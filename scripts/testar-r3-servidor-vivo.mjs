// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As partes B e C da prova do servidor do chat separado (scripts/testar-r3-servidor.mjs chama isto quando há CHAT_URL; quem sobe o
// servidor em contêiner e passa as variáveis é scripts/r3-servidor-conteiner.mjs).
//   B. O aparelho de sempre (lib/rede/caixas/cliente.ts, lib/rede/caixas/pedidos.ts, lib/rede/passes/cliente.ts), só com o transporte
//      trocado pelo adaptador do chat separado (fetchDoChat): as mesmas rotas e o mesmo JSON da R2 contra o servidor em Rust. Passes RSA
//      emitidos como o site emite e conferidos lá só com a chave PÚBLICA (repetido, de outra chave, com contexto, adulterado:
//      recusados; o da semana passada vale). A prova de trabalho. O cofre anônimo. A franquia pela interface (token errado recusado).
//   C. O aceite do 3.1: um administrador da rede social com a chave de serviço e o banco inteiro da rede (a) não acha nenhuma linha do
//      chat no banco da rede; (b) não tem credencial nenhuma do servidor do chat (JWT de serviço e cookie recusados); (c) não apaga nada
//      sem o passe de leitura da caixa. E o contêiner como pedido (só leitura, sem capacidades, sem porta, rede interna).
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

export async function testarVivo({ URL_CHAT, ok, espera, recusa }) {
  const inst = JSON.parse(process.env.CHAT_TESTE_INSTANCIA ?? "{}");
  const TOKEN = process.env.CHAT_INTERFACE_TOKEN ?? "";
  const sorteio = (n) => new Uint8Array(crypto.randomBytes(n));
  const b64u = (b) => Buffer.from(b).toString("base64url");
  const hex = (b) => Buffer.from(b).toString("hex");

  // ── O aparelho: armazenamento em memória e o transporte com o adaptador do chat separado ───────────────────────────────
  const guardado = new Map();
  globalThis.localStorage = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) };
  const { configurarTransporte } = await import("../lib/rede/caixas/transporte.ts");
  const { fetchDoChat } = await import("../lib/rede/caixas/servidor-do-chat.ts");
  const cliente = await import("../lib/rede/caixas/cliente.ts");
  const { depositarPedido } = await import("../lib/rede/caixas/pedidos.ts");
  const { TAMANHOS_DUPLA, TAMANHO_PEDIDO } = await import("../lib/rede/caixas/tamanhos.ts");
  const { resolverProva } = await import("../lib/rede/caixas/prova.ts");
  const { conferirMarcasNoChat } = await import("../lib/rede/caixas/franquia-servidor.ts");
  const comum = await import("../lib/rede/passes/comum.ts");
  const S = await import("../lib/rede/passes/servidor.ts");
  const passesDoAparelho = await import("../lib/rede/passes/cliente.ts");
  const { publicVerif, genericBatched, TokenChallenge } = await import("@cloudflare/privacypass-ts");

  // O "site" do teste: só o diretório (a caixa de pedidos da Bia) responde aqui; as caixas vão ao servidor do chat pelo adaptador.
  const vistos = [];
  let diretorioDaBia = null;
  const site = async (url, init) => {
    vistos.push({ url: String(url), init });
    if (String(url) === "/api/alumia/diretorio/ler") return diretorioDaBia ? Response.json({ conta: diretorioDaBia }) : Response.json({ ok: false }, { status: 404 });
    return globalThis.fetch(url, init);
  };
  configurarTransporte({ fetch: fetchDoChat(URL_CHAT, site), base: "" });

  // ── Os passes: emitidos com as chaves sorteadas pela rodada (as mesmas que a rede de teste publica) ──────────────────────────
  const SEGREDO = "segredo-dos-passes-so-deste-teste-com-32+"; // gitleaks:allow (valor de teste)
  const vazio = new Uint8Array(0);
  const chaves = {};
  for (const [semana, c] of Object.entries(inst.chaves ?? {})) {
    const publica = new Uint8Array(Buffer.from(c.publica, "base64url"));
    const pkcs8 = new Uint8Array(Buffer.from(c.pkcs8, "base64url"));
    const banco = { ler: async () => ({ publica, privadaSelada: S.selarPrivada(SEGREDO, Number(semana), vazio, publica, pkcs8), seq: 1 }), guardar: async () => { throw new Error("x"); } };
    chaves[semana] = await S.chaveDoEmissor(Number(semana), vazio, banco, SEGREDO, false);
  }
  const hoje = comum.semanaDe();
  // A emissão é em lote de 30 (como a rota do site); os passes sobrando ficam numa fila por chave e desafio.
  const filas = new Map();
  async function loteDe(chave, desafioDoPasse) {
    const cls = Array.from({ length: comum.PASSES_POR_DIA }, () => new publicVerif.Client(comum.MODO));
    const reqs = [];
    for (const cl of cls) reqs.push(new genericBatched.TokenRequest(await cl.createTokenRequest(desafioDoPasse, chave.publica)));
    const r = new genericBatched.Client().deserializeTokenResponse(await S.emitirLote(new genericBatched.Client().createTokenRequest(reqs).serialize(), chave));
    const saida = [];
    for (let i = 0; i < cls.length; i++) saida.push(comum.cabecalhoDoPasse(b64u((await cls[i].finalize(r.tokenResponses[i].tokenResponse)).serialize())));
    return saida;
  }
  async function passe(chave = chaves[hoje], desafioDoPasse = comum.desafio()) {
    const nome = `${chave.semana}|${b64u(desafioDoPasse.serialize())}`;
    if (!filas.get(nome)?.length) filas.set(nome, await loteDe(chave, desafioDoPasse));
    return filas.get(nome).shift();
  }
  ok("VIVO: as chaves da semana e da anterior estão prontas", !!chaves[hoje] && !!chaves[hoje - 1]);
  // O aparelho guarda 30 passes da semana (como depois de garantirPasses).
  const lote = (await loteDe(chaves[hoje], comum.desafio())).map((c) => c.replace(/^PrivateToken token="|"$/g, ""));
  guardado.set("alumia-passes-r2", JSON.stringify({ porSemana: { [hoje]: lote }, pegouEm: new Date().toISOString().slice(0, 10), urnas: {} }));
  ok("VIVO: o aparelho tem os 30 passes", passesDoAparelho.passesGuardados() === 30);

  const cru = async (rota, corpo, cab = {}) => {
    const r = await fetch(`${URL_CHAT}${rota}`, { method: corpo === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...cab }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    return { status: r.status, corpo: await r.json().catch(() => null), cabecalhos: r.headers };
  };
  const envelope = (n = TAMANHOS_DUPLA[0]) => sorteio(n);

  // ═══════════════════ B. As mesmas rotas e o mesmo JSON, pelo cliente de sempre ═══════════════════
  const saude = await cru("/saude");
  ok("VIVO: /saude responde, sem cache", saude.status === 200 && /no-store/.test(saude.cabecalhos.get("cache-control") ?? ""));
  const bia = cliente.novaCaixa(false);
  await espera("VIVO: criar a caixa (gasta um passe, conferido só com a chave pública)", () => cliente.criar(bia));
  ok("VIVO: o passe saiu do aparelho", passesDoAparelho.passesGuardados() === 29);
  await espera("VIVO: criar de novo a mesma caixa: ok (idempotente)", () => cliente.criar(bia));
  const env1 = envelope();
  const franquia = sorteio(32);
  const dep = await espera("VIVO: depositar (com a franquia: volta a marca e o dia)", () => cliente.depositar(bia, env1, franquia), (r) => r.ok && r.marca?.length === 32 && /^\d{4}-\d{2}-\d{2}$/.test(r.dia));
  const lidos = await espera("VIVO: buscar devolve o pacote, igual", () => cliente.buscar(bia, 0), (p) => p.length === 1 && hex(p[0].envelope) === hex(env1) && hex(p[0].franquia) === hex(franquia));
  ok("VIVO: só caixa do aparelho de sempre: nada foi ao site além do diretório", vistos.every((v) => v.url.startsWith(URL_CHAT) || v.url === "/api/alumia/diretorio/ler"));
  ok("VIVO: e as chamadas ao chat vão sem cookie e sem referência", vistos.filter((v) => v.url.startsWith(URL_CHAT)).every((v) => v.init.credentials === "omit" && v.init.referrerPolicy === "no-referrer"));
  ok("VIVO: tamanho fora da lista: recusado no aparelho", (await cliente.depositar(bia, sorteio(1000))).erro === "tamanho");
  ok("VIVO: e no servidor", (await cru("/caixa/lote", { itens: [{ acao: "depositar", id: b64u(bia.id), pd: b64u(bia.pd), envelope: b64u(sorteio(1000)) }] })).corpo?.erro === "tamanho");

  // A franquia pela interface (a pergunta da rede social).
  if (dep?.ok && lidos?.length) {
    const { resumoDaCaixa, resumoDoPasseDeDeposito } = await import("../lib/rede/franquia/protocolo.ts");
    const m = { c: franquia, idH: resumoDaCaixa(bia.id), pdH: resumoDoPasseDeDeposito(bia.pd), dia: dep.dia, marca: dep.marca };
    const chat = { endereco: URL_CHAT, token: TOKEN };
    const torta = { ...m, marca: Uint8Array.from(m.marca, (b, i) => (i === 0 ? b ^ 1 : b)) };
    const r = await conferirMarcasNoChat([m, torta], chat);
    ok("VIVO: a franquia: a marca do depósito confere pela interface; a adulterada não", r?.size === 1 && [...r][0].startsWith(b64u(m.c)), JSON.stringify(r && [...r]));
    ok("VIVO: token errado: recusado (e a rota diria sem_servico)", (await conferirMarcasNoChat([m], { endereco: URL_CHAT, token: "x".repeat(40) })) === null);
    const semToken = await cru("/interno/franquia/conferir", { marcas: [] });
    ok("VIVO: sem token: 401", semToken.status === 401);
  }

  await espera("VIVO: confirmar tira o pacote (caixa de um leitor)", async () => { await cliente.confirmar(bia, lidos?.[0]?.ordem ?? 1); return cliente.buscar(bia, 0); }, (p) => p.length === 0);

  // Bloqueio: o passe de depósito velho para; quem foi bloqueado ouve "ok" e nada chega.
  const pdNovo = sorteio(32);
  await espera("VIVO: trocar o passe de depósito com bloqueio", () => cliente.trocar(bia, { pd: pdNovo }, true));
  ok("VIVO: depósito com o passe bloqueado responde ok, igual ao certo", (await cliente.depositar(bia, envelope())).ok === true);
  ok("VIVO: e nada chega", (await cliente.buscar(bia, 0)).length === 0);
  ok("VIVO: com o passe novo chega", (await cliente.depositar({ id: bia.id, pd: pdNovo }, envelope())).ok === true && (await cliente.buscar(bia, 0)).length === 1);

  // Passes: os ataques, direto na rota (o cliente de sempre nunca repete).
  const criarCru = (cab) => cru("/caixa/lote", { itens: [{ acao: "criar", id: b64u(sorteio(32)), pd_h: b64u(sorteio(32)), pl_h: b64u(sorteio(32)), multi: false }] }, cab);
  const umPasse = await passe();
  ok("VIVO: passe novo: cria", (await criarCru({ Authorization: umPasse })).corpo?.resultados?.[0]?.ok === true);
  const repetido = await criarCru({ Authorization: umPasse });
  ok("VIVO: ATAQUE passe repetido: recusado", repetido.corpo?.resultados?.[0]?.ok !== true, JSON.stringify(repetido.corpo));
  ok("VIVO: passe da semana passada (a chave anterior publicada): vale", (await criarCru({ Authorization: await passe(chaves[hoje - 1]) })).corpo?.resultados?.[0]?.ok === true);
  const par = await publicVerif.Issuer.generateKey(comum.MODO, { modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1) });
  const pubFora = await publicVerif.getPublicKeyBytes(par.publicKey);
  const clFora = new publicVerif.Client(comum.MODO);
  const reqFora = await clFora.createTokenRequest(comum.desafio(), pubFora);
  const passeFora = comum.cabecalhoDoPasse(b64u((await clFora.finalize(await new publicVerif.Issuer(comum.MODO, comum.EMISSOR, par.privateKey, par.publicKey).issue(reqFora))).serialize()));
  ok("VIVO: ATAQUE passe de uma chave que a rede não publicou (outra semana, ou dada só a uma pessoa): recusado", (await criarCru({ Authorization: passeFora })).corpo?.resultados?.[0]?.ok !== true);
  ok("VIVO: ATAQUE passe com contexto (de urna) usado como geral: recusado", (await criarCru({ Authorization: await passe(chaves[hoje], comum.desafio(sorteio(32))) })).corpo?.resultados?.[0]?.ok !== true);
  const bom = Buffer.from((await passe()).replace(/^PrivateToken token="|"$/g, ""), "base64url");
  let adulterados = 0;
  for (const i of [1, 10, 40, 80, 200, bom.length - 1]) {
    const t = Buffer.from(bom);
    t[i] ^= 1;
    if ((await criarCru({ Authorization: comum.cabecalhoDoPasse(t.toString("base64url")) })).corpo?.resultados?.[0]?.ok !== true) adulterados++;
  }
  ok("VIVO: ATAQUE passe adulterado em cada campo: recusado (6 de 6)", adulterados === 6, `${adulterados}/6`);
  const outroDesafio = new TokenChallenge(2, "outro.invalid", new Uint8Array(0), ["outro.invalid"]);
  const passeO = await passe(chaves[hoje], outroDesafio);
  ok("VIVO: ATAQUE passe da chave certa com o desafio de outro emissor: recusado", (await criarCru({ Authorization: passeO })).corpo?.resultados?.[0]?.ok !== true);
  ok("VIVO: sem passe e sem prova: recusado", (await criarCru({})).corpo?.resultados?.[0]?.ok !== true);

  // O pedido de conversa (pedidos.ts no modo separado: diretório no site, caixa de pedidos no chat, desafio do chat + passe).
  const pedidosDaBia = cliente.novaCaixa(false);
  const criarPedidos = await cru("/caixa/lote", { itens: [{ acao: "criar", id: b64u(pedidosDaBia.id), pd_h: b64u(cliente.resumoDoPasseDeDeposito(pedidosDaBia.pd)), pl_h: b64u(cliente.resumoDoPasseDeLeitura(pedidosDaBia.pl)), multi: false, pedidos: true }] }, { Authorization: await passe() });
  ok("VIVO: a caixa de pedidos da Bia (pedidos: true)", criarPedidos.corpo?.resultados?.[0]?.ok === true, JSON.stringify(criarPedidos.corpo));
  diretorioDaBia = { pedidos_caixa: b64u(pedidosDaBia.id), pedidos_pd: b64u(pedidosDaBia.pd) };
  // lerConta pede a conta inteira; o teste monta uma com os tamanhos certos (o conteúdo das chaves não importa ao servidor do chat).
  Object.assign(diretorioDaBia, { usuario: "00000000-0000-4000-8000-00000000b1a0", identidade: b64u(sorteio(32)), pedidos_xwing: b64u(sorteio(1216)), pedidos_assinatura: b64u(sorteio(64)), aparelhos: [] });
  const pedido = sorteio(TAMANHO_PEDIDO);
  await espera("VIVO: depositarPedido (modo separado) chega à caixa de pedidos", () => depositarPedido("Bia Teste", pedido, URL_CHAT));
  ok("VIVO: e a Bia lê o pedido", (await cliente.buscar(pedidosDaBia, 0)).some((p) => hex(p.envelope) === hex(pedido)));
  ok("VIVO: um depósito comum na caixa de pedidos: recusado (só o item 'pedido')", (await cliente.depositar(pedidosDaBia, sorteio(TAMANHO_PEDIDO))).ok !== true && (await cliente.buscar(pedidosDaBia, 0)).length === 1);
  const desafio = await cru("/desafio");
  ok("VIVO: /desafio: 22 bits de fora, 20 com passe", desafio.corpo?.bits === 22 && desafio.corpo?.bits_com_passe === 20);
  {
    const d = new Uint8Array(Buffer.from(desafio.corpo.desafio, "base64url"));
    // Uma prova de 20 bits que NÃO tem 22 (acha uma, sem passe: a de fora pede 22).
    let n20 = null;
    for (let tentativa = 0; tentativa < 8 && !n20; tentativa++) {
      const n = await resolverProva(d, 20, 2 ** 26);
      const h = crypto.createHash("sha256").update(Buffer.concat([d, n])).digest();
      if ((h[2] & 0x0c) !== 0) n20 = n;
      else d.set(new Uint8Array(Buffer.from((await cru("/desafio")).corpo.desafio, "base64url")));
    }
    ok("VIVO: achou uma prova de 20 bits que não tem 22 (para o ataque abaixo)", n20 !== null);
    if (n20) {
      const r = await cru("/caixa/lote", { itens: [{ acao: "pedido", id: b64u(pedidosDaBia.id), pd: b64u(pedidosDaBia.pd), envelope: b64u(sorteio(TAMANHO_PEDIDO)), desafio: b64u(d), nonce: b64u(n20) }] });
      ok("VIVO: ATAQUE pedido sem passe com prova de 20 bits: recusado (de fora pede 22)", r.corpo?.erro === "prova" || r.corpo?.resultados?.[0]?.ok !== true, JSON.stringify(r.corpo));
    }
    const n22 = await resolverProva(d, 22);
    const corpo22 = { itens: [{ acao: "pedido", id: b64u(pedidosDaBia.id), pd: b64u(pedidosDaBia.pd), envelope: b64u(sorteio(TAMANHO_PEDIDO)), desafio: b64u(d), nonce: b64u(n22) }] };
    ok("VIVO: pedido sem passe com 22 bits (quem vem de fora): entra", (await cru("/caixa/lote", corpo22)).corpo?.resultados?.[0]?.ok === true);
    ok("VIVO: ATAQUE o mesmo desafio de novo: recusado (gasto)", (await cru("/caixa/lote", corpo22)).corpo?.resultados?.[0]?.ok !== true);
    const dTorto = Buffer.from(d);
    dTorto[30] ^= 1;
    ok("VIVO: ATAQUE desafio que não é do servidor: recusado", (await cru("/caixa/lote", { itens: [{ ...corpo22.itens[0], desafio: dTorto.toString("base64url") }] })).corpo?.erro === "prova");
  }

  // O cofre anônimo (a lista sincronizada fora da conta).
  const cofre = { id: sorteio(32), pd: sorteio(32), pl: sorteio(32) };
  const { resumo } = await import("../lib/rede/caixas/base.ts");
  // Os rótulos do cofre anônimo (alumia/r3/cofre-anonimo/{deposito,leitura}/v1) e o menor tamanho do cofre (o de interno.rede_cofre_tamanho_ok).
  const pdH = resumo("alumia/r3/cofre-anonimo/deposito/v1", cofre.pd), plH = resumo("alumia/r3/cofre-anonimo/leitura/v1", cofre.pl);
  const blob = sorteio(33 + 24 + 65536 + 17);
  const g0 = await cru("/cofre/gravar", { id: b64u(cofre.id), pd: b64u(cofre.pd), pd_h: b64u(pdH), pl_h: b64u(plH), versao: 0, blob: b64u(blob) }, { Authorization: await passe() });
  ok("VIVO: cofre: criar (versão 0, paga com passe)", g0.status === 200 && g0.corpo?.ok === true, JSON.stringify(g0.corpo));
  const lido = await cru("/cofre/ler", { id: b64u(cofre.id), pl: b64u(cofre.pl) });
  ok("VIVO: cofre: ler devolve o blob", lido.corpo?.cofre && Buffer.from(lido.corpo.cofre.blob, "base64").equals(Buffer.from(blob)), JSON.stringify(lido.corpo)?.slice(0, 200));
  ok("VIVO: cofre: passe de leitura errado não lê", (await cru("/cofre/ler", { id: b64u(cofre.id), pl: b64u(sorteio(32)) })).corpo?.cofre == null);
  ok("VIVO: cofre: versão repetida = conflito (dois aparelhos)", (await cru("/cofre/gravar", { id: b64u(cofre.id), pd: b64u(cofre.pd), versao: 0, blob: b64u(blob) }, { Authorization: await passe() })).status !== 200);

  // ═══════════════════ C. O aceite do 3.1: o administrador da rede social ═══════════════════
  // (b) Nenhuma credencial da rede abre o chat: o JWT de serviço (Bearer) e o cookie de sessão são recusados em toda rota.
  const jwtDeServico = `${b64u(Buffer.from('{"alg":"HS256","typ":"JWT"}'))}.${b64u(Buffer.from('{"role":"service_role","iss":"supabase"}'))}.${b64u(sorteio(32))}`;
  const rotas = ["/caixa/lote", "/caixa/buscar", "/caixa/confirmar", "/caixa/trocar", "/caixa/apagar", "/cofre/ler", "/cofre/gravar", "/cofre/apagar"];
  let recusadas = 0;
  for (const r of rotas) {
    const comJwt = await cru(r, { id: b64u(bia.id), pl: b64u(bia.pl) }, { Authorization: `Bearer ${jwtDeServico}`, apikey: jwtDeServico });
    const comCookie = await cru(r, { id: b64u(bia.id), pl: b64u(bia.pl) }, { Cookie: `sb-access-token=${jwtDeServico}` });
    if (comJwt.status === 400 && comJwt.corpo?.erro === "sem_sessao_aqui" && comCookie.status === 400 && comCookie.corpo?.erro === "sem_sessao_aqui") recusadas++;
  }
  ok("ACEITE (b): o JWT de serviço e o cookie da rede são recusados em todas as rotas das caixas e do cofre", recusadas === rotas.length, `${recusadas}/${rotas.length}`);
  ok("ACEITE (b): e na interface da franquia", (await cru("/interno/franquia/conferir", { marcas: [] }, { Authorization: `Bearer ${jwtDeServico}` })).status === 401);
  // (c) Sem o passe de leitura, nada se apaga (a resposta é igual; a caixa continua).
  const antes = (await cliente.buscar(bia, 0)).length;
  await cru("/caixa/apagar", { id: b64u(bia.id), pl: b64u(sorteio(32)) });
  await cru("/cofre/apagar", { id: b64u(cofre.id), pl: b64u(sorteio(32)) });
  ok("ACEITE (c): apagar sem o passe de leitura não apaga a caixa", antes === 1 && (await cliente.buscar(bia, 0)).length === 1);
  ok("ACEITE (c): nem o cofre", (await cru("/cofre/ler", { id: b64u(cofre.id), pl: b64u(cofre.pl) })).corpo?.cofre != null);
  // (a) O banco inteiro da rede social (o install.sql com as migrações da onda) não tem linha nenhuma do chat desta conversa.
  {
    const { criarBanco } = await import("./banco-local.mjs");
    const banco = await criarBanco();
    const procurar = [bia.id, bia.pl, bia.pd, cliente.idDaCaixaNoBanco(bia.id), cliente.idDaCaixaNoBanco(pedidosDaBia.id), env1.subarray(0, 32), pedido.subarray(0, 32)].map(hex);
    const tabelas = (await banco.dono("select table_schema || '.' || table_name as t from information_schema.tables where table_schema in ('interno', 'public') and table_type = 'BASE TABLE'")).rows.map((r) => r.t);
    let achou = 0, linhas = 0;
    for (const t of tabelas) {
      const rs = (await banco.dono(`select t::text as x from ${t} t`)).rows;
      linhas += rs.length;
      for (const r of rs) if (procurar.some((p) => r.x.includes(p) || r.x.includes(Buffer.from(p, "hex").toString("base64")))) achou++;
    }
    ok(`ACEITE (a): nenhuma das ${tabelas.length} tabelas da rede (${linhas} linhas) tem caixa, passe ou pacote desta conversa`, achou === 0 && tabelas.length > 50, `${achou} achados`);
    const caixasDaRede = (await banco.dono("select count(*)::int as n from interno.caixas")).rows[0]?.n;
    ok("ACEITE (a): as caixas do banco da rede ficaram vazias (a conversa foi toda ao servidor do chat)", caixasDaRede === 0, String(caixasDaRede));
    await banco.pg.close();
  }
  // O que o servidor do chat guarda, lido pelo DONO do banco do chat (que o administrador da rede não tem): sem conta, sem hora, sem IP.
  if (process.env.R3_VPS && inst.banco) {
    const psql = (sql) => execFileSync("ssh", ["-o", "BatchMode=yes", process.env.R3_VPS, `docker exec -i ${inst.banco} psql -At -U postgres -d chat`], { input: sql, encoding: "utf8" });
    const colunas = psql("select table_name || '.' || column_name || ':' || data_type from information_schema.columns where table_schema = 'chat' order by 1;").trim().split("\n");
    ok("VIVO: o banco do chat não tem coluna de conta, de hora ou de endereço", colunas.length > 5 && colunas.every((c) => !/:(uuid|timestamp|inet)|\.(usuario|conta|autor|ip|endereco|criad)[a-z_]*:/.test(c)), colunas.join(" "));
    const tudo = psql("select coalesce((select json_agg(c)::text from chat.caixas c), '') || coalesce((select json_agg(c)::text from chat.cofres c), '');");
    ok("VIVO: o id cru e os passes crus não estão no banco do chat", ![bia.id, bia.pl, bia.pd, pdNovo, cofre.id, cofre.pl, cofre.pd].some((x) => tudo.includes(hex(x))));
    const papeis = psql("select string_agg(privilege_type, ',') from information_schema.role_table_grants where grantee = 'chat_servidor';").trim();
    ok("VIVO: o papel do servidor não lê tabela nenhuma (só executa as funções)", papeis === "", papeis);
  }
  // O contêiner como pedido.
  const L = inst.limites ?? {};
  ok("CONTÊINER: sistema de arquivos só de leitura (e escrever foi recusado)", L.so_leitura === true && L.escrever_no_disco === "recusado", JSON.stringify(L));
  ok("CONTÊINER: sem capacidade nenhuma do kernel e sem ganhar privilégio", L.sem_capacidades === true && L.sem_novos_privilegios === true);
  ok("CONTÊINER: usuário sem privilégios", L.usuario === "10001:10001");
  ok("CONTÊINER: sem porta publicada, numa rede interna, sem saída para a internet", L.sem_porta_publicada === true && L.rede_interna === true && L.sair_para_a_internet === "sem_saida");
  void recusa;
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A junção da onda R2 de ponta a ponta: o chat a dois (lib/rede/chat/r2/servico.ts, com o motor de verdade) falando com as caixas
// anônimas DE VERDADE pelo adaptador da junção (lib/rede/chat/r2/transporte-das-caixas.ts → lib/rede/caixas/* → as rotas
// app/api/alumia/{caixa,pedido,diretorio,passes}/*, chamadas direto, sem servidor → um PostgREST de mentira na memória → o banco
// local, PGlite, com o install.sql inteiro da versão 15). Antes, a conversa a dois só tinha sido provada contra um servidor de caixas
// em memória, e as caixas só contra pacotes de mentira. Aqui:
//   - a Ana e a Bia ativam o chat (o banco cria a caixa de pedidos na publicação da conta), a Ana pede conversa, a Bia aceita, as duas
//     trocam mensagens e a Bia bloqueia (o depósito da Ana continua "ok" e nada chega);
//   - com o banco inteiro, nenhuma linha das caixas, dos pacotes ou dos passes tem a conta de alguém, e o id cru das caixas não está lá;
//   - a chave de voto de uma guardiã continua no diretório quando ela publica a conta de novo (outro aparelho) com a mesma identidade;
//   - o "Sair rápido" leva os passes anônimos e as caixas de cobertura (chaves que não começam com "lucia").
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r2-juncao.mjs   (npm run testar:r2-juncao)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { motorNoNode } from "./cifra-no-node.mjs";
import { spqrNoNode } from "./spqr-no-node.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor, (k, v) => (v instanceof Uint8Array ? `<${v.length} bytes>` : v))?.slice(0, 300)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.code ?? erro.message}`);
    return undefined;
  }
}

// O PostgREST de mentira sobe ANTES de importar os módulos do site (eles leem o endereço do banco ao carregar).
const SERVICO = "chave-de-servico-de-teste"; // gitleaks:allow (valor de teste)
const ANON = "chave-publica-de-teste"; // gitleaks:allow (valor de teste)
let rpcComo = null;
const servidorFalso = http.createServer(async (req, res) => {
  let corpo = "";
  for await (const pedaco of req) corpo += pedaco;
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/auth/v1/user") {
    if (bearer?.startsWith("conta.")) return res.end(JSON.stringify({ id: bearer.slice(6), email_confirmed_at: "2026-01-01" }));
    res.statusCode = 401;
    return res.end("{}");
  }
  const m = /^\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(req.url ?? "");
  if (!m) {
    res.statusCode = 404;
    return res.end("{}");
  }
  try {
    res.end(JSON.stringify(await rpcComo(bearer, m[1], corpo ? JSON.parse(corpo) : {})));
  } catch (erro) {
    if (process.env.DEPURA) console.log("DEPURA", m[1], erro.message);
    res.statusCode = /permission denied/.test(erro.message) ? 401 : 400;
    res.end(JSON.stringify({ message: erro.message }));
  }
});
await new Promise((r) => servidorFalso.listen(0, "127.0.0.1", r));
const SUPA = `http://127.0.0.1:${servidorFalso.address().port}`;
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPA,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
  SUPABASE_SERVICE_ROLE_KEY: SERVICO,
  ALUMIA_PASSES_SEGREDO: "segredo-dos-passes-de-teste-com-mais-de-32", // gitleaks:allow (valor de teste)
  ALUMIA_FRANQUIA_SEGREDO: "segredo-da-franquia-de-teste-com-mais-de-32", // gitleaks:allow (valor de teste)
});

// ═══════════════════ 1. O banco da versão 15 e o PostgREST de mentira ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario } = banco;
// Desde a R3 (20261125-r3-fim.sql) o install.sql está na versão 16; a junção da R2 continua valendo por cima dela.
await espera("o install.sql da junção responde a versão da R2 ou depois", async () => (await dono("select public.rede_alumia_versao() as v")).rows[0].v, (v) => v >= 15);
const agoraS = () => Math.floor(Date.now() / 1000);
const sessoes = new Map();
rpcComo = (bearer, funcao, argumentos) =>
  banco.exclusivo(async () => {
    let claims;
    if (bearer === SERVICO) claims = { role: "service_role" };
    else if (bearer?.startsWith("conta.")) claims = { role: "authenticated", sub: bearer.slice(6), aal: "aal2", session_id: sessoes.get(bearer.slice(6)), iat: agoraS() - 30, exp: agoraS() + 3600 };
    else claims = { role: "anon" };
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [JSON.stringify(claims)]);
    await banco.pg.exec(`set role ${claims.role}`);
    try {
      const nomes = Object.keys(argumentos);
      const valores = nomes.map((n) => {
        const v = argumentos[n];
        if (typeof v === "string" && /^\\x[0-9a-f]*$/i.test(v)) return Buffer.from(v.slice(2), "hex");
        return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
      });
      const r = (await banco.pg.query(`select public.${funcao}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`, valores)).rows[0]?.r ?? null;
      // Como o PostgREST: bytea sai como "\x" + hexadecimal.
      return JSON.parse(JSON.stringify(r, (k, v) => (v?.type === "Buffer" && Array.isArray(v.data) ? `\\x${Buffer.from(v.data).toString("hex")}` : v)));
    } finally {
      await banco.pg.exec("reset role");
    }
  });
const guardado = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) },
});
const ROTAS = {};
for (const r of ["caixa/lote", "caixa/buscar", "caixa/confirmar", "caixa/trocar", "caixa/apagar", "pedido", "pedido/desafio", "diretorio/ler", "diretorio/reivindicar", "passes/chave", "passes/emitir"]) {
  ROTAS[`/api/alumia/${r}`] = await import(`../app/api/alumia/${r}/route.ts`);
}
const vistos = [];
const fetchDoAparelho = async (url, init = {}) => {
  const caminho = String(url);
  const modulo = ROTAS[caminho];
  if (!modulo) throw new Error(`rota desconhecida ${caminho}`);
  vistos.push({ caminho, credenciais: init.credentials, autorizacao: new Headers(init.headers).get("authorization") ?? "" });
  return modulo[init.method === "GET" ? "GET" : "POST"](new Request(`http://alumia.test${caminho}`, init));
};
let contaAtual = null;
const { configurarTransporte } = await import("../lib/rede/caixas/transporte.ts");
configurarTransporte({
  fetch: fetchDoAparelho,
  base: "",
  tokenDaConta: async () => (contaAtual ? `conta.${contaAtual}` : null),
  rpcComSessao: async (funcao, argumentos) => {
    const r = await fetch(`${SUPA}/rest/v1/rpc/${funcao}`, { method: "POST", headers: { Authorization: `Bearer ${contaAtual ? `conta.${contaAtual}` : ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(argumentos) });
    const corpo = await r.json();
    if (!r.ok) throw Object.assign(new Error(corpo.message), { code: corpo.message });
    return corpo;
  },
});

// As pessoas (aprovadas, com codinome).
const P = {};
for (const nome of ["ana", "bia"]) {
  P[nome] = await criarUsuario(`${nome}@r2j.local`, `Pessoa ${nome}`);
  sessoes.set(P[nome], crypto.randomUUID());
  await rpcComo(`conta.${P[nome]}`, "eu", {}).catch(() => undefined);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["ana", "bia"]) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `r2j_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("select interno.alumia_entrada_ligar(true)");
await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'aprovada'), ($2, 'aprovada') on conflict (usuario) do update set situacao = 'aprovada'", [P.ana, P.bia]);

// ═══════════════════ 2. O chat a dois sobre as caixas de verdade ═══════════════════
const { transporteDasCaixas } = await import("../lib/rede/chat/r2/transporte-das-caixas.ts");
const { ChatDoAparelho } = await import("../lib/rede/chat/r2/servico.ts");
const { cofreDaLista } = await import("../lib/rede/aparelhos/sincronia.ts");
const { resumoDaCaixa, resumoDoPasse } = await import("../lib/rede/chat/r2/conversa.ts");
const cliente = await import("../lib/rede/caixas/cliente.ts");
const M = await motorNoNode();
const SPQR = await spqrNoNode();

ok("contrato: o resumo da caixa da conversa a dois é o mesmo do banco das caixas", (() => {
  const id = crypto.randomBytes(32);
  return Buffer.from(resumoDaCaixa(id)).equals(Buffer.from(cliente.idDaCaixaNoBanco(id)));
})());
ok("contrato: o resumo do passe de depósito também", (() => {
  const pd = crypto.randomBytes(32);
  return Buffer.from(resumoDoPasse(pd)).equals(Buffer.from(cliente.resumoDoPasseDeDeposito(pd)));
})());

/** Um aparelho: o motor, o histórico em memória e o transporte da junção. Cada chamada roda "como" a conta dona do aparelho. */
async function aparelho(usuario, codinome) {
  const historico = [];
  const deps = {
    motor: M.CoreCrypto.new(M.Database.inMemory()),
    spqr: SPQR,
    transporte: transporteDasCaixas(),
    historico: {
      async guardar(m) {
        if (!historico.some((x) => x.id === m.id && x.conversa === m.conversa)) historico.push(m);
      },
      async apagar() {},
      async apagarConversa() {},
    },
    cofre: cofreDaLista,
    persistir: async () => undefined,
    sigo: async () => false,
    conferirRegistro: async () => "confere",
  };
  contaAtual = usuario;
  const chat = await ChatDoAparelho.nascer(deps, usuario, codinome);
  return {
    chat,
    historico,
    como: async (fazer) => {
      contaAtual = usuario;
      try {
        return await fazer(chat);
      } finally {
        contaAtual = null;
      }
    },
  };
}

const A = await espera("a Ana ativa o chat: passes, caixa de sincronia, a conta e o aparelho no diretório", () => aparelho(P.ana, "Codinome ana"));
const B = await espera("a Bia também", () => aparelho(P.bia, "Codinome bia"));
if (!A || !B) {
  console.log(`${certos} certos, ${falhas.length} falhas`);
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
await espera("o banco criou a caixa de pedidos da Bia na publicação da conta", async () =>
  (await dono("select count(*)::int as n from interno.caixas c join interno.diretorio_contas d on c.id_h = interno.caixa_resumo('alumia/r2/caixa', d.pedidos_caixa) where d.usuario = $1", [P.bia])).rows[0].n,
(n) => n === 1);

const conv = await espera("a Ana pede conversa à Bia (diretório sem sessão, prova de trabalho e passe)", () => A.como((c) => c.pedirConversa("Codinome bia", "oi, é a Ana")));
await espera("a Bia recebe o pedido pela caixa de pedidos", () => B.como((c) => c.receberPedidos()), (n) => n === 1);
await espera("a Bia aceita (reivindica a pré-chave da Ana com passe, cria a caixa dela)", () => B.como((c) => c.aceitar(conv)));
await espera("a Ana recebe o aceite", () => A.como((c) => c.receber()));
ok("a conversa abre para a Ana", A.chat.estado.lista.conversas[conv]?.situacao === "aberta", A.chat.estado.lista.conversas[conv]?.situacao);
await B.como((c) => c.receber());
const m1 = await espera("a Ana manda uma mensagem", () => A.como((c) => c.mandarTexto(conv, "Ato sábado às 10h.")), (r) => r.entregues >= 1);
await espera("a Bia lê", async () => (await B.como((c) => c.receber()), B.historico.filter((m) => m.conversa === conv).map((m) => m.texto)), (l) => l.includes("Ato sábado às 10h."));
await espera("a Bia responde e a Ana lê", async () => {
  await B.como((c) => c.mandarTexto(conv, "Combinado.", { resposta: m1?.id }));
  await A.como((c) => c.receber());
  return A.historico.filter((m) => m.conversa === conv).map((m) => m.texto);
}, (l) => l.includes("Combinado."));

// ═══════════════════ 2b. A denúncia com prova de uma mensagem do chat ═══════════════════
{
  const fq = await import("../lib/rede/franquia/protocolo.ts");
  const rota = await import("../app/api/alumia/franquia/denunciar/route.ts");
  const daAna = B.historico.find((m) => m.conversa === conv && m.texto === "Ato sábado às 10h.");
  ok("a mensagem que a Bia recebeu traz a prova da franquia (caixa, dia, compromisso, marca do servidor, kf e conteúdo)", fq.provaInteira(daAna?.prova));
  ok("a cópia do que a própria pessoa escreveu não vira prova", A.historico.filter((m) => m.conversa === conv && m.autor === P.ana).every((m) => !m.prova));
  const denunciar = async (corpo, conta = P.bia) =>
    (await rota.POST(new Request("http://alumia.test/api/alumia/franquia/denunciar", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer conta.${conta}` }, body: JSON.stringify(corpo) }))).json();
  const r = await denunciar({ categoria: "ameaca", autor: "r2j_ana", trechos: [{ texto: "Ato sábado", prova: daAna?.prova }] });
  ok("a Bia denuncia o trecho com a prova, e o servidor confere (franquia da conversa a dois = a da denúncia)", r?.ok === true, JSON.stringify(r));
  const r2 = await denunciar({ categoria: "ameaca", autor: "r2j_ana", trechos: [{ texto: "Ato domingo", prova: daAna?.prova }] });
  ok("trecho que não estava na mensagem: recusado", r2?.motivo === "prova_nao_confere", JSON.stringify(r2));
}

// ═══════════════════ 3. O bloqueio pelas caixas ═══════════════════
await espera("a Bia bloqueia a Ana (troca o passe de depósito da caixa dela, sem dizer)", () => B.como((c) => c.bloquear(P.ana)));
const depois = await espera("o depósito da Ana continua respondendo como se tivesse ido", () => A.como((c) => c.mandarTexto(conv, "depois do bloqueio")));
await espera("e nada chega à Bia", async () => (await B.como((c) => c.receber()), B.historico.filter((m) => m.conversa === conv).map((m) => m.texto)), (l) => !l.includes("depois do bloqueio"));
ok("(a Ana não sabe do bloqueio)", depois === undefined || typeof depois.entregues === "number");

// ═══════════════════ 4. Com o banco inteiro na mão ═══════════════════
{
  const tabelas = ["caixas", "pacotes", "caixa_contagem", "passes_gastos", "passes_emitidos"];
  const tudo = [];
  for (const t of tabelas) tudo.push(JSON.stringify((await dono(`select * from interno.${t}`)).rows));
  const texto = tudo.join("\n");
  ok("metadados: nenhuma linha das caixas, dos pacotes ou dos passes tem a conta da Ana ou da Bia", ![P.ana, P.bia].some((u) => texto.includes(u)));
  const cols = (await dono("select table_name, column_name from information_schema.columns where table_schema = 'interno' and table_name = any($1)", [tabelas])).rows;
  ok("metadados: nenhuma coluna de conta ou de hora nas tabelas das caixas e dos passes", !cols.some((c) => /usuario|conta|autor|quem|para|criado|_em$|hora/.test(c.column_name)), JSON.stringify(cols.filter((c) => /usuario|conta|autor|quem|para|criado|_em$|hora/.test(c.column_name))));
  const idCru = A.chat.estado.porConversa[conv]?.caixa?.id;
  ok("metadados: o id cru da caixa da conversa não está no banco (só o resumo)", typeof idCru === "string" && (await dono("select count(*)::int as n from interno.caixas where id_h = $1", [Buffer.from(idCru, "base64url")])).rows[0].n === 0);
  ok("o aparelho chamou as caixas sem credenciais e sem a sessão da conta", vistos.filter((v) => !/passes\/emitir/.test(v.caminho)).every((v) => v.credenciais === "omit" && !/^Bearer /.test(v.autorizacao)));
}

// ═══════════════════ 5. A chave de voto da guardiã continua no diretório ═══════════════════
{
  contaAtual = P.ana;
  const r = await rpcComo(`conta.${P.ana}`, "rede_voto_minha_chave", { p: { voto: Buffer.alloc(1216, 5).toString("base64"), assinatura: Buffer.alloc(64, 6).toString("base64") } }).catch((e) => e.message);
  ok("a Ana publica a chave de voto dela (guardiã)", r?.ok === true, JSON.stringify(r));
  const temChave = async () => (await dono("select voto_xwing is not null as tem from interno.diretorio_contas where usuario = $1", [P.ana])).rows[0]?.tem;
  ok("(está no diretório)", (await temChave()) === true);
  // Outro aparelho da Ana publica a conta de novo (mesma identidade), sem a chave de voto: ela fica.
  const A2 = await espera("a Ana liga um segundo aparelho com as chaves da conta", async () => {
    const chaves = A.chat.chavesDaConta();
    const de = (s) => Buffer.from(s, "base64url");
    const deps = { ...A.chat.d, motor: M.CoreCrypto.new(M.Database.inMemory()), transporte: transporteDasCaixas() };
    contaAtual = P.ana;
    return ChatDoAparelho.nascer(deps, P.ana, "Codinome ana", { identidade: de(chaves.identidade), pedidos: de(chaves.pedidos), sincronia: de(chaves.sincronia) });
  });
  ok("publicar a conta de novo com a mesma identidade não apaga a chave de voto", A2 !== undefined && (await temChave()) === true);
  await dono("select 1");
  // Identidade nova (a chave de voto foi assinada pela velha): sai.
  await espera("uma identidade nova publicada para a conta tira a chave de voto (assinada pela velha)", async () => {
    contaAtual = P.ana;
    const deps = { ...A.chat.d, motor: M.CoreCrypto.new(M.Database.inMemory()), transporte: transporteDasCaixas() };
    await ChatDoAparelho.nascer(deps, P.ana, "Codinome ana");
    return temChave();
  }, (t) => t === false);
}

// ═══════════════════ 5b. A credencial da voz (TURN) por passe anônimo, sem sessão ═══════════════════
{
  Object.assign(process.env, { VOZ_TURN_URLS: "turn:retransmissao.exemplo:3478", VOZ_TURN_SEGREDO: "segredo-do-turn-de-teste-com-mais-de-32-letras" }); // gitleaks:allow (valor de teste)
  const voz = await import("../app/api/alumia/voz/retransmissao/route.ts");
  const pedir = (cabecalhos) => voz.POST(new Request("http://alumia.test/api/alumia/voz/retransmissao", { method: "POST", headers: { "content-type": "application/json", ...cabecalhos }, body: "{}" }));
  const comSessao = await pedir({ authorization: `Bearer conta.${P.ana}` });
  ok("voz: com a sessão da conta, recusa (a sala não se liga a conta)", comSessao.status === 400 && (await comSessao.json()).erro === "sem_sessao_aqui");
  const semPasse = await pedir({});
  ok("voz: sem passe, recusa", semPasse.status === 401);
  const { gastarPasse } = await import("../lib/rede/passes/cliente.ts");
  contaAtual = P.ana;
  const passe = await gastarPasse();
  contaAtual = null;
  const certo = await pedir({ authorization: passe });
  const corpo = await certo.json();
  ok("voz: com um passe anônimo, a credencial do TURN sai", certo.status === 200 && Array.isArray(corpo.iceServers) && corpo.iceServers.length > 0, JSON.stringify(corpo).slice(0, 120));
  const deNovo = await pedir({ authorization: passe });
  ok("voz: o mesmo passe de novo, recusado", deNovo.status === 409 && (await deNovo.json()).erro === "passe_usado");
  ok("voz: o aparelho pede a credencial sem a sessão (credentials: omit) e com o passe", /credentials: "omit"/.test(ler("lib/rede/voz/navegador.ts")) && /gastarPasse\(\)/.test(ler("lib/rede/voz/navegador.ts")) && !/access_token/.test(ler("lib/rede/voz/navegador.ts").split("servidoresDeRetransmissao")[1]?.split("export async function entrarNaSalaDeVoz")[0] ?? ""));
}

// ═══════════════════ 6. O "Sair rápido" leva o que a R2 guarda fora das chaves "lucia" ═══════════════════
{
  const ms = await import("../lib/modo-seguro.ts");
  const guardadas = ["alumia-passes-r2", "alumia-passes-r2-vista", "alumia-cobertura-r2", "alumia-cobertura-r2-ligada", "lucia-sessao", "de-outro-site"];
  const falso = { length: guardadas.length, key: (i) => guardadas[i] };
  ok("Sair rápido: os passes anônimos, a vista do registro e as caixas de cobertura saem do aparelho (e o que não é do site fica)",
    JSON.stringify(ms.chavesParaApagar(falso).sort()) === JSON.stringify(["alumia-cobertura-r2", "alumia-cobertura-r2-ligada", "alumia-passes-r2", "alumia-passes-r2-vista", "lucia-sessao"]));
  // As bases do aparelho que a R2 abre (IndexedDB): todas na lista das conhecidas, para o navegador sem indexedDB.databases()
  // (antes, a da chave de voto da guardiã ficava de fora: o Sair rápido e o pânico não a apagavam nesse navegador).
  const bases = [];
  for (const arq of ["lib/rede/voto/guarda.ts", "lib/rede/chat/r2/loja.ts", "lib/rede/grupos/apagar.ts", "lib/rede/chat/historico.ts"]) {
    for (const m of ler(arq).matchAll(/(?:const|export const) [A-Z0-9_]+ = "(lucia-[a-z0-9-]+)";/g)) bases.push(m[1]);
  }
  ok("Sair rápido: as bases da R2 (chave de voto da guardiã, loja do chat, grupos, histórico) estão todas na lista das conhecidas",
    bases.includes("lucia-alumia-voto") && bases.includes("lucia-alumia-r2") && bases.length >= 4 && bases.every((b) => ms.BASES_CONHECIDAS.includes(b) && ms.basesParaApagar([b]).includes(b)), bases.join());
  ok("Sair rápido: a vista do registro dos passes é uma chave que a saída conhece", ler("lib/rede/passes/cliente.ts").includes('"alumia-passes-r2-vista"'));
  ok("Sair rápido: a pasta do motor de cifra no OPFS (conversa a dois, grupos e equipe) é a que o motor usa", ms.PASTA_DO_MOTOR === (await import("../lib/rede/chat/r2/loja.ts")).PASTA_DO_MOTOR);
}

servidorFalso.close();
console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);

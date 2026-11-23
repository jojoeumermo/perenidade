// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova os grupos com membros escondidos (lib/rede/membros) com o motor de verdade (@wireapp/core-crypto, OpenMLS, suíte 61442) e
// uma caixa anônima de memória que se comporta como a do banco (guarda só resumos de id e passes; depósito com passe errado
// responde "ok" e some; um depósito "único" por caixa). Os ataques estão escritos como teste:
//   - o servidor (tudo que a caixa de memória guardou) não acha identidade, credencial do MLS, GroupInfo nem commit às claras;
//   - commit de quem não é da mediação é ignorado; segundo commit na mesma época é recusado e quem perdeu acompanha o outro;
//   - quem saiu não tira a caixa nem lê a época seguinte;
//   - post p2 de outra época ou de outro grupo não abre; embrulho mexido ou de outra época não abre;
//   - lista de papéis forjada e apresentação de outra folha viram suspeita; a chave de entrada só chega a quem vira mediação;
//   - a voz sai com o autor certo (ninguém fala pelo outro); a contagem só aparece a partir de 3.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r2-membros.mjs
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { motorNoNode } from "./cifra-no-node.mjs";
import { SUITE_MLS } from "../lib/rede/cifra/motor.ts";
import { Grupo, TransporteDoMotor } from "../lib/rede/membros/grupo.ts";
import { ENVELOPES_DE_GRUPO, embrulhar, desembrulhar, TIPO } from "../lib/rede/membros/embrulho.ts";
import { ENVELOPE_DO_PEDIDO, abrirPedido, conferirEntrada, publicarEntrada, resumoDaGestao, selarPedido, novoParXWing } from "../lib/rede/membros/entrada.ts";
import { derivarSegredos, resumoDaCaixa } from "../lib/rede/membros/segredos.ts";
import { abrirPost, cifrarPost } from "../lib/rede/membros/post.ts";
import { apresentar, autorizar, novosPapeis, conferirCadeia, primeirosPapeis } from "../lib/rede/membros/papeis.ts";
import { LISTA_DE_ROTULOS } from "../lib/rede/membros/rotulos.ts";
import { juntar, paraB64, texto, u32 } from "../lib/rede/membros/bytes.ts";

let certos = 0;
const falhas = [];
function confere(nome, ok, detalhe = "") {
  if (ok) certos++;
  else falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`);
}
async function recusa(nome, promessa, codigo) {
  try {
    await promessa();
    falhas.push(`${nome}: deveria recusar e passou`);
  } catch (e) {
    if (!codigo || String(e?.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${e?.message}"`);
  }
}
const hex = (b) => Buffer.from(b).toString("hex");
const contem = (grande, pequeno) => pequeno.length > 0 && Buffer.from(grande).indexOf(Buffer.from(pequeno)) >= 0;

// ── A caixa anônima de memória (o "servidor"): só resumos, como o banco ─────────────────────────────────────────────────────
const H = (rotulo, b) => hex(sha256(juntar(texto(rotulo), b)));
const TAMANHOS_ACEITOS = new Set([...ENVELOPES_DE_GRUPO, ENVELOPE_DO_PEDIDO]);
const servidor = { caixas: new Map(), guardado: [] };
let bloquearBusca = null;
const transporte = {
  async criar(c) {
    const k = H("alumia/r2/caixa", c.id);
    const atual = servidor.caixas.get(k);
    const pd = H("alumia/r2/passe-deposito", c.pd);
    const pl = H("alumia/r2/passe-leitura", c.pl);
    if (atual) {
      if (atual.pd !== pd || atual.pl !== pl) throw new Error("caixa_outra");
      return;
    }
    servidor.caixas.set(k, { pd, pl, multi: c.multi, unicoFeito: false, proxima: 1, pacotes: [] });
    servidor.guardado.push(Buffer.from(k, "hex"), Buffer.from(pd, "hex"), Buffer.from(pl, "hex"));
  },
  async depositar(c, envelope, franquia, unico) {
    const cx = servidor.caixas.get(H("alumia/r2/caixa", c.id));
    if (!TAMANHOS_ACEITOS.has(envelope.length)) return { ok: false, erro: "tamanho" };
    if (!cx || cx.pd !== H("alumia/r2/passe-deposito", c.pd)) return { ok: true }; // não denuncia: some
    if (unico) {
      if (cx.unicoFeito) return { ok: false, erro: "ocupada" };
      cx.unicoFeito = true;
    }
    cx.pacotes.push({ ordem: cx.proxima++, envelope: new Uint8Array(envelope), franquia: null, marca: null, dia: "2026-11-24" });
    servidor.guardado.push(Buffer.from(envelope));
    return { ok: true };
  },
  async buscar(c, cursor) {
    if (bloquearBusca && bloquearBusca()) return [];
    const cx = servidor.caixas.get(H("alumia/r2/caixa", c.id));
    if (!cx || cx.pl !== H("alumia/r2/passe-leitura", c.pl)) return [];
    return cx.pacotes.filter((p) => p.ordem > cursor).slice(0, 50);
  },
};

// ── Os aparelhos ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const M = await motorNoNode();
const commitsVistos = [];
async function aparelho(nome) {
  const transporteDoMotor = new TransporteDoMotor(M);
  const espiao = {
    sendCommitBundle: async (b) => {
      commitsVistos.push({ commit: b.commit, info: b.groupInfo?.payload?.copyBytes?.() ?? null });
      return transporteDoMotor.sendCommitBundle(b);
    },
    prepareForTransport: (h) => transporteDoMotor.prepareForTransport(h),
  };
  const cc = M.CoreCrypto.new(M.Database.inMemory());
  const cliente = new M.ClientId(new M.Uuid(crypto.randomUUID()), new M.DeviceId(1n), "alumia.invalid");
  const ref = await cc.transaction(async (c) => {
    await c.mlsInit(cliente, espiao);
    return c.addCredential(M.Credential.basic(M.cipherSuiteFromU16(SUITE_MLS), cliente));
  });
  const { secretKey, publicKey } = ed25519.keygen();
  const identidade = { publica: publicKey, assinar: async (d) => ed25519.sign(d, secretKey) };
  return { nome, M, cc, ref, cliente, transporteDoMotor, identidade, transporte };
}
const [apAna, apBia, apCaio, apDani] = [await aparelho("ana"), await aparelho("bia"), await aparelho("caio"), await aparelho("dani")];
const id = (ap) => paraB64(ap.identidade.publica);
const cli = (ap) => paraB64(ap.cliente.copyBytes());

// ── Criar o núcleo e entrar pela caixa de entrada ──────────────────────────────────────────────────────────────────────────
const ana = await Grupo.criar(apAna, "grupo", true);
confere("quem cria é a mediação", ana.souMediacao() && ana.papeis.versao === 1);
const NUCLEO = "0b7c1e52-5d0c-4a63-9a43-5f2a6c1d9e10";
const pub = ana.publicacaoDaEntrada(NUCLEO);
confere("a entrada publicada tem caixa, passe de depósito, X-Wing (1216 bytes) e o resumo da gestão (não o passe)",
  pub && Buffer.from(pub.xwing, "base64url").length === 1216 && pub.gestao_h !== ana.entrada.gestao
    && pub.gestao_h === paraB64(resumoDaGestao(Buffer.from(ana.entrada.gestao, "base64url"))));
confere("a entrada pública confere pela chave de gestão do núcleo", conferirEntrada(NUCLEO, pub) && conferirEntrada(NUCLEO, pub, pub.chave));
// Ataque: o servidor troca a chave X-Wing da entrada pela dele (para ler quem pede para entrar).
const xwingDoServidor = paraB64((await novoParXWing()).publica);
confere("servidor troca a X-Wing da entrada: a assinatura não confere", !conferirEntrada(NUCLEO, { ...pub, xwing: xwingDoServidor }));
confere("servidor troca a caixa ou o passe da entrada: não confere", !conferirEntrada(NUCLEO, { ...pub, caixa: paraB64(new Uint8Array(32)) }) && !conferirEntrada(NUCLEO, { ...pub, pd: paraB64(new Uint8Array(32)) }));
confere("a entrada de um núcleo não serve a outro", !conferirEntrada("11111111-2222-4333-8444-555555555555", pub));
// Ataque: o servidor troca tudo, com a chave de gestão dele. Quem já viu a chave deste núcleo recusa; quem nunca viu, não tem como saber.
const falsa = publicarEntrada(NUCLEO, { ...ana.entrada, publica: xwingDoServidor, assinante: paraB64(new Uint8Array(32).fill(5)) });
confere("servidor troca a chave de gestão: quem já conhecia a chave recusa", conferirEntrada(NUCLEO, falsa) && !conferirEntrada(NUCLEO, falsa, pub.chave));

async function entrar(ap, textoCurto) {
  const { pedido, resposta } = await Grupo.montarPedido(ap, textoCurto);
  const envelope = await selarPedido(Buffer.from(pub.xwing, "base64url"), pedido);
  const r = await transporte.depositar({ id: Buffer.from(pub.caixa, "base64url"), pd: Buffer.from(pub.pd, "base64url") }, envelope);
  return { pedido, resposta, r, envelope };
}
const eBia = await entrar(apBia, "sou da escola de sábado");
const eCaio = await entrar(apCaio, "");
confere("o pedido tem o tamanho fixo", eBia.envelope.length === ENVELOPE_DO_PEDIDO && eCaio.envelope.length === ENVELOPE_DO_PEDIDO);
const pedidos = await ana.pedidosDeEntrada();
confere("a mediação lê os dois pedidos", pedidos.length === 2, String(pedidos.length));
confere("o pedido traz a identidade e o texto", pedidos.some((p) => hex(p.identidade) === hex(apBia.identidade.publica) && p.texto === "sou da escola de sábado"));
confere("o pedido não abre com outra chave", (await abrirPedido((await novoParXWing()).privada, eBia.envelope)) === null);
confere("pedido cortado não abre", (await abrirPedido(Buffer.from(ana.entrada.privada, "base64url"), eBia.envelope.slice(1))) === null);
const pBia = pedidos.find((p) => hex(p.identidade) === hex(apBia.identidade.publica));
const pCaio = pedidos.find((p) => hex(p.identidade) === hex(apCaio.identidade.publica));
confere("aceitar a bia", (await ana.aceitar(pBia)) === "aceito");
const bia = await Grupo.entrarPelaResposta(apBia, eBia.resposta, eBia.pedido.kr, "grupo");
confere("a bia entra pela resposta", bia !== null && hex(bia.id) === hex(ana.id));
confere("com 2 pessoas, nenhum número na tela", ana.contagemParaTela() === null);
confere("aceitar o caio", (await ana.aceitar(pCaio)) === "aceito");
const caio = await Grupo.entrarPelaResposta(apCaio, eCaio.resposta, eCaio.pedido.kr, "grupo");
confere("o caio entra", caio !== null);
await bia.receber();
await ana.receber();
confere("todos na mesma época", ana.epoca === bia.epoca && bia.epoca === caio.epoca, `${ana.epoca}/${bia.epoca}/${caio.epoca}`);
confere("a caixa da época é a mesma para todos", hex(ana.segredosDaEpoca().caixa.id) === hex(caio.segredosDaEpoca().caixa.id));
confere("com 3 pessoas, a contagem aparece", ana.contagemParaTela() === 3, String(ana.contagemParaTela()));
confere("a resposta errada (outra kr) não entra", (await Grupo.entrarPelaResposta(apDani, eCaio.resposta, new Uint8Array(32), "grupo")) === null);

await caio.mandarTexto("bom dia, núcleo");
await ana.receber();
await bia.receber();
const lida = bia.mensagens.find((m) => m.tipo === "texto");
confere("a bia lê o caio, com o autor certo", lida && Buffer.from(lida.corpo).toString() === "bom dia, núcleo" && lida.autor === id(apCaio));

// ── O que o servidor guardou ───────────────────────────────────────────────────────────────────────────────────────────────
const tudo = Buffer.concat(servidor.guardado);
confere("o servidor não guarda nenhuma identidade", ![apAna, apBia, apCaio].some((ap) => contem(tudo, ap.identidade.publica)));
confere("o servidor não guarda nenhuma credencial do MLS (ClientId)", ![apAna, apBia, apCaio].some((ap) => contem(tudo, ap.cliente.copyBytes())));
confere("o servidor não guarda o id do grupo", !contem(tudo, ana.id));
confere("nenhum commit vai às claras", commitsVistos.length >= 2 && commitsVistos.every((c) => !contem(tudo, c.commit.slice(0, 64))));
confere("a GroupInfo nunca sai do aparelho", commitsVistos.every((c) => !c.info || !contem(tudo, c.info.slice(0, 64))));
confere("o servidor não guarda o id cru nem os passes das caixas", !contem(tudo, ana.segredosDaEpoca().caixa.id) && !contem(tudo, ana.segredosDaEpoca().caixa.pl));
confere("todo envelope tem tamanho da lista", servidor.guardado.filter((b) => b.length > 32).every((b) => TAMANHOS_ACEITOS.has(b.length)));

// ── Commit de quem não é da mediação ──────────────────────────────────────────────────────────────────────────────────────
await recusa("o caio não remove pela função (sem papel)", () => caio.remover([cli(apBia)]), "sem_papel");
{
  // O caio forja: faz o commit na biblioteca e deposita com uma autorização dele mesmo, para "remover".
  const epocaAntes = ana.epoca;
  const s = caio.segredosDaEpoca();
  apCaio.transporteDoMotor.aoMandar = async (b) => {
    const a = await autorizar(apCaio.identidade, caio.id, s.epoca, "remover", b.commit);
    const aut = texto(JSON.stringify(a));
    const env = await embrulhar(s.embrulho, resumoDaCaixa(s.caixa.id), s.epoca, TIPO.commit, juntar(u32(aut.length), aut, b.commit));
    const r = await transporte.depositar(s.caixa, env, undefined, true);
    if (!r.ok) throw new M.MlsTransportError.MessageRejected({ reason: r.erro });
  };
  const alvo = (await apCaio.cc.transaction((c) => c.getClientIds(new M.ConversationId(caio.id)))).filter((c) => paraB64(c.copyBytes()) === cli(apBia));
  await apCaio.cc.transaction((c) => c.removeClientsFromConversation(new M.ConversationId(caio.id), alvo));
  apCaio.transporteDoMotor.aoMandar = null;
  await ana.receber();
  await bia.receber();
  confere("o commit forjado do caio é ignorado pela ana (sem papel)", ana.ignorados.includes("sem_papel") && ana.epoca === epocaAntes);
  confere("a bia continua no grupo", !bia.removido && bia.epoca === epocaAntes);
  // Limite (dito no desenho): o commit forjado ocupou o lugar único da época; ninguém mais faz commit nesta época.
  confere("limite: a época fica travada para commits (a mediação refaz o grupo)", (await ana.atualizar()) === "ocupada");
}

// ── Um grupo novo para o resto (o anterior ficou travado pelo caio, como o desenho prevê) ─────────────────────────────────────
const g2 = await Grupo.criar(apAna, "grupo", true);
const pub2 = g2.publicacaoDaEntrada(NUCLEO);
async function entrar2(ap) {
  const { pedido, resposta } = await Grupo.montarPedido(ap, "");
  await transporte.depositar({ id: Buffer.from(pub2.caixa, "base64url"), pd: Buffer.from(pub2.pd, "base64url") }, await selarPedido(Buffer.from(pub2.xwing, "base64url"), pedido));
  return { pedido, resposta };
}
const [e2b, e2c, e2d] = [await entrar2(apBia), await entrar2(apCaio), await entrar2(apDani)];
for (const p of await g2.pedidosDeEntrada()) await g2.aceitar(p);
const b2 = await Grupo.entrarPelaResposta(apBia, e2b.resposta, e2b.pedido.kr, "grupo");
const c2 = await Grupo.entrarPelaResposta(apCaio, e2c.resposta, e2c.pedido.kr, "grupo");
const d2 = await Grupo.entrarPelaResposta(apDani, e2d.resposta, e2d.pedido.kr, "grupo");
for (const g of [g2, b2, c2, d2]) await g.receber();
confere("quatro no grupo novo, na mesma época", [b2, c2, d2].every((g) => g && g.epoca === g2.epoca), [b2, c2, d2].map((g) => g?.epoca).join("/"));

// ── Segundo commit na mesma época ────────────────────────────────────────────────────────────────────────────────────────
{
  const epoca = g2.epoca;
  confere("a bia troca a chave da folha", (await b2.atualizar()) === "atualizado" && b2.epoca === epoca + 1n);
  let pular = 1;
  bloquearBusca = () => pular-- > 0; // a ana ainda não viu o commit da bia quando tenta o dela
  const r = await g2.atualizar();
  bloquearBusca = null;
  confere("o segundo commit da mesma época é recusado (ocupada)", r === "ocupada", r);
  confere("quem perdeu acompanha o commit da outra", g2.epoca === epoca + 1n, String(g2.epoca));
  await c2.receber();
  await d2.receber();
  confere("todos na época da bia", c2.epoca === b2.epoca && d2.epoca === b2.epoca);
}

// ── Papéis: forjar e promover ─────────────────────────────────────────────────────────────────────────────────────────────
{
  const falsa = await novosPapeis(apCaio.identidade, c2.id, { ...c2.papeis, mediacao: [...c2.papeis.mediacao, id(apCaio)] }, [id(apCaio)]).catch(() => null);
  // O caio finge que a lista atual já o tem na mediação e assina a "próxima" com ele mesmo.
  confere("o caio monta uma lista forjada", falsa !== null);
  await c2["mandarAplicacao"]({ t: "papeis", l: falsa });
  await g2.receber();
  await b2.receber();
  confere("lista de papéis forjada vira suspeita e não muda nada", g2.suspeitas.includes("papeis_recusados") && !g2.papeis.mediacao.includes(id(apCaio)));
  await g2.mudarPapeis([id(apAna), id(apBia)]);
  await b2.receber();
  await c2.receber();
  confere("a bia vira mediação", b2.souMediacao() && b2.papeis.versao === g2.papeis.versao);
  confere("a chave de entrada chega só à bia", b2.entrada?.privada === g2.entrada.privada && c2.entrada === null);
  confere("a bia lê os pedidos de entrada", Array.isArray(await b2.pedidosDeEntrada()));
  confere("a cadeia inteira confere", conferirCadeia(g2.id, [g2["cadeia"][0], g2["cadeia"][1]]) !== null);
  const outraOrigem = await primeirosPapeis(apCaio.identidade, g2.id);
  confere("cadeia que começa em outra pessoa não confere para quem sabe quem criou", conferirCadeia(g2.id, [outraOrigem], id(apAna)) === null);
}

// ── Apresentação de outra folha ──────────────────────────────────────────────────────────────────────────────────────────
{
  const a = await apresentar(apCaio.identidade, c2.id, apBia.cliente.copyBytes(), (await novoParXWing()).publica);
  await c2["mandarAplicacao"]({ t: "apresentacao", a });
  await d2.receber();
  confere("apresentação com a folha de outra pessoa vira suspeita", d2.suspeitas.includes("apresentacao_falsa"));
}

// ── Voz e posts p2 ───────────────────────────────────────────────────────────────────────────────────────────────────────
{
  await g2.receber();
  confere("a chave da voz é a mesma para todos na época", hex(g2.chaveDeVoz()) === hex(d2.chaveDeVoz()));
  await c2.mandarVoz(texto("oferta"));
  await d2.receber();
  const voz = d2.mensagens.find((m) => m.tipo === "voz");
  confere("a combinação de voz sai com o autor certo (ninguém fala pelo outro)", voz && voz.autor === id(apCaio));
  await b2.postar(texto("pauta da plenária"));
  await d2.receber();
  const post = d2.mensagens.find((m) => m.tipo === "post");
  confere("o post p2 chega, com o autor", post && Buffer.from(post.corpo).toString() === "pauta da plenária" && post.autor === id(apBia));
  const s = g2.segredosDaEpoca();
  const cifrado = await cifrarPost(s, g2.id, texto("só desta época"));
  confere("o post abre na própria época", (await abrirPost(s, g2.id, cifrado)) !== null);
  const outra = derivarSegredos(crypto.getRandomValues(new Uint8Array(32)), g2.id, s.epoca + 1n, "grupo");
  confere("post p2 de outra época não abre", (await abrirPost(outra, g2.id, cifrado)) === null);
  confere("post p2 de outro grupo não abre", (await abrirPost(s, ana.id, cifrado)) === null);
  const mexido = new Uint8Array(cifrado);
  mexido[mexido.length - 5] ^= 1;
  confere("post p2 mexido não abre", (await abrirPost(s, g2.id, mexido)) === null);
}

// ── Remover: quem saiu não acha a caixa nova ─────────────────────────────────────────────────────────────────────────────
{
  await g2.receber();
  const caixaVelha = hex(c2.segredosDaEpoca().caixa.id);
  confere("a mediação tira o caio", (await g2.remover([cli(apCaio)])) === "removido");
  await c2.receber();
  confere("o caio sabe que saiu e apaga o grupo", c2.removido);
  const caixaNova = g2.segredosDaEpoca().caixa;
  confere("a caixa nova é outra", hex(caixaNova.id) !== caixaVelha);
  await recusa("o caio não tira os segredos da época nova", () => apCaio.cc.transaction((c) => c.exportSecretKey(new M.ConversationId(g2.id), 32)));
  await g2.mandarTexto("sem o caio");
  await b2.receber();
  await d2.receber();
  confere("quem ficou lê a época nova", b2.mensagens.some((m) => Buffer.from(m.corpo).toString() === "sem o caio"));
  confere("o caio não lê mais nada", !c2.mensagens.some((m) => Buffer.from(m.corpo).toString() === "sem o caio"));
  await recusa("o caio não deposita mais", () => c2.mandarTexto("ainda estou aqui"), "fora_do_grupo");
  confere("com a saída, a contagem volta a 3", g2.contagemParaTela() === 3, String(g2.contagemParaTela()));
}

// ── Sair por conta própria ───────────────────────────────────────────────────────────────────────────────────────────────
{
  await d2.sair();
  await g2.receber();
  confere("o pedido de saída da dani chega à mediação", g2.pedidosDeSaida.has(cli(apDani)));
  confere("a dani apagou o grupo do aparelho", d2.removido);
  confere("a mediação tira a folha de quem pediu", (await g2.remover([...g2.pedidosDeSaida])) === "removido");
  confere("com 2, a contagem some", g2.contagemParaTela() === null);
}

// ── O embrulho ───────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const k = crypto.getRandomValues(new Uint8Array(32));
  const idH = crypto.getRandomValues(new Uint8Array(32));
  const e = await embrulhar(k, idH, 7n, TIPO.aplicacao, texto("x"));
  confere("o embrulho tem tamanho da lista", ENVELOPES_DE_GRUPO.includes(e.length));
  confere("o embrulho abre", (await desembrulhar(k, idH, 7n, e))?.tipo === TIPO.aplicacao);
  confere("embrulho de outra época não abre", (await desembrulhar(k, idH, 8n, e)) === null);
  confere("embrulho de outra caixa não abre", (await desembrulhar(k, crypto.getRandomValues(new Uint8Array(32)), 7n, e)) === null);
  const m = new Uint8Array(e);
  m[40] ^= 1;
  confere("embrulho mexido não abre", (await desembrulhar(k, idH, 7n, m)) === null);
  const e2 = await embrulhar(k, idH, 7n, TIPO.aplicacao, texto("x"));
  confere("dois embrulhos iguais têm nonce diferente", hex(e.subarray(10, 34)) !== hex(e2.subarray(10, 34)));
  const nonces = new Set();
  for (let i = 0; i < 2000; i++) nonces.add(hex((await embrulhar(k, idH, 7n, TIPO.aplicacao, texto("x"))).subarray(10, 34)));
  confere("nenhum nonce repetido em 2000 embrulhos", nonces.size === 2000);
}

// ── Segredos e rótulos ───────────────────────────────────────────────────────────────────────────────────────────────────
{
  const x = crypto.getRandomValues(new Uint8Array(32));
  const g = crypto.getRandomValues(new Uint8Array(32));
  const a = derivarSegredos(x, g, 1n, "grupo");
  const e = derivarSegredos(x, g, 1n, "equipe");
  const todos = [a.caixa.id, a.caixa.pd, a.caixa.pl, a.embrulho, a.post, a.voz, e.caixa.id, e.embrulho].map(hex);
  confere("cada finalidade tem a sua chave (grupo e equipe diferentes)", new Set(todos).size === todos.length);
  confere("nenhum rótulo se repete", new Set(LISTA_DE_ROTULOS).size === LISTA_DE_ROTULOS.length);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);

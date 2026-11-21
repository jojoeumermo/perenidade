// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o chat entre instâncias da onda R3 (item 2.7; lib/rede/instancias/**, docs/rede/INSTANCIAS.md). A Ana é da instância A; a Bia,
// da instância B. O site da B roda aqui com as rotas DE VERDADE (app/api/alumia/{instancia,diretorio/ler,diretorio/reivindicar,
// pedido/desafio}) sobre um PostgREST de mentira (o registro de transparência da B, o diretório da Bia e as pré-chaves); o servidor do
// chat de cada instância é o de verdade, em contêiner (scripts/r3-servidor-conteiner.mjs --duas), quando R3_INSTANCIAS existe.
//   1. O endereço "codinome@instancia".
//   2. Conhecer a outra instância: o registro dela é conferido como corrente (confiança na primeira vez; depois, só a continuação); o
//      servidor do chat dela tem de ser o último anotado no registro DELA. Ataques: o passado reescrito, outro servidor do chat que não
//      o do registro, o nome trocado, a instância sem chat separado.
//   3. O diretório da Bia na B, com a identidade conferida no registro da B (chave fora do registro: recusada).
//   4. Reivindicar as pré-chaves da Bia SEM passe: a prova de trabalho de fora (22 bits); 20 bits, desafio de outro servidor ou
//      repetido: recusados; sem o chat entre instâncias ligado, a prova não vale no lugar do passe.
//   4b. A conversa com a pilha DE VERDADE (pedido assinado com a instância e conferido no registro da A; mandar/receber com
//      Proteus + SPQR + X-Wing; a franquia `c` no depósito e na busca de fora), sobre um servidor do chat de mentira com o JSON do
//      de verdade. Controle: o depósito sem `c` (como antes do conserto) não abre do outro lado.
//   5. (contêiner) A conversa (só o transporte: o envelope ali é um AES-GCM de teste, não a pilha da conversa): a Ana cria a caixa de respostas no servidor do chat da B e deposita o pedido na caixa de pedidos da Bia,
//      as duas pagas com prova de trabalho; a Bia lê e responde; a Ana lê. Depois: o aparelho da Ana não falou com a A nem uma vez;
//      nenhuma linha do banco do chat da B tem a conta da Ana, o nome da A ou a caixa da Ana na A; o banco do chat da A não ganhou nada.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-instancias.mjs   (as partes 1 a 4)
//      R3_VPS=<apelido ssh> node --import ./scripts/carregar-ts.mjs scripts/r3-servidor-conteiner.mjs --duas   (com a 5)
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import http from "node:http";

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function falha(nome, promessa, codigo) {
  try {
    await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}"`);
  } catch (e) {
    if (String(e.message) === codigo) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${e.message}"`);
  }
}
const sorteio = (n) => new Uint8Array(crypto.randomBytes(n));
const b64 = (b) => Buffer.from(b).toString("base64");
const b64u = (b) => Buffer.from(b).toString("base64url");
const hex = (b) => Buffer.from(b).toString("hex");
const sha256b64 = (t) => crypto.createHash("sha256").update(t).digest("base64");

// ═══════════════════ O "PostgREST" da instância B (só o que as rotas pedem) ═══════════════════
const INSTANCIA_A = "instancia-a.example", INSTANCIA_B = "instancia-b.example";
const CHAT_B = `https://chat.${INSTANCIA_B}`;
const BIA = { usuario: "00000000-0000-4000-8000-00000000b1a0", codinome: "Bia Teste", identidade: sorteio(32) };
const ANA = { usuario: "00000000-0000-4000-8000-00000000a0a0", codinome: "Ana Teste" };
const pedidosDaBia = { id: sorteio(32), pd: sorteio(32), pl: sorteio(32), multi: false };
const kt = [];
const gastos = new Set();
let preChaves = [{ aparelho: b64(sorteio(32)), id: 1, pre: b64(sorteio(40)), assinatura: b64(sorteio(64)) }, { aparelho: b64(sorteio(32)), id: 2, pre: b64(sorteio(40)), assinatura: b64(sorteio(64)) }];
function anotar(tipo, quem, identidade, versao = 1) {
  const seq = kt.length + 1;
  const anterior = kt.length ? kt[kt.length - 1].resumo : `${"A".repeat(43)}=`;
  const dia = new Date().toISOString().slice(0, 10);
  const resumo = sha256b64(`${anterior}|${seq}|${tipo}|${quem}|${identidade}|${versao}|${dia}`);
  kt.push({ seq, tipo, quem, identidade, versao, dia, resumo });
}
anotar("servidor-chat", sha256b64("alumia-kt:servidor-chat"), `sc1:${CHAT_B}`);
anotar("conta", sha256b64(`alumia-kt:1:${BIA.usuario}`), `r2:${b64(BIA.identidade)}`);
const contaDaBia = () => ({
  usuario: BIA.usuario, versao: 1, identidade: b64u(BIA.identidade), pedidos_xwing: b64u(sorteio(1216)), pedidos_assinatura: b64u(sorteio(64)),
  pedidos_caixa: b64u(pedidosDaBia.id), pedidos_pd: b64u(pedidosDaBia.pd), voto_xwing: null, voto_assinatura: null, aparelhos: [],
  ...contaDaBiaExtra,
});
let contaDaBiaExtra = {};
const chamadasAoBanco = [];
const postgrest = http.createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    const funcao = (req.url ?? "").replace("/rest/v1/rpc/", "");
    const a = corpo ? JSON.parse(corpo) : {};
    chamadasAoBanco.push({ funcao, a });
    const json = (s, x) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(x)); };
    if (funcao === "rede_kt_ponta") return json(200, { seq: kt.length, resumo: kt.at(-1).resumo });
    if (funcao === "rede_kt_trecho") return json(200, kt.filter((l) => l.seq > (a.p_desde ?? 0)).slice(0, 1000));
    if (funcao === "rede_diretorio_ler") return json(200, a.p_codinome === BIA.codinome ? contaDaBia() : null);
    if (funcao === "rede_diretorio_reivindicar") {
      const g = String(a.p_passe);
      if (gastos.has(g)) return json(400, { message: "passe_usado" });
      gastos.add(g);
      const saida = preChaves;
      preChaves = [];
      return json(200, saida);
    }
    return json(404, { message: "nao_existe" });
  });
});
await new Promise((ok_) => postgrest.listen(0, "127.0.0.1", ok_));
process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${postgrest.address().port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-servico-de-teste"; // gitleaks:allow (valor de teste)
process.env.ALUMIA_PASSES_SEGREDO = "segredo-dos-passes-da-instancia-b-de-teste-32+"; // gitleaks:allow (valor de teste)
process.env.NEXT_PUBLIC_ALUMIA_CHAT_SERVIDOR = CHAT_B;
process.env.ALUMIA_INSTANCIA = INSTANCIA_B;

const rotaInstancia = await import("../app/api/alumia/instancia/route.ts");
const rotaLer = await import("../app/api/alumia/diretorio/ler/route.ts");
const rotaReivindicar = await import("../app/api/alumia/diretorio/reivindicar/route.ts");
const rotaDesafio = await import("../app/api/alumia/pedido/desafio/route.ts");
const { lerEndereco, escreverEndereco, eDaqui, BITS_DE_FORA_MINIMO } = await import("../lib/rede/instancias/endereco.ts");
const I = await import("../lib/rede/instancias/cliente.ts");
const { resolverProva } = await import("../lib/rede/caixas/prova.ts");
const { TAMANHOS_DUPLA, TAMANHO_PEDIDO } = await import("../lib/rede/caixas/tamanhos.ts");

// O site da B, como o aparelho da Ana o vê (https://instancia-b.example/…), com as rotas de verdade; e os servidores do chat (o de
// verdade pelo túnel, quando há contêiner). Tudo o que o aparelho da Ana pede fica anotado.
const vivo = process.env.R3_INSTANCIAS ? JSON.parse(process.env.R3_INSTANCIAS) : null;
const pedidosDoAparelho = [];
let mexerNaRotaDaInstancia = (c) => c;
/** A parte 4b liga aqui o servidor do chat da B de mentira e o site da A de mentira. */
let redeExtra = async () => null;
async function rede(url, init = {}) {
  const u = new URL(String(url));
  pedidosDoAparelho.push({ host: u.host, caminho: u.pathname, init });
  if (init.credentials !== "omit" || init.referrerPolicy !== "no-referrer") throw new Error("o aparelho mandou credencial ou referência");
  const extra = await redeExtra(u, init);
  if (extra) return extra;
  if (u.host === INSTANCIA_B) {
    const pedido = new Request(`https://${INSTANCIA_B}${u.pathname}${u.search}`, { method: init.method ?? "GET", headers: init.headers, body: init.body });
    if (u.pathname === "/api/alumia/instancia") {
      const r = await rotaInstancia.GET(pedido);
      return r.status === 200 ? Response.json(mexerNaRotaDaInstancia(await r.json())) : r;
    }
    if (u.pathname === "/api/alumia/diretorio/ler") return rotaLer.POST(pedido);
    if (u.pathname === "/api/alumia/diretorio/reivindicar") return rotaReivindicar.POST(pedido);
    if (u.pathname === "/api/alumia/pedido/desafio") return rotaDesafio.GET(pedido);
    return Response.json({ ok: false }, { status: 404 });
  }
  const chats = vivo ? { [`chat.${INSTANCIA_A}`]: vivo.a.url, [`chat.${INSTANCIA_B}`]: vivo.b.url } : {};
  if (chats[u.host]) return fetch(`${chats[u.host]}${u.pathname}`, { method: init.method, headers: init.headers, body: init.body });
  throw new Error(`o aparelho tentou falar com ${u.host}`);
}

// ═══════════════════ 1. O endereço ═══════════════════
ok("o endereço: codinome@instancia", JSON.stringify(lerEndereco("Bia Teste@Instancia-B.example")) === JSON.stringify({ codinome: "Bia Teste", instancia: INSTANCIA_B }));
ok("o codinome pode ter @? não: a última @ separa e o codinome segue a regra de sempre", lerEndereco("a@b@instancia-b.example") === null);
ok("instância com porta, IP, esquema, caminho ou sem ponto: recusada", ["Bia@instancia-b.example:443", "Bia@10.0.0.1", "Bia@https://instancia-b.example", "Bia@instancia-b.example/x", "Bia@localhost", "Bia@"].every((e) => lerEndereco(e) === null));
ok("escrever e ler dá o mesmo", escreverEndereco(lerEndereco(`Bia Teste@${INSTANCIA_B}`)) === `Bia Teste@${INSTANCIA_B}`);
ok("a própria instância é reconhecida (o chat de sempre)", eDaqui(lerEndereco(`Ana Teste@${INSTANCIA_A}`), INSTANCIA_A) && !eDaqui(lerEndereco(`Bia@${INSTANCIA_B}`), INSTANCIA_A));

// ═══════════════════ 2. Conhecer a outra instância ═══════════════════
const b1 = await I.conhecerInstancia(INSTANCIA_B, null, rede);
ok("a B: primeira vez (confiança na primeira vez, dita na tela), o servidor do chat do registro", b1.primeiraVez && b1.chat === CHAT_B && b1.vista.seq === 2);
anotar("conta", sha256b64(`alumia-kt:1:${"00000000-0000-4000-8000-00000000c0c0"}`), `r2:${b64(sorteio(32))}`);
const b2 = await I.conhecerInstancia(INSTANCIA_B, b1.vista, rede);
ok("a B de novo: só a continuação da corrente (a vista anda)", !b2.primeiraVez && b2.vista.seq === 3);
{
  // A B reescreve a linha da Bia (outra chave) e refaz a corrente dali em diante: quem já tinha visto o registro nota.
  const verdade = kt.map((l) => ({ ...l }));
  const linhas = verdade.map((l) => ({ ...l }));
  linhas[1].identidade = `r2:${b64(sorteio(32))}`;
  for (let i = 1; i < linhas.length; i++) linhas[i].resumo = sha256b64(`${linhas[i - 1].resumo}|${linhas[i].seq}|${linhas[i].tipo}|${linhas[i].quem}|${linhas[i].identidade}|${linhas[i].versao}|${linhas[i].dia}`);
  kt.splice(0, kt.length, ...linhas);
  await falha("ATAQUE a B reescreve o passado do registro (outra chave da Bia) e refaz a corrente: quem já viu nota", () => I.conhecerInstancia(INSTANCIA_B, b2.vista, rede), "kt_quebrado");
  await falha("ATAQUE e quem viu só até a linha de antes também nota", () => I.conhecerInstancia(INSTANCIA_B, b1.vista, rede), "kt_quebrado");
  kt.splice(0, kt.length, ...verdade);
}
mexerNaRotaDaInstancia = (c) => ({ ...c, chat: "https://outro-chat.example" });
await falha("ATAQUE a rota da B aponta outro servidor do chat (não o do registro): recusado", () => I.conhecerInstancia(INSTANCIA_B, b2.vista, rede), "servidor_do_chat_fora_do_registro");
mexerNaRotaDaInstancia = (c) => ({ ...c, nome: INSTANCIA_A });
await falha("ATAQUE a rota responde com o nome de outra instância: recusado", () => I.conhecerInstancia(INSTANCIA_B, b2.vista, rede), "instancia_fora");
mexerNaRotaDaInstancia = (c) => c;
await falha("instância com nome torto: recusada antes de qualquer pedido", () => I.conhecerInstancia("10.0.0.1", null, rede), "instancia_invalida");
{
  const chat = process.env.NEXT_PUBLIC_ALUMIA_CHAT_SERVIDOR;
  process.env.ALUMIA_INSTANCIA = "";
  const r = await rotaInstancia.GET(new Request(`https://${INSTANCIA_B}/api/alumia/instancia`));
  ok("a rota da instância fica desligada (404) sem ALUMIA_INSTANCIA", r.status === 404);
  process.env.ALUMIA_INSTANCIA = INSTANCIA_B;
  const sessao = await rotaInstancia.GET(new Request(`https://${INSTANCIA_B}/api/alumia/instancia`, { headers: { Cookie: "sb-access-token=x" } }));
  ok("e recusa quem chega com sessão", sessao.status === 400);
  void chat;
}

// ═══════════════════ 3. O diretório da Bia na B ═══════════════════
const B = await I.conhecerInstancia(INSTANCIA_B, b2.vista, rede);
const dirDaBia = await I.lerDiretorioDeFora(B, BIA.codinome, rede);
ok("o diretório da Bia na B, com a identidade conferida no registro DA B", dirDaBia?.usuario === BIA.usuario && hex(dirDaBia.pedidosCaixa) === hex(pedidosDaBia.id));
ok("codinome que não existe lá: nulo", (await I.lerDiretorioDeFora(B, "Ninguem Aqui", rede)) === null);
{
  const verdadeira = BIA.identidade;
  BIA.identidade = sorteio(32);
  await falha("ATAQUE a B troca a chave da Bia no diretório sem passar pelo registro: recusado", () => I.lerDiretorioDeFora(B, BIA.codinome, rede), "chave_fora_do_registro");
  BIA.identidade = verdadeira;
}

// ═══════════════════ 4. Reivindicar sem passe (a prova de trabalho de fora) ═══════════════════
const reivindicar = (corpo, cab = {}) => rotaReivindicar.POST(new Request(`https://${INSTANCIA_B}/api/alumia/diretorio/reivindicar`, { method: "POST", headers: { "Content-Type": "application/json", ...cab }, body: JSON.stringify(corpo) }));
const desafioDaB = async () => new Uint8Array(Buffer.from((await (await rotaDesafio.GET(new Request(`https://${INSTANCIA_B}/api/alumia/pedido/desafio`))).json()).desafio, "base64url"));
{
  // Uma prova de 20 bits que não chega a 22.
  let d = await desafioDaB(), n20 = null;
  for (let t = 0; t < 6 && !n20; t++) {
    const n = await resolverProva(d, 20);
    const h = crypto.createHash("sha256").update(Buffer.concat([d, n])).digest();
    if ((h[2] & 0x0c) !== 0) n20 = n;
    else d = await desafioDaB();
  }
  const r20 = await reivindicar({ codinome: BIA.codinome, tipo: "proteus", desafio: b64u(d), nonce: b64u(n20) });
  ok("ATAQUE reivindicar sem passe com prova de 20 bits: recusado (de fora pede 22)", r20.status === 400 && (await r20.json()).erro === "prova");
  const outro = new Uint8Array(52);
  ok("ATAQUE desafio que não é da B: recusado", (await reivindicar({ codinome: BIA.codinome, tipo: "proteus", desafio: b64u(outro), nonce: b64u(await resolverProva(outro, BITS_DE_FORA_MINIMO)) })).status === 400);
  process.env.ALUMIA_INSTANCIA = "";
  const d2 = await desafioDaB();
  const desligado = await reivindicar({ codinome: BIA.codinome, tipo: "proteus", desafio: b64u(d2), nonce: b64u(await resolverProva(d2, BITS_DE_FORA_MINIMO)) });
  ok("sem o chat entre instâncias ligado, a prova não vale no lugar do passe", desligado.status === 401);
  process.env.ALUMIA_INSTANCIA = INSTANCIA_B;
}
const pre = await I.reivindicarDeFora(B, BIA.codinome, "proteus", rede);
ok("reivindicar de fora com 22 bits: as pré-chaves da Bia saem (uma por aparelho)", pre.length === 2 && pre.every((p) => p.aparelho.length === 32 && p.assinatura?.length === 64));
const gastoNoBanco = chamadasAoBanco.filter((c) => c.funcao === "rede_diretorio_reivindicar").at(-1)?.a;
ok("o banco da B gastou o resumo do desafio no lugar do passe (e não recebeu nada da Ana)", typeof gastoNoBanco?.p_passe === "string" && Object.keys(gastoNoBanco).sort().join() === "p_passe,p_tipo,p_usuario" && gastoNoBanco.p_usuario === BIA.usuario);
{
  const d = await desafioDaB();
  const corpo = { codinome: BIA.codinome, tipo: "proteus", desafio: b64u(d), nonce: b64u(await resolverProva(d, BITS_DE_FORA_MINIMO)) };
  await reivindicar(corpo);
  const r = await reivindicar(corpo);
  ok("ATAQUE o mesmo desafio duas vezes: o segundo é recusado (passe_usado)", r.status === 409);
}

// ═══════════════════ 4b. A conversa entre instâncias com a pilha DE VERDADE (Proteus + SPQR + X-Wing) ═══════════════════
// Achado da auditoria interna da R3: CaixasDeFora mandava só {acao, id, pd, envelope} e a busca devolvia franquia = null; o envelope
// da conversa a dois prende o compromisso da franquia `c` nos dados associados (aad = id_h ‖ c ‖ semana), então a mensagem de verdade
// que vinha de outra instância NUNCA abria do outro lado; e a prova "viva" usava um AES-GCM com chave sorteada no teste e um pedido em
// JSON com "de: Ana@instancia-a" sem assinatura. Aqui, sem contêiner: o servidor do chat da B é um de mentira com o MESMO JSON das
// rotas do servidor do chat (nativo/servidor-chat/src/rotas.rs: lote, buscar, confirmar, desafio; a franquia guardada e devolvida), o
// site da A é um de mentira com o registro e o diretório da Ana; tudo o mais é o código do aparelho de verdade: o pedido fechado com
// fecharPedido (assinado pela identidade da Ana, com `instancia`), aberto com abrirPedido e conferido no registro DA A
// (conferirRemetenteDeFora), e a conversa com mandar()/receber() (Proteus + SPQR + X-Wing) sobre CaixasDeFora.
const { motorNoNode } = await import("./cifra-no-node.mjs");
const { spqrNoNode } = await import("./spqr-no-node.mjs");
const bytesR2 = await import("../lib/rede/chat/r2/bytes.ts");
const cert = await import("../lib/rede/chat/r2/certificados.ts");
const env = await import("../lib/rede/chat/r2/envelope.ts");
const proteus = await import("../lib/rede/chat/r2/proteus.ts");
const ordem = await import("../lib/rede/chat/r2/ordem.ts");
const conversaR2 = await import("../lib/rede/chat/r2/conversa.ts");
const blocoR2 = await import("../lib/rede/chat/r2/bloco.ts");
const pedidoR2 = await import("../lib/rede/chat/r2/pedido.ts");
const baseCaixas = await import("../lib/rede/caixas/base.ts");
const CHAT_B_LOCAL = "https://chat-local." + INSTANCIA_B;
const caixasDeMentira = new Map();
const vistoNoChatLocal = [];
let ordemLocal = 0;
const zeros = (h, bits) => {
  for (let i = 0; i < bits; i++) if ((h[i >> 3] >> (7 - (i & 7))) & 1) return false;
  return true;
};
const desafiosLocais = new Set();
function chatDeMentira(caminho, corpo) {
  const idH = (id) => b64u(baseCaixas.resumo("alumia/r2/caixa", new Uint8Array(Buffer.from(id, "base64url"))));
  if (caminho === "/desafio") {
    const d = b64u(sorteio(52));
    desafiosLocais.add(d);
    return { desafio: d, bits: BITS_DE_FORA_MINIMO, bits_com_passe: 20 };
  }
  vistoNoChatLocal.push({ caminho, corpo });
  const provaBoa = (x) => desafiosLocais.delete(x.desafio) && zeros(crypto.createHash("sha256").update(Buffer.concat([Buffer.from(x.desafio, "base64url"), Buffer.from(x.nonce, "base64url")])).digest(), BITS_DE_FORA_MINIMO);
  if (caminho === "/caixa/lote") {
    const resultados = corpo.itens.map((x) => {
      if (x.acao === "criar") {
        if (!x.proprio && !provaBoa(x)) return { ok: false, erro: "prova" };
        caixasDeMentira.set(idH(x.id), { pd_h: x.pd_h, pl_h: x.pl_h, pacotes: [] });
        return { ok: true };
      }
      const cx = caixasDeMentira.get(idH(x.id));
      if (x.acao === "pedido" && !provaBoa(x)) return { ok: false, erro: "prova" };
      if (!cx || cx.pd_h !== b64u(baseCaixas.resumo("alumia/r2/passe-deposito", new Uint8Array(Buffer.from(x.pd, "base64url"))))) return { ok: true };
      const marca = x.franquia ? b64u(sorteio(32)) : null;
      cx.pacotes.push({ ordem: ++ordemLocal, envelope: x.envelope, franquia: x.franquia ?? null, marca, unico: x.unico === true, dia: new Date().toISOString().slice(0, 10) });
      return marca ? { ok: true, marca, dia: new Date().toISOString().slice(0, 10) } : { ok: true };
    });
    return { resultados };
  }
  const cx = caixasDeMentira.get(idH(corpo.id));
  const plOk = cx && cx.pl_h === b64u(baseCaixas.resumo("alumia/r2/passe-leitura", new Uint8Array(Buffer.from(corpo.pl, "base64url"))));
  if (caminho === "/caixa/buscar") return { pacotes: plOk ? cx.pacotes.filter((p) => p.ordem > corpo.cursor) : [] };
  if (caminho === "/caixa/confirmar") {
    if (plOk) cx.pacotes = cx.pacotes.filter((p) => p.ordem > corpo.ate);
    return { ok: true };
  }
  return null;
}
// O site da A (de mentira): o registro de transparência DA A e o diretório da Ana lá.
const ktA = [];
function anotarNaA(tipo, quem, identidade) {
  const seq = ktA.length + 1;
  const anterior = ktA.length ? ktA[ktA.length - 1].resumo : `${"A".repeat(43)}=`;
  const dia = new Date().toISOString().slice(0, 10);
  ktA.push({ seq, tipo, quem, identidade, versao: 1, dia, resumo: sha256b64(`${anterior}|${seq}|${tipo}|${quem}|${identidade}|1|${dia}`) });
}
const CHAT_A = `https://chat.${INSTANCIA_A}`;
let contaDaAnaNaA = null;
function siteDaA(caminho, corpo, busca) {
  if (caminho === "/api/alumia/instancia") {
    const desde = Number(new URLSearchParams(busca).get("desde") ?? 0);
    return { v: 1, nome: INSTANCIA_A, chat: CHAT_A, ponta: { seq: ktA.length, resumo: ktA.at(-1).resumo }, linhas: ktA.filter((l) => l.seq > desde) };
  }
  if (caminho === "/api/alumia/diretorio/ler") return corpo.codinome === ANA.codinome && contaDaAnaNaA ? { conta: contaDaAnaNaA } : null;
  return null;
}
redeExtra = async (u, init) => {
  const corpo = init.body ? JSON.parse(init.body) : {};
  if (u.host === new URL(CHAT_B_LOCAL).host) {
    const r = chatDeMentira(u.pathname, corpo);
    return r ? Response.json(r) : Response.json({ ok: false }, { status: 404 });
  }
  if (u.host === INSTANCIA_A) {
    const r = siteDaA(u.pathname, corpo, u.search);
    return r ? Response.json(r) : Response.json({ ok: false }, { status: 404 });
  }
  return null;
};

{
  const M = await motorNoNode();
  const SPQR = await spqrNoNode();
  const pqNaMemoria = () => {
    const m = new Map();
    return { motor: SPQR, ler: (a) => m.get(bytesR2.paraB64Url(a)) ?? null, gravar: (a, r) => void m.set(bytesR2.paraB64Url(a), r) };
  };
  const semana = env.semanaDe();
  const hoje = Math.floor(Date.now() / 86_400_000);
  async function novoAparelho(conta, identidade) {
    const motor = M.CoreCrypto.new(M.Database.inMemory());
    const impressao = await proteus.ligarProteus(motor);
    const chave = cert.novoParEd25519();
    const xw = await env.novoParXWing();
    const semanas = new Map([[semana, xw.privada]]);
    const publico = { aparelho: chave.publica, certificado: cert.certificarAparelho(identidade, conta, chave.publica, impressao, hoje), xwing: xw.publica, semana, xwingAssinatura: cert.assinarChaveDaSemana(chave, xw.publica, semana) };
    return { conta, motor, chave, impressao, publico, eu: { conta, aparelho: chave.publica, motor, chaveDaSemana: async (s) => semanas.get(s) ?? null, pq: pqNaMemoria() } };
  }
  // A Ana na A: identidade de verdade, no registro DA A e no diretório da A.
  const idAna = cert.novoParEd25519();
  anotarNaA("servidor-chat", sha256b64("alumia-kt:servidor-chat"), `sc1:${CHAT_A}`);
  anotarNaA("conta", sha256b64(`alumia-kt:1:${ANA.usuario}`), `r2:${b64(idAna.publica)}`);
  contaDaAnaNaA = {
    usuario: ANA.usuario, versao: 1, identidade: b64u(idAna.publica), pedidos_xwing: b64u(sorteio(1216)), pedidos_assinatura: b64u(sorteio(64)),
    pedidos_caixa: b64u(sorteio(32)), pedidos_pd: b64u(sorteio(32)), voto_xwing: null, voto_assinatura: null, aparelhos: [],
  };
  // A Bia na B: a chave de pedidos de verdade no diretório da B (assinada pela identidade dela) e uma linha nova no registro DA B.
  const idBia = cert.novoParEd25519();
  const pedidosXw = await env.novoParXWing();
  BIA.identidade = idBia.publica;
  contaDaBiaExtra = { pedidos_xwing: b64u(pedidosXw.publica), pedidos_assinatura: b64u(cert.assinarChaveDePedidos(idBia, BIA.usuario, pedidosXw.publica)) };
  anotar("conta", sha256b64(`alumia-kt:1:${BIA.usuario}`), `r2:${b64(idBia.publica)}`, 2);
  process.env.NEXT_PUBLIC_ALUMIA_CHAT_SERVIDOR = CHAT_B_LOCAL;
  anotar("servidor-chat", sha256b64("alumia-kt:servidor-chat"), `sc1:${CHAT_B_LOCAL}`);
  const Bv = await I.conhecerInstancia(INSTANCIA_B, B.vista, rede);
  const dirBia = await I.lerDiretorioDeFora(Bv, BIA.codinome, rede);
  ok("4b: a Ana lê a chave de pedidos da Bia no diretório da B (identidade conferida no registro DA B; chave de pedidos assinada)",
    !!dirBia && cert.chaveDePedidosConfere(dirBia.identidade, BIA.usuario, dirBia.pedidosXwing, dirBia.pedidosAssinatura));
  // A caixa de pedidos da Bia, no chat da B (o aparelho dela cria com um passe da B; aqui direto no servidor de mentira).
  chatDeMentira("/caixa/lote", { itens: [{ acao: "criar", proprio: true, id: b64u(pedidosDaBia.id), pd_h: b64u(baseCaixas.resumo("alumia/r2/passe-deposito", pedidosDaBia.pd)), pl_h: b64u(baseCaixas.resumo("alumia/r2/passe-leitura", pedidosDaBia.pl)) }] });

  const ana = await novoAparelho(ANA.usuario, idAna);
  const bia = await novoAparelho(BIA.usuario, idBia);
  const chatB = new I.CaixasDeFora(Bv.chat, rede);
  // A Ana cria no chat da B a caixa onde lê as respostas, e manda o pedido de verdade (assinado, com a instância dela).
  const respostas = { id: sorteio(32), pd: sorteio(32), pl: sorteio(32), multi: false };
  await chatB.criar(respostas);
  const conversa = sorteio(16);
  const pedido = await pedidoR2.fecharPedido(dirBia.pedidosXwing, idAna, {
    conversa, conta: ANA.usuario, codinome: ANA.codinome, identidade: idAna.publica, aparelho: ana.chave.publica, texto: "Oi, Bia! Sou da organização A.",
    resposta: { id: respostas.id, pd: respostas.pd }, pdH: baseCaixas.resumo("alumia/r2/passe-deposito", respostas.pd), instancia: INSTANCIA_A,
  });
  await chatB.pedir(dirBia, pedido);
  // A Bia lê o pedido, abre e confere QUEM pede no registro DA A.
  const [pctPedido] = await chatB.buscarPacotes(pedidosDaBia, 0);
  const aberto = pctPedido ? await pedidoR2.abrirPedido(pedidosXw.privada, pctPedido.envelope) : null;
  ok("4b: a Bia abre o pedido de verdade (HPKE X-Wing, assinado pela identidade da Ana) e ele diz a instância da Ana", aberto?.instancia === INSTANCIA_A && aberto?.codinome === ANA.codinome);
  const conferido = aberto ? await I.conferirRemetenteDeFora(aberto, null, rede).catch((e) => e) : null;
  ok("4b: conferirRemetenteDeFora: a identidade do pedido é a da conta da Ana no diretório e no registro DA A", conferido?.diretorio?.usuario === ANA.usuario, String(conferido?.message ?? ""));
  {
    // ATAQUE: a Eva (sem conta na A) assina com a identidade dela e diz ser a Ana da A. A assinatura confere com a identidade de
    // dentro, mas a identidade não é a do registro da A.
    const eva = cert.novoParEd25519();
    const forjado = await pedidoR2.fecharPedido(dirBia.pedidosXwing, eva, { ...aberto, identidade: eva.publica });
    const abertoForjado = await pedidoR2.abrirPedido(pedidosXw.privada, forjado);
    const r = await I.conferirRemetenteDeFora(abertoForjado, null, rede).then(() => "passou", (e) => e.message);
    ok("ATAQUE 4b: pedido de fora com identidade que não é a do registro da instância dita: recusado (remetente_fora)", r === "remetente_fora", r);
    const r2 = await I.conferirRemetenteDeFora({ ...aberto, instancia: undefined }, null, rede).then(() => "passou", (e) => e.message);
    ok("ATAQUE 4b: pedido sem instância não passa como de fora", r2 === "remetente_fora", r2);
    // E o campo "instancia" vai dentro do assinado: trocá-lo invalida a assinatura (o pedido não abre).
    ok("4b: pedido da mesma instância (sem `instancia`) abre como sempre", (await pedidoR2.abrirPedido(pedidosXw.privada, await pedidoR2.fecharPedido(dirBia.pedidosXwing, idAna, { ...aberto, instancia: undefined })))?.instancia === undefined);
  }
  // A conversa: a Bia abre a sessão Proteus com a pré-chave do aparelho da Ana (o aceite) e responde na caixa que a Ana criou; a
  // Ana responde de volta numa caixa da Bia. Tudo pelo servidor do chat da B, por CaixasDeFora, com mandar()/receber() de verdade.
  await proteus.sessaoPelaPreChave(bia.motor, ana.chave.publica, ana.impressao, (await proteus.novasPreChaves(ana.motor, ana.chave, 1))[0]);
  const entradaDaBia = { id: sorteio(32), pd: sorteio(32), pl: sorteio(32), multi: false };
  await chatB.criar(entradaDaBia);
  const depositar = (caixa, envelope, c) => chatB.depositar(caixa, envelope, c);
  let envioBia = ordem.ENVIO_NOVO, envioAna = ordem.ENVIO_NOVO, ordemNaAna = ordem.ESTADO_NOVO, ordemNaBia = ordem.ESTADO_NOVO;
  const conhecidosDaAna = (a) => (bytesR2.iguais(a, bia.chave.publica) ? { conta: BIA.usuario, impressao: bia.impressao, meu: false } : null);
  const conhecidosDaBia = (a) => (bytesR2.iguais(a, ana.chave.publica) ? { conta: ANA.usuario, impressao: ana.impressao, meu: false } : null);
  const nada = async () => {};
  let r = await conversaR2.mandar(bia.eu, [{ aparelho: ana.publico, caixa: respostas, tipo: "mensagem" }], envioBia, { tipo: "texto", conversa, prazo: 7, corpo: blocoR2.corpoDeTexto({ t: "Oi, Ana! Aceito." }) }, depositar, nada);
  envioBia = r.estado;
  ok("4b: a Bia manda (Proteus + SPQR + X-Wing) e o servidor do chat da B aceita o depósito", r.entregues === 1);
  ok("4b: o depósito de fora LEVA o compromisso da franquia `c` (antes: só acao, id, pd, envelope)", vistoNoChatLocal.some((v) => v.caminho === "/caixa/lote" && v.corpo.itens.some((x) => x.acao === "depositar" && typeof x.franquia === "string")));
  let lidas = await chatB.buscarPacotes(respostas, 0);
  ok("4b: a busca de fora devolve a franquia (antes: franquia = null)", lidas.length === 1 && lidas[0].franquia?.length === 32);
  let rec = lidas[0] ? await conversaR2.receber(ana.eu, respostas.id, { envelope: lidas[0].envelope, franquia: lidas[0].franquia ?? new Uint8Array(0) }, conversa, conhecidosDaAna, () => ordemNaAna) : { ok: false, motivo: "nada" };
  ok("ACEITE 4b: a Ana ABRE a mensagem de verdade que veio da outra instância", rec.ok === true && blocoR2.lerCorpoDeTexto(rec.bloco.corpo)?.t === "Oi, Ana! Aceito.", rec.ok ? "" : rec.motivo);
  if (rec.ok) ordemNaAna = rec.estado;
  await chatB.confirmar(respostas, lidas[0]?.ordem ?? 0);
  r = await conversaR2.mandar(ana.eu, [{ aparelho: bia.publico, caixa: entradaDaBia, tipo: "mensagem" }], envioAna, { tipo: "texto", conversa, prazo: 7, corpo: blocoR2.corpoDeTexto({ t: "Que bom, Bia!" }) }, depositar, nada);
  envioAna = r.estado;
  lidas = await chatB.buscarPacotes(entradaDaBia, 0);
  rec = lidas[0] ? await conversaR2.receber(bia.eu, entradaDaBia.id, { envelope: lidas[0].envelope, franquia: lidas[0].franquia ?? new Uint8Array(0) }, conversa, conhecidosDaBia, () => ordemNaBia) : { ok: false, motivo: "nada" };
  ok("ACEITE 4b: e a Bia abre a resposta da Ana (nas duas direções)", rec.ok === true && blocoR2.lerCorpoDeTexto(rec.bloco.corpo)?.t === "Que bom, Bia!", rec.ok ? "" : rec.motivo);
  {
    // O controle (como era antes do conserto): o depósito sem `c` chega, mas a mensagem não abre do outro lado.
    const semC = (caixa, envelope) => chatB.depositar(caixa, envelope);
    await conversaR2.mandar(ana.eu, [{ aparelho: bia.publico, caixa: entradaDaBia, tipo: "mensagem" }], envioAna, { tipo: "texto", conversa, prazo: 7, corpo: blocoR2.corpoDeTexto({ t: "sem c" }) }, semC, nada);
    const sem = (await chatB.buscarPacotes(entradaDaBia, lidas[0]?.ordem ?? 0))[0];
    const rr = sem ? await conversaR2.receber(bia.eu, entradaDaBia.id, { envelope: sem.envelope, franquia: sem.franquia ?? new Uint8Array(0) }, conversa, conhecidosDaBia, () => ordemNaBia) : { ok: false };
    ok("CONTROLE 4b: o depósito SEM a franquia (como antes) não abre do outro lado", sem && sem.franquia === null && rr.ok === false);
  }
  // Volta o servidor do chat da B ao de antes (a parte 5 usa o de verdade, em contêiner).
  process.env.NEXT_PUBLIC_ALUMIA_CHAT_SERVIDOR = CHAT_B;
  anotar("servidor-chat", sha256b64("alumia-kt:servidor-chat"), `sc1:${CHAT_B}`);
}

// ═══════════════════ 5. A conversa entre instâncias, com os servidores do chat em contêiner ═══════════════════
if (!vivo) {
  console.log("\n(parte 5 NÃO rodou: sem R3_INSTANCIAS. Rode pelo scripts/r3-servidor-conteiner.mjs --duas.)");
} else {
  const psql = (inst, sql) => execFileSync("ssh", ["-o", "BatchMode=yes", process.env.R3_VPS, `docker exec -i ${inst.banco} psql -At -U postgres -d chat`], { input: sql, encoding: "utf8" });
  const contar = (inst) => psql(inst, "select (select count(*) from chat.caixas) || ',' || (select count(*) from chat.pacotes) || ',' || (select count(*) from chat.passes_gastos);").trim();
  // A caixa de pedidos da Bia na B (criada pela Bia, com um passe da B: o aparelho dela é dali).
  const { publicVerif, genericBatched } = await import("@cloudflare/privacypass-ts");
  const comum = await import("../lib/rede/passes/comum.ts");
  const S = await import("../lib/rede/passes/servidor.ts");
  const semana = comum.semanaDe();
  const ck = vivo.b.chaves[semana];
  const publica = new Uint8Array(Buffer.from(ck.publica, "base64url"));
  const SEGREDO = "segredo-dos-passes-so-deste-teste-com-32+"; // gitleaks:allow (valor de teste)
  S._esquecerChaves();
  const chaveB = await S.chaveDoEmissor(semana, new Uint8Array(0), { ler: async () => ({ publica, privadaSelada: S.selarPrivada(SEGREDO, semana, new Uint8Array(0), publica, new Uint8Array(Buffer.from(ck.pkcs8, "base64url"))), seq: 1 }), guardar: async () => null }, SEGREDO, false);
  const cls = Array.from({ length: comum.PASSES_POR_DIA }, () => new publicVerif.Client(comum.MODO));
  const reqs = [];
  for (const cl of cls) reqs.push(new genericBatched.TokenRequest(await cl.createTokenRequest(comum.desafio(), publica)));
  const lote = new genericBatched.Client().deserializeTokenResponse(await S.emitirLote(new genericBatched.Client().createTokenRequest(reqs).serialize(), chaveB));
  const passeDaBia = comum.cabecalhoDoPasse(b64u((await cls[0].finalize(lote.tokenResponses[0].tokenResponse)).serialize()));
  const { resumo } = await import("../lib/rede/caixas/base.ts");
  const criarBia = await fetch(`${vivo.b.url}/caixa/lote`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: passeDaBia }, body: JSON.stringify({ itens: [{ acao: "criar", id: b64u(pedidosDaBia.id), pd_h: b64u(resumo("alumia/r2/passe-deposito", pedidosDaBia.pd)), pl_h: b64u(resumo("alumia/r2/passe-leitura", pedidosDaBia.pl)), multi: false, pedidos: true }] }) }).then((r) => r.json());
  ok("VIVO: a Bia tem a caixa de pedidos no servidor do chat da B (paga com um passe da B)", criarBia.resultados?.[0]?.ok === true, JSON.stringify(criarBia));
  // A caixa de sempre da Ana, na A (criada com um passe da A antes de tudo): o que a A guarda da Ana antes da conversa.
  const caixaDaAnaNaA = { id: sorteio(32), pd: sorteio(32), pl: sorteio(32) };
  {
    const ckA = vivo.a.chaves[semana];
    const pubA = new Uint8Array(Buffer.from(ckA.publica, "base64url"));
    S._esquecerChaves(); // a memória das chaves é por semana: a da A não pode sair da memória da B
    const chaveA = await S.chaveDoEmissor(semana, new Uint8Array(0), { ler: async () => ({ publica: pubA, privadaSelada: S.selarPrivada(SEGREDO, semana, new Uint8Array(0), pubA, new Uint8Array(Buffer.from(ckA.pkcs8, "base64url"))), seq: 1 }), guardar: async () => null }, SEGREDO, false);
    const c2 = Array.from({ length: comum.PASSES_POR_DIA }, () => new publicVerif.Client(comum.MODO));
    const r2 = [];
    for (const cl of c2) r2.push(new genericBatched.TokenRequest(await cl.createTokenRequest(comum.desafio(), pubA)));
    const l2 = new genericBatched.Client().deserializeTokenResponse(await S.emitirLote(new genericBatched.Client().createTokenRequest(r2).serialize(), chaveA));
    const passeDaAna = comum.cabecalhoDoPasse(b64u((await c2[0].finalize(l2.tokenResponses[0].tokenResponse)).serialize()));
    const r = await fetch(`${vivo.a.url}/caixa/lote`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: passeDaAna }, body: JSON.stringify({ itens: [{ acao: "criar", id: b64u(caixaDaAnaNaA.id), pd_h: b64u(resumo("alumia/r2/passe-deposito", caixaDaAnaNaA.pd)), pl_h: b64u(resumo("alumia/r2/passe-leitura", caixaDaAnaNaA.pl)), multi: false }] }) }).then((x) => x.json());
    ok("VIVO: a Ana tem a caixa de sempre na A (com um passe da A)", r.resultados?.[0]?.ok === true);
  }
  const antesNaA = contar(vivo.a);
  const inicioDaConversa = pedidosDoAparelho.length;

  // O envelope: cifrado (AES-256-GCM, chave da sessão que as duas já têm; aqui sorteada) e completado ao tamanho fixo. O servidor só vê bytes.
  const chaveDaSessao = crypto.randomBytes(32);
  const selar = (texto, tamanho) => {
    const iv = crypto.randomBytes(12);
    const cifra = crypto.createCipheriv("aes-256-gcm", chaveDaSessao, iv);
    const corpo = Buffer.alloc(tamanho - 12 - 16);
    corpo.write(JSON.stringify(texto));
    return new Uint8Array(Buffer.concat([iv, cifra.update(corpo), cifra.final(), cifra.getAuthTag()]));
  };
  const abrir = (env) => {
    const d = crypto.createDecipheriv("aes-256-gcm", chaveDaSessao, env.subarray(0, 12));
    d.setAuthTag(env.subarray(env.length - 16));
    return JSON.parse(Buffer.concat([d.update(env.subarray(12, env.length - 16)), d.final()]).toString().replace(/\0+$/, ""));
  };
  // A Ana, no aparelho dela, fala com a B direto.
  const chatB = new I.CaixasDeFora(B.chat, rede);
  const respostasDaAna = { id: sorteio(32), pd: sorteio(32), pl: sorteio(32), multi: false };
  await chatB.criar(respostasDaAna).then(() => ok("VIVO: a Ana cria a caixa de respostas no chat da B (prova de trabalho, sem passe)", true), (e) => ok("VIVO: a Ana cria a caixa de respostas no chat da B", false, e.message));
  const pedido = selar({ de: `${ANA.codinome}@${INSTANCIA_A}`, responder: { id: b64u(respostasDaAna.id), pd: b64u(respostasDaAna.pd) }, texto: "Oi, Bia! Sou da organização A." }, TAMANHO_PEDIDO);
  await chatB.pedir(dirDaBia, pedido).then(() => ok("VIVO: o pedido entra na caixa de pedidos da Bia (prova de trabalho, sem passe)", true), (e) => ok("VIVO: o pedido entra na caixa de pedidos da Bia", false, e.message));
  // A Bia (aparelho dela, instância B) lê e responde na caixa que a Ana criou lá.
  const daBia = await fetch(`${vivo.b.url}/caixa/buscar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b64u(pedidosDaBia.id), pl: b64u(pedidosDaBia.pl), cursor: 0 }) }).then((r) => r.json());
  const lido = daBia.pacotes?.[0] ? abrir(new Uint8Array(Buffer.from(daBia.pacotes[0].envelope, "base64"))) : null;
  ok("VIVO: a Bia lê o pedido (e sabe quem é: Ana@instancia-a)", lido?.de === `${ANA.codinome}@${INSTANCIA_A}`);
  const resposta = selar({ texto: "Oi, Ana! Recebi." }, TAMANHOS_DUPLA[0]);
  const dep = await fetch(`${vivo.b.url}/caixa/lote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itens: [{ acao: "depositar", id: lido?.responder?.id, pd: lido?.responder?.pd, envelope: b64u(resposta) }] }) }).then((r) => r.json());
  ok("VIVO: a Bia responde na caixa da Ana (depósito sem passe, como sempre)", dep.resultados?.[0]?.ok === true);
  const lidas = await chatB.buscarPacotes(respostasDaAna, 0);
  ok("VIVO: a Ana lê a resposta no chat da B", lidas.length === 1 && abrir(lidas[0].envelope).texto === "Oi, Ana! Recebi.");
  await chatB.confirmar(respostasDaAna, lidas[0]?.ordem ?? 1);
  ok("VIVO: e confirma (sai do servidor)", (await chatB.buscarPacotes(respostasDaAna, 0)).length === 0);

  // O que cada um viu.
  const daConversa = pedidosDoAparelho.slice(inicioDaConversa);
  ok("ACEITE: o aparelho da Ana não falou com a A nem uma vez durante a conversa", daConversa.length > 0 && daConversa.every((p) => !p.host.endsWith(INSTANCIA_A)), JSON.stringify([...new Set(daConversa.map((p) => p.host))]));
  ok("ACEITE: e todas as chamadas à B foram sem cookie, sem sessão e sem referência", daConversa.every((p) => p.init.credentials === "omit" && p.init.referrerPolicy === "no-referrer" && !/authorization|cookie/i.test(JSON.stringify(p.init.headers ?? {}))));
  const tudoNaB = psql(vivo.b, "select coalesce((select json_agg(c)::text from chat.caixas c), '') || coalesce((select json_agg(p)::text from chat.pacotes p), '') || coalesce((select json_agg(g)::text from chat.passes_gastos g), '');");
  const daAna = [ANA.usuario, ANA.codinome, INSTANCIA_A, hex(caixaDaAnaNaA.id), hex(resumo("alumia/r2/caixa", caixaDaAnaNaA.id)), b64(resumo("alumia/r2/caixa", caixaDaAnaNaA.id)), hex(respostasDaAna.id), hex(respostasDaAna.pl), hex(respostasDaAna.pd)];
  ok("ACEITE: nenhuma linha do banco do chat da B tem a conta da Ana, o nome da A ou a caixa da Ana na A (nem os passes crus dela)", daAna.every((x) => !tudoNaB.includes(x)), daAna.filter((x) => tudoNaB.includes(x)).join(","));
  const colunasB = psql(vivo.b, "select string_agg(column_name, ',') from information_schema.columns where table_schema = 'chat';");
  ok("ACEITE: o banco do chat da B nem tem onde guardar de qual instância alguém vem (nenhuma coluna de origem, conta ou endereço)", !/instancia|origem|usuario|conta|endereco|ip\b/.test(colunasB), colunasB);
  ok("ACEITE: o banco do chat da A não ganhou nada com a conversa", contar(vivo.a) === antesNaA, `${antesNaA} → ${contar(vivo.a)}`);
}

postgrest.close();
console.log(`\nChat entre instâncias (R3): ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);

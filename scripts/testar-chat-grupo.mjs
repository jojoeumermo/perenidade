// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conversa em grupo do chat (recurso "alumia-chat-grupo", docs/rede/CHAT-PRIVADO.md ("Conversa em grupo")), de ponta a ponta, com os motores de verdade:
// a conversa a dois (Proteus + SPQR + envelope X-Wing, lib/rede/chat/r2/servico.ts) leva o convite e o pedido de entrada, e o grupo
// com membros escondidos (MLS na suíte híbrida do @wireapp/core-crypto, lib/rede/membros/grupo.ts) leva as mensagens. As caixas do
// GRUPO são as do banco de verdade: um Postgres (PGlite) com o install.sql do ramo, chamado pelas funções que a rota das caixas usa
// (public.rede_caixa_lote e public.rede_caixa_buscar). A conversa a dois fica no servidor de memória dos testes do chat.
//   1. o formato (lib/rede/chat/grupo/formato.ts): convite, pedido, recusa e as linhas do grupo; o que vem fora do formato cai;
//   2. a identidade da conta assina só os textos do grupo (apresentação, papéis, commit, boas-vindas), nunca outro uso;
//   3. dois participantes: criar, convidar pelo @ (só com conversa a dois aberta), aceitar, conversar nos dois sentidos, nome do
//      grupo, quem está (com o @ conferido no registro), código de segurança igual ao da conversa a dois, nenhum número com 2;
//   4. três participantes: quem entra depois NÃO lê as mensagens de antes; a contagem aparece com 3;
//   5. tirar: quem foi tirado não lê a mensagem nova (e o grupo fica só de leitura para ela); quem ficou lê;
//   6. sair: a mediação tira a folha de quem saiu no próximo commit; quem saiu não lê mais; a mediação que sai passa o papel antes;
//   7. recusa, convite de quem não tem conversa aberta, pedido forjado (de quem não foi convidado, ou com outra identidade): nada entra;
//   8. prazo para sumir e "ver uma vez" (dentro do cifrado), apagar para todos (só a própria);
//   9. o aparelho recarregado (retrato do grupo + loja do motor) continua no grupo, lendo e escrevendo;
//  10. A REGRA DE PRIVACIDADE, no banco: nenhuma linha de nenhuma tabela tem a conta, o @, a identidade, o nome do grupo, o id do
//      grupo, a credencial do MLS ou um texto; as tabelas que o grupo usou não têm coluna de conta nem de endereço de rede; nenhum
//      envelope fora dos tamanhos fixos; o servidor não sabe quem está em qual grupo. E nenhuma migração nova foi precisa.
//  11. as telas: o recurso, os textos nos seis idiomas, a lista e a janela com os grupos, nada de cifra importado nas telas.
// Uso: npm run testar:chat-grupo
import "fake-indexeddb/auto";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { sha256 } from "@noble/hashes/sha2.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function parte(nome, f) {
  try {
    await f();
  } catch (e) {
    falhas.push(`${nome}: ${e?.code ?? e?.message ?? e}${e?.stack ? ` ${String(e.stack).split("\n").slice(1, 3).join(" ").trim()}` : ""}`);
  }
}
async function codigoDe(f) {
  try {
    await f();
    return "";
  } catch (e) {
    return e?.code ?? e?.message ?? String(e);
  }
}
const contem = (grande, pequeno) => pequeno.length > 0 && Buffer.from(grande).indexOf(Buffer.from(pequeno)) >= 0;

// O Postgres de teste nasce antes de tudo: depois que o motor de cifra entra, ele não sobe no mesmo processo.
const { criarBanco } = await import("./banco-local.mjs");
const banco = await criarBanco();
const { dono } = banco;
const agoraS = () => Math.floor(Date.now() / 1000);
const rpc = (quem, funcao, argumentos = {}) =>
  banco.exclusivo(async () => {
    const nomes = Object.keys(argumentos);
    const papel = quem.papel ?? "authenticated";
    const claims = papel === "authenticated" ? JSON.stringify({ role: papel, sub: quem.sub, aal: "aal2", session_id: quem.sessao, iat: agoraS() - 30, exp: agoraS() + 3600 }) : JSON.stringify({ role: papel });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [claims]);
    await banco.pg.exec(`set role ${papel}`);
    try {
      const lista = nomes.map((n, i) => `${n} => $${i + 1}`).join(", ");
      const valores = nomes.map((n) => {
        const v = argumentos[n];
        return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Uint8Array) ? JSON.stringify(v) : v;
      });
      return (await banco.pg.query(`select public.${funcao}(${lista}) as r`, valores)).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
const SERVIDOR_DO_SITE = { papel: "service_role" };
const hojeNoBanco = (await dono("select interno.caixa_hoje()::text as d")).rows[0].d;
// As contas existem no banco (como na vida real): o teste da privacidade procura essas contas em todas as linhas.
const ANA = await banco.criarUsuario("ana@grupo.local", "Ana");
const BIA = await banco.criarUsuario("bia@grupo.local", "Bia");
const CAIO = await banco.criarUsuario("caio@grupo.local", "Caio");
const DANI = await banco.criarUsuario("dani@grupo.local", "Dani");
/** Cada tabela e quantas linhas tem: as que mudarem durante o grupo são as que o grupo usou. */
async function contagens() {
  const tabelas = (await dono("select schemaname as s, tablename as t from pg_tables where schemaname in ('public', 'interno', 'auth') order by 1, 2")).rows;
  const m = new Map();
  for (const { s, t } of tabelas) m.set(`${s}.${t}`, Number((await dono(`select count(*)::int as n from "${s}"."${t}"`)).rows[0].n));
  return m;
}
const antesDoGrupo = await contagens();

// O transporte das caixas do GRUPO: as mesmas funções que a rota /api/alumia/caixa/* chama, com os mesmos resumos.
const R = (rotulo, v) => crypto.createHash("sha256").update(Buffer.concat([Buffer.from(rotulo, "utf8"), Buffer.from(v)])).digest();
const b64 = (b) => Buffer.from(b).toString("base64");
const depositosDoGrupo = [];
const lote = (itens) => rpc(SERVIDOR_DO_SITE, "rede_caixa_lote", { p_itens: itens, p_dia: hojeNoBanco });
const caixasDoBanco = {
  async criar(c) {
    const r = await lote([{ acao: "criar", id_h: b64(R("alumia/r2/caixa", c.id)), pd_h: b64(R("alumia/r2/passe-deposito", c.pd)), pl_h: b64(R("alumia/r2/passe-leitura", c.pl)), multi: c.multi, gastos: [b64(crypto.randomBytes(32))] }]);
    if (r.resultados[0].ok !== true) throw new Error(`criar:${r.resultados[0].erro}`);
  },
  async depositar(c, envelope, _franquia, unico) {
    depositosDoGrupo.push(envelope.length);
    const r = await lote([{ acao: "depositar", id_h: b64(R("alumia/r2/caixa", c.id)), pd: b64(c.pd), envelope: b64(envelope), ...(unico ? { unico: true } : {}) }]);
    const item = r.resultados[0];
    return item.ok ? { ok: true } : { ok: false, erro: item.erro === "ocupada" || item.erro === "tamanho" ? item.erro : "rede" };
  },
  async buscar(c, cursor) {
    const r = await rpc(SERVIDOR_DO_SITE, "rede_caixa_buscar", { p_id_h: R("alumia/r2/caixa", c.id), p_pl: Buffer.from(c.pl), p_cursor: cursor });
    return r.pacotes.map((p) => ({ ordem: p.ordem, envelope: new Uint8Array(Buffer.from(p.envelope, "base64")), franquia: null, marca: null, dia: p.dia }));
  },
};

// ═══════════════════ A conversa a dois, com o motor de verdade (o arranjo do testar:p4-conversa) ═══════════════════
const { motorNoNode } = await import("./cifra-no-node.mjs");
const { spqrNoNode } = await import("./spqr-no-node.mjs");
const { paraB64Url, deB64Url, texto, juntar } = await import("../lib/rede/chat/r2/bytes.ts");
const { ChatDoAparelho } = await import("../lib/rede/chat/r2/servico.ts");
const { cofreDaLista } = await import("../lib/rede/aparelhos/sincronia.ts");
const { TAMANHOS_DO_ARQUIVO } = await import("../lib/rede/aparelhos/arquivo.ts");
const { TAMANHO_DO_PEDIDO } = await import("../lib/rede/chat/r2/pedido.ts");
const { ROTULOS_DE_FORA } = await import("../lib/rede/chat/r2/rotulos.ts");
const M = await motorNoNode();
const SPQR = await spqrNoNode();
const H = (rotulo, v) => sha256(juntar(texto(rotulo), v));
const servidor = { caixas: new Map(), contas: new Map(), aparelhos: new Map(), preChaves: new Map(), cofres: new Map(), depositos: [] };
const relogio = { agora: Date.UTC(2026, 10, 27, 12) };
const dia = () => new Date(relogio.agora).toISOString().slice(0, 10);
const caixaDe = (id) => servidor.caixas.get(paraB64Url(H(ROTULOS_DE_FORA.caixa, id)));
const codinomeDe = {};
function transporteDe(usuario) {
  return {
    async criarCaixa(c) {
      const k = paraB64Url(H(ROTULOS_DE_FORA.caixa, c.id));
      const plh = paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pl));
      const ja = servidor.caixas.get(k);
      if (ja) {
        if (ja.pl_h !== plh) throw new Error("caixa_existe");
        return;
      }
      servidor.caixas.set(k, { pd_h: paraB64Url(c.pdH), pd_anterior_h: null, pl_h: plh, proxima: 1, pacotes: [] });
    },
    async depositar(c, envelope, franquia) {
      const cx = caixaDe(c.id);
      const pdh = paraB64Url(H(ROTULOS_DE_FORA.passeDeposito, c.pd));
      const aceito = !!cx && (cx.pd_h === pdh || cx.pd_anterior_h === pdh);
      servidor.depositos.push({ tamanho: envelope.length, envelope: new Uint8Array(envelope), aceito });
      if (aceito) cx.pacotes.push({ ordem: cx.proxima++, envelope: new Uint8Array(envelope), franquia: franquia && new Uint8Array(franquia), dia: dia() });
      return { ok: true };
    },
    async buscar(c, cursor) {
      const cx = caixaDe(c.id);
      if (!cx || cx.pl_h !== paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) return [];
      return cx.pacotes.filter((p) => p.ordem > cursor).map((p) => ({ ...p, marca: null }));
    },
    async confirmar(c, ate) {
      const cx = caixaDe(c.id);
      if (cx && cx.pl_h === paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) cx.pacotes = cx.pacotes.filter((p) => p.ordem > ate);
    },
    async trocar(c, pdH, bloqueio) {
      const cx = caixaDe(c.id);
      if (!cx || cx.pl_h !== paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) return;
      cx.pd_anterior_h = bloqueio ? null : cx.pd_h;
      cx.pd_h = paraB64Url(pdH);
    },
    async apagar(c) {
      const k = paraB64Url(H(ROTULOS_DE_FORA.caixa, c.id));
      const cx = servidor.caixas.get(k);
      if (cx && cx.pl_h === paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) servidor.caixas.delete(k);
    },
    async lerDiretorio(codinome) {
      const [u, c] = [...servidor.contas].find(([, x]) => x.codinome === codinome) ?? [];
      if (!u) return null;
      const aparelhos = [...servidor.aparelhos.values()].filter((a) => a.usuario === u).map((a) => ({ ...a, usuario: undefined }));
      return { usuario: u, identidade: c.identidade, pedidosXwing: c.pedidosXwing, pedidosAssinatura: c.pedidosAssinatura, pedidosCaixa: c.pedidosCaixa, pedidosPd: c.pedidosPd, aparelhos };
    },
    async reivindicar(u) {
      const saida = [];
      for (const [k, a] of servidor.aparelhos) {
        if (a.usuario !== u) continue;
        const lista = servidor.preChaves.get(k) ?? [];
        const i = lista.findIndex((p) => !p.ultima);
        const p = i >= 0 ? lista.splice(i, 1)[0] : lista.find((x) => x.ultima);
        if (p) saida.push({ aparelho: a.aparelho, id: p.id, pre: p.pkb, assinatura: p.assinatura });
      }
      return saida;
    },
    async depositarPedido(codinome, envelope) {
      if (envelope.length !== TAMANHO_DO_PEDIDO) throw new Error("tamanho");
      const c = [...servidor.contas.values()].find((x) => x.codinome === codinome);
      if (c) await this.depositar({ id: c.pedidosCaixa, pd: c.pedidosPd }, envelope, null);
    },
    async publicarConta(c) {
      const k = paraB64Url(H(ROTULOS_DE_FORA.caixa, c.pedidosCaixa));
      const ja = servidor.caixas.get(k);
      servidor.caixas.set(k, { pd_h: paraB64Url(H(ROTULOS_DE_FORA.passeDeposito, c.pedidosPd)), pd_anterior_h: null, pl_h: paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pedidosPl)), proxima: ja?.proxima ?? 1, pacotes: ja?.pacotes ?? [] });
      const publico = { ...c };
      delete publico.pedidosPl;
      servidor.contas.set(usuario, { ...publico, codinome: codinomeDe[usuario] });
    },
    async publicarAparelho(a) {
      servidor.aparelhos.set(paraB64Url(a.aparelho), { ...a, usuario });
    },
    async publicarPreChaves(aparelho, lista) {
      servidor.preChaves.set(paraB64Url(aparelho), [...lista]);
    },
    async tirarAparelho(aparelho) {
      servidor.aparelhos.delete(paraB64Url(aparelho));
    },
    async lerCofre(tipo) {
      return servidor.cofres.get(`${usuario}:${tipo}`) ?? null;
    },
    async gravarCofre(tipo, versao, blob) {
      if (!TAMANHOS_DO_ARQUIVO.includes(blob.length)) throw new Error("invalido:tamanho");
      const k = `${usuario}:${tipo}`;
      if ((servidor.cofres.get(k)?.versao ?? 0) !== versao) return "versao_ocupada";
      servidor.cofres.set(k, { versao: versao + 1, blob: new Uint8Array(blob) });
      return { versao: versao + 1 };
    },
  };
}
function historicoNovo() {
  const m = new Map();
  return {
    m,
    async guardar(x) {
      m.set(`${x.conversa}:${x.id}:${x.aparelho}`, { ...x });
    },
    async apagar(conversa, id, autor) {
      for (const [k, x] of m) if (x.conversa === conversa && x.id === id && x.autor === autor) m.delete(k);
    },
    async apagarConversa(conversa) {
      for (const [k, x] of m) if (x.conversa === conversa) m.delete(k);
    },
    async editar(conversa, id, autor, t) {
      for (const x of m.values()) if (x.conversa === conversa && x.id === id && x.autor === autor) Object.assign(x, { texto: t, editada: true });
    },
    da: (conversa) => [...m.values()].filter((x) => x.conversa === conversa),
  };
}

// ═══════════════════ Os aparelhos: a conversa a dois e os grupos de cada pessoa ═══════════════════
// O mesmo adaptador do navegador (lib/rede/chat/grupo/transporte.ts) por cima das funções do banco.
const { transporteDosGrupos, CURSOR_MAXIMO } = await import("../lib/rede/chat/grupo/transporte.ts");
const transporteDoBanco = transporteDosGrupos(caixasDoBanco);
const { Grupo } = await import("../lib/rede/membros/grupo.ts");
const { GruposDoAparelho } = await import("../lib/rede/chat/grupo/servico.ts");
const { contatoDoChat } = await import("../lib/rede/chat/grupo/contato.ts");
const formato = await import("../lib/rede/chat/grupo/formato.ts");
const { paraB64: paraB64M, deB64: deB64M } = await import("../lib/rede/membros/bytes.ts");
const { canonico } = await import("../lib/rede/membros/bytes.ts");
const { ROTULOS: ROTULOS_DOS_MEMBROS } = await import("../lib/rede/membros/rotulos.ts");
const { assinarTextoDoGrupo, novoParEd25519 } = await import("../lib/rede/chat/r2/certificados.ts");

const credenciais = [];
/** A guarda de um aparelho (memória, como a selada do navegador). `copia`: tudo o que foi guardado, para procurar segredo. */
function guardaNova() {
  const m = new Map();
  return { m, ler: async (k) => (m.has(k) ? structuredClone(m.get(k)) : null), guardar: async (k, v) => void m.set(k, structuredClone(v)), apagar: async (k) => void m.delete(k) };
}
/** O aparelho do MLS dos grupos, pela mesma montagem do navegador (lib/rede/chat/grupo/aparelho.ts), com a loja na memória. */
const { prepararAparelhoDoGrupo } = await import("../lib/rede/chat/grupo/aparelho.ts");
async function aparelhoDoGrupo(chat, cc = null) {
  const identidade = { publica: deB64Url(chat.identidadePublica()), assinar: async (t) => chat.assinarParaOGrupo(t) };
  const ap = await prepararAparelhoDoGrupo(M, cc ?? M.CoreCrypto.new(await M.Database.inMemory()), identidade, transporteDoBanco);
  credenciais.push(ap.cliente.copyBytes());
  return ap;
}
const pessoas = {};
async function pessoa(usuario, codinome) {
  codinomeDe[usuario] = codinome;
  const motor = M.CoreCrypto.new(await M.Database.inMemory());
  const historico = historicoNovo();
  const p = { usuario, codinome, historico, chat: null, grupos: null, guarda: guardaNova(), conversas: {} };
  const deps = {
    motor, spqr: SPQR, transporte: transporteDe(usuario), historico, cofre: cofreDaLista, persistir: async () => undefined,
    sigo: async () => false, conferirRegistro: async (conta, identidade) => (pessoas[conta] && paraB64Url(identidade) === pessoas[conta].chat.identidadePublica() ? "confere" : "nao_confere"), agora: () => relogio.agora,
    // O que o navegador faz (lib/rede/chat/grupo/navegador.ts): o controle "grupo" vai para a fila dos grupos, sem esperar.
    aoGrupo: (x) => void p.grupos?.aoChegarConvite(x),
  };
  p.chat = await ChatDoAparelho.nascer(deps, usuario, codinome);
  p.ap = await aparelhoDoGrupo(p.chat);
  p.depsDosGrupos = {
    ap: p.ap, guarda: p.guarda, eu: { conta: usuario, codinome }, agora: () => relogio.agora,
    mandarPelaConversa: async (conversa, corpo) => void (await p.chat.mandarGrupo(conversa, corpo)),
    contatoPorCodinome: async (c) => contatoDoChat(p.chat, (x) => x.codinome === c),
    contatoPorConta: async (c) => contatoDoChat(p.chat, (x) => x.com === c),
    conferirIdentidade: (conta, identidade) => p.chat.conferirNoRegistro(conta, identidade),
  };
  p.grupos = new GruposDoAparelho(p.depsDosGrupos);
  pessoas[usuario] = p;
  return p;
}
const A = await pessoa(ANA, "ana_grupo");
const B = await pessoa(BIA, "bia_grupo");
const C = await pessoa(CAIO, "caio_grupo");
const D = await pessoa(DANI, "dani_grupo");
for (const x of [A, B, C, D]) await x.chat.rotinaAnonima();
for (const x of [A, B, C, D]) await x.chat.rotinaComSessao();
/** Abre a conversa a dois entre duas pessoas (pedido e aceite), como na tela. */
async function conversar(x, y) {
  const conv = await x.chat.pedirConversa(y.codinome, "oi");
  await y.chat.receberPedidos();
  await y.chat.aceitar(conv);
  await x.chat.receber();
  await y.chat.receber();
  await x.chat.mandarTexto(conv, "oi");
  await y.chat.receber();
  x.conversas[y.usuario] = conv;
  y.conversas[x.usuario] = conv;
  return conv;
}
await conversar(A, B);
await conversar(A, C);
await conversar(A, D);
/** Entrega o que a conversa a dois levou e espera a fila dos grupos de quem recebeu. */
async function entregar(...quem) {
  for (const q of quem) {
    await q.chat.receber();
    await q.grupos.naFila(async () => undefined);
  }
}
/** Todos buscam as caixas dos grupos (duas voltas: um commit lido leva a caixa nova). */
async function todosLeem(...quem) {
  for (let i = 0; i < 2; i++) for (const q of quem) await q.grupos.receber();
}
const textos = async (p, g) => (await p.grupos.mensagens(g)).map((m) => m.texto);
const NOME = "Núcleo Leste Cifrado";

// ═══════════════════ 1. O formato ═══════════════════
await parte("formato", async () => {
  const g = paraB64M(crypto.randomBytes(16));
  confere("1: convite lido", formato.lerCorpoDoConvite(JSON.stringify({ t: "convite", g, n: "  Horta   da rua " }))?.n === "Horta da rua");
  confere("1: convite sem nome, nome longo ou com controle: cai", [{ t: "convite", g, n: "" }, { t: "convite", g, n: "x".repeat(61) }, { t: "convite", g, n: "a\u0007b" }].every((c) => formato.lerCorpoDoConvite(JSON.stringify(c)) === null));
  confere("1: número de convite fora dos 16 bytes: cai", formato.lerCorpoDoConvite(JSON.stringify({ t: "recusa", g: paraB64M(crypto.randomBytes(15)) })) === null);
  confere("1: pedido sem a identidade de 32 bytes: cai", formato.lerCorpoDoConvite(JSON.stringify({ t: "pedido", g, i: paraB64M(crypto.randomBytes(31)), k: paraB64M(crypto.randomBytes(32)), r: paraB64M(crypto.randomBytes(32)), d: paraB64M(crypto.randomBytes(32)), p: "AAAA" })) === null);
  confere("1: tipo desconhecido e JSON quebrado: caem", formato.lerCorpoDoConvite(JSON.stringify({ t: "promover", g })) === null && formato.lerCorpoDoConvite("{") === null);
  const linha = formato.montarLinha({ t: "msg", id: paraB64M(crypto.randomBytes(16)), c: "oi", q: 1, p: 7 });
  confere("1: a linha começa com o prefixo do formato", linha.startsWith("alumia/chat-grupo/v1 ") && formato.lerLinha(linha)?.c === "oi");
  confere("1: prazo fora de 1, 7 e 30: cai", formato.lerLinha(linha.replace('"p":7', '"p":2')) === null);
  confere("1: texto vazio ou maior que 2000: cai", formato.lerLinha(linha.replace('"c":"oi"', '"c":"  "')) === null && formato.lerLinha(linha.replace('"c":"oi"', `"c":"${"x".repeat(2001)}"`)) === null);
  confere("1: um texto do grupo de outra tela (tópicos) não é linha desta", formato.lerLinha('alumia/p4/topicos/v1 {"t":"msg"}') === null && !formato.eLinhaDoGrupo("alumia/p4/topicos/v1 {}"));
  confere("1: 'quem' com conta que não é uuid: cai", formato.lerLinha(formato.montarLinha({ t: "eu", u: ANA, c: "ana" }).replace(ANA, "ana")) === null);
});

await parte("cursor", async () => {
  confere("1: o cursor 'lida até o fim' do grupo não vira pedido (o banco guarda integer)", (await transporteDoBanco.buscar({ id: crypto.randomBytes(32), pl: crypto.randomBytes(32) }, Number.MAX_SAFE_INTEGER)).length === 0 && CURSOR_MAXIMO === 2 ** 31 - 1);
  confere("1: sem o adaptador, o banco recusaria esse cursor", (await codigoDe(() => caixasDoBanco.buscar({ id: crypto.randomBytes(32), pl: crypto.randomBytes(32) }, Number.MAX_SAFE_INTEGER))) !== "");
});

// ═══════════════════ 2. A identidade assina só os textos do grupo ═══════════════════
await parte("assinatura", async () => {
  const par = novoParEd25519();
  for (const r of [ROTULOS_DOS_MEMBROS.folha, ROTULOS_DOS_MEMBROS.papeis, ROTULOS_DOS_MEMBROS.commit, ROTULOS_DOS_MEMBROS.boasVindas]) {
    confere(`2: assina o texto de "${r}"`, (await codigoDe(() => assinarTextoDoGrupo(par, canonico(r, new Uint8Array(4))))) === "");
  }
  for (const r of ["alumia/r2/voto/cedula/v1", "alumia/r2/declaracao/v1", ROTULOS_DOS_MEMBROS.entrada, ROTULOS_DOS_MEMBROS.gestao]) {
    confere(`2: recusa o texto de "${r}"`, (await codigoDe(() => assinarTextoDoGrupo(par, canonico(r, new Uint8Array(4))))) === "rotulo_errado");
  }
  confere("2: recusa o rótulo sem o zero do formato canônico (prefixo parecido)", (await codigoDe(() => assinarTextoDoGrupo(par, texto(`${ROTULOS_DOS_MEMBROS.papeis}x`)))) === "rotulo_errado");
});

// ═══════════════════ 3. Dois participantes ═══════════════════
let G = null;
await parte("dois", async () => {
  G = await A.grupos.criar(`  ${NOME} `);
  let lista = await A.grupos.lista();
  confere("3: o grupo criado aparece na lista, com o nome limpo, e quem criou é a mediação", lista.grupos.length === 1 && lista.grupos[0].nome === NOME && lista.grupos[0].souMediacao);
  confere("3: com uma pessoa, nenhum número", lista.grupos[0].contagem === null);
  confere("3: convidar quem não tem conversa aberta comigo: recusa", (await codigoDe(() => A.grupos.convidar(G, "@ninguem_aqui"))) === "grupo_sem_conversa");
  await A.grupos.convidar(G, "@bia_grupo");
  await entregar(B);
  lista = await B.grupos.lista();
  confere("3: o convite chega à Bia pela conversa a dois, com o nome e o @ de quem convidou", lista.convites.length === 1 && lista.convites[0].nome === NOME && lista.convites[0].codinome === "ana_grupo");
  confere("3: o convite não entra no histórico da conversa a dois", B.historico.da(B.conversas[ANA]).every((m) => !/chat-grupo|convite/.test(m.texto)));
  await B.grupos.responder(lista.convites[0].g, true);
  confere("3: aceitou: espera as boas-vindas", (await B.grupos.lista()).esperando.length === 1);
  await entregar(A);
  await todosLeem(B, A);
  lista = await B.grupos.lista();
  confere("3: a Bia está no grupo, com o mesmo id e o mesmo nome", lista.grupos.length === 1 && lista.grupos[0].id === G && lista.grupos[0].nome === NOME && lista.esperando.length === 0);
  confere("3: com 2 pessoas, nenhum número", lista.grupos[0].contagem === null && (await A.grupos.lista()).grupos[0].contagem === null);
  await A.grupos.mandarTexto(G, "bom dia, grupo");
  await todosLeem(B);
  confere("3: a Bia lê a Ana", (await textos(B, G)).includes("bom dia, grupo"));
  await B.grupos.mandarTexto(G, "bom dia, Ana");
  await todosLeem(A);
  const daBia = (await A.grupos.mensagens(G)).find((m) => m.texto === "bom dia, Ana");
  confere("3: a Ana lê a Bia, com a autora certa (a identidade da Bia)", daBia && daBia.autor === paraB64M(deB64Url(B.chat.identidadePublica())) && !daBia.minha);
  const pa = await A.grupos.pessoas(G);
  const bNaAna = pa.find((p) => p.codinome === "bia_grupo");
  confere("3: quem está, visto pela Ana: ela (mediação) e a Bia, com o @ conferido no registro", pa.length === 2 && pa[0].eu && pa[0].mediacao && bNaAna?.conferida === "confere" && !bNaAna.mediacao);
  const pb = await B.grupos.pessoas(G);
  confere("3: quem está, visto pela Bia: o @ da Ana chegou (linha 'quem' da mediação) e confere", pb.some((p) => p.codinome === "ana_grupo" && p.conferida === "confere" && p.mediacao));
  confere("3: o código de segurança com a Bia é o mesmo da conversa a dois", A.grupos.codigo(BIA, bNaAna.identidade) === A.chat.codigo(BIA));
  confere("3: a Bia não convida (só a mediação)", (await codigoDe(() => B.grupos.convidar(G, "ana_grupo"))) === "sem_papel");
  confere("3: a Bia não tira ninguém", (await codigoDe(() => B.grupos.tirar(G, pa[0].identidade))) === "sem_papel");
  await A.grupos.renomear(G, "Núcleo Leste");
  await todosLeem(B);
  confere("3: o nome novo chega à Bia (dentro do grupo)", (await B.grupos.lista()).grupos[0].nome === "Núcleo Leste");
});

// ═══════════════════ 4. Três participantes: quem entra depois não lê o que veio antes ═══════════════════
await parte("tres", async () => {
  await A.grupos.mandarTexto(G, "antes do Caio");
  await todosLeem(B);
  await A.grupos.convidar(G, "caio_grupo");
  await entregar(C);
  await C.grupos.responder((await C.grupos.lista()).convites[0].g, true);
  await entregar(A);
  await todosLeem(C, A, B);
  const lc = await C.grupos.lista();
  confere("4: o Caio entrou", lc.grupos.length === 1 && lc.grupos[0].id === G);
  confere("4: quem entra depois NÃO lê as mensagens de antes", !(await textos(C, G)).some((t) => ["bom dia, grupo", "bom dia, Ana", "antes do Caio"].includes(t)), (await textos(C, G)).join("|"));
  confere("4: com 3 pessoas, a contagem aparece (para todos)", lc.grupos[0].contagem === 3 && (await A.grupos.lista()).grupos[0].contagem === 3 && (await B.grupos.lista()).grupos[0].contagem === 3);
  await C.grupos.mandarTexto(G, "cheguei");
  await todosLeem(A, B);
  confere("4: os três leem o Caio", (await textos(A, G)).includes("cheguei") && (await textos(B, G)).includes("cheguei"));
  await B.grupos.mandarTexto(G, "oi, Caio");
  await todosLeem(A, C);
  confere("4: o Caio lê a Bia", (await textos(C, G)).includes("oi, Caio"));
  const pc = await C.grupos.pessoas(G);
  confere("4: o Caio sabe o @ das duas, conferidos (a linha 'quem' e as linhas 'eu')", ["ana_grupo", "bia_grupo"].every((n) => pc.some((p) => p.codinome === n && p.conferida === "confere")));
});

// ═══════════════════ 5. Tirar alguém ═══════════════════
await parte("tirar", async () => {
  const bia = (await A.grupos.pessoas(G)).find((p) => p.codinome === "bia_grupo");
  await A.grupos.tirar(G, bia.identidade);
  await A.grupos.mandarTexto(G, "depois que a Bia saiu");
  await todosLeem(B, C);
  confere("5: quem foi tirado NÃO lê a mensagem nova", !(await textos(B, G)).includes("depois que a Bia saiu"));
  confere("5: o grupo fica marcado para a Bia (fora, só leitura)", (await B.grupos.lista()).grupos[0].fora === "removido");
  confere("5: a Bia não consegue mais escrever", (await codigoDe(() => B.grupos.mandarTexto(G, "ainda estou?"))) === "grupo_fora");
  confere("5: o Caio lê", (await textos(C, G)).includes("depois que a Bia saiu"));
  confere("5: com 2 pessoas de novo, nenhum número", (await A.grupos.lista()).grupos[0].contagem === null);
  confere("5: a Bia sai da lista de quem está (na Ana e no Caio)", !(await A.grupos.pessoas(G)).some((p) => p.codinome === "bia_grupo") && !(await C.grupos.pessoas(G)).some((p) => p.codinome === "bia_grupo"));
  await B.grupos.esquecer(G);
  confere("5: a Bia tira o grupo da lista dela", (await B.grupos.lista()).grupos.length === 0);
});

// ═══════════════════ 6. Sair ═══════════════════
await parte("sair", async () => {
  await C.grupos.sair(G);
  confere("6: quem saiu não tem mais o grupo", (await C.grupos.lista()).grupos.length === 0);
  await todosLeem(A);
  await A.grupos.mandarTexto(G, "o Caio saiu");
  const pa = await A.grupos.pessoas(G);
  confere("6: a mediação tirou a folha de quem saiu (só a Ana ficou)", pa.length === 1 && pa[0].eu, pa.map((p) => p.codinome).join());
  // O Caio, de fora, com o retrato velho: não lê (o motor já apagou o grupo).
  const velho = await Grupo.restaurar(C.ap, structuredClone(C.guarda.m.get(`g:${G}`) ?? { v: 0 }));
  confere("6: o aparelho de quem saiu não tem mais o grupo para reler", velho === null);
  // A mediação que sai passa o papel antes: um grupo novo com a Bia, e a Ana sai.
  const G2 = await A.grupos.criar("Brigada da horta");
  await A.grupos.convidar(G2, "bia_grupo");
  await entregar(B);
  await B.grupos.responder((await B.grupos.lista()).convites[0].g, true);
  await entregar(A);
  await todosLeem(B, A);
  await A.grupos.sair(G2);
  await todosLeem(B);
  const pb = await B.grupos.pessoas(G2);
  confere("6: a mediação que sai passa o papel antes (a Bia vira mediação e fica sozinha)", pb.length === 1 && pb[0].eu && pb[0].mediacao, JSON.stringify(pb));
  confere("6: a Bia, agora mediação, convida", (await codigoDe(() => B.grupos.convidar(G2, "caio_grupo"))) === "grupo_sem_conversa");
});

// ═══════════════════ 7. Recusa, convite e pedido forjados ═══════════════════
await parte("recusa", async () => {
  await A.grupos.convidar(G, "dani_grupo");
  confere("7: o convite feito fica esperando", (await A.grupos.convitesFeitos(G)).length === 1);
  await entregar(D);
  const conv = (await D.grupos.lista()).convites[0];
  // Ataque: a Bia (que tem conversa com a Ana) manda um pedido com o número do convite da Dani.
  const { pedido } = await Grupo.montarPedido(B.ap, "");
  await B.chat.mandarGrupo(B.conversas[ANA], formato.montarCorpoDoConvite(formato.pedidoParaCorpo(conv.g, pedido)));
  await entregar(A);
  confere("7: pedido de quem não foi convidado (com o número do convite de outra pessoa): nada entra", (await A.grupos.pessoas(G)).length === 1 && (await A.grupos.convitesFeitos(G)).length === 1);
  // Ataque: a Dani manda o pedido com a identidade da Bia.
  const { pedido: p2 } = await Grupo.montarPedido(D.ap, "");
  await D.chat.mandarGrupo(D.conversas[ANA], formato.montarCorpoDoConvite(formato.pedidoParaCorpo(conv.g, { ...p2, identidade: deB64Url(B.chat.identidadePublica()) })));
  await entregar(A);
  confere("7: pedido com outra identidade que a conhecida da conversa: nada entra", (await A.grupos.pessoas(G)).length === 1 && (await A.grupos.convitesFeitos(G)).length === 1);
  await D.grupos.responder(conv.g, false);
  await entregar(A);
  confere("7: recusou: o convite some dos dois lados", (await A.grupos.convitesFeitos(G)).length === 0 && (await D.grupos.lista()).convites.length === 0);
  confere("7: e a Dani não entrou", (await D.grupos.lista()).grupos.length === 0 && (await A.grupos.pessoas(G)).length === 1);
});

// ═══════════════════ 8. Prazo, ver uma vez, apagar para todos ═══════════════════
await parte("prazo", async () => {
  await A.grupos.convidar(G, "dani_grupo");
  await entregar(D);
  await D.grupos.responder((await D.grupos.lista()).convites[0].g, true);
  await entregar(A);
  await todosLeem(D, A);
  await A.grupos.mandarTexto(G, "some amanhã", { prazo: 1 });
  await A.grupos.mandarTexto(G, "só uma vez", { prazo: 30, umaVez: true });
  const minha = await A.grupos.mandarTexto(G, "vou apagar", { prazo: 7 });
  await todosLeem(D);
  const naDani = await D.grupos.mensagens(G);
  confere("8: a Dani lê as três, com o 'ver uma vez' marcado", ["some amanhã", "só uma vez", "vou apagar"].every((t) => naDani.some((m) => m.texto === t)) && naDani.find((m) => m.texto === "só uma vez")?.umaVez === true);
  await A.grupos.apagarMensagem(G, minha.id);
  await todosLeem(D);
  confere("8: apagar para todos: some da Ana e da Dani", !(await textos(A, G)).includes("vou apagar") && !(await textos(D, G)).includes("vou apagar"));
  const deOutra = (await D.grupos.mensagens(G)).find((m) => m.texto === "só uma vez");
  await D.grupos.apagarMensagem(G, deOutra.id);
  await todosLeem(A);
  confere("8: apagar a de outra pessoa: só daqui (a dela fica)", !(await textos(D, G)).includes("só uma vez") && (await textos(A, G)).includes("só uma vez"));
  relogio.agora += 2 * 86_400_000;
  confere("8: passado o prazo de 1 dia, a mensagem some (dos dois lados)", !(await textos(A, G)).includes("some amanhã") && !(await textos(D, G)).includes("some amanhã"));
  confere("8: a de 30 dias continua", (await textos(A, G)).includes("só uma vez"));
});

// ═══════════════════ 9. O aparelho recarregado ═══════════════════
await parte("recarregar", async () => {
  // A Ana fecha a aba e abre de novo: a mesma loja do motor (o mesmo CoreCrypto) e a mesma guarda; tudo o mais é novo.
  const ap2 = await aparelhoDoGrupo(A.chat, A.ap.cc);
  const novos = new GruposDoAparelho({ ...A.depsDosGrupos, ap: ap2 });
  const l = await novos.lista();
  confere("9: a lista volta (nome, mediação)", l.grupos.some((g) => g.id === G && g.nome === "Núcleo Leste" && g.souMediacao));
  confere("9: as mensagens voltam", (await novos.mensagens(G)).some((m) => m.texto === "só uma vez"));
  await D.grupos.mandarTexto(G, "a Ana recarregou?");
  await novos.receber();
  confere("9: depois de recarregar, lê o que chegou", (await novos.mensagens(G)).some((m) => m.texto === "a Ana recarregou?"));
  await novos.mandarTexto(G, "recarreguei");
  await todosLeem(D);
  confere("9: e escreve (a Dani lê)", (await textos(D, G)).includes("recarreguei"));
  A.grupos = novos;
});

// ═══════════════════ 10. A regra de privacidade, no banco ═══════════════════
await parte("privacidade", async () => {
  const depois = await contagens();
  const usadas = [...depois].filter(([t, n]) => n !== antesDoGrupo.get(t)).map(([t]) => t);
  confere("10: o grupo usou só as tabelas das caixas", usadas.length > 0 && usadas.every((t) => /^interno\.(caixas|pacotes|caixa_|passes_)/.test(t)), usadas.join(", "));
  const colunas = (await dono(`select table_schema || '.' || table_name as t, column_name as c, data_type as d from information_schema.columns
    where table_schema || '.' || table_name = any($1)`, [usadas])).rows;
  confere("10: as tabelas que o grupo usou não têm coluna de conta (uuid) nem de endereço de rede (inet)", colunas.every((c) => c.d !== "uuid" && c.d !== "inet" && !/usuario|conta|autor|membro|ip$|^ip|endereco/.test(c.c)), colunas.filter((c) => c.d === "uuid" || c.d === "inet").map((c) => `${c.t}.${c.c}`).join());
  // Tudo o que está no banco, linha a linha, em texto (bytea vira \x... em hexadecimal).
  const tabelas = (await dono("select schemaname as s, tablename as t from pg_tables where schemaname in ('public', 'interno') order by 1, 2")).rows;
  let tudo = "";
  for (const { s, t } of tabelas) for (const r of (await dono(`select row_to_json(x)::text as j from "${s}"."${t}" x`)).rows) tudo += `\n${s}.${t} ${r.j}`;
  const hex = (b) => Buffer.from(b).toString("hex");
  const b64u = (b) => paraB64M(b);
  const procurar = {
    "a conta de alguém": [ANA, BIA, CAIO, DANI],
    "o @ de alguém": ["ana_grupo", "bia_grupo", "caio_grupo", "dani_grupo"],
    "o nome do grupo": ["Núcleo Leste", "Brigada da horta", "Leste Cifrado"],
    "o texto de uma mensagem": ["bom dia, grupo", "depois que a Bia saiu", "recarreguei", "cheguei"],
    "a identidade de alguém (hexadecimal ou base64)": [A, B, C, D].flatMap((p) => { const i = deB64Url(p.chat.identidadePublica()); return [hex(i), b64u(i), Buffer.from(i).toString("base64").replace(/=+$/, "")]; }),
    "o id do grupo": [hex(deB64M(G)), G],
    "a credencial do MLS de algum aparelho": credenciais.flatMap((c) => [hex(c), Buffer.from(c).toString("utf8")]),
  };
  for (const [o, lista] of Object.entries(procurar)) {
    const achado = lista.find((x) => x && tudo.includes(x));
    confere(`10: nenhuma linha do banco tem ${o}`, !achado, achado ? (tudo.split("\n").find((l) => l.includes(achado)) ?? "").slice(0, 160) : "");
  }
  // A conta da pessoa só aparece nas tabelas da conta (auth.users e o perfil), nunca junto de caixa ou pacote.
  const linhasComConta = tudo.split("\n").filter((l) => [ANA, BIA, CAIO, DANI].some((u) => l.includes(u)));
  confere("10: o servidor não sabe quem está em qual grupo (nenhuma linha liga conta a caixa)", linhasComConta.every((l) => !/^interno\.(caixas|pacotes)/.test(l)));
  const tamanhos = new Set([2098, 8242, 32818, 131122]);
  confere("10: todo envelope do grupo tem um dos tamanhos fixos", depositosDoGrupo.length > 0 && depositosDoGrupo.every((n) => tamanhos.has(n)), [...new Set(depositosDoGrupo)].join());
  const noBanco = (await dono("select distinct octet_length(envelope) as n from interno.pacotes")).rows.map((r) => r.n);
  confere("10: no banco, só os tamanhos fixos", noBanco.every((n) => tamanhos.has(n)), noBanco.join());
  // A conversa a dois: o convite e o pedido vão no envelope de tamanho fixo de sempre.
  const DUPLA = new Set([2048, 4096, 8192, 16384, 24576, 32768].map((n) => 1120 + n + 16));
  servidor.depositos.length = 0;
  await A.grupos.convidar(G, "bia_grupo");
  confere("10: o convite pela conversa a dois sai num tamanho fixo da conversa", servidor.depositos.length > 0 && servidor.depositos.every((d) => DUPLA.has(d.tamanho)), servidor.depositos.map((d) => d.tamanho).join());
  confere("10: o envelope do convite não leva o nome do grupo às claras", servidor.depositos.every((d) => !contem(d.envelope, Buffer.from("Núcleo Leste"))));
  // As guardas dos aparelhos (o que fica no disco, cifrado no navegador) não vão ao servidor: só para conferir que o nome mora lá.
  confere("10: o nome do grupo mora só nos aparelhos", JSON.stringify([...A.guarda.m.values()]).includes("Núcleo Leste"));
  confere("10: nenhuma migração nova: o grupo usa só as funções das caixas que já existiam", !existe("supabase/migracoes/20261130-chat-grupo.sql"));
});

// ═══════════════════ 11. As telas e o recurso ═══════════════════
await parte("telas", async () => {
  const { RECURSOS, SO_PELO_NOME, lerRecursos } = await import("../lib/recursos.ts");
  confere("11: o recurso existe e é só pelo nome", "alumia-chat-grupo" in RECURSOS && SO_PELO_NOME.includes("alumia-chat-grupo"));
  confere("11: 'todos' não liga a conversa em grupo", !lerRecursos("todos").has("alumia-chat-grupo") || SO_PELO_NOME.includes("alumia-chat-grupo"));
  confere("11: o nome no painel único", /"alumia-chat-grupo": \{ nome:/.test(ler("components/painel/alumia/nomes-das-funcoes.ts")));
  const plano = (o, p = "", saida = []) => {
    for (const [k, v] of Object.entries(o)) {
      if (k === "_rascunho") continue;
      if (v && typeof v === "object") plano(v, `${p}${k}.`, saida);
      else saida.push(`${p}${k}`);
    }
    return saida;
  };
  const pacote = (l) => JSON.parse(ler(`i18n/rede/chat-grupo/${l}.json`));
  const chavesPt = plano(pacote("pt")).sort().join();
  for (const l of ["en", "es", "fr", "ru", "zh"]) confere(`11: textos em ${l}, as mesmas chaves e a marca _rascunho`, pacote(l)._rascunho === true && plano(pacote(l)).sort().join() === chavesPt);
  confere("11: o português é o final (sem marca)", pacote("pt")._rascunho === undefined);
  const marcas = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  const plana = (o, p = "", saida = {}) => {
    for (const [k, v] of Object.entries(o)) if (v && typeof v === "object") plana(v, `${p}${k}.`, saida); else saida[`${p}${k}`] = v;
    return saida;
  };
  const ptP = plana(pacote("pt"));
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const x = plana(pacote(l));
    const ruins = Object.keys(ptP).filter((k) => typeof ptP[k] === "string" && marcas(ptP[k]) !== marcas(String(x[k] ?? "")));
    confere(`11: marcadores iguais em ${l}`, ruins.length === 0, ruins.join());
  }
  const tela = semComentarios(ler("components/rede/chat/Tela.tsx"));
  const janela = semComentarios(ler("components/rede/chat/janela/JanelaDoChat.tsx"));
  confere("11: a página Conversas mostra os grupos atrás do recurso", /ligado\("alumia-chat-grupo"\)/.test(tela) && /ListaDeGrupos/.test(tela) && /ConversaDoGrupo/.test(tela));
  confere("11: a janela flutuante mostra os grupos e abre o grupo, atrás do recurso", /ligado\("alumia-chat-grupo"\)/.test(janela) && /ListaDeGrupos/.test(janela) && /ConversaDoGrupo/.test(janela));
  const telasDoGrupo = ["components/rede/chat/grupo/ListaDeGrupos.tsx", "components/rede/chat/grupo/ConversaDoGrupo.tsx"].map((c) => semComentarios(ler(c))).join("\n");
  confere("11: as telas do grupo não importam cifra nem motor (só o cliente)", !/from "@\/lib\/rede\/(membros|cifra|chat\/r2|grupos)\//.test(telasDoGrupo) && /cliente-grupo|grupo\/cliente/.test(telasDoGrupo));
  confere("11: nenhum número abaixo de 3 na tela (a contagem vem do motor, que dá null abaixo de 3)", !/pessoas\.length|\.length\s*\}\s*pessoas/.test(telasDoGrupo));
  const cliente = semComentarios(ler("lib/rede/chat/grupo/cliente.ts"));
  confere("11: o cliente da tela não manda nada do grupo ao servidor por fora (sem chamar o banco, sem fetch)", !/chamar\(|fetch\(|rpc\(/.test(cliente));
});

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  FALHA: " + f);
process.exit(falhas.length ? 1 : 0);

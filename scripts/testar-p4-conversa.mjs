// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, lote da conversa (itens 13 a 21), atrás de "alumia-p4-conversa". Tudo o que é conversa entra como TIPO NOVO DE CONTEÚDO
// DENTRO DO CIFRADO, pela interface que o chat já oferece (lib/rede/chat/r2/servico.ts e lib/rede/membros/grupo.ts): nada de Proteus,
// SPQR, MLS, envelope, caixas ou franquia muda, e o servidor não fica sabendo de que tipo é a mensagem (o envelope tem o tamanho de
// sempre).
//   13  foto de ver uma vez: o tipo novo do corpo de anexo (só "ver uma vez", sem metadado), pelo mesmo caminho e envelope, e a
//       tela que abre a foto dentro da proteção contra print do item 1;
//   14  freio de encaminhamento: a contagem dentro do corpo de texto (o texto continua provável na denúncia), o freio e a tela;
//   15  notas para mim: a conversa só comigo, pela sincronia dos meus aparelhos, que o servidor não conhece;
//   16  pastas de conversas (já existiam): as contas da lista e a regra de privacidade (só no aparelho, cifradas);
//   17  não perturbe só no aparelho: a janela no IndexedDB do aparelho, o service worker que silencia o push, e o banco que deixa
//       de segurar o push e de guardar a janela com o interruptor ligado;
//   18  envio agendado: o texto fica só no aparelho (nada no servidor antes da hora) e sai como mensagem comum, do tamanho de sempre;
//   19  "quem leva o quê" no grupo (tipo novo dentro do texto cifrado do grupo MLS) e a enquete do grupo da R3, que já existia;
//   20  tópicos dentro do grupo (mesmas pessoas; tipo novo dentro do texto cifrado do grupo MLS); o grupo filho fica pendente;
//   21  nota de voz com transcrição: só pelo reconhecedor local do navegador (a conferência das legendas dos stories), texto só na tela;
// Uso: npm run testar:p4-conversa
import "fake-indexeddb/auto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "@noble/hashes/sha2.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
/** Uma parte do teste: se o código ainda não existe (antes do item), a parte inteira conta como falha, sem derrubar as outras. */
async function parte(nome, f) {
  try {
    await f();
  } catch (e) {
    falhas.push(`${nome}: ${e?.code ?? e?.message ?? e}`);
  }
}
const contem = (grande, pequeno) => pequeno.length > 0 && Buffer.from(grande).indexOf(Buffer.from(pequeno)) >= 0;

// O Postgres de teste (PGlite, com o install.sql do ramo) nasce antes de tudo: depois que o motor de cifra e o fetch de mentira
// entram, ele não sobe no mesmo processo.
const { criarBanco } = await import("./banco-local.mjs");
const bancoDoTeste = criarBanco();
await bancoDoTeste;

// A rede: nada deste lote pode chamar a rede pelo navegador. Toda chamada a fetch durante as partes do aparelho é anotada.
// (O motor de cifra dos testes carrega o próprio WebAssembly por fetch de um endereço "data:" ou "file:": isso passa.)
const chamadas = [];
const fetchDeVerdade = globalThis.fetch;
globalThis.fetch = async (url, ...resto) => {
  const u = String(url instanceof Request ? url.url : url);
  if (u.startsWith("file:") || u.startsWith("data:")) return fetchDeVerdade(url, ...resto);
  chamadas.push(u);
  throw new Error("sem_rede_no_teste");
};

// ═══════════════════ O chat a dois, com o motor de verdade (o mesmo arranjo do testar:p4-anexo-cifrado) ═══════════════════
const { motorNoNode } = await import("./cifra-no-node.mjs");
const { spqrNoNode } = await import("./spqr-no-node.mjs");
const { paraB64Url, texto, juntar } = await import("../lib/rede/chat/r2/bytes.ts");
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
async function aparelho(usuario, codinome, chaves) {
  codinomeDe[usuario] = codinome;
  const motor = M.CoreCrypto.new(await M.Database.inMemory());
  const historico = historicoNovo();
  const deps = {
    motor, spqr: SPQR, transporte: transporteDe(usuario), historico, cofre: cofreDaLista, persistir: async () => undefined,
    sigo: async () => false, conferirRegistro: async () => "confere", agora: () => relogio.agora,
  };
  const chat = await ChatDoAparelho.nascer(deps, usuario, codinome, chaves);
  return { chat, historico, usuario };
}
const ANA = "aaaaaaaa-0000-4000-8000-000000000013";
const BIA = "bbbbbbbb-0000-4000-8000-000000000013";
const A = await aparelho(ANA, "ana");
const B = await aparelho(BIA, "bia");
for (const x of [A, B]) await x.chat.rotinaAnonima();
for (const x of [A, B]) await x.chat.rotinaComSessao();
const conv = await A.chat.pedirConversa("bia", "oi");
await B.chat.receberPedidos();
await B.chat.aceitar(conv);
await A.chat.receber();
await B.chat.receber();
await A.chat.mandarTexto(conv, "oi");
await B.chat.receber();
servidor.depositos.length = 0;
await A.chat.mandarTexto(conv, "ok");
await B.chat.receber();
/** O tamanho do envelope de um texto curto: toda mensagem nova deste lote tem de sair igual (o tipo não aparece de fora). */
const tamanhoDoTexto = servidor.depositos.map((d) => d.tamanho).join();
const envelopesDe = async (f) => {
  servidor.depositos.length = 0;
  const r = await f();
  return { r, tamanhos: servidor.depositos.map((d) => d.tamanho).join(), envelopes: servidor.depositos.map((d) => d.envelope) };
};

// ═══════════════════ 13. Foto de ver uma vez ═══════════════════
await parte("13", async () => {
  const { abrirAnexo, contextoDaConversa, lerCorpoDeAnexo, montarCorpoDeAnexo, prepararAnexo, TETOS } = await import("../lib/rede/chat/anexo-cifrado.ts");
  const u32be = (n) => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  const pedaco = (tipo, dados) => Buffer.concat([u32be(dados.length), Buffer.from(tipo, "latin1"), dados, new Uint8Array(4)]);
  const ihdr = Uint8Array.of(0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0);
  const idat = new Uint8Array(4000);
  crypto.getRandomValues(idat);
  const png = (extra = []) => new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pedaco("IHDR", ihdr), ...extra, pedaco("IDAT", idat), pedaco("IEND", new Uint8Array(0))]));
  const limpa = png();
  const comGps = png([pedaco("eXIf", Buffer.from("MM\0*GPS -23.55 -46.63 Pixel 7", "latin1"))]);
  const ctx = contextoDaConversa("r2", conv);
  const pf = await prepararAnexo(limpa, "image/png", 0, ctx, { dias: 1, umaVez: true });
  confere("13: a foto vira o tipo 'imagem', sempre de ver uma vez", pf.corpo.tipo === "imagem" && pf.corpo.mime === "image/png" && pf.corpo.umaVez === true);
  const codigoDe = async (f) => {
    try {
      await f();
      return "";
    } catch (e) {
      return e.code ?? e.message;
    }
  };
  let recusou = await codigoDe(() => prepararAnexo(limpa, "image/png", 0, ctx, { dias: 1 }));
  confere("13: foto sem 'ver uma vez' é recusada no aparelho", recusou === "anexo_invalido", recusou);
  recusou = await codigoDe(() => prepararAnexo(comGps, "image/png", 0, ctx, { dias: 1, umaVez: true }));
  confere("13: privacidade: foto que ainda leva metadado (EXIF, GPS) é recusada antes de cifrar", recusou === "anexo_metadado", recusou);
  recusou = await codigoDe(() => prepararAnexo(limpa, "image/png", 1000, ctx, { dias: 1, umaVez: true }));
  confere("13: a foto não tem duração", recusou === "anexo_longo", recusou);
  confere("13: o teto da foto é o da imagem do story (3 MB)", TETOS.imagem.bytes === 3 * 1024 * 1024 && TETOS.imagem.segundos === 0);
  const corpo = montarCorpoDeAnexo({ ...pf.corpo, endereco: "13131313131313131313131313131313" });
  const semMarca = new Uint8Array(corpo);
  semMarca[1] = 0;
  confere("13: um corpo de foto sem a marca de ver uma vez (aparelho alterado) não é lido", lerCorpoDeAnexo(corpo)?.tipo === "imagem" && lerCorpoDeAnexo(semMarca) === null);
  const { r, tamanhos, envelopes } = await envelopesDe(() => A.chat.mandarAnexo(conv, corpo));
  confere("13: o envelope da foto tem o MESMO tamanho do de um texto curto (o servidor não sabe que é foto)", tamanhos === tamanhoDoTexto, `${tamanhos} / ${tamanhoDoTexto}`);
  confere("13: privacidade: nenhum envelope leva a chave, o endereço ou a foto às claras", envelopes.every((e) => !contem(e, Buffer.from(pf.corpo.chave, "base64url")) && !contem(e, Buffer.from("13131313131313131313131313131313", "hex")) && !contem(e, idat.subarray(0, 32))));
  confere("13: quem mandou não guarda a foto", !A.historico.da(conv).some((x) => x.id === r.id));
  await B.chat.receber();
  const naBia = B.historico.da(conv).find((x) => x.id === r.id);
  confere("13: a Bia recebe a foto marcada como ver uma vez", naBia && naBia.umaVez === true && lerCorpoDeAnexo(Buffer.from(naBia.anexo, "base64url"))?.tipo === "imagem");
  confere("13: a foto abre de volta igual, byte a byte", Buffer.from(await abrirAnexo(pf.cifrado, lerCorpoDeAnexo(corpo), ctx)).equals(Buffer.from(limpa)));
  // A tela.
  const tela = ler("components/rede/chat/AnexoCifrado.tsx");
  const conversa = ler("components/rede/chat/Conversa.tsx");
  confere("13: o botão da foto só com a flag do lote ligada", /const comConversaP4 = ligado\("alumia-p4-conversa"\)/.test(conversa) && /foto=\{comConversaP4 \? \(tc\?\.foto \?\? null\) : null\}/.test(conversa) && /\{foto && \(/.test(tela));
  confere("13: a foto é refeita no canvas do aparelho antes de cifrar, e vai sempre como ver uma vez", tela.indexOf("refazerImagem(f)") > 0 && tela.indexOf("refazerImagem(f)") < tela.indexOf('await mandar(new Uint8Array(await refeita.arrayBuffer()), refeita.type || "image/webp", 0, true)'));
  confere("13: a foto e o vídeo de ver uma vez abrem dentro da proteção contra print do item 1, com a marca de quem lê", /<ConteudoProtegido ativo=\{protegido\} marca=\{marca\}/.test(tela) && /const protegido = umaVez && corpo\.tipo !== "audio" && !!foto/.test(tela) && /marca=\{minhaMarca\}/.test(conversa));
  confere("13: sem a proteção (flag desligada), a foto não abre", /if \(corpo\.tipo === "imagem" && !foto\) return/.test(tela));
  confere("13: nada baixa sozinho e nada vai a serviço de fora", /onClick=\{\(\) => void abrir\(\)\}/.test(tela) && !/https?:\/\//.test(semComentarios(tela)));
});

// ═══════════════════ 14. Freio de encaminhamento ═══════════════════
await parte("14", async () => {
  const { corpoDeTexto, lerCorpoDeTexto } = await import("../lib/rede/chat/r2/bloco.ts");
  const { trechoNoConteudo } = await import("../lib/rede/franquia/protocolo.ts");
  const regras = await import("../lib/rede/chat/encaminhar.ts");
  // O formato: a contagem vai dentro do corpo de texto, e o texto continua cru no fim (a denúncia com prova acha o trecho).
  const c = corpoDeTexto({ t: "Ato amanhã às 10h na praça", enc: 3 });
  confere("14: a contagem vai e volta dentro do corpo de texto", lerCorpoDeTexto(c)?.enc === 3 && lerCorpoDeTexto(c)?.t === "Ato amanhã às 10h na praça");
  confere("14: o texto encaminhado continua provável na denúncia com prova (o trecho está cru no corpo)", trechoNoConteudo(c, "às 10h na praça"));
  confere("14: texto sem a marca não traz contagem (o formato de antes não muda)", lerCorpoDeTexto(corpoDeTexto({ t: "oi" }))?.enc === undefined && corpoDeTexto({ t: "oi" })[0] === 0);
  confere("14: contagem zero no corpo é recusada", lerCorpoDeTexto(Uint8Array.from([8, 0, 111, 105])) === null);
  // As regras.
  confere("14: a contagem sobe um a cada encaminhamento, até 255", regras.contagemAoEncaminhar(undefined) === 1 && regras.contagemAoEncaminhar(4) === 5 && regras.contagemAoEncaminhar(255) === 255);
  confere("14: marca: \"encaminhada\" de 1 a 4, \"muitas vezes\" a partir de 5", regras.marcaDeEncaminhada(undefined) === null && regras.marcaDeEncaminhada(1) === "encaminhada" && regras.marcaDeEncaminhada(4) === "encaminhada" && regras.marcaDeEncaminhada(5) === "muitas");
  confere("14: o freio: até 5 conversas de uma vez; o que vai virar \"muitas vezes\" só para uma", regras.destinosPermitidos(undefined) === 5 && regras.destinosPermitidos(3) === 5 && regras.destinosPermitidos(4) === 1 && regras.destinosPermitidos(9) === 1);
  // De ponta a ponta: a Ana encaminha para a Bia e para a Cau.
  const C = await aparelho("cccccccc-0000-4000-8000-000000000014", "cau");
  await C.chat.rotinaAnonima();
  await C.chat.rotinaComSessao();
  const convAC = await A.chat.pedirConversa("cau", "oi");
  await C.chat.receberPedidos();
  await C.chat.aceitar(convAC);
  await A.chat.receber();
  await C.chat.receber();
  const { r, tamanhos, envelopes } = await envelopesDe(() => A.chat.encaminhar([conv, convAC], "Ato amanhã às 10h na praça", undefined));
  confere("14: encaminhou para as duas conversas", r.length === 2 && r.every((x) => x.entregues === 1));
  confere("14: o envelope do encaminhado tem o tamanho de sempre (o servidor não vê a marca nem a contagem)", tamanhos.split(",").every((n) => tamanhoDoTexto.split(",").includes(n)), `${tamanhos} / ${tamanhoDoTexto}`);
  confere("14: privacidade: o texto não aparece às claras em nenhum envelope", envelopes.every((e) => !contem(e, Buffer.from("na praça"))));
  await B.chat.receber();
  await C.chat.receber();
  const naBia = B.historico.da(conv).find((x) => x.texto === "Ato amanhã às 10h na praça");
  const naCau = C.historico.da(convAC).find((x) => x.texto === "Ato amanhã às 10h na praça");
  confere("14: quem recebe vê a contagem 1 (encaminhada)", naBia?.encaminhada === 1 && naCau?.encaminhada === 1);
  confere("14: a cópia de quem encaminhou também fica marcada", A.historico.da(conv).some((x) => x.texto === "Ato amanhã às 10h na praça" && x.encaminhada === 1));
  const erroDe = async (f) => {
    try {
      await f();
      return "";
    } catch (e) {
      return e.code ?? e.message;
    }
  };
  confere("14: o freio: com a contagem 4, para duas conversas de uma vez é recusado", (await erroDe(() => A.chat.encaminhar([conv, convAC], "corrente", 4))) === "encaminhar_limite");
  servidor.depositos.length = 0;
  const umaSo = await A.chat.encaminhar([conv], "corrente", 4);
  await B.chat.receber();
  confere("14: com a contagem 4, para uma conversa vai, e chega como \"muitas vezes\" (5)", umaSo.length === 1 && B.historico.da(conv).find((x) => x.id === umaSo[0].id)?.encaminhada === 5);
  confere("14: nada sai quando o freio recusa (só a conversa permitida depositou)", servidor.depositos.length > 0 && servidor.depositos.length <= 3);
  confere("14: mais de 5 de uma vez é recusado", (await erroDe(() => A.chat.encaminhar(["a", "b", "c", "d", "e", "f"], "x", undefined))) === "encaminhar_limite");
  // A tela.
  const conversa = ler("components/rede/chat/Conversa.tsx");
  const tela = ler("components/rede/chat/Encaminhar.tsx");
  confere("14: o Encaminhar só com os textos do lote (a flag) e nunca em ver uma vez ou na fila", /if \(tc && !m\.umaVez && !m\.pendente && m\.texto\)/.test(conversa));
  confere("14: a marca aparece na bolha", /<MarcaDeEncaminhada t=\{tc\.encaminhar\} contagem=\{m\.encaminhada\} \/>/.test(conversa));
  confere("14: a janela usa a regra do freio e a lista deste aparelho (nada de servidor)", /destinosPermitidos\(contagem\)/.test(tela) && !/rpc\(|fetch\(|\/api\//.test(semComentarios(tela)));
  confere("14: o histórico e o navegador guardam a contagem", /encaminhada\?: number/.test(ler("lib/rede/chat/historico.ts")) && /m\.encaminhada \? \{ encaminhada: m\.encaminhada \}/.test(ler("lib/rede/chat/r2/navegador.ts")));
});

// ═══════════════════ 15. Notas para mim ═══════════════════
await parte("15", async () => {
  const { idDasNotas, DIAS_DAS_NOTAS } = await import("../lib/rede/chat/r2/servico.ts");
  // A Ana liga um segundo aparelho (pelo QR: as chaves da conta, aparelho novo).
  const c = A.chat.chavesDaConta();
  const A2 = await aparelho(ANA, "ana", { identidade: Buffer.from(c.identidade, "base64url"), pedidos: Buffer.from(c.pedidos, "base64url"), sincronia: Buffer.from(c.sincronia, "base64url") });
  // O diretório que o aparelho 1 tinha lido é de antes do segundo existir: passa um dia (a validade da leitura) e ele relê.
  relogio.agora += 86_400_000 + 60_000;
  for (let i = 0; i < 2; i++) for (const x of [A, A2]) {
    await x.chat.rotinaAnonima();
    await x.chat.rotinaComSessao();
  }
  confere("15: o id das notas é o mesmo nos dois aparelhos da Ana e sai da chave de sincronia", A.chat.notas === A2.chat.notas && A.chat.notas === idDasNotas(Buffer.from(c.sincronia, "base64url")) && Buffer.from(A.chat.notas, "base64url").length === 16);
  confere("15: o id das notas é outro na conta da Bia", B.chat.notas !== A.chat.notas);
  confere("15: as notas não entram na lista de conversas (o servidor não guarda nem a lista cifrada com elas)", !(A.chat.notas in A.chat.estado.lista.conversas));
  const { r, tamanhos, envelopes } = await envelopesDe(() => A.chat.mandarNota("Senha do cadeado do galpão: 4 7 1 9"));
  confere("15: a nota fica no histórico deste aparelho, sem prazo curto", A.historico.da(A.chat.notas).some((x) => x.id === r.id && x.texto === "Senha do cadeado do galpão: 4 7 1 9" && x.expira - x.quando === DIAS_DAS_NOTAS * 86_400_000));
  confere("15: a nota foi para o outro aparelho da Ana (e só para ele)", r.entregues === 1 && envelopes.length === 1);
  confere("15: o envelope da nota tem o tamanho de sempre", tamanhos.split(",").every((n) => tamanhoDoTexto.split(",").includes(n)), `${tamanhos} / ${tamanhoDoTexto}`);
  confere("15: privacidade: o texto da nota não aparece às claras", envelopes.every((e) => !contem(e, Buffer.from("cadeado"))));
  const daBiaAntes = B.historico.m.size;
  await A2.chat.receber();
  await B.chat.receber();
  confere("15: o segundo aparelho da Ana recebe a nota", A2.historico.da(A.chat.notas).some((x) => x.id === r.id && x.autor === ANA && x.texto === "Senha do cadeado do galpão: 4 7 1 9"));
  confere("15: privacidade: a Bia não recebe nada da nota", B.historico.m.size === daBiaAntes && !B.historico.da(A.chat.notas).length);
  confere("15: a nota não conta como não lida em conversa nenhuma", Object.values(A2.chat.estado.porConversa).every((x) => x.naoLidas === 0));
  await A.chat.apagarNota(r.id);
  await A2.chat.receber();
  confere("15: apagar tira a nota daqui e do outro aparelho", !A.historico.da(A.chat.notas).length && !A2.historico.da(A.chat.notas).length);
  // Um aparelho de outra conta não escreve nas notas da Ana: mesmo que mande um bloco com o id delas, a Ana ignora.
  const r2 = await A2.chat.mandarNota("segunda");
  await A.chat.receber();
  confere("15: a nota do segundo aparelho chega ao primeiro", A.historico.da(A.chat.notas).some((x) => x.id === r2.id));
  const servico = ler("lib/rede/chat/r2/servico.ts");
  confere("15: privacidade: só um aparelho meu escreve nas minhas notas (o de outra conta é ignorado)", /if \(convId === this\.notas\) \{\s+if \(!r\.de\.meu\) return 0;/.test(servico));
  // A tela.
  const tela = ler("components/rede/chat/Tela.tsx");
  const notas = ler("components/rede/chat/Notas.tsx");
  confere("15: o botão das notas só com a flag (os textos do lote)", /const comConversaP4 = ligado\("alumia-p4-conversa"\)/.test(tela) && /\{tc && \(\s*\/\/ Notas para mim/.test(tela));
  confere("15: a tela das notas não fala com o servidor (só com o chaveiro do aparelho)", !/rpc\(|fetch\(|\/api\/|supabase/.test(semComentarios(notas)));
  confere("15: o Sair rápido esvazia a tela das notas", /aoApagarTudoDoChat\(/.test(notas));
});

// ═══════════════════ 16. Pastas de conversas (já existiam) ═══════════════════
await parte("16", async () => {
  const { conversasDaPasta, pastasDoResumo } = await import("../lib/rede/chat/pastas.ts");
  const resumo = new Map([
    ["c1", { pasta: "Trabalho" }],
    ["c2", { pasta: "" }],
    ["c3", { pasta: "Ação" }],
    ["c4", { pasta: "Trabalho" }],
  ]);
  confere("16: as pastas da lista vêm sem repetir, sem a vazia e em ordem", pastasDoResumo(resumo).join("|") === "Ação|Trabalho", pastasDoResumo(resumo).join("|"));
  const todas = [{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }, { id: "c5" }];
  confere("16: a pasta mostra só as conversas dela", conversasDaPasta(todas, resumo, "Trabalho").map((c) => c.id).join() === "c1,c4");
  confere("16: \"todas\" mostra tudo, inclusive conversa sem organização guardada", conversasDaPasta(todas, resumo, "").length === 5);
  const tela = ler("components/rede/chat/Tela.tsx");
  confere("16: a lista do chat usa estas contas", /pastasDoResumo\(resumo\)/.test(tela) && /conversasDaPasta\(todas, resumo, pasta\)/.test(tela));

  // A regra de privacidade: a pasta fica só no aparelho, cifrada no histórico; nada vai à rede.
  const h = await import("../lib/rede/chat/historico.ts");
  const conta = "aaaaaaaa-0000-4000-8000-000000000016";
  const antes = chamadas.length;
  await h.mudarOrganizacao(conta, "conversa-16", (o) => ({ ...o, pasta: "Pasta Secreta Dezesseis" }));
  const lida = await h.lerOrganizacao(conta, "conversa-16");
  confere("16: a pasta guardada volta igual", lida.pasta === "Pasta Secreta Dezesseis");
  const resumoDoAparelho = await h.resumoDasConversas(conta);
  confere("16: o resumo da lista traz a pasta (lido do aparelho)", resumoDoAparelho.get("conversa-16")?.pasta === "Pasta Secreta Dezesseis");
  confere("16: guardar e ler a pasta não chama a rede", chamadas.length === antes, chamadas.slice(antes).join());
  const crus = await new Promise((pronto, falhou) => {
    const p = indexedDB.open(h.BANCO_DO_HISTORICO);
    p.onsuccess = () => {
      const tx = p.result.transaction("conversas", "readonly");
      const g = tx.objectStore("conversas").getAll();
      g.onsuccess = () => pronto(g.result);
      g.onerror = () => falhou(g.error);
    };
    p.onerror = () => falhou(p.error);
  });
  const registro = crus.find((r) => r.chave === `${conta}:conversa-16`);
  confere("16: no IndexedDB a pasta está cifrada (o nome não aparece às claras)", registro && !contem(new Uint8Array(registro.cifrado), new TextEncoder().encode("Secreta")));
  const codigo = semComentarios(ler("lib/rede/chat/historico.ts")) + semComentarios(ler("lib/rede/chat/pastas.ts"));
  confere("16: o código das pastas não fala com o servidor", !/fetch\(|rpc\(|supabase|\/api\//.test(codigo));
});

// ═══════════════════ 17. Não perturbe com horário, só no aparelho ═══════════════════
await parte("17", async () => {
  const sil = await import("../lib/rede/avisos/silencio-no-aparelho.ts");
  const vm = await import("node:vm");
  // O service worker de verdade, num ambiente de mentira (como o testar:app-offline), com o IndexedDB de teste.
  const ouvintes = {};
  const mostradas = [];
  const contexto = {
    self: {
      location: { origin: "https://lucia.test" },
      registration: { active: {}, showNotification: async (titulo, opcoes) => void mostradas.push({ titulo, opcoes }) },
      clients: { claim: async () => undefined, matchAll: async () => [], openWindow: async () => undefined },
      skipWaiting: () => undefined,
      addEventListener: (tipo, f) => (ouvintes[tipo] = f),
    },
    caches: { open: async () => ({}), keys: async () => [], delete: async () => true },
    navigator: { onLine: true },
    indexedDB,
    Response, Request, URL, AbortController, TextEncoder, setTimeout, clearTimeout, Promise, Date,
    module: { exports: {} },
    fetch: async () => {
      throw new Error("sem_rede_no_teste");
    },
  };
  vm.createContext(contexto);
  vm.runInContext(ler("public/sw.js"), contexto, { filename: "sw.js" });
  const sw = contexto.module.exports;
  confere("17: o service worker e o aparelho usam o mesmo banco da janela", sw.BANCO_DO_SILENCIO === sil.BANCO_DO_SILENCIO);
  // A mesma conta nos dois lados, com janela no mesmo dia e atravessando a meia-noite.
  const casos = [
    [{ inicio: 60, fim: 600 }, 59, false], [{ inicio: 60, fim: 600 }, 60, true], [{ inicio: 60, fim: 600 }, 599, true], [{ inicio: 60, fim: 600 }, 600, false],
    [{ inicio: 1320, fim: 420 }, 1319, false], [{ inicio: 1320, fim: 420 }, 1320, true], [{ inicio: 1320, fim: 420 }, 0, true], [{ inicio: 1320, fim: 420 }, 419, true], [{ inicio: 1320, fim: 420 }, 420, false],
    [null, 100, false],
  ];
  confere("17: \"estou na janela?\" dá o mesmo no aparelho e no service worker", casos.every(([j, m, esperado]) => sil.noSilencio(j, m) === esperado && sw.noSilencio(j, m) === esperado));
  confere("17: janela torta (início igual ao fim, fora do dia) vale como sem janela", sw.noSilencio({ inicio: 5, fim: 5 }, 5) === false && sw.noSilencio({ inicio: -1, fim: 5 }, 2) === false && sil.janelaValida({ inicio: 1, fim: 1440 }) === null);
  confere("17: \"22:00\" vira 1320 e volta", sil.minutosDe("22:00") === 1320 && sil.hhmmDe(1320) === "22:00" && sil.minutosDe("24:00") === null);
  // Guardar no aparelho: nada vai à rede.
  const antes = chamadas.length;
  const agora = new Date();
  const m = agora.getHours() * 60 + agora.getMinutes();
  await sil.guardarJanelaNoAparelho({ inicio: (m + 1430) % 1440, fim: (m + 10) % 1440 });
  confere("17: a janela fica guardada neste aparelho", JSON.stringify(await sil.lerJanelaNoAparelho()) === JSON.stringify({ inicio: (m + 1430) % 1440, fim: (m + 10) % 1440 }));
  let erroDaJanela = "";
  try {
    await sil.guardarJanelaNoAparelho({ inicio: 10, fim: 10 });
  } catch (e) {
    erroDaJanela = e.code;
  }
  confere("17: início igual ao fim é recusado", erroDaJanela === "invalido:horario");
  confere("17: privacidade: guardar e ler a janela não chama a rede", chamadas.length === antes, chamadas.slice(antes).join());
  // O push dentro da janela: chega, sem som nem vibração, com o mesmo conteúdo sem texto.
  const empurrar = async (dados) => {
    const esperas = [];
    ouvintes.push({ data: { json: () => dados }, waitUntil: (p) => esperas.push(p) });
    await Promise.all(esperas);
    return mostradas.at(-1);
  };
  const quieto = await empurrar({ n: 3, l: "pt" });
  confere("17: dentro da janela o aviso chega SEM som nem vibração", quieto?.opcoes.silent === true);
  confere("17: o aviso continua sem texto de post (só o número)", quieto?.opcoes.body === "Você tem 3 avisos na Alumia." && quieto?.opcoes.tag === "rede-avisos");
  await sil.guardarJanelaNoAparelho(null);
  const normal = await empurrar({ n: 1, l: "pt" });
  confere("17: fora da janela (ou sem janela) o aviso é o de sempre", normal && normal.opcoes.silent === undefined && normal.opcoes.body === "Você tem 1 aviso na Alumia.");
  await sil.guardarJanelaNoAparelho({ inicio: (m + 60) % 1440, fim: (m + 120) % 1440 });
  const foraDaJanela = await empurrar({ n: 2, l: "en" });
  confere("17: com janela em outro horário, o aviso de agora tem som", foraDaJanela && foraDaJanela.opcoes.silent === undefined);
  await sil.guardarJanelaNoAparelho(null);

  // O banco: com o interruptor ligado, o servidor não segura o push nem guarda janela nova; desligado, tudo como antes.
  const { pg, dono, criarUsuario, rpc: chamar } = await bancoDoTeste;
  await pg.exec(ler("supabase/migracoes/20261127-p4-conversa.sql"));
  await pg.exec(ler("supabase/migracoes/20261127-p4-conversa.sql")); // idempotente: roda duas vezes
  const ana = await criarUsuario("ana17@exemplo.invalid", "Ana");
  await chamar({ papel: "authenticated", sub: ana, ip: "198.51.100.17" }, "eu"); // o perfil nasce na primeira entrada
  await dono("insert into interno.rede_avisos_silencio (usuario, inicio, fim) values ($1, 0, 1439)", [ana]);
  const emSilencio = async () => (await dono("select interno.alumia_em_silencio($1, '2026-11-27 12:00+00') s", [ana])).rows[0].s;
  confere("17: desligado, o servidor segura o push como antes", (await emSilencio()) === true);
  await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-p4-conversa', true) on conflict (nome) do update set ligado = true");
  confere("17: ligado, o servidor não segura mais o push pela janela antiga", (await emSilencio()) === false);
  let barrado = "";
  try {
    await dono("update interno.rede_avisos_silencio set inicio = 5 where usuario = $1", [ana]);
  } catch (e) {
    barrado = String(e.message);
  }
  confere("17: ligado, o banco não aceita mudar a janela no servidor", barrado.includes("silencio_no_aparelho"), barrado);
  await dono("delete from interno.rede_avisos_silencio where usuario = $1", [ana]);
  confere("17: ligado, tirar a janela antiga continua valendo", (await dono("select count(*)::int n from interno.rede_avisos_silencio where usuario = $1", [ana])).rows[0].n === 0);
  barrado = "";
  try {
    await dono("insert into interno.rede_avisos_silencio (usuario, inicio, fim) values ($1, 1, 2)", [ana]);
  } catch (e) {
    barrado = String(e.message);
  }
  confere("17: ligado, o banco não guarda janela nova", barrado.includes("silencio_no_aparelho"), barrado);
  const acesso = (await dono("select has_function_privilege('authenticated', 'interno.rede_p4_conversa_ligada()', 'execute') a, has_function_privilege('anon', 'interno.rede_p4_conversa_silencio_barrar()', 'execute') b")).rows[0];
  confere("17: as funções novas são fechadas para anon e authenticated", acesso.a === false && acesso.b === false);
  await dono("update interno.recursos_vivos set ligado = false where nome = 'alumia-p4-conversa'");
  await dono("insert into interno.rede_avisos_silencio (usuario, inicio, fim) values ($1, 0, 1439)", [ana]);
  confere("17: desligado de novo, volta a valer como antes", (await emSilencio()) === true);
  // A tela.
  const tela = ler("components/rede/avisos/HorarioDeSilencio.tsx");
  const doAparelho = tela.slice(tela.indexOf("if (noAparelho) {"), tela.indexOf("if (previa()) {", tela.indexOf("if (noAparelho) {")));
  confere("17: com a flag, guardar fica no aparelho (nada de rpc no caminho do aparelho)", doAparelho.includes("guardarJanelaNoAparelho(") && !doAparelho.includes("rpc"));
  confere("17: a janela antiga sai do servidor (os dois nulos) depois de vir para o aparelho", /guardarJanelaNoAparelho\(local\)[\s\S]*rpc\("rede_aviso_silencio_salvar", \{ p_inicio: null, p_fim: null \}\)/.test(tela));
  confere("17: com a flag, a tela não lê mais a janela do servidor pelo caminho antigo", /if \(previa\(\) \|\| !membro \|\| noAparelho\) return;/.test(tela));
});

// ═══════════════════ 18. Envio agendado, no aparelho ═══════════════════
await parte("18", async () => {
  const { AGENDAR_DE, AGENDAR_ATE, horaValida } = await import("../lib/rede/chat/agendar.ts");
  confere("18: a hora vale de 1 minuto a 30 dias", AGENDAR_DE === 60_000 && AGENDAR_ATE === 30 * 86_400_000 && !horaValida(1000 + 59_000, 1000) && horaValida(1000 + 60_000, 1000) && !horaValida(1000 + AGENDAR_ATE + 1, 1000) && !horaValida(NaN, 1000));
  const erroDe = async (f) => {
    try {
      await f();
      return "";
    } catch (e) {
      return e.code ?? e.message;
    }
  };
  confere("18: hora fora da janela é recusada", (await erroDe(() => A.chat.agendar(conv, "cedo demais", relogio.agora + 10_000))) === "agendar_hora");
  const servidorAntes = JSON.stringify([...servidor.caixas.values(), ...servidor.cofres.values()], (_, v) => (v instanceof Uint8Array ? Buffer.from(v).toString("base64") : v));
  servidor.depositos.length = 0;
  const quando = relogio.agora + 2 * 3_600_000;
  const { id } = await A.chat.agendar(conv, "Lembrete: panfletagem às 7h na estação", quando);
  confere("18: privacidade: agendar não deposita nada (o servidor não sabe que a mensagem existe)", servidor.depositos.length === 0);
  const servidorDepois = JSON.stringify([...servidor.caixas.values(), ...servidor.cofres.values()], (_, v) => (v instanceof Uint8Array ? Buffer.from(v).toString("base64") : v));
  confere("18: privacidade: nem as caixas nem a cópia da lista no servidor mudam ao agendar", servidorAntes === servidorDepois);
  confere("18: a agendada fica no histórico deste aparelho, marcada com a hora", A.historico.da(conv).some((x) => x.id === id && x.agendada === quando && x.texto === "Lembrete: panfletagem às 7h na estação"));
  confere("18: a agendada está na lista deste aparelho", A.chat.agendadasDe(conv).length === 1 && A.chat.agendadasDe(conv)[0].quando === quando);
  confere("18: antes da hora, nada sai", (await A.chat.enviarAgendadas()) === 0 && servidor.depositos.length === 0);
  // Uma segunda, de que a Ana desiste.
  const desistida = await A.chat.agendar(conv, "esta não vai", quando + 60_000);
  await A.chat.cancelarAgendada(conv, desistida.id);
  confere("18: desistir tira a agendada daqui (lista e histórico)", A.chat.agendadasDe(conv).length === 1 && !A.historico.da(conv).some((x) => x.id === desistida.id));
  relogio.agora = quando + 5 * 60_000;
  const { r, tamanhos, envelopes } = await envelopesDe(() => A.chat.enviarAgendadas());
  confere("18: na hora, a agendada sai (uma só: a desistida não)", r === 1 && A.chat.agendadasDe(conv).length === 0);
  confere("18: o envelope da agendada tem o tamanho de um texto comum (o servidor não sabe que foi agendada)", tamanhos.split(",").every((n) => tamanhoDoTexto.split(",").includes(n)), `${tamanhos} / ${tamanhoDoTexto}`);
  confere("18: privacidade: o texto agendado não aparece às claras", envelopes.every((e) => !contem(e, Buffer.from("panfletagem"))));
  confere("18: depois de sair, a marca de agendada some do histórico (vira a cópia comum)", !A.historico.da(conv).some((x) => x.agendada) && A.historico.da(conv).some((x) => x.texto === "Lembrete: panfletagem às 7h na estação"));
  confere("18: não sai duas vezes", (await A.chat.enviarAgendadas()) === 0);
  await B.chat.receber();
  const naBia = B.historico.da(conv).filter((x) => x.texto === "Lembrete: panfletagem às 7h na estação");
  confere("18: a Bia recebe uma vez, como mensagem comum", naBia.length === 1 && naBia[0].agendada === undefined);
  confere("18: a Bia não recebe a desistida", !B.historico.da(conv).some((x) => x.texto === "esta não vai"));
  // A tela.
  const conversa = ler("components/rede/chat/Conversa.tsx");
  const tela = ler("components/rede/chat/Tela.tsx");
  const janela = ler("components/rede/chat/AgendarEnvio.tsx");
  const pt = JSON.parse(ler("i18n/rede/p4-conversa/pt.json"));
  confere("18: o botão de agendar só com os textos do lote (a flag)", /\{tc && !umaVez && temporaria === null && \(/.test(conversa) && /\{tc && agendando && !editando && \(/.test(conversa));
  confere("18: a tela confere as agendadas só com a flag, de 30 em 30 s", /if \(!eu \|\| !comConversaP4 \|\| PREVIA_DO_CHAT\) return;/.test(tela) && /setInterval\(conferir, CONFERIR_AGENDADAS_MS\)/.test(tela));
  confere("18: a tela avisa que o aparelho precisa estar ligado com o chat aberto", /só neste aparelho/.test(pt.agendar.aviso) && /ligado/.test(pt.agendar.aviso) && /\{t\.aviso\}/.test(janela));
  confere("18: a janela não fala com o servidor", !/rpc\(|fetch\(|\/api\/|supabase/.test(semComentarios(janela)));
  confere("18: a bolha mostra a hora e o menu só oferece desistir", /data-agendada/.test(conversa) && /if \(m\.agendada\) \{\s+if \(tc\) itens\.push\(\{ rotulo: tc\.agendar\.desistir/.test(conversa));
  confere("18: o histórico e o navegador guardam a hora", /agendada\?: number/.test(ler("lib/rede/chat/historico.ts")) && /m\.agendada \? \{ agendada: m\.agendada \}/.test(ler("lib/rede/chat/r2/navegador.ts")));
});

// ═══════════════════ 19. "Quem leva o quê" e a enquete no grupo ═══════════════════
await parte("19", async () => {
  const { quemLevaNoGrupo, listasDoGrupo, ROTULOS, LIMITES } = await import("../lib/rede/chat/quem-leva.ts");
  const { enquetesDoGrupo } = await import("../lib/rede/voto/enquete-do-grupo.ts");
  const rotulos = await import("../lib/rede/cifra/rotulos.ts");
  // Um grupo de mentira com a mesma interface do Grupo do MLS (mandarTexto, receber, mensagens): cada texto chega aos OUTROS com o
  // autor (como o MLS faz), e quem mandou não recebe o próprio (por isso o módulo guarda as linhas próprias).
  const caixa = [];
  const membro = (eu) => {
    const g = { mensagens: [], lido: 0 };
    g.receber = async () => {
      for (; g.lido < caixa.length; g.lido++) if (caixa[g.lido].autor !== eu) g.mensagens.push(caixa[g.lido]);
    };
    g.mandarTexto = async (t) => {
      caixa.push({ tipo: "texto", autor: eu, corpo: new TextEncoder().encode(t) });
    };
    return g;
  };
  const nomes = ["ana", "bia", "caio", "dani"];
  const G = Object.fromEntries(nomes.map((n) => [n, membro(n)]));
  const L = Object.fromEntries(nomes.map((n) => [n, quemLevaNoGrupo(G[n], n)]));
  const sincronizar = async () => {
    for (const n of nomes) await G[n].receber();
  };
  const id = await L.ana.abrir("Ato de sábado", ["Faixa", "Água", "Caixa de som"]);
  await sincronizar();
  let r = L.bia.listas().find((x) => x.id === id);
  confere("19: a lista chega com título, coisas e quem abriu", r && r.titulo === "Ato de sábado" && r.coisas.join("|") === "Faixa|Água|Caixa de som" && r.autor === "ana" && !r.fechada);
  confere("19: quem abriu vê a própria lista (o aparelho guarda as linhas próprias)", L.ana.listas().some((x) => x.id === id));
  await L.bia.levar(id, 1);
  await L.caio.levar(id, 1);
  await L.caio.levar(id, 0);
  await L.dani.levar(id, 2);
  await L.dani.levar(id, 2, false); // desistiu
  await L.dani.levar(id, 9); // fora da lista
  await sincronizar();
  r = L.ana.listas().find((x) => x.id === id);
  confere("19: cada pessoa marca e desmarca o que leva; coisa fora da lista não conta", JSON.stringify(r.quem) === JSON.stringify([["caio"], ["bia", "caio"], []]), JSON.stringify(r.quem));
  await L.bia.fechar(id); // não foi ela quem abriu
  await sincronizar();
  confere("19: só quem abriu fecha", !L.caio.listas()[0].fechada);
  await L.ana.fechar(id);
  await L.dani.levar(id, 0);
  await sincronizar();
  r = L.caio.listas().find((x) => x.id === id);
  confere("19: depois de fechada, marca nova não conta", r.fechada && r.quem[0].join() === "caio");
  confere("19: todos os membros contam igual", nomes.every((n) => JSON.stringify(L[n].listas()) === JSON.stringify(L.ana.listas())));
  // Textos tortos, autor desconhecido e limites.
  const tortos = [
    { tipo: "texto", autor: "bia", corpo: new TextEncoder().encode(`${ROTULOS.quemLeva} {"t":"levo","id":"${crypto.randomUUID()}","c":0,"s":true}`) },
    { tipo: "texto", autor: "bia", corpo: new TextEncoder().encode(`${ROTULOS.quemLeva} isto não é json`) },
    { tipo: "texto", autor: null, corpo: new TextEncoder().encode(`${ROTULOS.quemLeva} {"t":"lista","id":"${crypto.randomUUID()}","p":"x","c":["a"]}`) },
    { tipo: "texto", autor: "bia", corpo: new TextEncoder().encode(`${ROTULOS.quemLeva} {"t":"lista","id":"${crypto.randomUUID()}","p":"x","c":[]}`) },
  ];
  confere("19: marca de lista que não existe, texto torto, autor sem apresentação e lista vazia: ignorados", listasDoGrupo(tortos).length === 0);
  let recusou = "";
  try {
    await L.ana.abrir("x", Array.from({ length: LIMITES.coisas + 1 }, (_, i) => `coisa ${i}`));
  } catch (e) {
    recusou = e.message;
  }
  confere("19: mais de 20 coisas é recusado no aparelho", recusou === "lista_invalida");
  confere("19: o rótulo do quem leva está na lista única dos rótulos e não repete nenhum", rotulos.LISTAS["quem-leva"]?.quemLeva === "alumia/p4/quem-leva/v1" && rotulos.rotulosRepetidos(rotulos.LISTAS).length === 0);
  // Privacidade: só passa pelo texto do grupo (o MLS cifra; o servidor vê pacotes de tamanho fixo), nada de rede nem de servidor.
  const modulo = semComentarios(ler("lib/rede/chat/quem-leva.ts"));
  confere("19: privacidade: o módulo só fala com o grupo cifrado (mandarTexto), nada de rede, servidor ou cifra própria", /g\.mandarTexto\(t\)/.test(modulo) && !/fetch\(|rpc\(|supabase|\/api\/|crypto\.subtle|localStorage|indexedDB/i.test(modulo));
  // A enquete do grupo (R3) já existia: o total só a partir de 3, e nenhuma opção com 1 ou 2.
  const voto = (autor, o, eid) => ({ tipo: "texto", autor, corpo: new TextEncoder().encode(`alumia/r3/enquete-do-grupo/v1 ${JSON.stringify({ t: "voto", id: eid, o })}`) });
  const eid = crypto.randomUUID();
  const abre = { tipo: "texto", autor: "ana", corpo: new TextEncoder().encode(`alumia/r3/enquete-do-grupo/v1 ${JSON.stringify({ t: "enquete", id: eid, p: "Pauta?", o: ["sim", "não"] })}`) };
  confere("19: a enquete do grupo (R3) só mostra números com 3 votos ou mais", enquetesDoGrupo([abre, voto("bia", 0, eid), voto("caio", 0, eid)])[0].contagem === null && JSON.stringify(enquetesDoGrupo([abre, voto("bia", 0, eid), voto("caio", 0, eid), voto("dani", 0, eid)])[0].contagem) === "[3,0]");
  confere("19: a enquete do grupo NÃO é secreta entre os membros (o voto secreto fica pendente: credencial anônima no grupo)", enquetesDoGrupo([abre, voto("bia", 0, eid)])[0].votos[0].autor === "bia");
});

// ═══════════════════ 20. Tópicos dentro do grupo ═══════════════════
await parte("20", async () => {
  const { topicosNoGrupo, topicosDoGrupo, ROTULOS, LIMITES, GRUPO_SERVE } = await import("../lib/rede/chat/topicos.ts");
  const rotulos = await import("../lib/rede/cifra/rotulos.ts");
  const caixa = [];
  const papeis = { mediacao: ["ana"] };
  const membro = (eu) => {
    const g = { mensagens: [], lido: 0, papeis };
    g.receber = async () => {
      for (; g.lido < caixa.length; g.lido++) if (caixa[g.lido].autor !== eu) g.mensagens.push(caixa[g.lido]);
    };
    g.mandarTexto = async (t) => {
      caixa.push({ tipo: "texto", autor: eu, corpo: new TextEncoder().encode(t) });
    };
    return g;
  };
  const nomes = ["ana", "bia", "caio"];
  const G = Object.fromEntries(nomes.map((n) => [n, membro(n)]));
  const T = Object.fromEntries(nomes.map((n) => [n, topicosNoGrupo(G[n], n)]));
  const sincronizar = async () => {
    for (const n of nomes) await G[n].receber();
  };
  const ato = await T.ana.abrir("Ato de sábado");
  let recusou = "";
  try {
    await T.bia.abrir("Meu canal");
  } catch (e) {
    recusou = e.message;
  }
  confere("20: só a mediação abre tópico (no aparelho)", recusou === "so_mediacao");
  // Um aparelho alterado manda a linha mesmo assim: os outros não contam.
  await G.bia.mandarTexto(`${ROTULOS.topicos} ${JSON.stringify({ t: "topico", id: crypto.randomUUID(), n: "Canal pirata" })}`);
  await T.bia.escrever(ato, "Eu levo a faixa");
  await G.caio.mandarTexto("oi, gente"); // texto comum: Geral
  await G.caio.mandarTexto(`alumia/p4/quem-leva/v1 {"t":"levo"}`); // outro tipo novo: nem Geral, nem tópico
  await sincronizar();
  // (Lido pela ana: os textos crus acima saíram sem passar pelo módulo, e o MLS não devolve a quem mandou.)
  let r = T.ana.ler();
  confere("20: o tópico da mediação existe para todos; o de quem não é da mediação, não", r.topicos.length === 1 && r.topicos[0].nome === "Ato de sábado");
  confere("20: a mensagem cai no tópico certo, com quem escreveu", r.topicos[0].mensagens.length === 1 && r.topicos[0].mensagens[0].autor === "bia" && r.topicos[0].mensagens[0].texto === "Eu levo a faixa");
  confere("20: texto comum fica no Geral; os outros tipos novos não", r.geral.length === 1 && r.geral[0].texto === "oi, gente");
  await G.bia.mandarTexto(`${ROTULOS.topicos} ${JSON.stringify({ t: "renomear", id: ato, n: "Renomeado pela bia" })}`);
  await T.ana.renomear(ato, "Ato de sábado (praça)");
  await sincronizar();
  confere("20: só a mediação renomeia", T.bia.ler().topicos[0].nome === "Ato de sábado (praça)");
  await T.ana.arquivar(ato);
  await T.caio.escrever(ato, "atrasado");
  await sincronizar();
  r = T.bia.ler();
  confere("20: tópico arquivado não recebe mensagem nova", r.topicos[0].arquivado && r.topicos[0].mensagens.length === 1);
  confere("20: todos os membros veem os mesmos tópicos", nomes.every((n) => JSON.stringify(T[n].ler().topicos) === JSON.stringify(T.ana.ler().topicos)));
  confere("20: mensagem para tópico que não existe e texto torto não contam", topicosDoGrupo([{ tipo: "texto", autor: "ana", corpo: new TextEncoder().encode(`${ROTULOS.topicos} ${JSON.stringify({ t: "msg", id: crypto.randomUUID(), c: "x" })}`) }, { tipo: "texto", autor: "ana", corpo: new TextEncoder().encode(`${ROTULOS.topicos} {torto`) }], ["ana"]).topicos.length === 0);
  confere("20: até 30 tópicos abertos por grupo", LIMITES.abertos === 30 && topicosDoGrupo(Array.from({ length: 31 }, () => ({ tipo: "texto", autor: "ana", corpo: new TextEncoder().encode(`${ROTULOS.topicos} ${JSON.stringify({ t: "topico", id: crypto.randomUUID(), n: "t" })}`) })), ["ana"]).topicos.length === 30);
  confere("20: o Grupo do MLS serve como está (nada muda no grupo nem no protocolo)", GRUPO_SERVE === true);
  confere("20: o rótulo dos tópicos está na lista única e não repete", rotulos.LISTAS.topicos?.topicos === "alumia/p4/topicos/v1" && rotulos.rotulosRepetidos(rotulos.LISTAS).length === 0);
  const modulo = semComentarios(ler("lib/rede/chat/topicos.ts"));
  confere("20: privacidade: só o texto do grupo cifrado (mandarTexto), nada de rede, servidor ou cifra própria", /g\.mandarTexto\(t\)/.test(modulo) && !/fetch\(|rpc\(|supabase|\/api\/|crypto\.subtle|localStorage|indexedDB/i.test(modulo));
});

// ═══════════════════ 21. Nota de voz com transcrição no aparelho ═══════════════════
await parte("21", async () => {
  const { ditadoNoAparelho } = await import("../lib/rede/midia/reconhecer.ts");
  // O reconhecedor de mentira: responde "available" só quando pedem o modo local.
  const pedidos = [];
  class Local {
    static async available(o) {
      pedidos.push(o);
      return o.processLocally === true ? "available" : "downloadable";
    }
  }
  Local.prototype.processLocally = false;
  class SoNaNuvem {}
  const antes = { window: globalThis.window, HTMLMediaElement: globalThis.HTMLMediaElement };
  try {
    globalThis.HTMLMediaElement = class {};
    globalThis.HTMLMediaElement.prototype.captureStream = () => null;
    globalThis.window = { SpeechRecognition: Local };
    confere("21: com o modo local garantido e o idioma instalado, a transcrição é oferecida", (await ditadoNoAparelho("pt")) === true && pedidos.every((o) => o.processLocally === true));
    globalThis.window = { SpeechRecognition: SoNaNuvem };
    confere("21: privacidade: reconhecedor sem modo local (manda o áudio para fora) não é usado", (await ditadoNoAparelho("pt")) === false);
    globalThis.window = { webkitSpeechRecognition: Local };
    confere("21: privacidade: o reconhecedor antigo com prefixo (sem modo local) não é usado", (await ditadoNoAparelho("pt")) === false);
    Local.available = async () => "downloadable";
    globalThis.window = { SpeechRecognition: Local };
    confere("21: idioma que precisaria baixar pacote (serviço de fora) não é oferecido", (await ditadoNoAparelho("pt")) === false);
  } finally {
    globalThis.window = antes.window;
    globalThis.HTMLMediaElement = antes.HTMLMediaElement;
  }
  confere("21: nada foi à rede", chamadas.length === 0, chamadas.join());
  // A tela.
  const tela = ler("components/rede/chat/AnexoCifrado.tsx");
  const conversa = ler("components/rede/chat/Conversa.tsx");
  const trecho = tela.slice(tela.indexOf("function TranscricaoNoAparelho"), tela.indexOf("const codigo = "));
  confere("21: a transcrição só aparece se o aparelho garante o modo local", /ditadoNoAparelho\(lang\)/.test(trecho) && /if \(!pode\) return null;/.test(trecho));
  confere("21: transcreve o áudio decifrado neste aparelho (o endereço blob: local)", /ditarAudio\(url, lang,/.test(trecho));
  confere("21: privacidade: o texto fica só na tela (nada de histórico, servidor ou rede)", !/rpc\(|fetch\(|\/api\/|supabase|guardar|historico|localStorage|indexedDB/i.test(semComentarios(trecho)));
  confere("21: nota de voz de ver uma vez não se transcreve", /\{transcrever && !umaVez && <TranscricaoNoAparelho/.test(tela));
  confere("21: só com a flag do lote (os textos)", /transcrever=\{tc\?\.transcrever \?\? null\}/.test(conversa));
  confere("21: a nota de voz é o áudio cifrado do item 137 (o mesmo tipo de anexo)", /corpo\.tipo === "audio" \? \(\s*<>\s*<audio controls src=\{url\}/.test(tela));
});

// ═══════════════════ A flag e o banco ═══════════════════
await parte("flag", async () => {
  const recursos = ler("lib/recursos.ts");
  confere("flag: alumia-p4-conversa existe e é só pelo nome", /"alumia-p4-conversa":/.test(recursos) && /SO_PELO_NOME[^;]*"alumia-p4-conversa"/.test(recursos));
  confere("flag: o nome no painel único", /"alumia-p4-conversa": \{ nome:/.test(ler("components/painel/alumia/nomes-das-funcoes.ts")));
  const caminho = "supabase/migracoes/20261127-p4-conversa.sql";
  confere("flag: a migração existe", existe(caminho));
  const SQL = ler(caminho);
  confere("flag: no catálogo do banco, protegida por to_regclass", /if to_regclass\('interno\.recursos_catalogo'\) is not null then\s+insert into interno\.recursos_catalogo \(nome, so_pelo_nome\) values \('alumia-p4-conversa', true\)/.test(SQL));
  confere("migração: termina trancando a porta", SQL.trim().endsWith("select interno.alumia_trancar();"));
  confere("migração: não mexe na versão nem na lista da porta", !/rede_alumia_versao|alumia_porta_aberta/.test(SQL.replace(/^--.*$/gm, "")));
  // As traduções: as mesmas chaves nos seis idiomas, e as cinco novas com a marca de rascunho.
  const plano = (o, p = "", saida = []) => {
    for (const [k, v] of Object.entries(o)) {
      if (k === "_rascunho") continue;
      if (v && typeof v === "object") plano(v, `${p}${k}.`, saida);
      else saida.push(`${p}${k}`);
    }
    return saida;
  };
  const pacote = (l) => JSON.parse(ler(`i18n/rede/p4-conversa/${l}.json`));
  const chavesPt = plano(pacote("pt")).sort().join();
  for (const l of ["en", "es", "fr", "ru", "zh"]) confere(`textos: ${l} com as mesmas chaves e a marca _rascunho`, pacote(l)._rascunho === true && plano(pacote(l)).sort().join() === chavesPt);
  confere("textos: o português é o final (sem marca)", pacote("pt")._rascunho === undefined);
});

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  FALHA: " + f);
process.exit(falhas.length ? 1 : 0);

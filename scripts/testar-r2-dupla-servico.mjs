// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O chat a dois da onda R2 de ponta a ponta no Node (lib/rede/chat/r2/servico.ts), com o motor de verdade (@wireapp/core-crypto:
// Proteus), o envelope X-Wing, os pedidos, os vários aparelhos, a lista sincronizada cifrada e um servidor de caixas EM MEMÓRIA que
// faz o que o banco faz (resumos dos passes, passe errado responde "ok" e o pacote cai fora, troca de passe com e sem bloqueio,
// busca por cursor, confirmação apaga, pré-chave entregue uma vez, arquivo da conta com versão). Os ataques estão escritos como
// teste: pedido forjado, pedido de quem foi recusado, bloqueado ou fora de "quem pode me chamar", pacote reentregue, servidor que
// troca a chave de pedidos, identidade trocada, quem lê a caixa tentando apagar mensagem de outra pessoa; e, com o servidor inteiro
// na mão, que nada nele liga conta a conversa.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r2-dupla-servico.mjs
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { motorNoNode } from "./cifra-no-node.mjs";
import { spqrNoNode } from "./spqr-no-node.mjs";
import { iguais, paraB64Url, deB64Url, sortear, texto, juntar } from "../lib/rede/chat/r2/bytes.ts";
import { ChatDoAparelho, derivadosDaConta, declaracaoPara, juntarListas, LISTA_VAZIA } from "../lib/rede/chat/r2/servico.ts";
import { resumoDaCaixa, resumoDoPasse, compromisso } from "../lib/rede/chat/r2/conversa.ts";
import { declaracaoConfere, assinarChaveDePedidos, novoParEd25519 } from "../lib/rede/chat/r2/certificados.ts";
import { fecharPedido, abrirPedido, TAMANHO_DO_PEDIDO } from "../lib/rede/chat/r2/pedido.ts";
import { montar, novoBloco, semKf, corpoDeTexto } from "../lib/rede/chat/r2/bloco.ts";
import { temSessao } from "../lib/rede/chat/r2/proteus.ts";
import { cofreDaLista } from "../lib/rede/aparelhos/sincronia.ts";
import { TAMANHOS_DO_ARQUIVO } from "../lib/rede/aparelhos/arquivo.ts";
import { ROTULOS_DE_FORA } from "../lib/rede/chat/r2/rotulos.ts";

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function recusa(nome, f, codigo) {
  try {
    await f();
    falhas.push(`${nome}: deveria recusar com "${codigo}"`);
  } catch (e) {
    if (String(e?.code ?? e?.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${e?.code ?? e?.message}"`);
  }
}

const M = await motorNoNode();
const SPQR = await spqrNoNode();
const b64 = paraB64Url;
const H = (rotulo, v) => sha256(juntar(texto(rotulo), v));

// ═══════════════════ O servidor em memória ═══════════════════
// Guarda o que o banco guarda (resumos, pacotes sem conta, o dia), e anota cada chamada anônima SEM conta.
const servidor = {
  caixas: new Map(), // id_h → { pd_h, pd_anterior_h, pl_h, proxima, pacotes: [{ ordem, envelope, franquia, dia }] }
  contas: new Map(), // usuario → { codinome, identidade, pedidosXwing, pedidosAssinatura, pedidosCaixa, pedidosPd }
  aparelhos: new Map(), // b64(aparelho) → { usuario, ...publico }
  preChaves: new Map(), // b64(aparelho) → [{ id, pkb, assinatura, ultima }]
  cofres: new Map(), // `${usuario}:${tipo}` → { versao, blob }
  anonimas: [], // { acao, argumentos sem conta }
  trocarPedidosDe: null, // ataque: o servidor entrega outra chave de pedidos para esta conta
};
const dia = () => new Date(relogio.agora).toISOString().slice(0, 10);
const relogio = { agora: Date.UTC(2026, 10, 24, 12) };
function caixaDe(id) {
  return servidor.caixas.get(b64(H(ROTULOS_DE_FORA.caixa, id)));
}
function transporteDe(usuario) {
  return {
    async criarCaixa(c) {
      servidor.anonimas.push({ acao: "criar" });
      const k = b64(H(ROTULOS_DE_FORA.caixa, c.id));
      const plh = b64(H(ROTULOS_DE_FORA.passeLeitura, c.pl));
      const ja = servidor.caixas.get(k);
      if (ja) {
        if (ja.pl_h !== plh) throw new Error("caixa_existe");
        return;
      }
      servidor.caixas.set(k, { pd_h: b64(c.pdH), pd_anterior_h: null, pl_h: plh, proxima: 1, pacotes: [] });
    },
    async depositar(c, envelope, franquia) {
      servidor.anonimas.push({ acao: "depositar", tamanho: envelope.length });
      const cx = caixaDe(c.id);
      const pdh = b64(H(ROTULOS_DE_FORA.passeDeposito, c.pd));
      // Passe errado (ou caixa que não existe) responde IGUAL ao certo: o bloqueio não se denuncia.
      if (cx && (cx.pd_h === pdh || cx.pd_anterior_h === pdh)) cx.pacotes.push({ ordem: cx.proxima++, envelope: new Uint8Array(envelope), franquia: franquia && new Uint8Array(franquia), dia: dia() });
      return { ok: true };
    },
    async buscar(c, cursor) {
      servidor.anonimas.push({ acao: "buscar" });
      const cx = caixaDe(c.id);
      if (!cx || cx.pl_h !== b64(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) return [];
      return cx.pacotes.filter((p) => p.ordem > cursor).map((p) => ({ ...p, marca: null }));
    },
    async confirmar(c, ate) {
      const cx = caixaDe(c.id);
      if (cx && cx.pl_h === b64(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) cx.pacotes = cx.pacotes.filter((p) => p.ordem > ate);
    },
    async trocar(c, pdH, bloqueio) {
      const cx = caixaDe(c.id);
      if (!cx || cx.pl_h !== b64(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) return;
      cx.pd_anterior_h = bloqueio ? null : cx.pd_h;
      cx.pd_h = b64(pdH);
    },
    async apagar(c) {
      const k = b64(H(ROTULOS_DE_FORA.caixa, c.id));
      const cx = servidor.caixas.get(k);
      if (cx && cx.pl_h === b64(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) servidor.caixas.delete(k);
    },
    async lerDiretorio(codinome) {
      servidor.anonimas.push({ acao: "diretorio", codinome });
      const [u, c] = [...servidor.contas].find(([, x]) => x.codinome === codinome) ?? [];
      if (!u) return null;
      const aparelhos = [...servidor.aparelhos.values()].filter((a) => a.usuario === u).map((a) => ({ ...a, usuario: undefined }));
      const pedidos = servidor.trocarPedidosDe === u ? servidor.chavePedidosFalsa : c.pedidosXwing;
      return { usuario: u, identidade: c.identidade, pedidosXwing: pedidos, pedidosAssinatura: c.pedidosAssinatura, pedidosCaixa: c.pedidosCaixa, pedidosPd: c.pedidosPd, aparelhos };
    },
    async reivindicar(u) {
      servidor.anonimas.push({ acao: "reivindicar" });
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
      servidor.anonimas.push({ acao: "pedido", tamanho: envelope.length });
      if (envelope.length !== TAMANHO_DO_PEDIDO) throw new Error("tamanho");
      const c = [...servidor.contas.values()].find((x) => x.codinome === codinome);
      if (!c) return;
      await this.depositar({ id: c.pedidosCaixa, pd: c.pedidosPd }, envelope, null);
    },
    // Com sessão (a conta é quem chama).
    async publicarConta(c) {
      // Como o banco (public.rede_diretorio_conta): a caixa de pedidos nasce aqui, com os resumos; se já existe e não é desta conta, recusa.
      const k = b64(H(ROTULOS_DE_FORA.caixa, c.pedidosCaixa));
      const minha = servidor.contas.get(usuario);
      if (servidor.caixas.has(k) && !(minha && b64(minha.pedidosCaixa) === b64(c.pedidosCaixa))) throw new Error("caixa_ocupada");
      const ja = servidor.caixas.get(k);
      servidor.caixas.set(k, { pd_h: b64(H(ROTULOS_DE_FORA.passeDeposito, c.pedidosPd)), pd_anterior_h: null, pl_h: b64(H(ROTULOS_DE_FORA.passeLeitura, c.pedidosPl)), proxima: ja?.proxima ?? 1, pacotes: ja?.pacotes ?? [] });
      const { pedidosPl: _pl, ...publico } = c;
      servidor.contas.set(usuario, { ...publico, codinome: minha?.codinome ?? codinomeDe[usuario] });
    },
    async publicarAparelho(a) {
      servidor.aparelhos.set(b64(a.aparelho), { ...a, usuario });
    },
    async publicarPreChaves(aparelho, lista) {
      servidor.preChaves.set(b64(aparelho), [...lista]);
    },
    async tirarAparelho(aparelho) {
      servidor.aparelhos.delete(b64(aparelho));
      servidor.preChaves.delete(b64(aparelho));
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

// ═══════════════════ As pessoas e os aparelhos ═══════════════════
const ANA = "aaaaaaaa-0000-4000-8000-000000000001";
const BIA = "bbbbbbbb-0000-4000-8000-000000000002";
const CAIO = "cccccccc-0000-4000-8000-000000000003";
const codinomeDe = { [ANA]: "ana", [BIA]: "bia", [CAIO]: "caio" };
const segue = new Set(); // `${quem}>${segue}`
function historicoNovo() {
  const m = new Map();
  return {
    m,
    async guardar(x) {
      if (![...m.values()].some((y) => y.id === x.id && y.conversa === x.conversa && y.autor === x.autor)) m.set(`${x.conversa}:${x.id}:${m.size}`, x);
    },
    async apagar(conversa, id, autor) {
      for (const [k, x] of m) if (x.conversa === conversa && x.id === id && x.autor === autor) m.delete(k);
    },
    async apagarConversa(conversa) {
      for (const [k, x] of m) if (x.conversa === conversa) m.delete(k);
    },
    da: (conversa) => [...m.values()].filter((x) => x.conversa === conversa),
  };
}
async function aparelho(usuario, chaves) {
  const motor = M.CoreCrypto.new(M.Database.inMemory());
  const historico = historicoNovo();
  const deps = {
    motor, spqr: SPQR, transporte: transporteDe(usuario), historico, cofre: cofreDaLista, persistir: async () => undefined,
    sigo: async (conta) => segue.has(`${usuario}>${conta}`), conferirRegistro: async () => "confere", agora: () => relogio.agora,
  };
  const chat = await ChatDoAparelho.nascer(deps, usuario, codinomeDe[usuario], chaves);
  return { chat, historico, motor, deps };
}
const chavesDe = (a) => {
  const c = a.chat.chavesDaConta();
  return { identidade: deB64Url(c.identidade), pedidos: deB64Url(c.pedidos), sincronia: deB64Url(c.sincronia) };
};

/**
 * O relógio próprio do chat (lib/rede/chat/r2/navegador.ts), aqui à mão: a rotina sem sessão de cada aparelho e depois a com sessão,
 * na ordem dada. Nenhum evento grava com sessão; a lista sincronizada só vai ao servidor por aqui.
 */
async function rotina(...xs) {
  for (const x of xs) await x.chat.rotinaAnonima();
  for (const x of xs) await x.chat.rotinaComSessao();
}

const A1 = await aparelho(ANA);
const B1 = await aparelho(BIA);
const B2 = await aparelho(BIA, chavesDe(B1)); // a Bia ligou o segundo aparelho (QR): chaves da conta, aparelho novo
const C1 = await aparelho(CAIO);
confere("aparelhos: o segundo aparelho da Bia tem chave própria (não a do primeiro)", B1.chat.estado.aparelho.publico.aparelho !== B2.chat.estado.aparelho.publico.aparelho);
confere("aparelhos: a identidade da conta é a mesma nos dois (o código de segurança não muda)", B1.chat.estado.identidade === B2.chat.estado.identidade);
confere("relógio: ao nascer, o aparelho NÃO cria a caixa de sincronia nem grava a lista (nada anônimo colado à publicação da conta)",
  B1.chat.estado.aparelho.sincroniaCriada === false && !servidor.cofres.has(`${ANA}:lista`) && Object.keys(B1.chat.estado.lista.aparelhos).length === 0);
await rotina(A1, B1, B2, C1);
await rotina(A1, B1, B2, C1);
confere("relógio: a rotina sem sessão criou a caixa de sincronia", B1.chat.estado.aparelho.sincroniaCriada === true && !!caixaDe(deB64Url(B1.chat.estado.aparelho.sincronia.id)));
confere("lista: os dois aparelhos da Bia se conhecem pela lista sincronizada", Object.keys(B1.chat.estado.lista.aparelhos).length === 2);
confere("lista: o servidor guarda um arquivo cifrado de tamanho fixo (faixa de 64 KB)", servidor.cofres.get(`${BIA}:lista`)?.blob.length === TAMANHOS_DO_ARQUIVO[0]);
confere("lista: o arquivo do servidor não tem o codinome nem a conta em claro", !Buffer.from(servidor.cofres.get(`${BIA}:lista`).blob).includes(Buffer.from(BIA)));

// ═══════════════════ Pedir, aceitar ═══════════════════
const conv = await A1.chat.pedirConversa("bia", "oi, é a Ana do núcleo");
confere("pedido: a conversa fica 'enviado' na lista da Ana", A1.chat.estado.lista.conversas[conv]?.situacao === "enviado");
confere("pedido: o pedido tem o tamanho fixo", servidor.anonimas.some((x) => x.acao === "pedido" && x.tamanho === TAMANHO_DO_PEDIDO));
confere("pedido: B1 recebe o pedido", (await B1.chat.receberPedidos()) === 1 && B1.chat.estado.lista.conversas[conv]?.situacao === "recebido");
confere("pedido: o texto chega cifrado até o aparelho", B1.chat.estado.lista.conversas[conv]?.texto === "oi, é a Ana do núcleo");
confere("pedido: B2 vê o pedido pela lista (sem ler a caixa de pedidos de novo)", (await B2.chat.receberPedidos()) === 0 && (await rotina(B1, B2).then(() => B2.chat.estado.lista.conversas[conv]?.situacao)) === "recebido");
await B1.chat.aceitar(conv);
await A1.chat.receber();
confere("aceite: a conversa abre para a Ana", A1.chat.estado.lista.conversas[conv]?.situacao === "aberta");
const caixaDaAna = A1.chat.estado.porConversa[conv].caixa;
confere("aceite: a caixa de resposta da Ana passa a aceitar só o passe da Bia (o provisório morreu)", caixaDe(deB64Url(caixaDaAna.id))?.pd_h === A1.chat.estado.lista.conversas[conv].pdHDeles && caixaDe(deB64Url(caixaDaAna.id))?.pd_anterior_h === null);
confere("aceite: a Ana guardou a declaração da Bia para a caixa dela (denúncia com autoria)", (() => {
  const b1 = B1.chat.estado.aparelho.publico.aparelho;
  const d = declaracaoPara(A1.chat.estado, conv, b1);
  return d && declaracaoConfere(deB64Url(B1.chat.estado.lista.contatos[BIA]?.identidade ?? A1.chat.estado.lista.contatos[BIA].identidade), d.idH, d.pdH, BIA, d.declaracao);
})());
await B1.chat.receber(); // anúncio da Ana
await rotina(B1, B2);
await B2.chat.receber(); // B2 cria a caixa dela e se anuncia à Ana
await A1.chat.receber(); // a Ana recebe o anúncio de B2
confere("vários aparelhos: a Ana conhece as caixas dos dois aparelhos da Bia", Object.keys(A1.chat.estado.lista.conversas[conv].destinos).length === 2);

// ═══════════════════ Metadados: nenhum evento grava com sessão (revisão final da R2) ═══════════════════
// Antes, pedir, aceitar, receber o anúncio e bloquear gravavam a lista no servidor COM a sessão logo depois da chamada anônima: a
// ordem das transações no banco ligava a caixa (e o pedido) à conta. Agora só a rotina com sessão grava.
{
  const comSessao = [];
  for (const x of [A1, B1, B2, C1]) {
    for (const f of ["gravarCofre", "publicarConta", "publicarAparelho", "publicarPreChaves"]) {
      const original = x.deps.transporte[f].bind(x.deps.transporte);
      x.deps.transporte[f] = async (...a) => {
        if (!x.naRotina) comSessao.push(f);
        return original(...a);
      };
    }
  }
  globalThis.__comSessao = comSessao;
  for (const x of [A1, B1, B2, C1]) {
    for (const r of ["rotinaComSessao", "rotinaAnonima"]) {
      const original = x.chat[r].bind(x.chat);
      x.chat[r] = async () => {
        x.naRotina = true;
        try {
          return await original();
        } finally {
          x.naRotina = false;
        }
      };
    }
  }
}

// ═══════════════════ Mandar e receber ═══════════════════
const m1 = await A1.chat.mandarTexto(conv, "Ato sábado às 10h, Praça da Sé.");
confere("mandar: a mensagem sai para os dois aparelhos da Bia", m1.entregues === 2, String(m1.entregues));
confere("receber: B1 lê", (await B1.chat.receber()) === 1 && B1.historico.da(conv).some((x) => x.texto === "Ato sábado às 10h, Praça da Sé." && x.autor === ANA));
confere("receber: B2 lê", (await B2.chat.receber()) === 1 && B2.historico.da(conv).some((x) => x.id === m1.id));
const m2 = await B1.chat.mandarTexto(conv, "Combinado.", { resposta: m1.id });
confere("resposta: a Ana lê, com a referência à mensagem respondida", (await A1.chat.receber()) === 1 && A1.historico.da(conv).some((x) => x.id === m2.id && x.resposta === m1.id));
await B2.chat.receber();
confere("sincronia: B2 recebe a cópia do que B1 mandou, como da Bia", B2.historico.da(conv).some((x) => x.id === m2.id && x.autor === BIA));
confere("contador: o contador e a cadeia ficam dentro do cifrado (sem aviso na conversa limpa)", A1.historico.da(conv).every((x) => x.avisos.length === 0));

// Reentrega: o servidor devolve o mesmo pacote de novo (cursor zerado).
{
  const aqui = B1.chat.estado.porConversa[conv];
  const cx = caixaDe(deB64Url(aqui.caixa.id));
  const m3 = await A1.chat.mandarTexto(conv, "terceira");
  const guardado = cx.pacotes.map((p) => ({ ...p }));
  await B1.chat.receber();
  cx.pacotes.push(...guardado.map((p) => ({ ...p, ordem: cx.proxima++ })));
  const antes = B1.historico.da(conv).length;
  await B1.chat.receber();
  confere("ataque: pacote reentregue pelo servidor não aparece duas vezes", B1.historico.da(conv).length === antes && B1.historico.da(conv).filter((x) => x.id === m3.id).length === 1);
  await B2.chat.receber();
}

// Apagar: só a própria mensagem.
{
  await A1.chat.apagarMensagem(conv, m1.id);
  await B1.chat.receber();
  confere("apagar: o pedido da Ana apaga a mensagem dela na Bia", !B1.historico.da(conv).some((x) => x.id === m1.id));
  const antes = A1.historico.da(conv).length;
  await B1.chat.apagarMensagem(conv, A1.historico.da(conv).find((x) => x.autor === ANA)?.id ?? "x");
  await A1.chat.receber();
  confere("ataque: a Bia não apaga mensagem da Ana no aparelho da Ana (o autor tem de ser quem pede)", A1.historico.da(conv).length === antes);
}

confere("metadados: pedir, aceitar, anunciar caixa, receber, mandar e apagar NÃO gravaram nada com a sessão (só a rotina grava)", globalThis.__comSessao.length === 0, globalThis.__comSessao.join());

// ═══════════════════ O que o servidor tem na mão ═══════════════════
{
  const tudo = JSON.stringify([...servidor.caixas.entries()].map(([k, c]) => [k, c.pd_h, c.pd_anterior_h, c.pl_h, c.pacotes.map((p) => [p.ordem, p.dia])]));
  const conversaEmQualquerLugar = [...servidor.caixas.values()].some((c) => c.pacotes.some((p) => Buffer.from(p.envelope).includes(Buffer.from(deB64Url(conv)))));
  confere("metadados: nenhuma caixa ou pacote do servidor tem conta", ![ANA, BIA, CAIO].some((u) => tudo.includes(u)));
  confere("metadados: o id da conversa não aparece em claro em nenhum pacote", !conversaEmQualquerLugar);
  confere("metadados: só tamanhos fixos nos depósitos", servidor.anonimas.filter((x) => x.acao === "depositar").every((x) => [3184, 5232, 9328, 17520, 25712, 33904, TAMANHO_DO_PEDIDO].includes(x.tamanho)));
  confere("metadados: o pacote guarda só o dia, não a hora", [...servidor.caixas.values()].every((c) => c.pacotes.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.dia))));
  confere("metadados: as chamadas anônimas não levam conta", !JSON.stringify(servidor.anonimas).match(/[0-9a-f]{8}-0000-4000/));
}

// ═══════════════════ Pedidos: as regras no aparelho de quem recebe ═══════════════════
{
  await B1.chat.mudarPrefs("ninguem", 7);
  const c2 = await C1.chat.pedirConversa("bia", "oi");
  confere("quem pode: com 'ninguém', o pedido do Caio some em silêncio", (await B1.chat.receberPedidos()) === 0 && !B1.chat.estado.lista.conversas[c2]);
  await B1.chat.mudarPrefs("seguidos", 7);
  await C1.chat.apagarConversa(c2);
  const c3 = await C1.chat.pedirConversa("bia");
  confere("quem pode: com 'só quem eu sigo', o pedido de quem a Bia não segue some", (await B1.chat.receberPedidos()) === 0 && !B1.chat.estado.lista.conversas[c3]);
  segue.add(`${BIA}>${CAIO}`);
  await C1.chat.apagarConversa(c3);
  const c4 = await C1.chat.pedirConversa("bia");
  await B1.chat.receberPedidos();
  confere("quem pode: de quem a Bia segue, a conversa abre direto", B1.chat.estado.lista.conversas[c4]?.situacao === "aberta");
  await C1.chat.receber();
  confere("quem pode: o Caio vê a conversa aberta", C1.chat.estado.lista.conversas[c4]?.situacao === "aberta");
  segue.delete(`${BIA}>${CAIO}`);
  await B1.chat.mudarPrefs("pedidos", 7);
  // Recusa de 30 dias.
  const D1 = await aparelho(CAIO, chavesDe(C1));
  await B1.chat.apagarConversa(c4);
  await C1.chat.apagarConversa(c4);
  await rotina(C1, D1);
  await rotina(C1, D1);
  const c5 = await C1.chat.pedirConversa("bia");
  await B1.chat.receberPedidos();
  await B1.chat.recusar(c5);
  await C1.chat.apagarConversa(c5);
  const c6 = await C1.chat.pedirConversa("bia");
  confere("recusa: o mesmo Caio não consegue pedir de novo em 30 dias", (await B1.chat.receberPedidos()) === 0 && !B1.chat.estado.lista.conversas[c6]);
  relogio.agora += 31 * 86_400_000;
  await C1.chat.apagarConversa(c6);
  const c7 = await C1.chat.pedirConversa("bia");
  confere("recusa: depois de 30 dias, pode pedir de novo", (await B1.chat.receberPedidos()) === 1 && B1.chat.estado.lista.conversas[c7]?.situacao === "recebido");
  await B1.chat.recusar(c7);
  await C1.chat.apagarConversa(c7);
}

// ═══════════════════ Sem internet (junção da R3): o chat pela malha ═══════════════════
// O transporte com a malha (lib/rede/malha/estou-bem.ts, comMalha) guarda o depósito como pacote da malha; o aparelho de quem recebe
// reconhece a caixa dele (caixasDaMalha) e abre pelo mesmo caminho da caixa (receberDaMalha). O mesmo que lib/rede/chat/r2/navegador.ts
// liga no app Android.
{
  const { comMalha } = await import("../lib/rede/malha/estou-bem.ts");
  const { entregador } = await import("../lib/rede/malha/entrega.ts");
  const { destinoComAtos } = await import("../lib/rede/malha/atos.ts");
  const guardados = [];
  const doServidor = A1.deps.transporte;
  // Sem internet: a caixa não responde; a malha guarda.
  A1.deps.transporte = comMalha({ ...doServidor, depositar: async () => ({ ok: false }) }, { guardar: (p) => (guardados.push(p), true) }, () => true);
  const r = await A1.chat.mandarTexto(conv, "sem internet, pela malha");
  A1.deps.transporte = doServidor;
  confere("malha: sem internet, o depósito vira pacote da malha (um por aparelho de destino)", guardados.length >= 1 && r.entregues >= 1, `${guardados.length} ${r.entregues}`);
  const destinoDe = (x) => destinoComAtos({ caixas: () => x.chat.caixasDaMalha(), mensagem: (id, d) => x.chat.receberDaMalha(id, d) });
  confere("malha: as caixas que o aparelho procura são as das conversas e a de sincronia", B1.chat.caixasDaMalha().length === Object.keys(B1.chat.estado.porConversa).length + 1);
  const entB1 = entregador(destinoDe(B1));
  let abertos = 0;
  for (const p of guardados) if (await entB1(p)) abertos++;
  confere("malha: B1 abre o pacote dele pelo mesmo caminho da caixa", abertos === 1 && B1.historico.da(conv).some((x) => x.texto === "sem internet, pela malha"), String(abertos));
  const entC1 = entregador(destinoDe(C1));
  let doCaio = 0;
  for (const p of guardados) if (await entC1(p)) doCaio++;
  confere("malha: o Caio não abre nenhum pacote (não é para ele)", doCaio === 0);
  confere("malha: receberDaMalha recusa caixa que não é deste aparelho", (await B1.chat.receberDaMalha(sortear(32), { c: sortear(32), envelope: new Uint8Array(16) })) === false);
  let deNovo = 0;
  for (const p of guardados) if (await entB1(p)) deNovo++;
  confere("malha: o mesmo pacote repetido não entra de novo no histórico", deNovo === 0 && B1.historico.da(conv).filter((x) => x.texto === "sem internet, pela malha").length === 1);
}

// Pedido forjado: o Caio se passa pela Ana (conta e identidade dela), assinando com outra chave.
{
  const dirBia = await C1.deps.transporte.lerDiretorio("bia");
  const falsa = novoParEd25519();
  const forjado = await fecharPedido(dirBia.pedidosXwing, falsa, {
    conversa: sortear(16), conta: ANA, codinome: "ana", identidade: deB64Url(B1.chat.estado.lista.contatos[ANA].identidade), aparelho: sortear(32),
    texto: "sou a Ana, confia", resposta: { id: sortear(32), pd: sortear(32) }, pdH: sortear(32),
  });
  confere("ataque: pedido com a identidade da Ana mas assinado por outra chave não abre", (await abrirPedido(deB64Url(B1.chat.estado.pedidos), forjado)) === null);
  const comAPropria = await fecharPedido(dirBia.pedidosXwing, falsa, {
    conversa: sortear(16), conta: ANA, codinome: "ana", identidade: falsa.publica, aparelho: sortear(32), texto: "", resposta: { id: sortear(32), pd: sortear(32) }, pdH: sortear(32),
  });
  await C1.deps.transporte.depositarPedido("bia", comAPropria);
  // As duas apagam a conversa (senão o pedido cai só por já haver conversa com a Ana); a Ana pede de novo mais abaixo.
  await A1.chat.apagarConversa(conv);
  await B1.chat.apagarConversa(conv);
  const n = await B1.chat.receberPedidos();
  confere("ataque: pedido em nome da Ana com uma identidade que não é a do diretório some", n === 0);
}

// O servidor troca a chave de pedidos da Bia por uma dele: a assinatura da identidade não confere.
{
  const { XWing } = await import("@noble/post-quantum/hybrid.js");
  servidor.chavePedidosFalsa = XWing.getPublicKey(sortear(32));
  servidor.trocarPedidosDe = BIA;
  delete C1.chat.estado.lista.contatos[BIA];
  await recusa("ataque: chave de pedidos trocada pelo servidor é recusada no aparelho", () => C1.chat.pedirConversa("bia"), "dm_chave_estranha");
  servidor.trocarPedidosDe = null;
}

// ═══════════════════ Bloqueio ═══════════════════
const conv2 = await A1.chat.pedirConversa("bia");
await B1.chat.receberPedidos();
await B1.chat.aceitar(conv2);
await A1.chat.receber();
await B1.chat.receber();
await rotina(B1, B2);
await B2.chat.receber();
await A1.chat.receber();
await A1.chat.mandarTexto(conv2, "antes do bloqueio");
confere("bloqueio: antes, a Bia recebe", (await B1.chat.receber()) === 1);
await B2.chat.receber();
const listaDeAntesDoBloqueio = { ...servidor.cofres.get(`${BIA}:lista`) };
await B1.chat.bloquear(ANA);
await rotina(B1, B2);
{
  // A lista velha, inteira e válida (cifrada com a chave certa), devolvida pelo servidor: antes, o aparelho a juntava e um bloqueio
  // podia voltar atrás num aparelho que nunca tinha visto a versão nova. Agora a geração vai dentro do cifrado e a velha é recusada.
  const nova = servidor.cofres.get(`${BIA}:lista`);
  servidor.cofres.set(`${BIA}:lista`, { versao: nova.versao, blob: listaDeAntesDoBloqueio.blob });
  await B2.chat.lerLista();
  confere("ataque: o servidor devolve a lista de antes do bloqueio: o aparelho recusa (geração menor) e o bloqueio fica", B2.chat.estado.lista.bloqueios[ANA]?.ativo === true);
  const B3 = await aparelho(BIA, { ...chavesDe(B1), geracao: B1.chat.geracaoDaLista() });
  confere("ataque: nem o aparelho recém-ligado pelo QR (que recebe a geração do velho) aceita a lista velha", Object.keys(B3.chat.estado.lista.conversas).length === 0 && B3.chat.estado.listaGeracao === B1.chat.geracaoDaLista());
  const semGeracao = await aparelho(BIA, chavesDe(B1));
  confere("LIMITE: o aparelho novo sem a geração (restaurado de cópia velha, sem QR) ainda aceita a lista velha", Object.keys(semGeracao.chat.estado.lista.conversas).length > 0 && semGeracao.chat.estado.lista.bloqueios[ANA]?.ativo !== true);
  servidor.cofres.set(`${BIA}:lista`, nova);
  await rotina(B1, B2);
}
await B2.chat.receber(); // B2 aplica o bloqueio às caixas dela
{
  const r = await A1.chat.mandarTexto(conv2, "depois do bloqueio");
  confere("bloqueio: o depósito da Ana continua respondendo 'ok' (o bloqueio não se denuncia)", r.entregues === 2);
  confere("bloqueio: nada chega a B1 nem a B2", (await B1.chat.receber()) === 0 && (await B2.chat.receber()) === 0);
  await A1.chat.pedirConversa("bia").catch(() => undefined);
  confere("bloqueio: pedido novo da Ana também some", (await B1.chat.receberPedidos()) === 0);
  await recusa("bloqueio: desbloquear antes de 3 h é recusado", () => B1.chat.desbloquear(ANA), "cedo_para_desbloquear");
  relogio.agora += 3 * 3_600_000 + 1000;
  await B1.chat.desbloquear(ANA);
  await rotina(B1, B2);
  await B2.chat.receber();
  await A1.chat.mandarTexto(conv2, "depois do desbloqueio");
  confere("bloqueio: depois do desbloqueio, volta a chegar", (await B1.chat.receber()) === 1 && (await B2.chat.receber()) === 1);
  // O freio de 20 bloqueios por hora.
  for (let i = 0; i < 20; i++) await B1.chat.bloquear(`dddddddd-0000-4000-8000-${String(i).padStart(12, "0")}`);
  await recusa("freio: o 21º bloqueio na mesma hora é recusado", () => B1.chat.bloquear("eeeeeeee-0000-4000-8000-000000000000"), "muitos_bloqueios");
}

// ═══════════════════ Identidade trocada ═══════════════════
{
  // A Bia "reinstala" sem cópia: identidade nova no diretório (o servidor mostra a nova; poderia ser o servidor mentindo).
  const original = { ...servidor.contas.get(BIA) };
  const nova = novoParEd25519();
  servidor.contas.get(BIA).identidade = nova.publica;
  servidor.contas.get(BIA).pedidosAssinatura = assinarChaveDePedidos(nova, BIA, original.pedidosXwing);
  A1.chat.estado.lista.contatos[BIA].lidoEm = 0;
  await recusa("identidade: com a identidade da Bia trocada, nada sai até a Ana aceitar", () => A1.chat.mandarTexto(conv2, "oi?"), "dm_identidade_mudou");
  A1.chat.estado.lista.contatos[BIA].verificado = true;
  await recusa("identidade: se a Ana tinha comparado o código, só aceita comparando de novo", () => A1.chat.confiar(BIA, false), "dm_exige_comparar");
  servidor.contas.set(BIA, original);
  A1.chat.estado.lista.contatos[BIA].mudou = null;
}

// ═══════════════════ Cópia de segurança: não ressuscita chave velha ═══════════════════
{
  await rotina(A1); // a lista da Ana vai ao servidor na volta seguinte do relógio
  const R = await aparelho(ANA, chavesDe(A1));
  confere("cópia: o aparelho restaurado é NOVO (outra chave de aparelho, outra identidade Proteus)", R.chat.estado.aparelho.publico.aparelho !== A1.chat.estado.aparelho.publico.aparelho && R.chat.estado.aparelho.impressao !== A1.chat.estado.aparelho.impressao);
  confere("cópia: o aparelho restaurado não tem sessão nenhuma com os aparelhos da Bia", !(await temSessao(R.motor, deB64Url(B1.chat.estado.aparelho.publico.aparelho))));
  confere("cópia: a lista volta (as conversas aparecem)", !!R.chat.estado.lista.conversas[conv2]);
}

// ═══════════════════ Franquia: os bytes do contrato com a denúncia ═══════════════════
{
  const kf = sortear(32);
  const idH = resumoDaCaixa(sortear(32));
  const bloco = montar(novoBloco({ tipo: "texto", conversa: sortear(16), contador: 1, anterior: new Uint8Array(32), prazo: 7, corpo: corpoDeTexto({ t: "Ação às 10h — \"Praça\"\nlinha 2" }) }));
  const conteudo = semKf(bloco);
  // O formato da denúncia com prova (lib/rede/franquia/protocolo.ts e lib/rede/caixas/franquia.ts), refeito aqui à
  // parte: HMAC-SHA-256(kf, rótulo ‖ id_h ‖ conteúdo), sem separador (o rótulo é fixo e o id_h tem sempre 32 bytes). Na junção: a forma
  // com tamanhos na frente, que esta frente usava, nunca conferiria no servidor.
  const deLa = hmac(sha256, kf, juntar(texto("alumia/r2/franquia/v1"), idH, conteudo));
  confere("franquia: o compromisso é o mesmo do formato da denúncia com prova", iguais(compromisso(kf, idH, conteudo), deLa));
  const trecho = Buffer.from("\"Praça\"\nlinha", "utf8");
  confere("franquia: o texto vai cru (UTF-8, NFC) no bloco: o trecho com aspas e quebra de linha se acha byte a byte", Buffer.from(conteudo).includes(trecho));
  const idCaixa = sortear(32);
  confere("caixas: id_h e pd_h são SHA-256(rótulo ‖ valor), como na frente das caixas", iguais(resumoDaCaixa(idCaixa), H("alumia/r2/caixa", idCaixa)) && iguais(resumoDoPasse(idCaixa), H("alumia/r2/passe-deposito", idCaixa)));
}

// ═══════════════════ Lista: juntar dois aparelhos ═══════════════════
{
  const a = LISTA_VAZIA();
  const b = LISTA_VAZIA();
  a.prefs = { quemPode: "ninguem", prazo: 1, m: 5 };
  b.prefs = { quemPode: "seguidos", prazo: 30, m: 9 };
  a.bloqueios.x = { desde: 1, ativo: true, m: 10 };
  b.bloqueios.x = { desde: 1, ativo: false, m: 20 };
  const j = juntarListas(a, b);
  confere("lista: na junção vence a mudança mais nova, item a item", j.prefs.quemPode === "seguidos" && j.bloqueios.x.ativo === false);
  const pd = derivadosDaConta(sortear(32));
  confere("conta: a caixa de pedidos e o passe de sincronia saem da chave de sincronia, todos diferentes", new Set([pd.pedidos.id, pd.pedidos.pl, pd.pedidos.pd, pd.pdSincronia].map(b64)).size === 4);
}

// ═══════════════════ Registro público das chaves: as linhas da R2 ═══════════════════
{
  const { atualizarVista, conferirConta, INICIO, quemNoRegistro, resumoDaLinha, resumoDaLinhaComTipo } = await import("../lib/rede/chat/transparencia.ts");
  const ident = novoParEd25519().publica;
  const b64p = (b) => Buffer.from(b).toString("base64");
  const quem = await quemNoRegistro(BIA);
  // Uma linha do beta (sem tipo novo, "olm") e depois a identidade da conta na R2 ("conta"), como o banco grava (rede_kt_resumo2).
  const l1 = { seq: 1, tipo: "olm", quem, identidade: "oVELHA", versao: 1, dia: "2026-11-20" };
  l1.resumo = await resumoDaLinha(INICIO.resumo, l1);
  const l2 = { seq: 2, tipo: "conta", quem, identidade: `r2:${b64p(ident)}`, versao: 1, dia: "2026-11-24" };
  l2.resumo = await resumoDaLinhaComTipo(l1.resumo, l2);
  const registro = (linhas) => ({ ponta: async () => ({ seq: linhas.at(-1).seq, resumo: linhas.at(-1).resumo }), trecho: async (desde) => linhas.filter((l) => l.seq > desde) });
  const vista = await atualizarVista(INICIO, registro([l1, l2]));
  confere("registro: a identidade da conta que está na ponta confere", (await conferirConta(vista, BIA, ident)) === "confere");
  confere("registro: outra identidade (o servidor mostrando outra chave) não confere", (await conferirConta(vista, BIA, novoParEd25519().publica)) === "nao_confere");
  const mexida = { ...l2, tipo: "aparelho" };
  let quebrou = false;
  try {
    await atualizarVista(INICIO, registro([l1, mexida]));
  } catch (e) {
    quebrou = e.message === "kt_quebrado";
  }
  confere("registro: trocar o tipo de uma linha quebra a corrente", quebrou);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  FALHA:", f);
process.exit(falhas.length ? 1 : 0);

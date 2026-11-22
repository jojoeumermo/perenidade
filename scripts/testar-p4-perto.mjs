// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, lote "perto" (itens 2, 7, 8, 22, 23, 24 e 25), com o código do aparelho de verdade (o chat a dois com o motor Proteus e o
// SPQR de verdade, o MLS de verdade) e o banco de verdade (PGlite com o install.sql e a migração 20261127-p4-perto.sql):
//   · item 2: a posição vai DENTRO do cifrado (o servidor nunca vê a coordenada), arredondada no aparelho antes de cifrar, por tempo
//     limitado; quem recebe guarda só a ÚLTIMA (sem trajeto), apaga ao vencer e no "parei"; no grupo (MLS), tipo novo de conteúdo;
//   · item 7: o pedido de ajuda é o mesmo conteúdo com a marca "sos", fica no histórico cifrado só 24 h e conta como mensagem nova;
//   · item 8: o cronômetro da volta para casa é só do aparelho (nada no banco), com o último aviso antes de mandar;
//   · item 22: o canal de aviso da organização (o sino), só avisos por escolha, número só a partir de 3 e só para quem gere;
//   · itens 23 a 25: o palco, a fila de mãos, a sala de espera, a senha e o ritmo de estudo na sala de voz cifrada;
//   · a regra de privacidade de cada item.
// Uso: npm run testar:p4-perto
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "@noble/hashes/sha2.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function recusa(nome, f, codigo) {
  try {
    await f();
    falhas.push(`${nome}: deveria recusar com "${codigo}"`);
  } catch (e) {
    if (`${e?.codigo ?? ""} ${e?.code ?? ""} ${e?.message ?? ""}`.includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${e?.codigo ?? e?.code ?? e?.message}"`);
  }
}
async function passa(nome, f) {
  try {
    const v = await f();
    certos++;
    return v;
  } catch (e) {
    falhas.push(`${nome}: ${e?.codigo ?? e?.code ?? e?.message}`);
    return undefined;
  }
}
const contem = (grande, pequeno) => pequeno.length > 0 && Buffer.from(grande).indexOf(Buffer.from(pequeno)) >= 0;
const b64 = (b) => Buffer.from(b).toString("base64url");

// O banco do item 22 nasce ANTES de carregar o motor do chat (o motor de cifra muda o ambiente que o PGlite usa para achar os arquivos).
const { criarBanco } = await import("./banco-local.mjs");
const SQL_DO_LOTE = ler("supabase/migracoes/20261127-p4-perto.sql").replace(/^﻿/, "");
const COLADA = ler("supabase/install.sql").replace(/\r\n/g, "\n").includes(SQL_DO_LOTE.replace(/\r\n/g, "\n").trim());
const BANCO = await criarBanco(COLADA ? { antesDe: SQL_DO_LOTE } : {});

const P = await import("../lib/rede/perto/posicao.ts");
const V = await import("../lib/rede/perto/volta.ts");

// ═══════════════════ 1. Item 2: o corpo da posição (puro) ═══════════════════
{
  const bairro = P.arredondar(-8.047562, -34.876983, "bairro");
  confere("bairro: arredonda a 2 casas no aparelho", bairro.la === -8.05 && bairro.lo === -34.88, JSON.stringify(bairro));
  const exata = P.arredondar(-8.0475623, -34.8769834, "exata");
  confere("exata: arredonda a 5 casas", exata.la === -8.04756 && exata.lo === -34.87698, JSON.stringify(exata));
  confere("fora da Terra: nada", P.arredondar(91, 0, "exata") === null && P.arredondar(0, 181, "bairro") === null && P.arredondar(NaN, 0, "exata") === null);
  const c = P.corpoDePosicao({ la: -8.047562, lo: -34.876983, precisao: "bairro", duracaoMs: 15 * 60_000 });
  confere("o corpo leva a posição já arredondada e a duração em segundos (não a hora)", c.la === -8.05 && c.pr === "b" && c.dura === 900 && !("ate" in c));
  const bytes = P.montarCorpoDePosicao(c);
  confere("o corpo vai e volta", JSON.stringify(P.lerCorpoDePosicao(bytes)) === JSON.stringify(c));
  confere("bairro com a posição exata dentro: recusado", P.lerCorpoDePosicao(JSON.stringify({ v: 1, la: -8.04756, lo: -34.88, pr: "b", dura: 60 })) === null);
  confere("chave a mais (um 'trajeto'): recusado", P.lerCorpoDePosicao(JSON.stringify({ ...c, trajeto: [[1, 2]] })) === null);
  confere("prazo acima de 8 h: recusado", P.lerCorpoDePosicao(JSON.stringify({ ...c, dura: 8 * 3600 + 1 })) === null);
  confere("prazo de 8 h: aceito", P.lerCorpoDePosicao(JSON.stringify({ ...c, dura: 8 * 3600 })) !== null);
  confere("número em notação científica (precisão escondida): recusado", P.lerCorpoDePosicao('{"v":1,"la":1e-7,"lo":0,"pr":"b","dura":60}') === null);
  confere("'parei' com posição junto: recusado", P.lerCorpoDePosicao(JSON.stringify({ v: 1, fim: 1, la: 1, lo: 1 })) === null);
  confere("'parei' sozinho: aceito", JSON.stringify(P.lerCorpoDePosicao(JSON.stringify(P.PAREI))) === '{"v":1,"fim":1}');
  confere("versão desconhecida: recusada", P.lerCorpoDePosicao(JSON.stringify({ ...c, v: 2 })) === null);
  confere("pedido de localização: só a marca, sem posição", JSON.stringify(P.lerCorpoDePosicao(JSON.stringify(P.PEDIDO))) === '{"v":1,"pede":1}');
  confere("pedido de localização com posição junto: recusado", P.lerCorpoDePosicao(JSON.stringify({ v: 1, pede: 1, la: 1, lo: 1, pr: "b", dura: 60 })) === null);
  confere("pedido com valor estranho: recusado", P.lerCorpoDePosicao(JSON.stringify({ v: 1, pede: 2 })) === null);
  confere("uma vez só (ponto de encontro): vale 1 h", P.VIDA_DE_UMA_VEZ_MS === 3600_000 && P.lerCorpoDePosicao(JSON.stringify(P.corpoDePosicao({ la: 1, lo: 1, precisao: "bairro", duracaoMs: P.VIDA_DE_UMA_VEZ_MS }))).dura === 3600);
  confere("lixo: recusado", P.lerCorpoDePosicao(new Uint8Array([0xff, 0xfe])) === null && P.lerCorpoDePosicao("[]") === null && P.lerCorpoDePosicao("null") === null);
  let lancou = false;
  try {
    P.corpoDePosicao({ la: 0, lo: 0, precisao: "exata", duracaoMs: 9 * 3600_000 });
  } catch {
    lancou = true;
  }
  confere("o aparelho não monta prazo acima de 8 h", lancou);
  // Os prazos: 15 min, 1 h, 8 h e "até eu parar" (15 min de cada vez, renovado).
  confere("os prazos são os da coordenação", JSON.stringify(P.PRAZOS) === JSON.stringify([15, 60, 480, "parar"]));
  confere("15 min: a duração da vez é o que falta", P.duracaoDaVez(15, 0, 5 * 60_000) === 10 * 60_000);
  confere("15 min: vencido, nada sai", P.duracaoDaVez(15, 0, 15 * 60_000) === null);
  confere("até eu parar: 15 min de cada vez", P.duracaoDaVez("parar", 0, 10 * 3600_000) === P.RENOVACAO_MS);
}

// ═══════════════════ 2. Item 2: a guarda de quem recebe (sem trajeto) ═══════════════════
{
  const g = new P.GuardaDePosicoes();
  let avisos = 0;
  g.ouvir(() => avisos++);
  const um = P.corpoDePosicao({ la: -23.55052, lo: -46.63331, precisao: "exata", duracaoMs: 15 * 60_000 });
  const dois = P.corpoDePosicao({ la: -23.56, lo: -46.64, precisao: "exata", duracaoMs: 15 * 60_000 });
  g.receber("c:x", "ana", um, 1000);
  g.receber("c:x", "ana", dois, 2000);
  const vig = g.vigentes(3000);
  confere("sem trajeto: a segunda posição TROCA a primeira (uma entrada por pessoa)", vig.length === 1 && vig[0].la === -23.56 && g.tamanho === 1);
  confere("a guarda não tem lista de pontos", !Object.values(vig[0]).some((v) => Array.isArray(v)));
  confere("vence sozinha: depois do prazo, some", g.vigentes(2000 + 15 * 60_000).length === 0 && g.tamanho === 0);
  g.receber("c:x", "ana", um, 1000);
  g.receber("c:x", "ana", P.PAREI, 1500);
  confere("'parei' apaga na hora", g.vigentes(1600).length === 0);
  g.receber("c:y", "bia", P.corpoDePosicao({ la: 1, lo: 1, precisao: "bairro", duracaoMs: 60_000, sos: true }), 1000);
  g.receber("c:y", "bia", P.PAREI, 1100);
  g.receber("c:y", "bia", P.corpoDePosicao({ la: 2, lo: 2, precisao: "bairro", duracaoMs: 60_000 }), 1200);
  const sos = g.vigentes(1300);
  confere("o pedido de ajuda não some com 'parei' nem é trocado por uma posição comum", sos.length === 1 && sos[0].sos && sos[0].la === 1);
  confere("o pedido de ajuda vale 24 h", g.vigentes(1000 + P.VIDA_DO_SOS_MS - 1).length === 1 && g.vigentes(1000 + P.VIDA_DO_SOS_MS).length === 0);
  g.receber("c:z", "caio", P.sosSemPosicao(), 1);
  confere("pedido de ajuda sem posição (sem permissão de local) também chega", g.vigentes(2)[0]?.la === null);
  // Pedido de localização: chega como pedido (nenhuma posição), vence em 15 min, recusar só tira daqui.
  g.receber("c:w", "duda", P.PEDIDO, 5000);
  confere("pedido de localização: fica como pedido, não como posição", g.pedidos(5001).length === 1 && !g.vigentes(5001).some((p) => p.autor === "duda"));
  confere("pedido de localização: some sozinho em 15 min", g.pedidos(5000 + P.VIDA_DO_PEDIDO_MS).length === 0);
  g.receber("c:w", "duda", P.PEDIDO, 6000);
  g.tirarPedido("c:w", "duda");
  confere("pedido de localização: recusar tira o pedido", g.pedidos(6001).length === 0);
  g.receber("c:w", "duda", P.PEDIDO, 7000);
  g.esquecer();
  confere("esquecer (Sair rápido) apaga tudo", g.tamanho === 0 && g.pedidos(7001).length === 0 && avisos > 0);
  confere("distância: Recife a Olinda ~ 6 km", Math.abs(P.distancia({ la: -8.0476, lo: -34.877 }, { la: -8.0089, lo: -34.8553 }) - 4900) < 1500);
}

// ═══════════════════ 3. Item 2: perto de qual município (no aparelho) ═══════════════════
{
  const { montarIndice } = await import("../lib/rede/mapa/indice.ts");
  const { municipioPerto } = await import("../lib/rede/perto/lugar.ts");
  const indice = montarIndice(JSON.parse(ler("lib/rede/mapa/municipios.json")));
  const rec = municipioPerto(indice, -8.0476, -34.877);
  confere("o centro do Recife fica perto do Recife (ou de vizinho imediato)", rec && rec.uf === "PE" && ["Recife", "Olinda", "Jaboatão dos Guararapes"].includes(rec.nome), JSON.stringify(rec));
  const sp = municipioPerto(indice, -23.5505, -46.6333);
  confere("o centro de São Paulo fica em SP", sp && sp.uf === "SP", JSON.stringify(sp));
  confere("no meio do Atlântico: nenhum município", municipioPerto(indice, -10, -20) === null);
  const lugar = ler("lib/rede/perto/lugar.ts");
  confere("o município sai do índice local: nada é buscado fora e nenhum endereço de site", !/fetch\(|XMLHttpRequest|import\(["']https?:|https?:\/\//.test(lugar.replace(/\/\/ .*$/gm, "")));
  const { linkGeo } = await import("../lib/rede/perto/lugar.ts");
  confere("abrir no mapa do aparelho: geo: (RFC 5870), sem site", linkGeo(-8.05, -34.88) === "geo:-8.05,-34.88");
}

// ═══════════════════ 4. Item 8: a volta para casa (o cronômetro só no aparelho) ═══════════════════
{
  const v = V.comecarVolta(40, 0);
  confere("a volta conta 40 min", V.faseDaVolta(v, 10 * 60_000).fase === "contando" && V.faseDaVolta(v, 10 * 60_000).faltaMs === 30 * 60_000);
  const ult = V.faseDaVolta(v, 40 * 60_000 + 1000);
  confere("venceu: o último aviso, com 2 min para o 'Cheguei'", ult.fase === "ultimo_aviso" && ult.faltaMs === V.ULTIMO_AVISO_MS - 1000);
  confere("depois do último aviso: mandar", V.faseDaVolta(v, 40 * 60_000 + V.ULTIMO_AVISO_MS).fase === "mandar");
  const mais = V.maisTempo(v, 20, 30 * 60_000);
  confere("'ainda não cheguei': mais 20 min a partir do prazo", mais.ate === 60 * 60_000);
  const reaberta = V.retomarVolta(v, 50 * 60_000);
  confere("reaberta depois do prazo: o último aviso começa agora, com os 2 min inteiros", V.faseDaVolta(reaberta, 50 * 60_000).fase === "ultimo_aviso" && V.faseDaVolta(reaberta, 50 * 60_000).faltaMs === V.ULTIMO_AVISO_MS);
  confere("reaberta antes do prazo: nada muda", V.retomarVolta(v, 1000) === v);
  confere("guardada e lida de volta", JSON.stringify(V.lerVolta(V.guardarVolta(v), 1000)) === JSON.stringify(v));
  confere("guardada não leva posição nem pessoa (só começo e fim)", Object.keys(JSON.parse(V.guardarVolta(v))).sort().join() === "ate,comecou");
  confere("vencida há mais de 12 h: descartada", V.lerVolta(V.guardarVolta(v), v.ate + 12 * 3600_000 + 1) === null);
  confere("lixo e chave a mais: nada", V.lerVolta("{", 0) === null && V.lerVolta(JSON.stringify({ ...v, quem: "x" }), 0) === null);
  let lancou = 0;
  for (const m of [4, 721, 1.5]) {
    try {
      V.comecarVolta(m, 0);
    } catch {
      lancou++;
    }
  }
  confere("minutos fora de 5 a 720: recusados", lancou === 3);
  confere("a chave do aparelho começa com 'lucia' (o Sair rápido apaga)", V.CHAVE_DA_VOLTA.startsWith("lucia"));
}

// ═══════════════════ 5. Itens 2 e 7: o chat a dois, com o motor de verdade ═══════════════════
const { motorNoNode } = await import("./cifra-no-node.mjs");
const { spqrNoNode } = await import("./spqr-no-node.mjs");
const { paraB64Url, texto, juntar } = await import("../lib/rede/chat/r2/bytes.ts");
const M = await motorNoNode();
{
  const { ChatDoAparelho } = await import("../lib/rede/chat/r2/servico.ts");
  const { cofreDaLista } = await import("../lib/rede/aparelhos/sincronia.ts");
  const { TAMANHOS_DO_ARQUIVO } = await import("../lib/rede/aparelhos/arquivo.ts");
  const { TAMANHO_DO_PEDIDO } = await import("../lib/rede/chat/r2/pedido.ts");
  const { ROTULOS_DE_FORA } = await import("../lib/rede/chat/r2/rotulos.ts");
  const SPQR = await spqrNoNode();
  const H = (rotulo, v) => sha256(juntar(texto(rotulo), v));
  const servidor = { caixas: new Map(), contas: new Map(), aparelhos: new Map(), preChaves: new Map(), cofres: new Map(), depositos: [] };
  const relogio = { agora: Date.UTC(2026, 10, 27, 12) };
  const dia = () => new Date(relogio.agora).toISOString().slice(0, 10);
  const caixaDe = (id) => servidor.caixas.get(paraB64Url(H(ROTULOS_DE_FORA.caixa, id)));
  const codinomeDe = {};
  const transporteDe = (usuario) => ({
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
  });
  const historicoNovo = () => {
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
      async editar() {},
      da: (conversa) => [...m.values()].filter((x) => x.conversa === conversa),
    };
  };
  async function aparelho(usuario, codinome, comGuarda = true) {
    codinomeDe[usuario] = codinome;
    const motor = M.CoreCrypto.new(await M.Database.inMemory());
    const historico = historicoNovo();
    const guarda = new P.GuardaDePosicoes();
    const recebidas = [];
    const deps = {
      motor, spqr: SPQR, transporte: transporteDe(usuario), historico, cofre: cofreDaLista, persistir: async () => undefined,
      sigo: async () => false, conferirRegistro: async () => "confere", agora: () => relogio.agora,
      ...(comGuarda ? { aoPosicao: (p) => {
        recebidas.push(p);
        guarda.receber(`c:${p.conversa}`, p.autor, p.corpo, p.quando);
      } } : {}),
    };
    const chat = await ChatDoAparelho.nascer(deps, usuario, codinome);
    return { chat, historico, guarda, recebidas, usuario };
  }
  const ANA = "aaaaaaaa-0000-4000-8000-000000000001";
  const BIA = "bbbbbbbb-0000-4000-8000-000000000002";
  const A = await aparelho(ANA, "ana");
  const B = await aparelho(BIA, "bia");
  for (const x of [A, B]) await x.chat.rotinaAnonima();
  for (const x of [A, B]) await x.chat.rotinaComSessao();
  const conv = await A.chat.pedirConversa("bia", "oi");
  await B.chat.receberPedidos();
  await B.chat.aceitar(conv);
  await A.chat.receber();
  await B.chat.receber();
  const ola = await A.chat.mandarTexto(conv, "oi");
  await B.chat.receber();
  confere("chat: a conversa abriu e o texto chegou", B.historico.da(conv).some((x) => x.id === ola.id));
  const tamanhoDoTexto = servidor.depositos.at(-1).tamanho;

  // A Ana compartilha a posição (bairro) por 15 min.
  const exataDeVerdade = { la: -8.0475623, lo: -34.8769834 };
  const corpo = P.corpoDePosicao({ ...exataDeVerdade, precisao: "bairro", duracaoMs: 15 * 60_000 });
  const antes = servidor.depositos.length;
  const r = await A.chat.mandarPosicao(conv, corpo);
  confere("chat: a posição sai para os aparelhos da Bia", r.entregues >= 1);
  const novos = servidor.depositos.slice(antes);
  const tudo = Buffer.concat(novos.map((d) => Buffer.from(d.envelope)));
  const coordenadas = ["-8.05", "-34.88", "-8.0475", "-34.8769", "-8.04756"].map((s) => Buffer.from(s));
  confere("chat: o servidor NUNCA vê a coordenada (nem arredondada nem exata) nos envelopes", coordenadas.every((c) => !contem(tudo, c)));
  confere("chat: o envelope da posição tem o MESMO tamanho do de um texto", novos.every((d) => d.tamanho === tamanhoDoTexto), `${novos.map((d) => d.tamanho)} vs ${tamanhoDoTexto}`);
  confere("chat: a posição não vai aos meus outros aparelhos (só à outra pessoa)", novos.length === r.entregues);
  await B.chat.receber();
  const vig = B.guarda.vigentes(relogio.agora);
  confere("chat: a Bia recebe a posição já arredondada, com o autor provado", vig.length === 1 && vig[0].la === -8.05 && vig[0].lo === -34.88 && vig[0].autor === ANA && vig[0].precisao === "bairro");
  confere("chat: a posição comum NÃO entra no histórico (nem no de quem recebe, nem no de quem manda)", !B.historico.da(conv).some((x) => x.posicao) && !A.historico.da(conv).some((x) => x.posicao));
  // Nova posição: troca a anterior (sem trajeto).
  await A.chat.mandarPosicao(conv, P.corpoDePosicao({ la: -8.06, lo: -34.9, precisao: "bairro", duracaoMs: 14 * 60_000 }));
  await B.chat.receber();
  confere("chat: a nova troca a anterior (uma só por pessoa)", B.guarda.vigentes(relogio.agora).length === 1 && B.guarda.vigentes(relogio.agora)[0].la === -8.06);
  await A.chat.mandarPosicao(conv, P.PAREI);
  await B.chat.receber();
  confere("chat: 'parei' apaga na Bia", B.guarda.vigentes(relogio.agora).length === 0);
  // A Bia pede a localização da Ana: chega como pedido, sem posição nenhuma, e o servidor não vê nada diferente de um texto.
  const antesDoPedido = servidor.depositos.length;
  await B.chat.mandarPosicao(conv, P.PEDIDO);
  confere("chat: o pedido de localização tem o MESMO tamanho de um texto", servidor.depositos.slice(antesDoPedido).every((d) => d.tamanho === tamanhoDoTexto));
  await A.chat.receber();
  confere("chat: o pedido de localização chega à Ana como pedido (nenhuma posição)", A.guarda.pedidos(relogio.agora).length === 1 && A.guarda.vigentes(relogio.agora).length === 0 && A.guarda.pedidos(relogio.agora)[0].autor === BIA);
  confere("chat: o pedido não entra no histórico", !A.historico.da(conv).some((x) => x.posicao));
  A.guarda.tirarPedido(`c:${conv}`, BIA);
  await recusa("chat: corpo fora do formato nem sai", () => A.chat.mandarPosicao(conv, { v: 1, la: 1.123, lo: 1, pr: "b", dura: 60 }), "posicao_invalida");
  // A ordem das mensagens continua inteira depois das posições (o controle usa o mesmo contador).
  const depois = await A.chat.mandarTexto(conv, "cheguei");
  await B.chat.receber();
  const m = B.historico.da(conv).find((x) => x.id === depois.id);
  confere("chat: o texto depois das posições chega sem aviso de buraco nem de ordem", m && m.avisos.length === 0, JSON.stringify(m?.avisos));
  confere("chat: e com a prova da franquia de sempre (a denúncia de texto não muda)", m?.prova !== undefined);

  // Item 7: o pedido de ajuda.
  const naoLidasAntes = B.chat.conversas().find((c) => c.id === conv)?.naoLidas ?? 0;
  const sos = P.corpoDePosicao({ ...exataDeVerdade, precisao: "exata", duracaoMs: 3600_000, sos: true });
  await A.chat.mandarPosicao(conv, sos);
  const n = await B.chat.receber();
  const guardada = B.historico.da(conv).find((x) => x.posicao);
  confere("SOS: conta como mensagem nova (o aviso de mensagem chega)", n >= 1 && (B.chat.conversas().find((c) => c.id === conv)?.naoLidas ?? 0) === naoLidasAntes + 1);
  confere("SOS: fica no histórico cifrado do aparelho, com a posição exata e a marca", guardada && JSON.parse(guardada.posicao).sos === 1 && JSON.parse(guardada.posicao).la === -8.04756);
  confere("SOS: some em 24 h (não fica no histórico pelo prazo da conversa)", guardada && guardada.expira - guardada.quando === P.VIDA_DO_SOS_MS);
  confere("SOS: sem prova de franquia (não é texto) e sem texto", guardada && guardada.prova === null && guardada.texto === "");
  confere("SOS: também vai para a guarda (a tela mostra no alto)", B.guarda.vigentes(relogio.agora).some((p) => p.sos));
  confere("SOS: quem mandou não guarda cópia", !A.historico.da(conv).some((x) => x.posicao));
  await A.chat.mandarPosicao(conv, P.sosSemPosicao(true));
  await B.chat.receber();
  confere("SOS da volta para casa sem posição: chega com a marca", B.historico.da(conv).some((x) => x.posicao && JSON.parse(x.posicao).volta === 1 && JSON.parse(x.posicao).la === undefined));

  // Quem bloqueou não recebe nada (a Bia bloqueia a Ana: a posição dela cai).
  const C = await aparelho("cccccccc-0000-4000-8000-000000000003", "caio", false);
  await C.chat.rotinaAnonima();
  await C.chat.rotinaComSessao();
  const conv2 = await C.chat.pedirConversa("bia", "oi");
  await B.chat.receberPedidos();
  await B.chat.aceitar(conv2);
  await C.chat.receber();
  await B.chat.receber();
  await C.chat.mandarTexto(conv2, "oi");
  await B.chat.receber();
  B.guarda.esquecer();
  await C.chat.mandarPosicao(conv2, P.corpoDePosicao({ la: 1, lo: 1, precisao: "bairro", duracaoMs: 60_000 }));
  await B.chat.receber();
  confere("chat: a posição chega pela conversa certa (origem c:<conversa>)", B.guarda.vigentes(relogio.agora).some((p) => p.origem === `c:${conv2}`));
  // Sem guarda ligada (aoPosicao ausente), a posição é descartada sem erro.
  await B.chat.mandarPosicao(conv2, P.corpoDePosicao({ la: 1, lo: 1, precisao: "bairro", duracaoMs: 60_000 }));
  const rc = await passa("chat: sem guarda, a posição é só descartada", () => C.chat.receber());
  confere("chat: sem guarda, nada de mensagem nova", rc === 0);

  // ═══ O grupo (MLS): tipo novo de conteúdo ═══
  const { ed25519 } = await import("@noble/curves/ed25519.js");
  const { SUITE_MLS } = await import("../lib/rede/cifra/motor.ts");
  const { Grupo, TransporteDoMotor } = await import("../lib/rede/membros/grupo.ts");
  const { ENVELOPES_DE_GRUPO } = await import("../lib/rede/membros/embrulho.ts");
  const { ENVELOPE_DO_PEDIDO, selarPedido } = await import("../lib/rede/membros/entrada.ts");
  const hx = (b) => Buffer.from(b).toString("hex");
  const Hg = (rotulo, b) => hx(sha256(juntar(texto(rotulo), b)));
  const ACEITOS = new Set([...ENVELOPES_DE_GRUPO, ENVELOPE_DO_PEDIDO]);
  const sg = { caixas: new Map(), guardado: [] };
  const transporte = {
    async criar(c) {
      const k = Hg("alumia/r2/caixa", c.id);
      if (sg.caixas.has(k)) return;
      sg.caixas.set(k, { pd: Hg("alumia/r2/passe-deposito", c.pd), pl: Hg("alumia/r2/passe-leitura", c.pl), unicoFeito: false, proxima: 1, pacotes: [] });
    },
    async depositar(c, envelope, _f, unico) {
      const cx = sg.caixas.get(Hg("alumia/r2/caixa", c.id));
      if (!ACEITOS.has(envelope.length)) return { ok: false, erro: "tamanho" };
      if (!cx || cx.pd !== Hg("alumia/r2/passe-deposito", c.pd)) return { ok: true };
      if (unico) {
        if (cx.unicoFeito) return { ok: false, erro: "ocupada" };
        cx.unicoFeito = true;
      }
      cx.pacotes.push({ ordem: cx.proxima++, envelope: new Uint8Array(envelope), franquia: null, marca: null, dia: "2026-11-27" });
      sg.guardado.push(Buffer.from(envelope));
      return { ok: true };
    },
    async buscar(c, cursor) {
      const cx = sg.caixas.get(Hg("alumia/r2/caixa", c.id));
      if (!cx || cx.pl !== Hg("alumia/r2/passe-leitura", c.pl)) return [];
      return cx.pacotes.filter((p) => p.ordem > cursor).slice(0, 50);
    },
  };
  async function ap(nome) {
    const transporteDoMotor = new TransporteDoMotor(M);
    const cc = M.CoreCrypto.new(M.Database.inMemory());
    const cliente = new M.ClientId(new M.Uuid(crypto.randomUUID()), new M.DeviceId(1n), "alumia.invalid");
    const ref = await cc.transaction(async (c) => {
      await c.mlsInit(cliente, transporteDoMotor);
      return c.addCredential(M.Credential.basic(M.cipherSuiteFromU16(SUITE_MLS), cliente));
    });
    const { secretKey, publicKey } = ed25519.keygen();
    return { nome, M, cc, ref, cliente, transporteDoMotor, identidade: { publica: publicKey, assinar: async (d) => ed25519.sign(d, secretKey) }, transporte };
  }
  const [apAna, apBia] = [await ap("ana"), await ap("bia")];
  const ana = await Grupo.criar(apAna, "grupo", true);
  const pub = ana.publicacaoDaEntrada("0b7c1e52-5d0c-4a63-9a43-5f2a6c1d9e10");
  const { pedido, resposta } = await Grupo.montarPedido(apBia, "");
  await transporte.depositar({ id: Buffer.from(pub.caixa, "base64url"), pd: Buffer.from(pub.pd, "base64url") }, await selarPedido(Buffer.from(pub.xwing, "base64url"), pedido));
  const [pBia] = await ana.pedidosDeEntrada();
  await ana.aceitar(pBia);
  const bia = await Grupo.entrarPelaResposta(apBia, resposta, pedido.kr, "grupo");
  confere("grupo: a Bia entrou", bia !== null);
  const corpoG = P.montarCorpoDePosicao(P.corpoDePosicao({ la: -23.5505199, lo: -46.6333094, precisao: "exata", duracaoMs: 3600_000 }));
  const antesG = sg.guardado.length;
  await ana.mandarPosicao(corpoG);
  await bia.receber();
  const mG = bia.mensagens.find((x) => x.tipo === "posicao");
  confere("grupo: a posição chega como tipo novo de conteúdo, com o autor certo", mG && Buffer.from(mG.corpo).equals(Buffer.from(corpoG)) && mG.autor === b64(apAna.identidade.publica));
  const novosG = Buffer.concat(sg.guardado.slice(antesG));
  confere("grupo: o servidor não vê a coordenada", !contem(novosG, Buffer.from("-23.55052")) && !contem(novosG, Buffer.from("-46.63331")));
  confere("grupo: o envelope tem um dos tamanhos fixos de sempre", sg.guardado.slice(antesG).every((e) => ENVELOPES_DE_GRUPO.includes(e.length)));
  await recusa("grupo: corpo fora do formato nem sai", () => ana.mandarPosicao(new TextEncoder().encode('{"v":1,"la":1.123,"lo":1,"pr":"b","dura":60}')), "posicao_invalida");
}

// ═══════════════════ 7. Itens 23 a 25: os modos da sala de voz ═══════════════════
{
  const Mo = await import("../lib/rede/voz/modos.ts");
  // Puro.
  let e = Mo.estadoInicial();
  e = Mo.ligarPalco(e, "ana", true);
  confere("palco: ligado, só a anfitriã fala", e.palco && e.anfitria === "ana" && Mo.possoFalar(e, "ana") && !Mo.possoFalar(e, "bia"));
  e = Mo.mao(e, "ana", "bia", true);
  e = Mo.mao(e, "ana", "caio", true);
  e = Mo.mao(e, "ana", "bia", true);
  confere("palco: a fila de mãos, na ordem, sem repetir", e.maos.join() === "bia,caio");
  confere("palco: só a anfitriã mexe na fila", Mo.mao(e, "bia", "dani", true) === e);
  e = Mo.darVez(e, "ana", "bia", true);
  confere("palco: dar a vez tira da fila e deixa falar", Mo.possoFalar(e, "bia") && e.maos.join() === "caio");
  e = Mo.darVez(e, "ana", "bia", false);
  confere("palco: tirar a vez", !Mo.possoFalar(e, "bia"));
  confere("palco: desligado, todo mundo fala", Mo.possoFalar(Mo.ligarPalco(e, "ana", false), "caio"));
  let w = Mo.ligarEspera(Mo.estadoInicial(), "ana", true, ["ana", "bia"]);
  confere("espera: quem já estava entra junto; quem chega não liga", Mo.podeLigar(w, "ana", "bia") && !Mo.podeLigar(w, "ana", "caio") && Mo.esperando(w, "caio") && !Mo.esperando(w, "bia"));
  w = Mo.bateu(w, "ana", "caio");
  confere("espera: a anfitriã anota quem bateu", w.batendo.join() === "caio");
  confere("espera: só a anfitriã anota", Mo.bateu(w, "bia", "dani") === w);
  w = Mo.decidir(w, "ana", "caio", true);
  confere("espera: aprovada, liga", Mo.podeLigar(w, "bia", "caio") && w.batendo.length === 0);
  confere("espera: quem espera não liga nem para quem está dentro", !Mo.podeLigar(Mo.bateu(w, "ana", "dani"), "dani", "bia"));
  const ri = Mo.ligarRitmo(Mo.estadoInicial(), "ana", { foco: 25, pausa: 5 }, 0);
  confere("ritmo: foco nos primeiros 25 min", Mo.faseDoRitmo(ri.ritmo, 10 * 60_000).fase === "foco" && Mo.faseDoRitmo(ri.ritmo, 10 * 60_000).faltaMs === 15 * 60_000);
  confere("ritmo: pausa depois, e o ciclo seguinte", Mo.faseDoRitmo(ri.ritmo, 27 * 60_000).fase === "pausa" && Mo.faseDoRitmo(ri.ritmo, 31 * 60_000).ciclo === 2);
  let recusou = false;
  try {
    Mo.ligarRitmo(Mo.estadoInicial(), "ana", { foco: 200, pausa: 5 }, 0);
  } catch {
    recusou = true;
  }
  confere("ritmo: fora dos limites (5 a 90, 1 a 30), recusado", recusou);
  confere("presença: o número só a partir de 3", Mo.contagem(2) === null && Mo.contagem(0) === null && Mo.contagem(3) === 3);
  // Quem manda o estado.
  const p = Mo.ligarPalco(Mo.estadoInicial(), "bia", true);
  confere("estado: de quem não é a anfitriã que diz ser, recusado", Mo.aceitarEstado(Mo.estadoInicial(), "caio", p, new Set()) === null);
  const a1 = Mo.ligarPalco(Mo.estadoInicial(), "ana", true);
  confere("estado: duas anfitriãs ao mesmo tempo: fica a de menor identificador", Mo.aceitarEstado(p, "ana", a1, new Set(["ana", "bia"])) === a1 && Mo.aceitarEstado(a1, "bia", p, new Set(["ana", "bia"])) === null);
  confere("estado: versão velha da mesma anfitriã, ignorada", Mo.aceitarEstado(Mo.ligarPalco(a1, "ana", false), "ana", a1, new Set(["ana"])) === null);
  confere("estado: a anfitriã saiu, outra pode assumir", Mo.aceitarEstado(a1, "bia", p, new Set(["bia"])) === p);
  confere("estado: lixo e listas grandes demais recusados", Mo.lerEstado({ ...a1, maos: Array.from({ length: 9 }, (_, i) => `x${i}`) }) === null && Mo.lerEstado(null) === null && Mo.lerRecadoDeModo({ k: "outro" }) === null);

  // Com a sala de verdade (lib/rede/voz/sala.ts), conexões de mentira e um canal na memória.
  const { criarSalaDeVoz, selarRecado, abrirRecado } = await import("../lib/rede/voz/sala.ts");
  const { criarControleDosModos } = await import("../lib/rede/voz/controle-dos-modos.ts");
  class ConexaoDeMentira {
    constructor(config) { this.config = config; this.signalingState = "stable"; this.connectionState = "new"; this.faixas = []; this.receptores = 0; }
    addTrack(f) { this.faixas.push(f); }
    addTransceiver(tipo, o) { if (tipo === "audio" && o?.direction === "recvonly") this.receptores++; }
    async createOffer() { return { type: "offer", sdp: "v=0 oferta" }; }
    async createAnswer() { return { type: "answer", sdp: "v=0 resposta" }; }
    async setLocalDescription(d) { this.local = d; this.signalingState = d.type === "offer" ? "have-local-offer" : "stable"; }
    async setRemoteDescription(d) { this.remota = d; if (d.type === "answer") this.signalingState = "stable"; }
    async addIceCandidate() {}
    close() { this.connectionState = "closed"; }
  }
  const ondas = new Set();
  const vistos = [];
  const fazerCanal = () => {
    const meus = [];
    const canal = { enviar: async (b) => { vistos.push(JSON.stringify(b)); for (const c of ondas) if (c !== canal) for (const o of c.ouvintes) o(b); }, aoReceber: (f) => void meus.push(f), sair: async () => void ondas.delete(canal), ouvintes: meus };
    ondas.add(canal);
    return canal;
  };
  const chave = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const chaveFixa = { atual: async () => ({ epoca: 1, chave }), daEpoca: async (x) => (x === 1 ? chave : null) };
  const turn = [{ urls: ["turn:retransmissao.exemplo:3478"], username: "u", credential: "c" }];
  const espere = () => new Promise((r) => setTimeout(r, 40));
  const microfone = () => {
    const faixa = { enabled: true, stop() {} };
    return { faixa, getAudioTracks: () => [faixa], getTracks: () => [faixa] };
  };
  const gente = {};
  async function entra(nome, mic = microfone()) {
    const controle = criarControleDosModos(nome);
    const conexoes = [];
    const sala = criarSalaDeVoz({ eu: nome, sala: "g:estudo", chave: chaveFixa, canal: fazerCanal(), iceServers: turn, modos: controle.ganchos, novaConexao: (c) => { const x = new ConexaoDeMentira(c); conexoes.push(x); return x; } });
    controle.ligar(sala);
    await sala.entrar(mic);
    gente[nome] = { controle, sala, conexoes, mic };
    for (let i = 0; i < 4; i++) await espere();
    return gente[nome];
  }
  const ligados = (nome) => new Set(gente[nome].sala.participantes().map((x) => x.usuario));
  const ana = await entra("ana");
  const bia = await entra("bia");
  confere("sala: sem modos, Ana e Bia se ligam como sempre", ligados("ana").has("bia") && ligados("bia").has("ana"));
  // Palco: a Ana liga; a Bia fica sem a vez, com o microfone desligado no aparelho dela.
  await ana.controle.acoes.palco(true);
  for (let i = 0; i < 3; i++) await espere();
  confere("palco: a Bia recebe o estado da anfitriã", bia.controle.estado().palco && bia.controle.estado().anfitria === "ana");
  confere("palco: sem a vez, o microfone da Bia é desligado no aparelho dela", bia.mic.faixa.enabled === false && ana.mic.faixa.enabled === true);
  await bia.controle.acoes.mao(true);
  for (let i = 0; i < 3; i++) await espere();
  confere("palco: a mão da Bia entra na fila (na Ana e na Bia)", ana.controle.estado().maos.join() === "bia" && bia.controle.estado().maos.join() === "bia");
  await ana.controle.acoes.vez("bia", true);
  for (let i = 0; i < 3; i++) await espere();
  confere("palco: a Ana dá a vez; a Bia pode falar", bia.controle.estado().falam.includes("bia") && bia.controle.estado().maos.length === 0);
  // Espera: a Ana liga a espera; o Caio chega e não liga para ninguém até ser aprovado.
  await ana.controle.acoes.palco(false);
  await ana.controle.acoes.espera(true);
  for (let i = 0; i < 3; i++) await espere();
  const caio = await entra("caio");
  confere("espera: o Caio bate e ninguém liga para ele", !ligados("ana").has("caio") && !ligados("bia").has("caio") && caio.sala.participantes().length === 0);
  confere("espera: a anfitriã vê quem bateu; o Caio sabe que espera", ana.controle.estado().batendo.includes("caio") && caio.controle.estado().espera && caio.controle.estado().anfitria === "ana");
  await ana.controle.acoes.decidir("caio", true);
  for (let i = 0; i < 6; i++) await espere();
  confere("espera: aprovado, o Caio liga para todos", ligados("caio").has("ana") && ligados("caio").has("bia") && ligados("ana").has("caio") && ligados("bia").has("caio"));
  // A Dani chega e é recusada: fica de fora.
  const dani = await entra("dani");
  await ana.controle.acoes.decidir("dani", false);
  for (let i = 0; i < 4; i++) await espere();
  confere("espera: recusada, a Dani fica de fora", !ligados("ana").has("dani") && dani.sala.participantes().length === 0 && !ana.controle.estado().batendo.includes("dani"));
  // Estudo em silêncio: entra sem microfone e só ouve (o ritmo vem da anfitriã).
  await ana.controle.acoes.espera(false);
  await ana.controle.acoes.ritmo({ foco: 25, pausa: 5 });
  for (let i = 0; i < 4; i++) await espere();
  const eva = await entra("eva", null);
  for (let i = 0; i < 4; i++) await espere();
  confere("estudo: quem entra sem microfone liga e só ouve (nenhuma faixa, um receptor)", ligados("eva").has("ana") && eva.conexoes.every((c) => c.faixas.length === 0 && c.receptores === 1));
  confere("estudo: quem chega recebe o ritmo da anfitriã", eva.controle.estado().ritmo?.foco === 25 && eva.controle.estado().ritmo?.inicio === ana.controle.estado().ritmo?.inicio);
  // O canal só vê blocos cifrados: nem os nomes, nem o modo.
  const tudo = vistos.join("\n");
  confere("canal: o servidor não vê quem levantou a mão, quem espera nem o ritmo", !/"maos"|"batendo"|"palco"|"ritmo"|caio|dani/.test(tudo));
  // Recado "sala" forjado por quem não tem a chave: não abre.
  const outra = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const forjado = await selarRecado(outra, 1, "g:estudo", { de: "ana", para: null, tipo: "sala", modo: { k: "estado", e: Mo.ligarPalco(Mo.estadoInicial(), "ana", true) }, quando: Date.now() });
  confere("canal: recado de modo sem a chave do grupo não abre", (await abrirRecado(chave, "g:estudo", forjado)) === null);
  for (const x of Object.values(gente)) await x.sala.sair();
  // A senha muda o nome da sala (e quem não sabe cai noutra).
  const nav = ler("lib/rede/voz/navegador.ts");
  confere("senha: muda o nome da sala (canal e contexto da cifra) e não vai a lugar nenhum", /export async function nomeComSenha/.test(nav) && /canalDoRealtime\(opcoes\.grupo, nome\)/.test(nav) && /sala: `\$\{opcoes\.grupo\}:\$\{nome\}`/.test(nav));
}

// ═══════════════════ 8. Item 22: o canal de aviso da organização, no banco de verdade ═══════════════════
{
  const SQL = SQL_DO_LOTE;
  const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  confere("migração: termina passando a porta", /select interno\.alumia_trancar\(\);\s*$/.test(SQL));
  confere("migração: diz que roda depois do p5-fim (banco 17) e antes do p4-fim", SQL.includes("Roda depois de 20261126-p5-fim.sql (banco na versão 17)") && SQL.includes("antes do 20261127-p4-fim.sql"));
  confere("migração: não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr|interno\.origem\(\)/i.test(semComentario));
  confere("migração: não mexe na versão nem na lista da porta", !/rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
  confere("migração: nenhuma posição no banco (nada de latitude, longitude, posição)", !/latitude|longitude|\bposicao\b|\bla\b numeric|coords/i.test(semComentario));
  confere(COLADA ? "migração: colada no install.sql (quem junta colou)" : "migração: não colada no install.sql (quem junta cola)", true);
  const banco = BANCO;
  const { dono, rpc, criarUsuario, pg } = banco;
  const n0 = (await dono("select count(*)::int n from pg_proc where proname like 'rede\\_p4\\_canal\\_%'")).rows[0].n;
  confere("antes da migração: nenhuma função do canal", n0 === 0);
  const col0 = (await dono("select count(*)::int n from information_schema.columns where table_schema = 'interno' and table_name = 'rede_org_sinos' and column_name = 'so_avisos'")).rows[0].n;
  confere("antes da migração: sem a escolha 'só os avisos'", col0 === 0);
  let trancar;
  try {
    const r = await pg.exec(SQL);
    trancar = r.at(-1)?.rows?.[0]?.alumia_trancar;
    certos++;
  } catch (e) {
    falhas.push(`migração roda no banco 17: ${e.message}`);
  }
  confere(`a porta passa em todas as funções novas (abertas: ${JSON.stringify(trancar?.abertas)})`, Array.isArray(trancar?.abertas) && trancar.abertas.length === 0);
  await passa("a migração roda de novo (idempotente)", () => pg.exec(SQL));
  const def = (await dono("select pg_get_functiondef('interno.alumia_org_postou()'::regprocedure) d")).rows[0].d;
  confere("a redefinição do aviso é a da migração (respeita 'só os avisos')", def.includes("v_aviso or not s.so_avisos"));
  // As pessoas.
  const Q = {};
  const nomes = ["org", "ana", "bia", "caio", "dani", "eva", "fabi", "coord"];
  for (const [i, nome] of nomes.entries()) {
    Q[nome] = await criarUsuario(`${nome}@p4-perto.local`, nome);
    await rpc({ papel: "authenticated", sub: Q[nome], ip: `198.51.100.${i + 1}` }, "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
      [Q[nome], `Pessoa ${i + 1}`, nome === "org" ? "coletivo_perto" : nome]);
  }
  await dono("delete from interno.papeis");
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [Q.coord]);
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  for (const id of Object.values(Q)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
  await dono("update auth.users set created_at = now() - interval '30 days'");
  await dono("insert into interno.rede_orgs (perfil, tipo, cidade, verificada_em) values ($1, 'coletivo', 'Recife', now())", [Q.org]);
  await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono')", [Q.org, Q.ana]);
  const como = (nome) => ({ papel: "authenticated", sub: Q[nome], ip: "198.51.100.200" });
  const limpar = () => dono("delete from interno.limites");
  const chama = async (nome, f, a) => {
    await limpar();
    return rpc(como(nome), f, a);
  };
  const ligar = (sim) => dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-p4-perto', $1) on conflict (nome) do update set ligado = $1", [sim]);
  await recusa("desligado no painel: não liga o canal", () => chama("bia", "rede_p4_canal_escolher", { p_handle: "coletivo_perto", p_modo: "avisos" }), "desligado");
  await ligar(true);
  const m1 = await passa("a Bia escolhe 'só os avisos'", () => chama("bia", "rede_p4_canal_escolher", { p_handle: "coletivo_perto", p_modo: "avisos" }));
  confere("a escolha volta para a própria pessoa", m1?.modo === "avisos");
  await passa("o Caio escolhe 'tudo'", () => chama("caio", "rede_p4_canal_escolher", { p_handle: "coletivo_perto", p_modo: "tudo" }));
  await recusa("modo inventado: recusado", () => chama("caio", "rede_p4_canal_escolher", { p_handle: "coletivo_perto", p_modo: "lista" }), "invalido:modo");
  confere("cada pessoa vê só a própria escolha", (await chama("caio", "rede_p4_canal_meu", { p_handle: "coletivo_perto" }))?.modo === "tudo" && (await chama("dani", "rede_p4_canal_meu", { p_handle: "coletivo_perto" }))?.modo === "nada");
  // O número: só para quem gere, e só a partir de 3.
  await recusa("quem não gere não vê o número", () => chama("bia", "rede_p4_canal_contagem", { p_handle: "coletivo_perto" }), "sem_permissao");
  await recusa("nem a coordenação vê o número de uma organização que não gere", () => chama("coord", "rede_p4_canal_contagem", { p_handle: "coletivo_perto" }), "sem_permissao");
  const c2 = await chama("ana", "rede_p4_canal_contagem", { p_handle: "coletivo_perto" });
  confere("com 2 inscritas: 'menos de 3' (nenhum número)", c2?.inscritas === null && c2?.so_avisos === null, JSON.stringify(c2));
  await passa("a Dani liga o sino antigo (tudo)", () => chama("dani", "rede_org_sino", { p_handle: "coletivo_perto", p_sim: true }));
  const c3 = await chama("ana", "rede_p4_canal_contagem", { p_handle: "coletivo_perto" });
  confere("com 3 inscritas: o número aparece", c3?.inscritas === 3, JSON.stringify(c3));
  confere("'só os avisos' com 1 pessoa: não aparece (apontaria quem é)", c3?.so_avisos === null);
  confere("a contagem não devolve nenhum nome nem id", !JSON.stringify(c3).match(/[0-9a-f]{8}-[0-9a-f]{4}|bia|caio|dani|Pessoa/));
  // O aviso respeita a escolha.
  const avisosDe = async (nome) => (await dono("select texto from interno.avisos where para = $1 order by criado_em", [Q[nome]])).rows.map((r) => r.texto);
  await dono("delete from interno.avisos");
  await dono("insert into interno.rede_posts (autor, texto, tipo) values ($1, 'Assembleia amanhã às 18h, na sede do coletivo.', 'post')", [Q.org]);
  confere("post comum: quem quer 'tudo' recebe; quem quer 'só os avisos' não", (await avisosDe("caio")).length === 1 && (await avisosDe("dani")).length === 1 && (await avisosDe("bia")).length === 0);
  await dono("insert into interno.rede_posts (autor, texto, tipo) values ($1, 'Aviso: o ato de sexta mudou de lugar. Veja no calendário.', 'aviso')", [Q.org]);
  const daBia = await avisosDe("bia");
  confere("aviso: todas recebem, e o texto diz que é aviso", daBia.length === 1 && daBia[0].includes("publicou um aviso") && (await avisosDe("caio")).length === 2);
  confere("o aviso não leva trecho do post", ![...daBia, ...(await avisosDe("caio"))].some((t) => /Assembleia|ato de sexta/.test(t)));
  confere("quem não ligou o sino não recebe nada", (await avisosDe("eva")).length === 0);
  // Desligar sempre funciona (mesmo com o interruptor desligado).
  await ligar(false);
  const m0 = await passa("desligado no painel, sair do canal ainda funciona", () => chama("bia", "rede_p4_canal_escolher", { p_handle: "coletivo_perto", p_modo: "nada" }));
  confere("saiu: 'nada'", m0?.modo === "nada");
  await recusa("desligado no painel: a contagem não sai", () => chama("ana", "rede_p4_canal_contagem", { p_handle: "coletivo_perto" }), "desligado");
  // A regra de privacidade: nenhuma função do lote devolve lista de pessoas; tabelas fechadas.
  const funcoes = (await dono("select p.proname, pg_get_function_result(p.oid) r from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede\\_p4\\_canal\\_%'")).rows;
  confere("nenhuma função do canal devolve tabela ou lista (só jsonb de um objeto)", funcoes.length === 3 && funcoes.every((f) => f.r === "jsonb"));
  confere("o corpo das funções não monta lista de quem ligou o sino", !/jsonb_agg|array_agg|string_agg/.test(semComentario));
  const anon = (await dono("select has_function_privilege('anon', 'public.rede_p4_canal_contagem(text)', 'execute') a, has_function_privilege('authenticated', 'interno.alumia_org_postou()', 'execute') b")).rows[0];
  confere("anon não executa; ninguém de fora chama o gatilho", anon.a === false && anon.b === false);
  confere("a escolha nova fica na tabela de antes, sem hora nem endereço", (await dono("select string_agg(column_name, ',' order by column_name) c from information_schema.columns where table_schema = 'interno' and table_name = 'rede_org_sinos'")).rows[0].c === "org,so_avisos,usuario");
}

// ═══════════════════ 9. No código (a regra de privacidade estática) ═══════════════════
{
  const perto = ["lib/rede/perto/posicao.ts", "lib/rede/perto/volta.ts", "lib/rede/perto/lugar.ts", "lib/rede/perto/guarda.ts", "lib/rede/perto/cliente.ts"].map(ler).join("\n");
  const semComentario = perto.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  confere("perto: nada de Math.random", !/Math\.random/.test(semComentario));
  confere("perto: nenhum serviço de fora pelo navegador (nada de fetch nem de endereço http)", !/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//.test(semComentario));
  // As telas.
  const tela = ler("components/rede/perto/TelaDoPerto.tsx");
  const pedir = tela.slice(tela.indexOf("function PedirAjuda"), tela.indexOf("// ───── Volta para casa"));
  confere("tela: o pedido de ajuda passa pela confirmação antes de sair", pedir.indexOf("await confirmar(") > 0 && pedir.indexOf("await confirmar(") < pedir.indexOf("await pedirAjuda("));
  const comp = tela.slice(tela.indexOf("function Compartilhar"), tela.indexOf("// ───── Quem compartilha comigo"));
  confere("tela: compartilhar passa pela confirmação (com quantas pessoas do círculo) antes de pedir a posição", comp.indexOf("await confirmar(") > 0 && comp.indexOf("await confirmar(") < comp.indexOf("compartilhar.comecar("));
  confere("tela: precisão 'só o bairro' é o padrão", /useState<Precisao>\("bairro"\)/.test(tela));
  const telas = ["TelaDoPerto.tsx", "Recebidas.tsx", "VigiaDoPerto.tsx", "CanalDeAvisos.tsx", "ModosDaSala.tsx", "PosicaoNaMensagem.tsx", "usar.ts", "Pedidos.tsx", "acao.tsx"].map((f) => ler(`components/rede/perto/${f}`)).join("\n");
  confere("telas: nada guardado no aparelho pelas telas (nem localStorage nem sessionStorage)", !/localStorage|sessionStorage|indexedDB/.test(telas));
  confere("telas: nenhum link para mapa de site de fora com a posição (só geo: do aparelho)", !/https?:\/\/|openstreetmap/i.test(telas.replace(/^\s*\/\/.*$/gm, "")) && /linkGeo\(/.test(ler("components/rede/perto/Recebidas.tsx")));
  confere("vigia: o pedido de ajuda da volta sai uma vez (volta.venceu tira a volta antes de mandar)", /this\.trocar\(null\);\s*if \(outraAba\) return null;\s*return pedirAjuda\(/.test(ler("lib/rede/perto/cliente.ts")));
  confere("conversa: o pedido de ajuda aparece na conversa e fica fora da denúncia com prova", /m\.posicao !== undefined \? \(\s*<PosicaoNaMensagem/.test(ler("components/rede/chat/Conversa.tsx")) && /m\.anexo === undefined && m\.posicao === undefined\);/.test(ler("components/rede/chat/Conversa.tsx")));
  const sala = ler("components/rede/voz/SalaDeVoz.tsx");
  confere("sala: os modos só com a flag (desligada, a sala é a de antes)", /const comModos = ligado\("alumia-p4-perto"\);/.test(sala) && /\.\.\.\(novo \? \{ modos: novo\.ganchos, senha, semMicrofone \} : \{\}\)/.test(sala));
  confere("sala: no estudo, presença só como contagem (sem nomes)", /Presenca t=\{tp\.sala\}/.test(sala) && /contagem\(n\)/.test(ler("components/rede/perto/ModosDaSala.tsx")));
  confere("canal: só com a flag, e o número só para quem gere", /const ativo = ligado\("alumia-p4-perto"\);/.test(ler("components/rede/perto/CanalDeAvisos.tsx")) && /if \(gerencio\) canal\.contagem/.test(ler("components/rede/perto/CanalDeAvisos.tsx")));
  const vigia = ler("components/rede/perto/VigiaDoPerto.tsx");
  confere("vigia: a faixa fixa enquanto compartilha, com para quem, até quando e o botão de parar", /estado\.ligado && \(/.test(vigia) && /t\.compartilhar\.faixa/.test(vigia) && /compartilhar\.parar\(\)/.test(vigia));
  const cli = ler("lib/rede/perto/cliente.ts");
  confere("compartilhar: quem saiu do círculo (conversa fechada, bloqueada ou apagada) para de receber na próxima atualização", /aindaAbertas\(estado\.conversas\)/.test(cli) && /c\.situacao === "aberta" && !c\.bloqueada && !c\.apagada/.test(cli));
  const ped = ler("components/rede/perto/Pedidos.tsx");
  confere("pedido: aceitar só com o toque, e recusar não manda nada", /compartilhar\.incluir\(/.test(ped) && !/mandar|pedirLocalizacao/.test(ped.slice(ped.indexOf("t.pedido.aceitar}"))));
  confere("pedido: numa partilha de posição EXATA, aceitar pede a confirmação antes (o botão promete só o bairro)", /confirmar\(t\.pedido\.aceitarExata/.test(ped) && /posicaoExataConfirmada: exata/.test(ped));
  confere("compartilhar: incluir numa partilha exata sem a confirmação é recusado no cliente", /precisao === "exata" && o\.posicaoExataConfirmada !== true/.test(cli));
  confere("encaixe: desligada a rota, nada aparece", /export const encaixe: Encaixe = !rotaNovaLigada\("perto"\) \? \{\} :/.test(ler("components/rede/perto/encaixe.tsx")));
  // Os textos: as mesmas chaves nos seis idiomas, e os cinco novos com a marca de rascunho.
  const chavesDe = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chavesDe(v, `${p}${k}.`) : [`${p}${k}`])).filter((k) => k !== "_rascunho").sort().join();
  const pt = JSON.parse(ler("i18n/rede/p4-perto/pt.json"));
  confere("textos: o português é o final (sem marca)", pt._rascunho === undefined);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const x = JSON.parse(ler(`i18n/rede/p4-perto/${l}.json`));
    confere(`textos: ${l} com as mesmas chaves e a marca _rascunho`, typeof x._rascunho === "string" && chavesDe(x) === chavesDe(pt));
  }
  confere("perto: a posição nunca vai ao disco (localStorage só guarda a volta, que não tem posição)", !/localStorage\.setItem\([^)]*(la|lo|posicao|coords)/.test(semComentario) && /setItem\(CHAVE_DA_VOLTA, guardarVolta\(v\)\)/.test(semComentario));
  confere("perto: nenhuma chamada ao banco com posição (nada de rpc no cliente do perto além do modo ato)", !/\brpc\(|chamar\(/.test(ler("lib/rede/perto/cliente.ts").replace(/\/\/.*$/gm, "")));
  const servico = ler("lib/rede/chat/r2/servico.ts");
  confere("chat: a posição vai como controle DENTRO do cifrado (enviarBloco com 'controle')", /enviarBloco\(id, "controle", controle\(\{ a: "posicao", p \}\), destinos, false\)/.test(servico));
  confere("chat: os TIPOS do bloco não mudaram (nenhum tipo novo no protocolo)", /export const TIPOS = \{ texto: 1, controle: 2, anexo: 3, caixas: 4 \} as const;/.test(ler("lib/rede/chat/r2/bloco.ts")));
  confere("chat: a posição comum não vai ao histórico (só o SOS)", /if \(corpo\.sos\) \{\s*await this\.d\.historico\.guardar/.test(servico));
  const nav = ler("lib/rede/chat/r2/navegador.ts");
  confere("navegador: a posição que chega vai para a guarda da memória", nav.includes('import("../../perto/guarda")') && nav.includes("...(m.posicao ? { posicao: m.posicao } : {})"));
  confere("guarda: some no Sair rápido e no apagar tudo do chat", ler("lib/rede/perto/guarda.ts").includes("aoApagarTudoDoChat(() => guardaDePosicoes.esquecer())"));
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  FALHA: " + f);
process.exit(falhas.length ? 1 : 0);

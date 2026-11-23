// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, lote "chamadas" (itens 139 e 140): a chamada de voz e de vídeo da conversa a dois, com o código do aparelho de verdade
// (o chat a dois com o motor Proteus e o SPQR de verdade) e o banco de verdade (PGlite com o install.sql e a migração
// 20261127-p4-chamadas.sql):
//   · o toque é um tipo novo de conteúdo DENTRO do cifrado: o servidor do chat nunca vê a chave, o id nem que houve chamada (o
//     envelope tem o tamanho de uma mensagem curta comum); só a OUTRA pessoa da conversa toca; nada fica em histórico;
//   · a chave da sala sai do toque (só as duas pessoas a têm): quem não tem o toque não entra nem lê a combinação; o canal de
//     combinação só vê blocos cifrados, com nome tirado da chave (não aponta a conversa nem as contas);
//   · teto de 2 na chamada a dois; sempre por retransmissão; vídeo até 4 pessoas por sala, acima disso só voz (item 140);
//   · o andamento (ligar, tocar, atender, recusar, desistir, desligar, o prazo do toque) só na memória;
//   · a regra de privacidade: nenhum registro de chamada, nada no disco, nenhuma notificação do sistema, nada de Math.random;
//   · a migração: só os dois interruptores (só pelo nome), nenhuma tabela, nenhuma função.
// Uso: npm run testar:p4-chamadas
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
const espere = (ms = 30) => new Promise((r) => setTimeout(r, ms));

// O banco nasce ANTES de carregar o motor do chat (o motor de cifra muda o ambiente que o PGlite usa para achar os arquivos).
const { criarBanco } = await import("./banco-local.mjs");
const SQL_DO_LOTE = ler("supabase/migracoes/20261127-p4-chamadas.sql").replace(/^﻿/, "");
const COLADA = ler("supabase/install.sql").replace(/\r\n/g, "\n").includes(SQL_DO_LOTE.replace(/\r\n/g, "\n").trim());
const BANCO = await criarBanco(COLADA ? { antesDe: SQL_DO_LOTE } : {});

const T = await import("../lib/rede/chamada/toque.ts");
const G = await import("../lib/rede/chamada/guarda.ts");
const PN = await import("../lib/rede/chamada/painel.ts");
const SC = await import("../lib/rede/chamada/sala.ts");
const V = await import("../lib/rede/voz/sala.ts");
const R = await import("../lib/rede/cifra/rotulos.ts");

// ═══════════════════ 1. O toque (puro) ═══════════════════
{
  const a = T.novoToque(false, 1_000);
  const b = T.novoToque(true, 1_000);
  confere("toque: id de 16 bytes e chave de 32 bytes, sorteados (dois toques nunca iguais)", Buffer.from(a.id, "base64url").length === 16 && Buffer.from(a.k, "base64url").length === 32 && a.id !== b.id && a.k !== b.k);
  confere("toque: lê o que escreveu", JSON.stringify(T.lerCorpoDoToque(JSON.stringify(b))) === JSON.stringify(b));
  const fim = T.fimDoToque(b, "recusou", 2_000);
  confere("fim: mesmo id, SEM chave", fim.id === b.id && fim.k === "" && T.lerCorpoDoToque(JSON.stringify(fim))?.fim === "recusou");
  confere("fim 'atendida' é aceito", T.lerCorpoDoToque(JSON.stringify(T.fimDoToque(b, "atendida")))?.fim === "atendida");
  const ruins = [
    { ...a, k: a.k.slice(1) },
    { ...a, id: "curto" },
    { ...a, extra: 1 },
    { ...a, v: 2 },
    { ...a, video: "sim" },
    { ...fim, k: a.k },
    { ...fim, fim: "sumiu" },
    { ...a, quando: Number.NaN },
  ];
  confere("toque fora do formato (chave curta, campo a mais, fim com chave...) é recusado", ruins.every((x) => T.lerCorpoDoToque(JSON.stringify(x)) === null));
  confere("toque grande demais é recusado", T.lerCorpoDoToque(JSON.stringify({ ...a, pad: "x".repeat(500) })) === null);
  confere("toque vale por 2 minutos, não mais", T.toqueVale(a, 1_000 + T.TOQUE_VALE_MS) && !T.toqueVale(a, 1_001 + T.TOQUE_VALE_MS));
  confere("toque do futuro (relógio adiantado mais de 30 s) não toca", !T.toqueVale(T.novoToque(false, 100_000), 50_000));
  confere("fim nunca 'toca'", !T.toqueVale(fim, 2_000));

  const k1 = await T.chaveDaCombinacao(a);
  const k2 = await T.chaveDaCombinacao(JSON.parse(JSON.stringify(a)));
  const selado = await V.selarRecado(k1, 0, "chamada:x", { de: "u1", para: null, tipo: "ola", quando: Date.now() });
  confere("as duas pontas tiram a MESMA chave da combinação do toque", (await V.abrirRecado(k2, "chamada:x", selado))?.tipo === "ola");
  confere("outro toque, outra chave (não abre)", (await V.abrirRecado(await T.chaveDaCombinacao(b), "chamada:x", selado)) === null);
  confere("a chave da combinação não é extraível", k1.extractable === false);
  const canal = await T.canalDaChamada(a);
  confere("o nome do canal sai da chave: não traz o id do toque nem nada da conversa", /^voz-[0-9a-f]{32}$/.test(canal) && !canal.includes(a.id) && canal === (await T.canalDaChamada(JSON.parse(JSON.stringify(a)))) && canal !== (await T.canalDaChamada(b)));
  await recusa("fim (sem chave) não abre sala", () => T.chaveDaCombinacao(fim), "chamada_sem_chave");
  confere("os rótulos da chamada estão na lista única, sem repetir nem ser prefixo de outro", R.LISTAS.chamada?.combinacao === T.ROTULOS.combinacao && R.rotulosRepetidos().length === 0 && R.rotulosPrefixos().length === 0, JSON.stringify(R.rotulosRepetidos()));
}

// ═══════════════════ 2. A guarda dos toques (memória da aba) ═══════════════════
{
  const g = new G.GuardaDosToques();
  let avisos = 0;
  const fins = [];
  g.ouvir(() => avisos++);
  g.ouvirFins((id, f) => fins.push([id, f]));
  const t1 = T.novoToque(true, 10_000);
  confere("guarda: toque novo passa a tocar", g.receber("c1", "u2", "Bia", t1, 10_000) && g.tocando(10_000).length === 1 && avisos === 1);
  confere("guarda: o mesmo toque de novo não duplica", (g.receber("c1", "u2", "Bia", t1, 10_500), g.tocando(10_500).length === 1));
  const t2 = T.novoToque(false, 10_600);
  confere("guarda: outra chamada na mesma conversa com uma tocando é ignorada", !g.receber("c1", "u2", "Bia", t2, 10_600));
  confere("guarda: o toque vence sozinho (2 min)", g.tocando(10_000 + T.TOQUE_VALE_MS + 1).length === 0);
  const t3 = T.novoToque(false, 20_000);
  g.receber("c2", "u3", "Caio", t3, 20_000);
  g.receber("c2", "u3", "Caio", T.fimDoToque(t3, "cancelou", 21_000), 21_000);
  confere("guarda: o fim para de tocar e é avisado a quem ouve os fins", g.tocando(21_000).length === 0 && fins.at(-1)?.[1] === "cancelou");
  confere("guarda: o toque atrasado de uma chamada que já acabou não volta a tocar", !g.receber("c2", "u3", "Caio", t3, 21_500));
  const t4 = T.novoToque(false, 30_000);
  g.receber("c3", "u4", "Dani", t4, 30_000);
  g.encerrar(t4.id, 30_100);
  confere("guarda: atendeu ou recusou aqui, para de tocar", g.tocando(30_100).length === 0 && !g.receber("c3", "u4", "Dani", t4, 30_200));
  g.receber("c4", "u5", "Eva", T.novoToque(false, 40_000), 40_000);
  g.esquecer();
  confere("guarda: o Sair rápido apaga tudo", g.tocando(40_000).length === 0);
  confere("guarda: o nome fica curto (só o codinome)", (g.receber("c5", "u6", "x".repeat(300), T.novoToque(false, 50_000), 50_000), g.tocando(50_000)[0].nome.length === 80));
}

// ═══════════════════ 3. O andamento (painel), com ações de mentira ═══════════════════
{
  const relogio = { agora: 1_000_000, timers: [] };
  const agendar = (f, ms) => {
    const t = { quando: relogio.agora + ms, f, vivo: true };
    relogio.timers.push(t);
    return () => void (t.vivo = false);
  };
  const andar = async (ms) => {
    relogio.agora += ms;
    for (const t of relogio.timers.filter((x) => x.vivo && x.quando <= relogio.agora)) {
      t.vivo = false;
      t.f();
    }
    await espere(5);
  };
  const log = [];
  let ultimoAoMudar = null;
  const salaDeMentira = () => ({ saiu: false, mudoEm: null, camEm: null, mudo(s) { this.mudoEm = s; }, camera(s) { this.camEm = s; }, async sair() { this.saiu = true; } });
  let salaAtual = null;
  let falhar = null;
  const acoes = {
    agora: () => relogio.agora,
    agendar,
    async ligar(conversa, video, aoMudar) {
      if (falhar) throw falhar;
      ultimoAoMudar = aoMudar;
      salaAtual = salaDeMentira();
      log.push(["ligar", conversa, video]);
      return { toque: T.novoToque(video, relogio.agora), sala: salaAtual, camera: null };
    },
    async atender(toque, comCamera, aoMudar) {
      ultimoAoMudar = aoMudar;
      salaAtual = salaDeMentira();
      log.push(["atender", toque.id, comCamera]);
      return { sala: salaAtual, camera: null };
    },
    async avisarFim(conversa, toque, fim) {
      log.push(["fim", conversa, fim, toque.k === undefined ? "?" : "k"]);
    },
  };
  const g = new G.GuardaDosToques();
  const p = PN.criarPainelDaChamada(g, acoes);
  await p.ligar("conv-1", "Bia", false);
  confere("painel: ligar abre a sala e fica 'ligando'", p.estado().fase === "ligando" && log.at(-1)[0] === "ligar");
  await p.ligar("conv-2", "Caio", false);
  confere("painel: uma chamada por vez (a segunda não liga)", log.filter((x) => x[0] === "ligar").length === 1);
  ultimoAoMudar([{ usuario: "bia", fluxo: null }]);
  await espere(5);
  confere("painel: a outra pessoa entrou: 'em chamada', com o cronômetro", p.estado().fase === "em_chamada" && p.estado().desde === relogio.agora);
  confere("painel: quem liga avisa 'atendida' (os outros aparelhos dela param de tocar)", log.some((x) => x[0] === "fim" && x[2] === "atendida"));
  p.mudo(true);
  confere("painel: mudo chega à sala", salaAtual.mudoEm === true && p.estado().mudo);
  await p.desligar();
  confere("painel: desligar fecha a sala e avisa 'desligou'", salaAtual.saiu && p.estado().fase === "acabou" && p.estado().motivo === "eu" && log.at(-1)[2] === "desligou");
  p.fechar();
  confere("painel: fechar volta a 'parada' e não guarda nada da chamada", JSON.stringify(p.estado()) === JSON.stringify({ fase: "parada", conversa: null, nome: "", video: false, liguei: false, outros: [], mudo: false, camera: false, minhaCamera: null, desde: null, motivo: null, erro: null }));

  // Ninguém atende: o prazo do toque vence.
  await p.ligar("conv-1", "Bia", true);
  await andar(T.TOQUE_VALE_MS - 1);
  confere("painel: antes do prazo, ainda ligando", p.estado().fase === "ligando");
  await andar(2);
  confere("painel: sem resposta em 2 min, 'não atendeu' e avisa 'cancelou'", p.estado().fase === "acabou" && p.estado().motivo === "nao_atendeu" && log.at(-1)[2] === "cancelou" && salaAtual.saiu);
  p.fechar();

  // A outra pessoa recusa (o fim chega pelo chat, na guarda).
  await p.ligar("conv-1", "Bia", false);
  // O fim de OUTRA chamada não mexe nesta.
  g.receber("conv-1", "bia", "Bia", T.fimDoToque(T.novoToque(false), "recusou"), relogio.agora);
  confere("painel: o fim de outra chamada não fecha esta", p.estado().fase === "ligando");
  // O id desta chamada: o toque que a ação de mentira devolveu (pego pelo aviso de desistir).
  await p.desligar();
  const idDesta = log.at(-1);
  confere("painel: desistir antes de atenderem avisa 'cancelou'", idDesta[2] === "cancelou");
  p.fechar();

  // Recusa de verdade: guardamos o toque que saiu.
  let toqueSaiu = null;
  const acoes2 = { ...acoes, async ligar(c, v, aoMudar) { const r = await acoes.ligar(c, v, aoMudar); toqueSaiu = r.toque; return r; } };
  const g2 = new G.GuardaDosToques();
  const p2 = PN.criarPainelDaChamada(g2, acoes2);
  await p2.ligar("conv-9", "Bia", false);
  g2.receber("conv-9", "bia", "Bia", T.fimDoToque(toqueSaiu, "atendida"), relogio.agora);
  confere("painel: 'atendida' não fecha a chamada aberta", p2.estado().fase === "ligando");
  g2.receber("conv-9", "bia", "Bia", T.fimDoToque(toqueSaiu, "recusou"), relogio.agora);
  await espere(5);
  confere("painel: a outra pessoa recusou: acaba, sem avisar de volta", p2.estado().fase === "acabou" && p2.estado().motivo === "recusou" && log.at(-1)[2] !== "cancelou");
  p2.fechar();

  // Quem recebe: atender e a conexão que não abre.
  const recebido = { conversa: "conv-5", autor: "ana", nome: "Ana", corpo: T.novoToque(true, relogio.agora), chegou: relogio.agora };
  g2.receber(recebido.conversa, recebido.autor, recebido.nome, recebido.corpo, relogio.agora);
  await p2.atender(recebido, false);
  confere("painel: atender para de tocar e fica 'conectando' (só voz, sem câmera)", g2.tocando(relogio.agora).length === 0 && p2.estado().fase === "conectando" && p2.estado().camera === false && log.at(-1)[0] === "atender" && log.at(-1)[2] === false);
  await andar(PN.ESPERA_DA_CONEXAO_MS + 1);
  confere("painel: a conexão não abriu em 30 s: acaba e avisa 'desligou'", p2.estado().motivo === "nao_conectou" && log.at(-1)[2] === "desligou");
  p2.fechar();

  // Recusar.
  const outro = { conversa: "conv-6", autor: "caio", nome: "Caio", corpo: T.novoToque(false, relogio.agora), chegou: relogio.agora };
  g2.receber(outro.conversa, outro.autor, outro.nome, outro.corpo, relogio.agora);
  await p2.recusar(outro);
  confere("painel: recusar para de tocar e avisa 'recusou'", g2.tocando(relogio.agora).length === 0 && log.at(-1)[2] === "recusou");

  // Erro no microfone: nada sai.
  falhar = Object.assign(new Error("negado"), { name: "NotAllowedError" });
  const antes = log.length;
  await p2.ligar("conv-7", "Bia", false);
  confere("painel: microfone negado: acaba com o erro e nenhum toque sai", p2.estado().motivo === "erro" && p2.estado().erro === "NotAllowedError" && log.length === antes);
  falhar = null;
  p2.fechar();

  // Em chamada, a outra pessoa some (a conexão caiu).
  await p2.ligar("conv-8", "Bia", false);
  ultimoAoMudar([{ usuario: "bia", fluxo: null }]);
  ultimoAoMudar([]);
  await espere(5);
  confere("painel: a outra pessoa saiu: acaba", p2.estado().fase === "acabou" && p2.estado().motivo === "saiu");
  p2.fechar();

  // Sair rápido no meio da chamada.
  await p2.ligar("conv-8", "Bia", true);
  const s = salaAtual;
  p2.sairJa();
  await espere(5);
  confere("painel: Sair rápido fecha a sala na hora e volta a 'parada'", s.saiu && p2.estado().fase === "parada");
}

// ═══════════════════ 4. A sala da chamada (a de voz), com conexões de mentira ═══════════════════
class ConexaoDeMentira {
  constructor(config) { this.config = config; this.signalingState = "stable"; this.connectionState = "new"; this.candidatos = []; this.faixas = []; this.transceptores = []; }
  addTrack(f) { this.faixas.push(f); }
  addTransceiver(tipo, o) { this.transceptores.push([tipo, o?.direction]); }
  async createOffer() { return { type: "offer", sdp: "v=0 oferta-secreta" }; }
  async createAnswer() { return { type: "answer", sdp: "v=0 resposta-secreta" }; }
  async setLocalDescription(d) { this.local = d; this.signalingState = d.type === "offer" ? "have-local-offer" : "stable"; }
  async setRemoteDescription(d) { this.remota = d; if (d.type === "answer") this.signalingState = "stable"; }
  async addIceCandidate(c) { this.candidatos.push(c); }
  close() { this.connectionState = "closed"; }
}
const ondas = new Map();
const noFio = [];
const fazerCanal = (nome) => {
  const meus = [];
  const lista = ondas.get(nome) ?? new Set();
  ondas.set(nome, lista);
  const canal = {
    enviar: async (b) => {
      noFio.push({ nome, b: JSON.stringify(b) });
      for (const c of lista) if (c !== canal) for (const o of c.ouvintes) o(b);
    },
    aoReceber: (f) => void meus.push(f),
    sair: async () => void lista.delete(canal),
    ouvintes: meus,
  };
  lista.add(canal);
  return canal;
};
const turn = [{ urls: ["turn:retransmissao.exemplo:3478"], username: "u", credential: "c" }];
const faixa = (tipo) => ({ kind: tipo, enabled: true, stop() { this.parada = true; } });
const fluxo = (temVideo) => {
  const a = faixa("audio");
  const v = temVideo ? faixa("video") : null;
  return { a, v, getAudioTracks: () => [a], getVideoTracks: () => (v ? [v] : []), getTracks: () => (v ? [a, v] : [a]) };
};
{
  const toque = T.novoToque(true);
  const nome = await T.canalDaChamada(toque);
  const pontas = {};
  for (const quem of ["ana:01", "bia:02"]) {
    const conexoes = [];
    const mic = fluxo(false);
    const cam = fluxo(true);
    const sala = await SC.abrirChamada({ eu: quem, toque, canal: fazerCanal(nome), iceServers: turn, microfone: mic, camera: { getVideoTracks: cam.getVideoTracks, getTracks: () => [cam.v] }, novaConexao: (c) => { const x = new ConexaoDeMentira(c); conexoes.push(x); return x; } });
    pontas[quem] = { sala, conexoes, mic, cam };
    await espere();
  }
  for (let i = 0; i < 3; i++) await espere();
  const [A, B] = [pontas["ana:01"], pontas["bia:02"]];
  confere("sala: as duas pontas se ligam (oferta e resposta trocadas)", A.conexoes.length === 1 && B.conexoes.length === 1 && [A.conexoes[0].remota?.type, B.conexoes[0].remota?.type].sort().join() === "answer,offer");
  confere("sala: sempre por retransmissão (relay)", [...A.conexoes, ...B.conexoes].every((c) => c.config.iceTransportPolicy === "relay"));
  confere("vídeo: com 2 pessoas, a câmera vai (faixa de vídeo na conexão)", A.conexoes[0].faixas.some((f) => f.kind === "video") && A.cam.v.enabled === true);
  // Quem tem a chave (um terceiro aparelho com o toque) não passa do teto de 2.
  const terceiras = [];
  const C = await SC.abrirChamada({ eu: "bia:03", toque, canal: fazerCanal(nome), iceServers: turn, microfone: fluxo(false), novaConexao: (c) => { const x = new ConexaoDeMentira(c); terceiras.push(x); return x; } });
  for (let i = 0; i < 4; i++) await espere();
  confere("sala: teto de 2 (o segundo aparelho que atende não entra na chamada já de pé)", A.sala.participantes().length === 1 && B.sala.participantes().length === 1);
  await C.sair();
  // Quem não tem o toque não entra: tenta com uma chave qualquer no mesmo canal.
  const intrusa = fazerCanal(nome);
  const kFalsa = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await intrusa.enviar(await V.selarRecado(kFalsa, 0, `chamada:${toque.id}`, { de: "intrusa:99", para: null, tipo: "oferta", sdp: "v=0 falsa", quando: Date.now() }));
  for (let i = 0; i < 3; i++) await espere();
  confere("sala: quem não tem o toque não entra na ligação", A.conexoes.length === 1 && B.conexoes.length === 1);
  // O que passou pelo canal de combinação (o Realtime do serviço): só blocos cifrados.
  const fio = noFio.filter((x) => x.nome === nome).map((x) => x.b).join("\n");
  const chaveCrua = Buffer.from(toque.k, "base64url");
  confere("canal: nenhuma oferta, resposta, candidato, conta nem chave aparece em claro", !/oferta-secreta|resposta-secreta|candidate|ana:01|bia:02/.test(fio) && !fio.includes(toque.k) && !fio.includes(toque.id) && !contem(Buffer.from(fio), chaveCrua));
  confere("canal: cada bloco é só {epoca, iv, ct}", noFio.filter((x) => x.nome === nome).every((x) => Object.keys(JSON.parse(x.b)).sort().join() === "ct,epoca,iv"));
  A.sala.camera(false);
  confere("vídeo: desligar a câmera desliga a faixa no aparelho", A.cam.v.enabled === false);
  A.sala.camera(true);
  await B.sala.sair();
  for (let i = 0; i < 3; i++) await espere();
  confere("sala: desligar de um lado derruba a ligação do outro", A.sala.participantes().length === 0);
  await A.sala.sair();
  confere("sala: sair para o microfone e a câmera", A.mic.a.parada === true && A.cam.v.parada === true);
}
{
  // Item 140: até 4 pessoas com vídeo; acima disso, só voz (a câmera desliga no próprio aparelho). A sala de voz de grupo serve de
  // banco de prova (a chamada de GRUPO fica desligada: docs/rede/VOZ.md), com chave fixa.
  confere("vídeo: o teto é 4", V.MAXIMO_COM_VIDEO === 4 && V.cabeVideo(4) && !V.cabeVideo(5));
  const chave = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const chaveFixa = { atual: async () => ({ epoca: 1, chave }), daEpoca: async (e) => (e === 1 ? chave : null) };
  const gente = [];
  for (const nome of ["p1", "p2", "p3", "p4", "p5"]) {
    const cam = fluxo(true);
    const conexoes = [];
    const sala = V.criarSalaDeVoz({ eu: nome, sala: "g:video", chave: chaveFixa, canal: fazerCanal("g-video"), iceServers: turn, comVideo: true, novaConexao: (c) => { const x = new ConexaoDeMentira(c); conexoes.push(x); return x; } });
    await sala.entrar(fluxo(false), { getVideoTracks: cam.getVideoTracks, getTracks: () => [cam.v] });
    gente.push({ nome, cam, sala, conexoes });
    for (let i = 0; i < 4; i++) await espere();
    if (gente.length === 4) confere("vídeo: com 4 na sala, todas as câmeras ligadas", gente.every((x) => x.cam.v.enabled && !x.sala.soVoz()));
  }
  confere("vídeo: com 5 na sala, só voz (a câmera de cada um desliga no aparelho)", gente.every((x) => x.cam.v.enabled === false && x.sala.soVoz()), JSON.stringify(gente.map((x) => [x.nome, x.cam.v.enabled, x.sala.participantes().length])));
  confere("vídeo: a quinta pessoa entra com a câmera desligada no aparelho (nada de imagem sai dela)", gente[4].cam.v.enabled === false && gente[4].sala.participantes().length === 4);
  await gente[4].sala.sair();
  for (let i = 0; i < 4; i++) await espere();
  confere("vídeo: voltou a 4, a câmera volta sozinha", gente.slice(0, 4).every((x) => x.cam.v.enabled === true));
  for (const x of gente.slice(0, 4)) await x.sala.sair();
}

// ═══════════════════ 5. O toque pelo chat a dois, com o motor de verdade ═══════════════════
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
  async function aparelho(usuario, codinome) {
    codinomeDe[usuario] = codinome;
    const motor = M.CoreCrypto.new(await M.Database.inMemory());
    const historico = historicoNovo();
    const guarda = new G.GuardaDosToques();
    const recebidos = [];
    const deps = {
      motor, spqr: SPQR, transporte: transporteDe(usuario), historico, cofre: cofreDaLista, persistir: async () => undefined,
      sigo: async () => false, conferirRegistro: async () => "confere", agora: () => relogio.agora,
      aoChamada: (c) => {
        recebidos.push(c);
        guarda.receber(c.conversa, c.autor, c.nome, c.corpo, c.quando);
      },
    };
    const chat = await ChatDoAparelho.nascer(deps, usuario, codinome);
    return { chat, historico, guarda, recebidos, usuario };
  }
  const ANA = "aaaaaaaa-0000-4000-8000-000000000001";
  const BIA = "bbbbbbbb-0000-4000-8000-000000000002";
  const CAIO = "cccccccc-0000-4000-8000-000000000003";
  const A = await aparelho(ANA, "ana");
  const B = await aparelho(BIA, "bia");
  const C = await aparelho(CAIO, "caio");
  for (const x of [A, B, C]) await x.chat.rotinaAnonima();
  for (const x of [A, B, C]) await x.chat.rotinaComSessao();
  const conv = await A.chat.pedirConversa("bia", "oi");
  await B.chat.receberPedidos();
  await B.chat.aceitar(conv);
  await A.chat.receber();
  await B.chat.receber();
  const ola = await A.chat.mandarTexto(conv, "oi");
  await B.chat.receber();
  confere("chat: a conversa abriu e o texto chegou", B.historico.da(conv).some((x) => x.id === ola.id));
  const tamanhoDoTexto = servidor.depositos.at(-1).tamanho;

  const toque = T.novoToque(true, relogio.agora);
  const antes = servidor.depositos.length;
  const historicoAntes = A.historico.m.size;
  const r = await A.chat.mandarChamada(conv, toque);
  confere("chat: o toque sai para os aparelhos da Bia", r.entregues >= 1);
  const novos = servidor.depositos.slice(antes);
  const tudo = Buffer.concat(novos.map((d) => Buffer.from(d.envelope)));
  confere("chat: o servidor NUNCA vê a chave da chamada, o id nem a palavra 'chamada' nos envelopes",
    !contem(tudo, Buffer.from(toque.k, "base64url")) && !contem(tudo, Buffer.from(toque.k)) && !contem(tudo, Buffer.from(toque.id)) && !contem(tudo, Buffer.from(toque.id, "base64url")) && !contem(tudo, Buffer.from("chamada")));
  confere("chat: o envelope do toque tem o tamanho de uma mensagem curta comum (não se distingue do texto)", novos.every((d) => d.tamanho === tamanhoDoTexto), `${novos.map((d) => d.tamanho)} vs ${tamanhoDoTexto}`);
  confere("chat: o toque não vai aos outros aparelhos de quem liga (nem fica no histórico dela)", A.historico.m.size === historicoAntes);
  await B.chat.receber();
  const chegou = B.recebidos.at(-1);
  confere("chat: a Bia recebe o toque de dentro do cifrado, com a chave inteira e o codinome da conversa", chegou?.corpo?.k === toque.k && chegou.corpo.id === toque.id && chegou.autor === ANA && chegou.nome === "ana" && chegou.conversa === conv);
  confere("chat: o toque não entra no histórico de quem recebe (não existe registro de chamadas)", !B.historico.da(conv).some((x) => (x.texto ?? "").includes(toque.id)) && B.historico.da(conv).length === 1);
  confere("chat: e passa a tocar na guarda da memória", B.guarda.tocando(relogio.agora).length === 1);
  await B.chat.mandarChamada(conv, T.fimDoToque(toque, "recusou", relogio.agora));
  await A.chat.receber();
  confere("chat: o fim volta pelo mesmo caminho, sem chave", A.recebidos.at(-1)?.corpo?.fim === "recusou" && A.recebidos.at(-1).corpo.k === "");
  await recusa("chat: toque fora do formato nem sai", () => A.chat.mandarChamada(conv, { ...toque, k: "curta" }), "chamada_invalida");
  // O Caio não está na conversa: um toque que ele mande para outra conversa não chega à Bia por esta.
  const conv2 = await C.chat.pedirConversa("bia", "oi");
  await B.chat.receberPedidos();
  await B.chat.aceitar(conv2);
  await C.chat.receber();
  await B.chat.receber();
  await C.chat.mandarTexto(conv2, "oi");
  await B.chat.receber();
  B.chat.bloquear?.(CAIO);
  if (typeof B.chat.bloquear === "function") {
    const n = B.recebidos.length;
    await C.chat.mandarChamada(conv2, T.novoToque(false, relogio.agora)).catch(() => undefined);
    await B.chat.receber();
    confere("chat: de quem eu bloqueei, o toque não toca", B.recebidos.length === n);
  }
}

// ═══════════════════ 6. A migração ═══════════════════
{
  const { pg, dono } = BANCO;
  const funcoes = async () => Number((await dono("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','interno')")).rows[0].n);
  const tabelas = async () => Number((await dono("select count(*)::int n from pg_tables where schemaname in ('public','interno')")).rows[0].n);
  const [f0, t0] = [await funcoes(), await tabelas()];
  let trancar;
  try {
    const r = await pg.exec(SQL_DO_LOTE);
    trancar = r.at(-1)?.rows?.[0]?.alumia_trancar;
    certos++;
  } catch (e) {
    falhas.push(`migração roda no banco: ${e.message}`);
  }
  confere("migração: a porta segue fechada", Array.isArray(trancar?.abertas) && trancar.abertas.length === 0, JSON.stringify(trancar));
  await passa("migração: roda de novo (idempotente)", () => pg.exec(SQL_DO_LOTE));
  confere("migração: nenhuma função nova, nenhuma tabela nova", (await funcoes()) === f0 && (await tabelas()) === t0);
  const cat = (await dono("select nome, so_pelo_nome from interno.recursos_catalogo where nome in ('alumia-p4-chamadas', 'sala-livekit') order by nome")).rows;
  confere("migração: os dois interruptores no catálogo, só pelo nome", cat.length === 2 && cat.every((x) => x.so_pelo_nome === true), JSON.stringify(cat));
  confere("migração: o cabeçalho diz onde entra e termina trancando", /Roda depois de 20261126-p5-fim\.sql \(banco na versão 17\)/.test(SQL_DO_LOTE) && /antes do\s*\n?--\s*20261127-p4-fim\.sql|antes do 20261127-p4-fim\.sql/.test(SQL_DO_LOTE) && /select interno\.alumia_trancar\(\);\s*$/.test(SQL_DO_LOTE));
}

// ═══════════════════ 7. A regra de privacidade, no código ═══════════════════
{
  const pasta = path.join(raiz, "lib/rede/chamada");
  const codigo = fs.readdirSync(pasta).map((f) => ler(`lib/rede/chamada/${f}`)).join("\n");
  const telas = fs.readdirSync(path.join(raiz, "components/rede/chamada")).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts")).map((f) => ler(`components/rede/chamada/${f}`)).join("\n");
  confere("privacidade: nada de Math.random nas chamadas", !/Math\.random\(/.test(codigo + telas));
  confere("privacidade: nada no disco (sem localStorage, sessionStorage, IndexedDB nem cookie)", !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(codigo + telas));
  confere("privacidade: nenhuma notificação do sistema mostra quem ligou (nem Notification nem push)", !/new Notification|showNotification|PushManager/.test(codigo + telas));
  confere("privacidade: nada chama o banco nem uma rota com a conta (sem rpc, sem fetch nas chamadas)", !/\.rpc\(|fetch\(|chamar\(/.test(codigo));
  const cli = ler("lib/rede/chamada/cliente.ts");
  confere("privacidade: o canal da chamada entra SEM a sessão da conta", /abrirCanalDeVoz\(nome, \{ semConta: true \}\)/.test(cli));
  const nav = ler("lib/rede/voz/navegador.ts");
  confere("privacidade: o cliente sem conta não guarda sessão e a retransmissão vai sem a sessão (credentials: omit)", /persistSession: false/.test(nav) && /credentials: "omit"/.test(nav));
  const conversa = ler("components/rede/chat/Conversa.tsx");
  confere("tela: os botões só aparecem com 'alumia-p4-chamadas' e o chat novo, e só com a identidade em ordem", /ligado\("alumia-p4-chamadas"\) && !PREVIA_DO_CHAT/.test(conversa) && /!sessao\.mudou && !sessao\.foraDoRegistro/.test(conversa));
  const navChat = ler("lib/rede/chat/r2/navegador.ts");
  confere("chat: com o interruptor desligado, o toque que chega é descartado", /if \(ligado\("alumia-p4-chamadas"\)\) void import\("\.\.\/\.\.\/chamada\/guarda"\)/.test(navChat));
  const servico = ler("lib/rede/chat/r2/servico.ts");
  confere("chat: só toca o toque da OUTRA pessoa da conversa, nunca de quem bloqueei", /ctl\?\.a === "chamada" && conv && !conv\.apagada && !r\.de\.meu && conv\.com === r\.de\.conta && !this\.bloqueado\(conv\.com\)/.test(servico));
  const enc = ler("components/rede/chamada/encaixe.tsx");
  confere("tela: desligado, o encaixe não desenha nada (só limpa no Sair rápido)", /\? \{ aoSairRapido: \[limpar\] \}/.test(enc));
  const casca = ler("components/rede/chamada/NaCasca.tsx");
  confere("tela: fechar a página e o Sair rápido fecham a chamada na hora", /addEventListener\("pagehide", sair\)/.test(casca) && /aoApagarTudoDoChat\(/.test(casca) && /guardaDosToques\.esquecer\(\)/.test(casca));
  const css = ler("components/rede/chamada/chamada.css");
  confere("tela: alvos de toque de 44 px e movimento reduzido", (css.match(/min-height: 44px; min-width: 44px/g) ?? []).length >= 2 && /prefers-reduced-motion: reduce/.test(css));
  const voz = ler("docs/rede/VOZ.md");
  confere("documento: a chamada a dois e o limite da de grupo estão no VOZ.md", /## Chamada da conversa a dois/.test(voz) && /chamada de grupo/i.test(voz));
  // Os textos: as mesmas chaves nos seis idiomas; os cinco que não são o português, marcados como rascunho.
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).sort().join();
  const pt = JSON.parse(ler("i18n/rede/p4-chamadas/pt.json"));
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const x = JSON.parse(ler(`i18n/rede/p4-chamadas/${l}.json`));
    confere(`textos: ${l} tem as mesmas chaves do português e é rascunho`, chaves(x) === chaves(pt) && x._rascunho === true);
  }
  confere("textos: os motivos de fim do painel e os erros do toque têm frase", ["cancelou", "recusou", "desligou", "atendida", "nao_atendeu", "nao_conectou", "saiu", "eu", "erro"].every((m) => typeof pt.fim[m] === "string") && ["NotAllowedError", "voz_sem_retransmissao", "chamada_nao_saiu", "dm_fora_do_registro", "outro"].every((m) => typeof pt.erros[m] === "string"));
  const rec = ler("lib/recursos.ts");
  confere("interruptor: alumia-p4-chamadas e sala-livekit só pelo nome", /"alumia-p4-chamadas", "sala-livekit"\]/.test(rec.slice(rec.indexOf("export const SO_PELO_NOME"))));
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);

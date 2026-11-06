// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os sons do Vale o Escrito, todos GERADOS no navegador com a Web Audio API: nenhum arquivo de áudio, nada baixado de
// terceiros. Regras:
//  - desligado até a pessoa ligar no botão de som (BotaoDeSom.tsx); nunca toca sozinho. A escolha fica no aparelho
//    (localStorage, chave "ve-som", sempre dentro de try/catch: sem armazenamento, o som só vale para esta visita);
//  - o contexto de áudio só nasce de um gesto da pessoa (o clique no botão, ou o primeiro clique ou tecla da visita quando
//    ela já tinha ligado antes): o navegador não deixa tocar sem gesto e nós também não queremos;
//  - com "reduzir movimento" (prefers-reduced-motion) não há zumbido de fundo nem som de passar o mouse: só os sons das
//    ações (abrir ficha, ligação acendendo, clique), mais baixos;
//  - nada de rastreio: o estado não sai do aparelho.
// Módulo puro (sem React): o botão assina as mudanças com assinarSom e a página chama tocar(...).

export type Efeito = "hover" | "clique" | "abrir" | "ligacao";

const CHAVE = "ve-som";

let ligado = false;
let lido = false;
let ctx: AudioContext | null = null;
let mestre: GainNode | null = null;
let zumbido: { parar: () => void } | null = null;
let ultimoHover = 0;
const ouvintes = new Set<() => void>();

const avisar = () => ouvintes.forEach((f) => f());

/** Menos movimento pedido no sistema? (sem janela, como no servidor, conta como sim: nada toca) */
export function menosMovimento(): boolean {
  try {
    return typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function lerEscolha(): boolean {
  if (lido) return ligado;
  lido = true;
  try {
    ligado = window.localStorage.getItem(CHAVE) === "1";
  } catch {
    ligado = false;
  }
  return ligado;
}

function guardarEscolha(v: boolean) {
  try {
    if (v) window.localStorage.setItem(CHAVE, "1");
    else window.localStorage.removeItem(CHAVE);
  } catch {
    // sem armazenamento (janela privada, dados bloqueados): a escolha vale só nesta visita
  }
}

/** O som está ligado? (no servidor, sempre não) */
export function somLigado(): boolean {
  return typeof window === "undefined" ? false : lerEscolha();
}

/** Para o useSyncExternalStore do botão. */
export function assinarSom(f: () => void): () => void {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** Cria o contexto (só dentro de um gesto da pessoa) com um compressor no fim, para nenhum som estourar. */
function garantirContexto(): AudioContext | null {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    mestre = ctx.createGain();
    mestre.gain.value = 0.7;
    mestre.connect(comp).connect(ctx.destination);
    return ctx;
  } catch {
    ctx = null;
    return null;
  }
}

/** O zumbido grave de fundo: dois osciladores quase iguais (batimento lento), um sub e um filtro que respira devagar. */
function ligarZumbido() {
  if (zumbido || !ctx || !mestre || menosMovimento()) return;
  const c = ctx;
  const saida = c.createGain();
  saida.gain.setValueAtTime(0, c.currentTime);
  saida.gain.linearRampToValueAtTime(0.05, c.currentTime + 2.5);
  const filtro = c.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.value = 160;
  filtro.Q.value = 4;
  const lfo = c.createOscillator();
  const lfoGanho = c.createGain();
  lfo.frequency.value = 0.07;
  lfoGanho.gain.value = 70;
  lfo.connect(lfoGanho).connect(filtro.frequency);
  const oscs = [
    { tipo: "sawtooth" as OscillatorType, f: 55, g: 0.45 },
    { tipo: "sawtooth" as OscillatorType, f: 55.35, g: 0.45 },
    { tipo: "sine" as OscillatorType, f: 27.5, g: 0.9 },
  ].map(({ tipo, f, g }) => {
    const o = c.createOscillator();
    const gg = c.createGain();
    o.type = tipo;
    o.frequency.value = f;
    gg.gain.value = g;
    o.connect(gg).connect(filtro);
    o.start();
    return o;
  });
  filtro.connect(saida).connect(mestre);
  lfo.start();
  zumbido = {
    parar: () => {
      const t = c.currentTime;
      saida.gain.cancelScheduledValues(t);
      saida.gain.setValueAtTime(saida.gain.value, t);
      saida.gain.linearRampToValueAtTime(0, t + 0.6);
      for (const o of [...oscs, lfo]) o.stop(t + 0.7);
    },
  };
}

function desligarZumbido() {
  zumbido?.parar();
  zumbido = null;
}

/** Liga ou desliga (chamado pelo clique no botão: é o gesto que destrava o áudio). */
export function definirSom(v: boolean) {
  lido = true;
  ligado = v;
  guardarEscolha(v);
  if (v) {
    garantirContexto();
    ligarZumbido();
    tocar("ligacao");
  } else {
    desligarZumbido();
    if (ctx) void ctx.suspend().catch(() => {});
  }
  avisar();
}

/**
 * Quem já tinha ligado o som em outra visita: o áudio só começa no primeiro gesto desta visita (clique ou tecla), nunca no
 * carregamento. Devolve a função que tira os ouvintes.
 */
export function retomarNoPrimeiroGesto(): () => void {
  if (typeof window === "undefined") return () => {};
  const retomar = () => {
    tirar();
    if (!lerEscolha()) return;
    garantirContexto();
    ligarZumbido();
  };
  const tirar = () => {
    window.removeEventListener("pointerdown", retomar, true);
    window.removeEventListener("keydown", retomar, true);
  };
  window.addEventListener("pointerdown", retomar, true);
  window.addEventListener("keydown", retomar, true);
  return tirar;
}

/** Envelope curto: sobe rápido e cai exponencialmente. */
function envelope(g: GainNode, t: number, pico: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tom(c: AudioContext, destino: AudioNode, tipo: OscillatorType, de: number, para: number, t: number, dur: number, pico: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(de, t);
  o.frequency.exponentialRampToValueAtTime(para, t + dur);
  envelope(g, t, pico, dur);
  o.connect(g).connect(destino);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Um sopro de ruído filtrado (papel, estática de rádio). */
function ruido(c: AudioContext, destino: AudioNode, t: number, dur: number, freq: number, pico: number) {
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = c.createGain();
  envelope(g, t, pico, dur);
  src.connect(f).connect(g).connect(destino);
  src.start(t);
}

/** Toca um efeito, se o som estiver ligado e o contexto já tiver nascido de um gesto. Nunca lança. */
export function tocar(efeito: Efeito) {
  if (!somLigado() || !ctx || !mestre || ctx.state !== "running") return;
  const calmo = menosMovimento();
  if (efeito === "hover" && calmo) return;
  try {
    const c = ctx;
    const t = c.currentTime + 0.005;
    const v = calmo ? 0.6 : 1;
    if (efeito === "hover") {
      const agora = performance.now();
      if (agora - ultimoHover < 70) return;
      ultimoHover = agora;
      tom(c, mestre, "sine", 2100, 1500, t, 0.05, 0.018);
    } else if (efeito === "clique") {
      tom(c, mestre, "triangle", 520, 240, t, 0.06, 0.05 * v);
      ruido(c, mestre, t, 0.03, 3200, 0.03 * v);
    } else if (efeito === "abrir") {
      ruido(c, mestre, t, 0.16, 1800, 0.06 * v);
      tom(c, mestre, "sine", 110, 70, t, 0.22, 0.12 * v);
      tom(c, mestre, "square", 880, 880, t + 0.05, 0.04, 0.012 * v);
    } else if (efeito === "ligacao") {
      tom(c, mestre, "sine", 330, 335, t, 0.18, 0.05 * v);
      tom(c, mestre, "sine", 660, 668, t + 0.07, 0.24, 0.04 * v);
      tom(c, mestre, "sine", 990, 1000, t + 0.14, 0.3, 0.02 * v);
    }
  } catch {
    // áudio indisponível: segue em silêncio
  }
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Sons sintetizados no navegador com WebAudio: notas (onda seno e triângulo com envelope suave) e batidas (bumbo, caixa,
// chimbal e palma feitos de osciladores e ruído filtrado). Nenhum arquivo de som, nenhuma biblioteca de terceiros, nada
// sai do aparelho. O contexto só nasce no primeiro toque da pessoa (regra dos navegadores) e o volume é baixo.
import { frequenciaMidi, type Batida } from "@/lib/jogos/sons";

let contexto: AudioContext | null = null;
let ruido: AudioBuffer | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!contexto) {
    const Classe = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Classe) return null;
    contexto = new Classe();
  }
  if (contexto.state === "suspended") void contexto.resume();
  return contexto;
}

export const temAudio = () => typeof window !== "undefined" && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

const VOLUME = 0.22;

/** Toca uma nota (número MIDI) por `duracao` segundos, a partir de `quando` (relógio do contexto). */
export function tocarNota(midi: number, duracao = 0.45, quando = 0): void {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + quando;
  const saida = c.createGain();
  saida.gain.setValueAtTime(0.0001, t0);
  saida.gain.exponentialRampToValueAtTime(VOLUME, t0 + 0.02);
  saida.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);
  saida.connect(c.destination);
  for (const [tipo, mult, ganho] of [["sine", 1, 1], ["triangle", 2, 0.25]] as const) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = tipo;
    osc.frequency.value = frequenciaMidi(midi) * mult;
    g.gain.value = ganho;
    osc.connect(g).connect(saida);
    osc.start(t0);
    osc.stop(t0 + duracao + 0.05);
  }
}

function bufferDeRuido(c: AudioContext): AudioBuffer {
  if (!ruido || ruido.sampleRate !== c.sampleRate) {
    ruido = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const dados = ruido.getChannelData(0);
    // Ruído determinístico simples (não precisa ser aleatório de verdade).
    let x = 12345;
    for (let i = 0; i < dados.length; i++) {
      x = (x * 1664525 + 1013904223) >>> 0;
      dados[i] = x / 2147483648 - 1;
    }
  }
  return ruido;
}

function rajada(c: AudioContext, t0: number, duracao: number, tipo: BiquadFilterType, freq: number, ganho: number): void {
  const fonte = c.createBufferSource();
  fonte.buffer = bufferDeRuido(c);
  const filtro = c.createBiquadFilter();
  filtro.type = tipo;
  filtro.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(ganho, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);
  fonte.connect(filtro).connect(g).connect(c.destination);
  fonte.start(t0);
  fonte.stop(t0 + duracao + 0.02);
}

/** Toca uma batida de bateria sintetizada. */
export function tocarBatida(tipo: Batida, quando = 0): void {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + quando;
  if (tipo === "bumbo") {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.setValueAtTime(150, t0);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.14);
    g.gain.setValueAtTime(VOLUME * 2.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.32);
  } else if (tipo === "caixa") {
    rajada(c, t0, 0.18, "highpass", 1400, VOLUME * 1.2);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = 190;
    g.gain.setValueAtTime(VOLUME, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.12);
  } else if (tipo === "chimbal") {
    rajada(c, t0, 0.06, "highpass", 7000, VOLUME * 0.7);
  } else {
    rajada(c, t0, 0.05, "bandpass", 1500, VOLUME * 1.4);
    rajada(c, t0 + 0.02, 0.09, "bandpass", 1100, VOLUME * 1.0);
  }
}

/** Dois tons curtos que dizem "ops, vamos de novo", sem susto: um tom suave descendo. */
export const somDeTente = () => {
  tocarNota(64, 0.25);
  tocarNota(60, 0.35, 0.22);
};
/** Três notas subindo: "muito bem". */
export const somDeFesta = () => {
  tocarNota(60, 0.25);
  tocarNota(64, 0.25, 0.2);
  tocarNota(67, 0.5, 0.4);
};

// ───────── Os sons do palco dos jogos (components/jogos/Imersao.tsx) ─────────
// Curtos e baixos; só tocam com o som ligado pela pessoa (desligado por padrão).

/** Acertou: duas notas subindo, rápidas. */
export const somDeAcerto = () => {
  tocarNota(72, 0.16);
  tocarNota(79, 0.3, 0.1);
};
/** Errou: um tom grave e curto, sem buzina. */
export const somDeErro = () => {
  tocarNota(55, 0.22);
  tocarNota(52, 0.3, 0.14);
};
/** É a sua vez (ou chegou pergunta nova): um sino só. */
export const somDeVez = () => tocarNota(76, 0.35);
/** Os últimos segundos do relógio. */
export const somDeTique = () => tocarBatida("chimbal");
/** Acabou a partida: um arpejo e uma palma. */
export const somDeFim = () => {
  somDeFesta();
  tocarNota(72, 0.6, 0.6);
  tocarBatida("palma", 0.6);
};

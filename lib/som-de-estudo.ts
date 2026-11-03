// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Som para estudar (Etapa 4, pacote E4-06, ideia R1-70; docs/escola/som.md). Não há no repositório música com licença
// conferida, então nada de música: três fundos de som gerados no próprio aparelho com a Web Audio API, sem baixar
// nenhum arquivo e sem servidor. Ruído marrom (grave), ruído rosa (equilibrado) e "chuva" (ruído filtrado com uma
// modulação lenta, mais gotas esparsas). Nada toca sozinho: só um toque da pessoa liga.
//
// Quando a voz de uma aula começa a ler (o evento "lucia:voz-falou", de lib/vozes/leitor.ts), o volume cai para 30% e
// volta uns segundos depois da última frase.
//
// A primeira metade do arquivo é pura (gera as amostras com um sorteio de semente fixa) e roda nos testes do Node; a
// segunda é o motor de som, que só existe no navegador. O estado mora fora dos componentes, como o da rádio
// (lib/radio.ts), para o som seguir enquanto a pessoa navega pelo site.
// Sem os atalhos "@/" de propósito.

import { useSyncExternalStore } from "react";

export const TIPOS_DE_SOM = ["marrom", "rosa", "chuva"] as const;
export type TipoDeSom = (typeof TIPOS_DE_SOM)[number];
export const eTipoDeSom = (v: unknown): v is TipoDeSom => typeof v === "string" && (TIPOS_DE_SOM as readonly string[]).includes(v);

/** O volume (fração do volume escolhido) enquanto a voz de uma aula fala. */
export const NIVEL_COM_VOZ = 0.3;
/** Quantos segundos de som são gerados; o laço emenda o fim no começo sem estalo. */
export const SEGUNDOS_DO_LACO = 8;
const EMENDA = 0.25;
export const VOLUME_PADRAO = 0.5;
/** A chave do volume escolhido (prefixo da Escola: entra na cópia e sai no "apagar meus dados"). */
export const CHAVE_DO_VOLUME = "lucia:escola:som-volume";

// ───────────── Parte pura ─────────────

/** Sorteio com semente (mulberry32): o mesmo som a cada vez, e testes que dão sempre o mesmo resultado. */
export function sorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído branco entre -1 e 1. */
export function ruidoBranco(n: number, aleatorio: () => number): Float32Array {
  const saida = new Float32Array(n);
  for (let i = 0; i < n; i++) saida[i] = aleatorio() * 2 - 1;
  return saida;
}

/** Ruído marrom: o branco somado aos poucos, com um vazamento para não sair do eixo. Grave, como um ronco distante. */
export function ruidoMarrom(n: number, aleatorio: () => number): Float32Array {
  const saida = new Float32Array(n);
  let ultimo = 0;
  for (let i = 0; i < n; i++) {
    ultimo = (ultimo + 0.02 * (aleatorio() * 2 - 1)) / 1.02;
    saida[i] = ultimo * 3.5;
  }
  return saida;
}

/** Ruído rosa (o filtro de Paul Kellet): a mesma energia em cada oitava, como vento constante. */
export function ruidoRosa(n: number, aleatorio: () => number): Float32Array {
  const saida = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const branco = aleatorio() * 2 - 1;
    b0 = 0.99886 * b0 + branco * 0.0555179;
    b1 = 0.99332 * b1 + branco * 0.0750759;
    b2 = 0.969 * b2 + branco * 0.153852;
    b3 = 0.8665 * b3 + branco * 0.3104856;
    b4 = 0.55 * b4 + branco * 0.5329522;
    b5 = -0.7616 * b5 - branco * 0.016898;
    saida[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + branco * 0.5362) * 0.11;
    b6 = branco * 0.115926;
  }
  return saida;
}

/** Gotas: estalos curtos e esparsos, cada um caindo em poucos milissegundos (o "pingo" da chuva). */
export function gotas(n: number, taxa: number, aleatorio: () => number, porSegundo = 30): Float32Array {
  const saida = new Float32Array(n);
  const chance = porSegundo / taxa;
  const queda = Math.exp(-1 / (taxa * 0.004));
  let envelope = 0;
  for (let i = 0; i < n; i++) {
    if (aleatorio() < chance) envelope = 0.3 + aleatorio() * 0.7;
    saida[i] = (aleatorio() * 2 - 1) * envelope;
    envelope *= queda;
  }
  return saida;
}

/**
 * Fecha o laço sem estalo: o trecho final (`emenda` amostras) é misturado, aos poucos, no começo, e sai do fim. Tocado
 * em repetição, a última amostra emenda na primeira como se o som nunca tivesse parado.
 */
export function fecharLaco(amostras: Float32Array, emenda: number): Float32Array {
  const m = Math.max(0, Math.min(Math.floor(emenda), Math.floor(amostras.length / 2)));
  const tamanho = amostras.length - m;
  const saida = amostras.slice(0, tamanho);
  for (let i = 0; i < m; i++) {
    const t = i / m;
    saida[i] = amostras[i] * t + amostras[tamanho + i] * (1 - t);
  }
  return saida;
}

/** Ajusta para o pico ficar em `pico` (sem passar de 1, que estoura). */
export function normalizar(amostras: Float32Array, pico = 0.9): Float32Array {
  let maior = 0;
  for (const v of amostras) maior = Math.max(maior, Math.abs(v));
  if (maior === 0) return amostras;
  const fator = pico / maior;
  return amostras.map((v) => v * fator);
}

/** As amostras de um tipo de som, prontas para tocar em laço. A chuva devolve o chiado e as gotas em separado. */
export function amostrasDe(tipo: TipoDeSom, taxa: number, semente = 7): { base: Float32Array; gotas?: Float32Array } {
  const n = Math.floor(taxa * (SEGUNDOS_DO_LACO + EMENDA));
  const emenda = Math.floor(taxa * EMENDA);
  const aleatorio = sorteio(semente);
  if (tipo === "marrom") return { base: normalizar(fecharLaco(ruidoMarrom(n, aleatorio), emenda), 0.8) };
  if (tipo === "rosa") return { base: normalizar(fecharLaco(ruidoRosa(n, aleatorio), emenda), 0.7) };
  // Chuva: o rosa com um pouco de branco por cima (o chiado), e as gotas num laço de outro tamanho, para não repetirem juntos.
  const rosa = ruidoRosa(n, aleatorio);
  const branco = ruidoBranco(n, aleatorio);
  const chiado = rosa.map((v, i) => v * 0.8 + branco[i] * 0.2);
  const ng = Math.floor(taxa * (SEGUNDOS_DO_LACO * 0.7 + EMENDA));
  return { base: normalizar(fecharLaco(chiado, emenda), 0.7), gotas: normalizar(fecharLaco(gotas(ng, taxa, aleatorio), emenda), 0.6) };
}

/** O nível do som agora: o volume escolhido, ou 30% dele enquanto a voz da aula fala. */
export const nivelDoSom = (volume: number, comVoz: boolean) => Math.max(0, Math.min(1, volume)) * (comVoz ? NIVEL_COM_VOZ : 1);

/** Quanto tempo esperar, depois da última frase da voz, para o som voltar ao volume cheio (milissegundos). */
export function esperaDepoisDaVoz(duracaoSegundos: number, texto: string): number {
  // A voz do aparelho não diz quanto dura: conta uns 14 caracteres por segundo.
  const estimada = duracaoSegundos > 0 ? duracaoSegundos : texto.length / 14;
  return Math.round(Math.min(60, Math.max(3, estimada)) * 1000) + 2500;
}

// ───────────── Motor de som (só no navegador) ─────────────

export interface EstadoDoSom {
  tipo: TipoDeSom | null;
  volume: number;
  /** A voz de uma aula está falando: o som está a 30%. */
  comVoz: boolean;
  /** O navegador não consegue gerar som. */
  semAudio: boolean;
}

const INICIAL: EstadoDoSom = { tipo: null, volume: VOLUME_PADRAO, comVoz: false, semAudio: false };
let estado: EstadoDoSom = INICIAL;
let volumeLido = false;
const ouvintes = new Set<() => void>();

function mudar(parte: Partial<EstadoDoSom>) {
  estado = { ...estado, ...parte };
  ouvintes.forEach((o) => o());
}

export function useSomDeEstudo(): EstadoDoSom {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
    () => INICIAL,
  );
}

let contexto: AudioContext | null = null;
let mestre: GainNode | null = null;
/** Os nós do som que está tocando, para desligar tudo de uma vez. */
let nos: AudioNode[] = [];
let fontes: AudioScheduledSourceNode[] = [];
let relogioDaVoz = 0;
const buffers = new Map<string, AudioBuffer>();

function lerVolume(): number {
  try {
    const v = Number(localStorage.getItem(CHAVE_DO_VOLUME));
    return localStorage.getItem(CHAVE_DO_VOLUME) !== null && v >= 0 && v <= 1 ? v : VOLUME_PADRAO;
  } catch {
    return VOLUME_PADRAO;
  }
}

function aplicarNivel(rapido = false) {
  if (!contexto || !mestre) return;
  mestre.gain.setTargetAtTime(nivelDoSom(estado.volume, estado.comVoz), contexto.currentTime, rapido ? 0.05 : 0.4);
}

function bufferDe(chave: string, amostras: Float32Array): AudioBuffer {
  const pronto = buffers.get(`${chave}:${contexto!.sampleRate}`);
  if (pronto) return pronto;
  const buffer = contexto!.createBuffer(1, amostras.length, contexto!.sampleRate);
  buffer.getChannelData(0).set(amostras);
  buffers.set(`${chave}:${contexto!.sampleRate}`, buffer);
  return buffer;
}

function laco(buffer: AudioBuffer): AudioBufferSourceNode {
  const fonte = contexto!.createBufferSource();
  fonte.buffer = buffer;
  fonte.loop = true;
  fontes.push(fonte);
  nos.push(fonte);
  return fonte;
}

/** Monta o grafo do tipo pedido até o volume mestre. */
function montar(tipo: TipoDeSom) {
  const c = contexto!;
  const { base, gotas: pingos } = amostrasDe(tipo, c.sampleRate);
  const fonte = laco(bufferDe(tipo, base));
  if (tipo !== "chuva") {
    fonte.connect(mestre!);
    fonte.start();
    return;
  }
  // Chuva: o chiado passa por um passa-alta e um passa-baixa (tira o ronco e o agudo demais) e por um ganho que sobe
  // e desce devagar (duas ondas lentas somadas, que não se repetem juntas), como a chuva que engrossa e afina.
  const alta = c.createBiquadFilter();
  alta.type = "highpass";
  alta.frequency.value = 400;
  const baixa = c.createBiquadFilter();
  baixa.type = "lowpass";
  baixa.frequency.value = 6500;
  const onda = c.createGain();
  onda.gain.value = 0.7;
  const lenta = c.createOscillator();
  lenta.frequency.value = 0.13;
  const funda = c.createGain();
  funda.gain.value = 0.2;
  const outra = c.createOscillator();
  outra.frequency.value = 0.37;
  const rasa = c.createGain();
  rasa.gain.value = 0.08;
  lenta.connect(funda).connect(onda.gain);
  outra.connect(rasa).connect(onda.gain);
  fonte.connect(alta).connect(baixa).connect(onda).connect(mestre!);
  nos.push(alta, baixa, onda, lenta, funda, outra, rasa);
  fontes.push(lenta, outra);
  if (pingos) {
    const fonteDasGotas = laco(bufferDe("gotas", pingos));
    const banda = c.createBiquadFilter();
    banda.type = "bandpass";
    banda.frequency.value = 2500;
    banda.Q.value = 0.8;
    const nivel = c.createGain();
    nivel.gain.value = 0.35;
    fonteDasGotas.connect(banda).connect(nivel).connect(mestre!);
    nos.push(banda, nivel);
  }
  for (const f of fontes) f.start();
}

function soltar() {
  for (const f of fontes) {
    try {
      f.stop();
    } catch {
      // já parado
    }
  }
  for (const n of nos) n.disconnect();
  fontes = [];
  nos = [];
}

function quandoAVozFala(evento: Event) {
  const detalhe = (evento as CustomEvent<{ duracao?: number; texto?: string }>).detail ?? {};
  window.clearTimeout(relogioDaVoz);
  if (!estado.comVoz) {
    mudar({ comVoz: true });
    aplicarNivel(true);
  }
  relogioDaVoz = window.setTimeout(() => {
    mudar({ comVoz: false });
    aplicarNivel();
  }, esperaDepoisDaVoz(Number(detalhe.duracao) || 0, String(detalhe.texto ?? "")));
}

/** Os comandos do som para estudar. `ligar` precisa ser chamado dentro de um toque (o navegador só libera o som assim). */
export const somDeEstudo = {
  /** O estado agora (para quem precisa ler sem redesenhar, como o tocador). */
  atual: (): EstadoDoSom => estado,
  ligar(tipo: TipoDeSom) {
    if (!eTipoDeSom(tipo)) return;
    if (!volumeLido) {
      volumeLido = true;
      mudar({ volume: lerVolume() });
    }
    try {
      contexto ??= new AudioContext();
    } catch {
      mudar({ semAudio: true });
      return;
    }
    void contexto.resume();
    if (!mestre) {
      mestre = contexto.createGain();
      mestre.connect(contexto.destination);
    }
    // Entra devagar (sem susto) a partir do silêncio; o som de antes (troca de tipo) sai junto.
    mestre.gain.cancelScheduledValues(contexto.currentTime);
    mestre.gain.setValueAtTime(0, contexto.currentTime);
    soltar();
    try {
      montar(tipo);
    } catch {
      soltar();
      mudar({ semAudio: true, tipo: null });
      return;
    }
    mudar({ tipo, semAudio: false });
    aplicarNivel();
    document.addEventListener("lucia:voz-falou", quandoAVozFala);
  },
  desligar() {
    document.removeEventListener("lucia:voz-falou", quandoAVozFala);
    window.clearTimeout(relogioDaVoz);
    if (contexto && mestre) {
      // Sai em um quarto de segundo e só então solta os nós.
      mestre.gain.setTargetAtTime(0, contexto.currentTime, 0.06);
      const saindo = { fontes, nos };
      fontes = [];
      nos = [];
      window.setTimeout(() => {
        for (const f of saindo.fontes) {
          try {
            f.stop();
          } catch {
            // já parado
          }
        }
        for (const n of saindo.nos) n.disconnect();
        if (!estado.tipo) void contexto?.suspend();
      }, 300);
    }
    mudar({ tipo: null, comVoz: false });
  },
  definirVolume(volume: number) {
    const v = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : VOLUME_PADRAO));
    volumeLido = true;
    mudar({ volume: v });
    aplicarNivel(true);
    try {
      localStorage.setItem(CHAVE_DO_VOLUME, String(v));
    } catch {
      // sem armazenamento: vale só nesta visita
    }
  },
  /** Lê o volume guardado (para o controle mostrar o valor certo antes de tocar). Chamar depois da hidratação. */
  carregarVolume() {
    if (volumeLido) return;
    volumeLido = true;
    mudar({ volume: lerVolume() });
  },
};

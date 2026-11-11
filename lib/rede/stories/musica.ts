// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A música opcional do vídeo do story, SEM RASTREIO: as faixas são geradas no próprio aparelho (síntese simples, determinística),
// nada é baixado de fora e nenhum serviço de terceiros fica sabendo quem ouviu o quê (LGPD art. 6º, III, necessidade). Por isso
// também não há "biblioteca" com nomes de artistas: são 4 ritmos de rua, de domínio comum, feitos aqui. O banco aceita só estes
// nomes (rede_stories.musica). Puro (sem DOM), para o teste rodar no Node; a mistura com o vídeo fica em midia.ts.
import type { MusicaDoStory } from "../tipos-stories";

export interface Musica {
  id: MusicaDoStory;
  /** Batidas por minuto. */
  bpm: number;
}

export const MUSICAS: readonly Musica[] = [
  { id: "batucada", bpm: 112 },
  { id: "marcha", bpm: 96 },
  { id: "ciranda", bpm: 84 },
  { id: "tambor", bpm: 128 },
];

/** Um sorteio que sai sempre igual (para o chiado do tamborim não mudar de uma vez para a outra). */
function sorteio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/** Os toques de cada ritmo, em 16 tempos por compasso: [tempo, instrumento]. */
const PADROES: Record<MusicaDoStory, { surdo: number[]; caixa: number[]; agudo: number[]; notas?: number[] }> = {
  batucada: { surdo: [0, 8], caixa: [2, 3, 6, 10, 11, 14], agudo: [0, 2, 4, 6, 8, 10, 12, 14, 15] },
  marcha: { surdo: [0, 4, 8, 12], caixa: [4, 12, 14], agudo: [] },
  ciranda: { surdo: [0, 6, 8, 14], caixa: [], agudo: [4, 12], notas: [220, 247, 262, 247, 220, 196, 220, 0] },
  tambor: { surdo: [0, 3, 6, 8, 11, 14], caixa: [4, 12], agudo: [2, 6, 10, 14] },
};

/**
 * Gera `segundos` da música em amostras de -1 a 1 (mono), na taxa `taxa`. Vai em volume baixo (0,5 de pico) porque mistura com o
 * som do vídeo; começa e termina com um esmaecer curto, para não estalar.
 */
export function gerarMusica(id: MusicaDoStory, taxa: number, segundos: number): Float32Array {
  const m = MUSICAS.find((x) => x.id === id) ?? MUSICAS[0];
  const p = PADROES[m.id];
  const total = Math.max(0, Math.floor(taxa * segundos));
  const saida = new Float32Array(total);
  const tempo = (60 / m.bpm / 4) * taxa; // amostras por tempo (semicolcheia)
  const ruido = sorteio(m.bpm * 7919);
  const toque = (inicio: number, dur: number, f: (t: number, k: number) => number) => {
    const fim = Math.min(total, inicio + Math.floor(dur * taxa));
    for (let i = Math.max(0, inicio); i < fim; i++) {
      const t = (i - inicio) / taxa;
      saida[i] += f(t, i);
    }
  };
  for (let n = 0, inicio = 0; inicio < total; n++, inicio = Math.floor(n * tempo)) {
    const passo = n % 16;
    if (p.surdo.includes(passo)) toque(inicio, 0.35, (t) => Math.sin(2 * Math.PI * (55 + 40 * Math.exp(-t * 18)) * t) * Math.exp(-t * 7) * 0.55);
    if (p.caixa.includes(passo)) toque(inicio, 0.12, (t) => ruido() * Math.exp(-t * 32) * 0.28);
    if (p.agudo.includes(passo)) toque(inicio, 0.05, (t) => (ruido() * 0.5 + Math.sin(2 * Math.PI * 3200 * t) * 0.5) * Math.exp(-t * 90) * 0.18);
    if (p.notas && passo % 2 === 0) {
      const nota = p.notas[(n / 2) % p.notas.length];
      if (nota) toque(inicio, 0.4, (t) => (Math.sin(2 * Math.PI * nota * t) + 0.3 * Math.sin(4 * Math.PI * nota * t)) * Math.exp(-t * 4) * 0.16);
    }
  }
  // Esmaecer (0,3 s) e teto: nunca passa de 0,5.
  const borda = Math.min(Math.floor(taxa * 0.3), Math.floor(total / 2));
  for (let i = 0; i < total; i++) {
    let g = 1;
    if (i < borda) g = i / borda;
    else if (i > total - borda) g = (total - i) / borda;
    saida[i] = Math.max(-0.5, Math.min(0.5, saida[i] * g));
  }
  return saida;
}

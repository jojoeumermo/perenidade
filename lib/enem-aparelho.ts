// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o curso ENEM guarda neste navegador, e só nele, na chave "lucia:enem" (lib/meu-estudo.ts, CHAVES.enem): as
// provas e simulados feitos (acertos por área, habilidade e dificuldade, e o tempo em cada questão), os diagnósticos,
// o plano de estudos e o que a pessoa marcou na lista do dia da prova. Entra na cópia de segurança e no "apagar".
// Nada vai para servidor. Sem os atalhos "@/" de propósito: `npm run testar:enem` roda este arquivo no Node.

import { CHAVES } from "./meu-estudo";

/** [acertos, total] */
export type Placar = [number, number];

export interface ResultadoDeProva {
  /** "oficial-2023-1-ingles", "minissimulado-matematica" … */
  id: string;
  titulo: string;
  quando: number;
  acertos: number;
  total: number;
  porArea: Record<string, Placar>;
  /** "matematica-3" → acertos na H3 de Matemática. */
  porHabilidade: Record<string, Placar>;
  porDificuldade: Record<string, Placar>;
  /** Segundos usados na prova inteira. */
  segundos: number;
}

export interface EstadoDoEnem {
  provas: ResultadoDeProva[];
  /** Segundos que a pessoa passou em cada questão, na última vez que a fez. */
  tempos: Record<string, number>;
  /** Itens marcados na lista do dia da prova. */
  lista: string[];
  diagnosticos: unknown[];
  plano: unknown;
}

const VAZIO: EstadoDoEnem = { provas: [], tempos: {}, lista: [], diagnosticos: [], plano: null };
const MAX_PROVAS = 100;
const MAX_TEMPOS = 3000;

export function lerEnem(): EstadoDoEnem {
  try {
    const d: unknown = JSON.parse(globalThis.localStorage?.getItem(CHAVES.enem) ?? "{}");
    if (!d || typeof d !== "object" || Array.isArray(d)) return { ...VAZIO };
    const o = d as Partial<EstadoDoEnem>;
    return {
      provas: Array.isArray(o.provas) ? o.provas : [],
      tempos: o.tempos && typeof o.tempos === "object" ? o.tempos : {},
      lista: Array.isArray(o.lista) ? o.lista.filter((x) => typeof x === "string") : [],
      diagnosticos: Array.isArray(o.diagnosticos) ? o.diagnosticos : [],
      plano: o.plano ?? null,
    };
  } catch {
    return { ...VAZIO };
  }
}

function gravar(estado: EstadoDoEnem) {
  try {
    globalThis.localStorage?.setItem(CHAVES.enem, JSON.stringify(estado));
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
  } catch {
    // armazenamento cheio ou bloqueado: o estudo segue, só não fica guardado
  }
}

/** Muda o estado guardado (lê, aplica a mudança, grava). */
export function mudarEnem(mudar: (e: EstadoDoEnem) => void) {
  const e = lerEnem();
  mudar(e);
  gravar(e);
}

export function registrarProva(r: ResultadoDeProva, tempos: Record<string, number>) {
  mudarEnem((e) => {
    e.provas = [r, ...e.provas].slice(0, MAX_PROVAS);
    const juntos = { ...e.tempos, ...tempos };
    e.tempos = Object.fromEntries(Object.entries(juntos).slice(-MAX_TEMPOS));
  });
}

export function marcarNaLista(item: string, marcado: boolean) {
  mudarEnem((e) => {
    e.lista = marcado ? [...new Set([...e.lista, item])] : e.lista.filter((x) => x !== item);
  });
}

/** Soma um acerto (ou erro) a um placar de um mapa. */
export function somar(mapa: Record<string, Placar>, chave: string, certo: boolean) {
  const p = mapa[chave] ?? [0, 0];
  mapa[chave] = [p[0] + (certo ? 1 : 0), p[1] + 1];
}

/** "1:05:09", "12:03", "0:45" */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
}

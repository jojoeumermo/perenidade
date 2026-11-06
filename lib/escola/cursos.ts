// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O modelo de curso da Escola Revolucionária Lúcia Maria: o formato do arquivo content/escola/cursos/<slug>.json, a validação (só com
// aulas, pessoas do Memorial e obras do Acervo que existem), as horas estimadas e o progresso de quem estuda. Puro: sem
// fs, sem React e sem os atalhos "@/" (`npm run testar:escola` roda este arquivo direto no Node). A leitura da pasta
// fica em lib/escola/cursos-servidor.ts. O formato está explicado em content/escola/cursos/LEIA-ME.md.

import type { Objetivo } from "./estudante";

export const CICLOS = ["basico", "profissional", "avancado"] as const;
export type Ciclo = (typeof CICLOS)[number];
export const FORMATOS = ["regular", "alternancia", "percurso"] as const;
export type Formato = (typeof FORMATOS)[number];

export interface Modulo {
  titulo: string;
  /** "trilha/aula" */
  aulas: string[];
  /** Tarefas de "tempo trabalho" (formato alternância). */
  pratica?: string[];
}

export interface Curso {
  slug: string;
  titulo: string;
  ciclo: Ciclo;
  formato: Formato;
  /** Slug de lib/areas.ts. */
  area: string;
  resumo: string;
  objetivo: string;
  /** Para a matrícula sugerir o curso a quem marcou esses objetivos. */
  objetivos: Objetivo[];
  modulos: Modulo[];
  /** Slugs de cursos que vêm antes. */
  requisitos: string[];
  /** O vínculo com o curso revela opinião política (ex.: formação política): turma só com consentimento. */
  sensivel?: boolean;
  patrono?: { memorial: string; motivo: string; confirmado: boolean };
  leituras?: { obra: string; ordem: number; porque: string }[];
  emConstrucao?: { titulo: string; motivo: string }[];
  tarefaNoMundo: string;
  projetoFinal: string;
  casoDoBairro?: boolean;
  semanas: number;
}

export interface Conferidores {
  existeAula: (trilhaAula: string) => boolean;
  existeMemorial: (slug: string) => boolean;
  existeObra: (slug: string) => boolean;
  existeCurso: (slug: string) => boolean;
  /** Os requisitos de outro curso, para achar ciclos (opcional: sem ele, só o próprio curso é olhado). */
  requisitosDe?: (slug: string) => string[] | undefined;
}

export const MIN_AULAS = 6;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AULA = /^[a-z0-9-]+\/[a-z0-9-]+$/;

/** Todas as aulas do curso, na ordem. */
export const aulasDoCurso = (curso: Pick<Curso, "modulos">): string[] => curso.modulos.flatMap((m) => m.aulas);
/** A trilha de uma aula "trilha/aula". */
export const trilhaDe = (aula: string) => aula.split("/")[0];

/** Confere um curso. Devolve a lista de erros (vazia quando está tudo certo). */
export function validarCurso(curso: Curso, c: Conferidores): string[] {
  const erros: string[] = [];
  const texto = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  if (!curso || typeof curso !== "object") return ["o curso não é um objeto"];
  if (!texto(curso.slug) || !SLUG.test(curso.slug)) erros.push(`slug inválido: ${String(curso.slug)}`);
  for (const campo of ["titulo", "area", "resumo", "objetivo", "tarefaNoMundo", "projetoFinal"] as const) if (!texto(curso[campo])) erros.push(`falta "${campo}"`);
  if (!CICLOS.includes(curso.ciclo)) erros.push(`ciclo inválido: ${String(curso.ciclo)}`);
  if (!FORMATOS.includes(curso.formato)) erros.push(`formato inválido: ${String(curso.formato)}`);
  if (!Array.isArray(curso.objetivos)) erros.push(`"objetivos" deve ser uma lista`);
  if (!Number.isInteger(curso.semanas) || curso.semanas < 1) erros.push(`"semanas" deve ser um número inteiro positivo`);
  if (!Array.isArray(curso.modulos) || curso.modulos.length === 0) {
    erros.push("o curso não tem módulos");
    return erros;
  }
  const vistas = new Set<string>();
  for (const [i, m] of curso.modulos.entries()) {
    if (!texto(m.titulo)) erros.push(`módulo ${i + 1} sem título`);
    if (!Array.isArray(m.aulas)) {
      erros.push(`módulo ${i + 1}: "aulas" deve ser uma lista`);
      continue;
    }
    for (const aula of m.aulas) {
      if (typeof aula !== "string" || !AULA.test(aula)) erros.push(`aula em formato errado (use "trilha/aula"): ${String(aula)}`);
      else if (!c.existeAula(aula)) erros.push(`aula não existe: ${aula}`);
      if (vistas.has(aula)) erros.push(`aula repetida: ${aula}`);
      vistas.add(aula);
    }
    if (m.pratica !== undefined && !(Array.isArray(m.pratica) && m.pratica.every(texto))) erros.push(`módulo ${i + 1}: "pratica" deve ser uma lista de textos`);
  }
  if (vistas.size < MIN_AULAS) erros.push(`o curso tem ${vistas.size} aulas; o mínimo é ${MIN_AULAS}`);
  if (curso.patrono && !c.existeMemorial(curso.patrono.memorial)) erros.push(`patrono não está no Memorial: ${curso.patrono.memorial}`);
  for (const l of curso.leituras ?? []) if (!c.existeObra(l.obra)) erros.push(`obra não está no Acervo: ${l.obra}`);
  if (!Array.isArray(curso.requisitos)) erros.push(`"requisitos" deve ser uma lista`);
  else {
    for (const r of curso.requisitos) if (r === curso.slug) erros.push("o curso é requisito de si mesmo");
    else if (!c.existeCurso(r)) erros.push(`requisito não existe: ${r}`);
    const ciclo = cicloDeRequisitos(curso.slug, curso.requisitos, c.requisitosDe ?? (() => undefined));
    if (ciclo) erros.push(`os requisitos formam um ciclo: ${ciclo.join(" → ")}`);
  }
  return erros;
}

/** Acha um ciclo que passe pelo curso (A pede B, B pede A). Devolve o caminho ou null. */
export function cicloDeRequisitos(slug: string, requisitos: string[], requisitosDe: (s: string) => string[] | undefined): string[] | null {
  const caminho: string[] = [slug];
  const visitados = new Set<string>();
  const andar = (lista: string[]): string[] | null => {
    for (const r of lista) {
      if (r === slug) return [...caminho, r];
      if (visitados.has(r)) continue;
      visitados.add(r);
      caminho.push(r);
      const achado = andar(requisitosDe(r) ?? []);
      if (achado) return achado;
      caminho.pop();
    }
    return null;
  };
  return andar(requisitos);
}

// ───────────── Horas (estimativa) ─────────────

/**
 * Minutos estimados de uma aula: o tempo de leitura, mais 2 minutos por questão do teste e 3 por exercício. É uma
 * ESTIMATIVA para o plano da semana, não uma carga horária oficial.
 */
export function tempoDaAula({ minutes, quiz, exercicios }: { minutes: number; quiz: number; exercicios: number }): number {
  return Math.max(0, minutes) + 2 * Math.max(0, quiz) + 3 * Math.max(0, exercicios);
}

/** Arredonda minutos para horas em meia hora (no mínimo meia hora quando há algum minuto). */
export function arredondarHoras(minutos: number): number {
  if (minutos <= 0) return 0;
  return Math.max(0.5, Math.round(minutos / 30) / 2);
}

/** Horas estimadas do curso inteiro, arredondadas para meia hora. */
export function horasDoCurso(curso: Pick<Curso, "modulos">, minutosDaAula: (aula: string) => number): number {
  return arredondarHoras(aulasDoCurso(curso).reduce((soma, a) => soma + minutosDaAula(a), 0));
}

// ───────────── Progresso ─────────────

/** A aula conta como feita se foi concluída ou se a trilha dela foi dispensada. */
const feita = (aula: string, concluidas: Iterable<string>, dispensas: string[]) => {
  const lista = concluidas instanceof Set ? concluidas : new Set(concluidas);
  return lista.has(aula) || dispensas.includes(trilhaDe(aula));
};

/** Horas feitas (estimativa, meia hora) contando as aulas concluídas e as das trilhas dispensadas. */
export function horasFeitas(curso: Pick<Curso, "modulos">, concluidas: Iterable<string>, dispensas: string[], minutosDaAula: (aula: string) => number): number {
  const feitas = new Set(concluidas);
  return arredondarHoras(aulasDoCurso(curso).filter((a) => feita(a, feitas, dispensas)).reduce((s, a) => s + minutosDaAula(a), 0));
}

/** A próxima aula a fazer no curso (a primeira não feita, na ordem), ou null quando acabou. */
export function proximaDoCurso(curso: Pick<Curso, "modulos">, concluidas: Iterable<string>, dispensas: string[]): string | null {
  const feitas = new Set(concluidas);
  return aulasDoCurso(curso).find((a) => !feita(a, feitas, dispensas)) ?? null;
}

/** A aula em que a pessoa está: a última aberta, se é do curso e ainda não foi feita; se não, a próxima do curso. */
export function aulaAtual(curso: Pick<Curso, "modulos">, concluidas: Iterable<string>, dispensas: string[], ultimaAberta?: string | null): string | null {
  const feitas = new Set(concluidas);
  if (ultimaAberta && aulasDoCurso(curso).includes(ultimaAberta) && !feita(ultimaAberta, feitas, dispensas)) return ultimaAberta;
  return proximaDoCurso(curso, feitas, dispensas);
}

/** O índice (0, 1, ...) e o título do módulo de uma aula, ou null se a aula não é do curso. */
export function moduloDe(curso: Pick<Curso, "modulos">, aula: string): { indice: number; titulo: string } | null {
  const indice = curso.modulos.findIndex((m) => m.aulas.includes(aula));
  return indice < 0 ? null : { indice, titulo: curso.modulos[indice].titulo };
}

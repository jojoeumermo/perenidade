// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A aula da semana: uma aula revisada por semana, a mesma para todo mundo, que a inicial destaca e que os núcleos
// podem usar como pauta do encontro. Troca na segunda-feira à meia-noite de Brasília, sem ninguém precisar escolher.
import type { Locale } from "@/i18n/config";
import { getTracks } from "./content";
import { lambeDoDia, semanaDe } from "./lambe-do-dia";

export interface AulaDaSemana {
  semana: number;
  /** Primeiro dia da semana (segunda), AAAA-MM-DD. */
  inicio: string;
  trilha: string;
  trilhaTitulo: string;
  area: string;
  aula: string;
  titulo: string;
  resumo: string;
  minutos: number;
  termos: { term: string; summary: string }[];
  pergunta?: string;
}

function inicioDa(semana: number): string {
  return new Date((semana * 7 - 3) * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A aula desta semana e das próximas, para a página vir pronta e o navegador trocar sozinho quando a semana virar
 * sem esperar a página ser montada de novo. Entram as aulas revisadas (ou todas, enquanto forem poucas); a ordem embaralha com o mesmo passo do
 * lambe-lambe do dia, para semanas seguidas não trazerem aulas vizinhas da mesma trilha.
 */
export function aulasDaSemana(lang: Locale, semanas = 4): AulaDaSemana[] {
  const todas = getTracks(lang)
    .flatMap((trilha) => trilha.lessons.filter((l) => l.summary).map((aula) => ({ trilha, aula })))
    .sort((a, b) => `${a.trilha.slug}/${a.aula.slug}`.localeCompare(`${b.trilha.slug}/${b.aula.slug}`));
  const revisadas = todas.filter((x) => x.aula.reviewed);
  // Enquanto houver poucas revisadas, entram todas: senão a mesma meia dúzia voltaria o tempo todo.
  const lista = revisadas.length >= 12 ? revisadas : todas;
  if (lista.length === 0) return [];
  const agora = semanaDe(new Date());
  return Array.from({ length: semanas }, (_, i) => {
    const semana = agora + i;
    const { trilha, aula } = lista[lambeDoDia(semana, lista.length)];
    return {
      semana,
      inicio: inicioDa(semana),
      trilha: trilha.slug,
      trilhaTitulo: trilha.title,
      area: trilha.area,
      aula: aula.slug,
      titulo: aula.title,
      resumo: aula.summary,
      minutos: aula.minutes,
      termos: aula.terms.slice(0, 3),
      pergunta: aula.quiz[0]?.question,
    };
  });
}

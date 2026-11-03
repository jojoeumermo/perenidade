// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que as páginas da avaliação (E4-13: /escola/provas e /escola/saberes) precisam saber dos cursos na montagem: as
// trilhas de cada curso, na ordem em que aparecem, com o título e se a trilha tem prova (a rota /trilhas/[trilha]/prova
// só existe com 10 questões ou mais, a mesma conta de app/[lang]/trilhas/[track]/prova/page.tsx). Só servidor.

import { getTrack, type Track } from "@/lib/content";
import { aulasDoCurso, type Curso, trilhaDe } from "@/lib/escola/cursos";

/** O mínimo de questões para a trilha ter prova (igual ao da página da prova). */
export const MINIMO_DA_PROVA = 10;

export const questoesDaTrilha = (track: Pick<Track, "lessons">) => track.lessons.reduce((soma, l) => soma + l.quiz.length, 0);

export interface TrilhaDoCursoVista {
  slug: string;
  titulo: string;
  prova: boolean;
  /** Quantas questões cada aula da trilha tem ("trilha/aula"), para a regra da dispensa. */
  disponiveis: Record<string, number>;
}

/** As trilhas de um curso, sem repetir, na ordem da primeira aula de cada uma. O conteúdo é lido em português. */
export function trilhasDoCurso(curso: Pick<Curso, "modulos">): TrilhaDoCursoVista[] {
  const slugs = [...new Set(aulasDoCurso(curso).map(trilhaDe))];
  return slugs.map((slug) => {
    const track = getTrack(slug, "pt");
    const disponiveis = Object.fromEntries((track?.lessons ?? []).filter((l) => l.quiz.length > 0).map((l) => [`${slug}/${l.slug}`, l.quiz.length]));
    return { slug, titulo: track?.title ?? slug, prova: track ? questoesDaTrilha(track) >= MINIMO_DA_PROVA : false, disponiveis };
  });
}

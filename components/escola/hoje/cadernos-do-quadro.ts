// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// SÓ NO SERVIDOR: as aulas escritas de cada um dos 11 cadernos (lib/escola/contratos.ts, CADERNOS_DA_ESCOLA), com o
// título no idioma da página, para o Quadro da semana e o percurso da tela Hoje. É conteúdo público (as mesmas aulas de
// /trilhas, abertas a todo mundo): nada de militante passa por aqui. O que a pessoa já fez fica no aparelho e é cruzado
// no navegador (QuadroDaSemana).

import ano from "@/content/escola/cursos/ano-de-formacao-politica.json";
import despertar from "@/content/despertar.json";
import type { Locale } from "@/i18n/config";
import { getTrack } from "@/lib/content";
import { CADERNOS_DA_ESCOLA, caminhoDaAula, caminhoDoCaderno, codigoDaAula, type CadernoDaEscola, type Degrau } from "@/lib/escola/contratos";
import { lessonId } from "@/lib/ids";

export interface AulaDoQuadro {
  /** O mesmo lessonId de /trilhas: concluir lá risca aqui. */
  id: string;
  titulo: string;
  codigo: string;
  href: string;
}

export interface CadernoDoQuadro {
  numero: number;
  degrau: Degrau;
  nome: string;
  href: string;
  aulas: AulaDoQuadro[];
}

/** As aulas de um caderno, na ordem: a trilha inteira, ou a lista "trilha/aula" das etapas do Despertar e dos módulos do curso. */
function idsDoCaderno(c: CadernoDaEscola, lang: Locale): { id: string; titulo: string }[] {
  if (c.fonte.tipo === "trilha") {
    const trilha = getTrack(c.fonte.trilha, lang);
    return (trilha?.lessons ?? []).map((l) => ({ id: lessonId(trilha!.slug, l.slug), titulo: l.title }));
  }
  const lista = c.fonte.tipo === "despertar" ? despertar.etapas.flatMap((e) => e.aulas) : (ano.modulos as { aulas: string[] }[]).flatMap((m) => m.aulas);
  const vistas = new Set<string>();
  const saida: { id: string; titulo: string }[] = [];
  for (const id of lista) {
    if (vistas.has(id)) continue;
    vistas.add(id);
    const [t, a] = id.split("/");
    const aula = getTrack(t, lang)?.lessons.find((l) => l.slug === a);
    if (aula) saida.push({ id, titulo: aula.title });
  }
  return saida;
}

export function cadernosDoQuadro(lang: Locale, nomes: readonly string[]): CadernoDoQuadro[] {
  return CADERNOS_DA_ESCOLA.map((c) => ({
    numero: c.numero,
    degrau: c.degrau,
    nome: nomes[c.numero - 1] ?? c.slug,
    href: caminhoDoCaderno(c.slug),
    aulas: idsDoCaderno(c, lang).map((a, i) => ({ ...a, codigo: codigoDaAula(c.numero, i), href: caminhoDaAula(c, a.id) })),
  }));
}

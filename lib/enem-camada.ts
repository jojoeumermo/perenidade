// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A camada do instituto sobre as provas oficiais, no formato que vai para o navegador: a classificação de cada questão
// com os nomes já resolvidos (objeto, tópico, título das aulas), a resolução e os enganos. As questões em si continuam
// em public/questoes/enem-<ano>.json, como o importador grava; a tela junta as duas partes pelo id.

import fs from "node:fs";
import path from "node:path";
import type { Locale } from "@/i18n/config";
import { getTracks } from "./content";
import { acharNaMatriz, AREAS_DO_ENEM, type Letra } from "./enem";
import { todosOsMapas } from "./curriculo-conteudo";
import { classificacoesDoEnem, matrizDoEnem } from "./enem-conteudo";
import type { AreaDoEnem } from "./mapa-curricular";

export interface QuestaoDaCamada {
  id: string;
  ano: number;
  area: AreaDoEnem;
  habilidade: number;
  objeto: string;
  objetoNome: string;
  topicoNome?: string;
  dificuldade: 1 | 2 | 3;
  gabarito: Letra;
  resolucao: string;
  enganos: Partial<Record<Letra, string>>;
  aulas: { href: string; titulo: string }[];
}

export function camadaDoAno(ano: number, lang: Locale): QuestaoDaCamada[] {
  const matriz = matrizDoEnem();
  const titulos = new Map<string, string>(getTracks(lang).flatMap((t) => t.lessons.map((l): [string, string] => [`${t.slug}/${l.slug}`, l.title])));
  return classificacoesDoEnem()
    .filter((c) => c.ano === ano)
    .map((c) => {
      const achado = acharNaMatriz(matriz, c.topico ?? c.objeto);
      return {
        id: c.id,
        ano: c.ano,
        area: c.area,
        habilidade: c.habilidade,
        objeto: c.objeto,
        objetoNome: achado?.objeto.nome ?? c.objeto,
        topicoNome: achado?.topico?.nome,
        dificuldade: c.dificuldade,
        gabarito: c.gabarito,
        resolucao: c.resolucao,
        enganos: c.enganos,
        aulas: c.aulas.filter((a) => titulos.has(a)).map((a) => ({ href: `/trilhas/${a}`, titulo: titulos.get(a) as string })),
      };
    });
}

/** Os anos que têm alguma questão classificada, do mais novo ao mais velho, com quantas por área. */
export function anosClassificados(): { ano: number; porArea: Record<AreaDoEnem, number> }[] {
  const anos = [...new Set(classificacoesDoEnem().map((c) => c.ano))].sort((a, b) => b - a);
  return anos.map((ano) => {
    const doAno = classificacoesDoEnem().filter((c) => c.ano === ano);
    return { ano, porArea: Object.fromEntries(AREAS_DO_ENEM.map((a) => [a, doAno.filter((c) => c.area === a).length])) as Record<AreaDoEnem, number> };
  });
}

/** O resumo de cada habilidade, para os relatórios ("matematica-3" → "Resolver problemas…"). */
export function resumosDasHabilidades(): Record<string, string> {
  const m = matrizDoEnem();
  return Object.fromEntries(AREAS_DO_ENEM.flatMap((a) => m.areas[a].competencias.flatMap((c) => c.habilidades.map((h) => [`${a}-${h.numero}`, h.resumo]))));
}

/** Os objetos de cada área (id e nome), para os filtros. */
export function objetosParaFiltro(): Record<AreaDoEnem, { id: string; nome: string }[]> {
  const m = matrizDoEnem();
  return Object.fromEntries(AREAS_DO_ENEM.map((a) => [a, m.areas[a].objetos.map((o) => ({ id: o.id, nome: o.nome }))])) as Record<AreaDoEnem, { id: string; nome: string }[]>;
}

/**
 * Os tópicos da matriz para o plano de estudos: o peso é a incidência (questões oficiais classificadas no tópico) e o
 * endereço é a aula do percurso ligada ao tópico no mapa curricular, ou a prática daquele conteúdo.
 */
export function topicosParaPlano(): { id: string; nome: string; area: AreaDoEnem; peso: number; href: string }[] {
  const m = matrizDoEnem();
  const peso = new Map<string, number>();
  for (const c of classificacoesDoEnem()) {
    peso.set(c.objeto, (peso.get(c.objeto) ?? 0) + 1);
    if (c.topico) peso.set(c.topico, (peso.get(c.topico) ?? 0) + 1);
  }
  const aula = new Map<string, string>();
  for (const [trilha, mapa] of todosOsMapas())
    if (trilha.startsWith("enem-")) for (const [slug, a] of Object.entries(mapa.aulas)) for (const id of a.objetos) if (!aula.has(id)) aula.set(id, `/trilhas/${trilha}/${slug}`);
  return AREAS_DO_ENEM.flatMap((area) =>
    m.areas[area].objetos.flatMap((o) =>
      o.topicos.map((t) => ({ id: t.id, nome: t.nome, area, peso: (peso.get(t.id) ?? 0) * 10 + (peso.get(o.id) ?? 0) / Math.max(1, o.topicos.length), href: aula.get(t.id) ?? aula.get(o.id) ?? `/enem/praticar?objeto=${o.id}` })),
    ),
  );
}

/** Os anos com prova do Enem importada (public/questoes/enem-<ano>.json), do mais novo ao mais velho. */
export function anosComProva(): number[] {
  return fs
    .readdirSync(path.join(process.cwd(), "public", "questoes"))
    .map((n) => /^enem-(\d{4})\.json$/.exec(n)?.[1])
    .filter((a): a is string => Boolean(a))
    .map(Number)
    .sort((a, b) => b - a);
}

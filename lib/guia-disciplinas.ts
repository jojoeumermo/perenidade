// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { AreaSlug, Stage } from "./areas";

/**
 * O guia das disciplinas: para cada objetivo, as disciplinas na ordem em que vale estudar (passos) ou os caminhos
 * entre os quais a pessoa escolhe um (opções). O ponto de partida escolhe a etapa (do zero = fundamental, já estudei
 * um pouco = médio, quero aprofundar = superior); sem trilha pronta naquela etapa, vale a mais próxima.
 */
export const OBJETIVOS = ["luta", "escola", "enem", "oficio", "linguas", "tecnologia"] as const;
export type Objetivo = (typeof OBJETIVOS)[number];

export const DO_GUIA: Record<Objetivo, { modo: "passos" | "opcoes"; areas: Partial<Record<Stage, readonly AreaSlug[]>> & { todas?: readonly AreaSlug[] }; extra?: "despertar" | "nivelamento" }> = {
  luta: { modo: "passos", areas: { todas: ["marxismo", "capitalismo", "formacao-militante"] }, extra: "despertar" },
  escola: { modo: "passos", areas: { fundamental: ["alfabetizacao", "portugues", "matematica"], todas: ["portugues", "matematica", "historia"] }, extra: "nivelamento" },
  enem: { modo: "passos", areas: { todas: ["enem", "portugues", "matematica"] }, extra: "nivelamento" },
  oficio: { modo: "opcoes", areas: { todas: ["trancista", "costureira", "barbeiro", "eletricista"] } },
  linguas: { modo: "opcoes", areas: { todas: ["espanhol", "ingles", "chines", "alemao"] } },
  tecnologia: { modo: "opcoes", areas: { todas: ["informatica", "programacao", "fotografia"] } },
};

/** Quando a etapa pedida não tem trilha pronta, a ordem das outras a tentar. */
const PERTO: Record<Stage, readonly Stage[]> = {
  fundamental: ["fundamental", "medio", "superior"],
  medio: ["medio", "fundamental", "superior"],
  superior: ["superior", "medio", "fundamental"],
};

export interface PassoDoGuia {
  area: AreaSlug;
  trilha: string;
  trilhaTitulo: string;
  prontas: number;
  aula: { slug: string; titulo: string } | null;
}

interface TrilhaDoGuia {
  slug: string;
  title: string;
  area: string;
  stage: Stage;
  lessons: { slug: string; title: string }[];
}

/** Todos os caminhos já resolvidos (objetivo × ponto de partida), para o guia não levar a lista de trilhas ao navegador. */
export function caminhosDoGuia(trilhas: readonly TrilhaDoGuia[], etapas: readonly Stage[]): Record<Objetivo, Record<Stage, PassoDoGuia[]>> {
  const melhor = (area: AreaSlug, etapa: Stage): PassoDoGuia | null => {
    for (const tentativa of PERTO[etapa]) {
      const escolhida = trilhas
        .filter((t) => t.area === area && t.stage === tentativa && t.lessons.length > 0)
        .reduce<TrilhaDoGuia | null>((a, b) => (!a || b.lessons.length > a.lessons.length ? b : a), null);
      if (escolhida) {
        const primeira = escolhida.lessons[0];
        return { area, trilha: escolhida.slug, trilhaTitulo: escolhida.title, prontas: escolhida.lessons.length, aula: primeira ? { slug: primeira.slug, titulo: primeira.title } : null };
      }
    }
    return null;
  };
  return Object.fromEntries(
    OBJETIVOS.map((objetivo) => {
      const { areas } = DO_GUIA[objetivo];
      return [objetivo, Object.fromEntries(etapas.map((etapa) => [etapa, (areas[etapa] ?? areas.todas ?? []).flatMap((area) => melhor(area, etapa) ?? [])]))];
    }),
  ) as Record<Objetivo, Record<Stage, PassoDoGuia[]>>;
}

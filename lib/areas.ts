// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Os nomes e descrições de cada disciplina ficam nos dicionários (i18n/), um por idioma.

export const groups = [
  { id: "percursos", areas: ["alfabetizacao", "enem"] },
  {
    id: "linguagens",
    areas: ["portugues", "literatura", "ingles", "ingles-infantil", "espanhol", "frances", "chines", "artes", "desenho", "design", "musica", "danca", "teatro", "cinema", "educacao-fisica"],
  },
  {
    id: "ciencias",
    areas: ["matematica", "fisica", "quimica", "biologia", "astronomia", "informatica", "programacao", "redes-e-seguranca", "inteligencia-artificial", "manutencao", "primeiros-socorros"],
  },
  {
    id: "humanidades",
    areas: [
      "historia",
      "geografia",
      "sociologia",
      "antropologia",
      "filosofia",
      "economia",
      "politica",
      "direito",
      "psicologia",
      "servico-social",
      "teologia",
      "educacao-popular",
      "midia",
      "meio-ambiente",
      "arquitetura",
      "arquivologia",
    ],
  },
  { id: "teoria", areas: ["capitalismo", "marxismo", "socialismo", "comunismo", "ideologia-e-politica", "dependencia", "imperialismo", "ecossocialismo"] },
  {
    id: "lutas",
    areas: [
      "trabalho",
      "sindicalismo",
      "luta-negra",
      "feminismo",
      "lgbtqia",
      "deficiencia",
      "povos-indigenas",
      "luta-pela-terra",
      "favelas",
      "luta-dos-professores",
      "movimento-estudantil",
      "pessoas-idosas",
    ],
  },
  { id: "hobbies", areas: ["trancista", "costureira", "barbeiro", "oratoria-e-lideranca"] },
] as const;

export type GroupId = (typeof groups)[number]["id"];
export type AreaSlug = (typeof groups)[number]["areas"][number];

export const areaSlugs = groups.flatMap((group) => group.areas) as readonly AreaSlug[];

export const isArea = (value: string): value is AreaSlug => (areaSlugs as readonly string[]).includes(value);

/** O essencial: ler, escrever, contar, línguas e ciências. É o que aparece no filtro "Essencial" das disciplinas. */
export const essential: readonly AreaSlug[] = ["alfabetizacao", "portugues", "matematica", "ingles", "chines", "historia", "geografia", "fisica", "quimica", "biologia", "informatica", "enem"];

/**
 * As disciplinas de cada etapa, para o filtro: o que se estuda no ensino fundamental, no médio e no superior.
 * Uma disciplina pode estar em mais de uma etapa (português e matemática acompanham a vida escolar inteira).
 */
export const stageAreas: Record<"fundamental" | "medio" | "superior", readonly AreaSlug[]> = {
  fundamental: ["alfabetizacao", "portugues", "matematica", "ingles", "ingles-infantil", "espanhol", "artes", "desenho", "musica", "danca", "educacao-fisica", "historia", "geografia", "biologia", "informatica", "primeiros-socorros", "meio-ambiente"],
  medio: ["enem", "portugues", "literatura", "ingles", "espanhol", "frances", "chines", "artes", "teatro", "cinema", "educacao-fisica", "matematica", "fisica", "quimica", "biologia", "astronomia", "informatica", "programacao", "historia", "geografia", "sociologia", "filosofia", "economia", "politica", "midia", "meio-ambiente", "trabalho", "primeiros-socorros"],
  superior: ["literatura", "design", "cinema", "matematica", "fisica", "quimica", "biologia", "astronomia", "programacao", "redes-e-seguranca", "inteligencia-artificial", "manutencao", "historia", "geografia", "sociologia", "antropologia", "filosofia", "economia", "politica", "direito", "psicologia", "servico-social", "teologia", "educacao-popular", "midia", "arquitetura", "arquivologia", "capitalismo", "marxismo", "socialismo", "comunismo", "ideologia-e-politica", "dependencia", "imperialismo", "ecossocialismo", "sindicalismo", "luta-negra", "feminismo", "lgbtqia", "deficiencia", "povos-indigenas", "luta-pela-terra", "favelas", "luta-dos-professores", "movimento-estudantil", "pessoas-idosas"],
};

/** Etapas do currículo comum, usadas para organizar as trilhas dentro de cada disciplina. */
export const stages = ["fundamental", "medio", "superior"] as const;
export type Stage = (typeof stages)[number];

export const licenses = [
  "Domínio público",
  "CC BY",
  "CC BY-SA",
  "CC BY-NC",
  "CC BY-NC-SA",
  "CC BY-NC-ND",
  // Para acervos em que a licença muda de texto para texto.
  "Conforme a fonte",
  // Obra protegida: a ficha é só uma referência e o link leva à editora ou a uma biblioteca.
  "Direitos reservados",
] as const;

export type License = (typeof licenses)[number];

/** Ferramentas de prática ligadas a cada disciplina (rotas em /ferramentas). */
export const areaTools: Partial<Record<AreaSlug, string[]>> = {
  programacao: ["python", "php"],
  informatica: ["bases-numericas"],
  "inteligencia-artificial": ["python"],
  musica: ["afinador", "metronomo", "teclado", "leitura-de-notas"],
  quimica: ["tabela-periodica"],
  matematica: ["calculadora"],
  fisica: ["calculadora"],
  economia: ["juros-compostos"],
  ingles: ["pronuncia"],
  espanhol: ["pronuncia"],
  chines: ["pronuncia"],
};

export const tools = [
  "python",
  "php",
  "afinador",
  "metronomo",
  "teclado",
  "leitura-de-notas",
  "tabela-periodica",
  "calculadora",
  "juros-compostos",
  "bases-numericas",
  "pronuncia",
  "dicionario",
  "frases",
  "graficos",
] as const;
export type ToolId = (typeof tools)[number];

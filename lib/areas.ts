// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Os nomes e descrições de cada disciplina ficam nos dicionários (i18n/), um por idioma.

export const groups = [
  { id: "percursos", areas: ["alfabetizacao", "enem"] },
  {
    id: "linguagens",
    areas: ["portugues", "literatura", "ingles", "ingles-infantil", "espanhol", "frances", "chines", "russo", "artes", "desenho", "design", "musica", "danca", "teatro", "cinema", "educacao-fisica"],
  },
  {
    id: "ciencias",
    areas: ["matematica", "fisica", "quimica", "biologia", "astronomia", "primeiros-socorros"],
  },
  {
    id: "tecnologia",
    areas: ["informatica", "programacao", "engenharia-de-sistemas", "redes-e-seguranca", "inteligencia-artificial", "manutencao", "edicao-de-video"],
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
      "direito",
      "psicologia",
      "neurodiversidade",
      "servico-social",
      "teologia",
      "educacao-popular",
      "midia",
      "meio-ambiente",
      "arquitetura",
      "arquivologia",
    ],
  },
  // A teoria começa pela política básica (política e cidadania, o Estado, as instituições, o voto) e só então chega ao capitalismo e às correntes.
  { id: "teoria", areas: ["politica", "estado", "instituicoes", "eleicoes", "capitalismo", "marxismo", "socialismo", "comunismo", "ideologia-e-politica", "dependencia", "imperialismo", "ecossocialismo"] },
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
  { id: "oficios", areas: ["trancista", "costureira", "barbeiro", "oratoria-e-lideranca"] },
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
  medio: ["enem", "portugues", "literatura", "ingles", "espanhol", "frances", "chines", "russo", "artes", "teatro", "cinema", "educacao-fisica", "matematica", "fisica", "quimica", "biologia", "astronomia", "informatica", "programacao", "historia", "geografia", "sociologia", "filosofia", "economia", "politica", "estado", "instituicoes", "eleicoes", "neurodiversidade", "costureira", "midia", "meio-ambiente", "trabalho", "primeiros-socorros"],
  superior: ["literatura", "design", "cinema", "matematica", "fisica", "quimica", "biologia", "astronomia", "programacao", "engenharia-de-sistemas", "redes-e-seguranca", "inteligencia-artificial", "manutencao", "historia", "geografia", "sociologia", "antropologia", "filosofia", "economia", "politica", "direito", "psicologia", "neurodiversidade", "servico-social", "teologia", "educacao-popular", "midia", "arquitetura", "arquivologia", "capitalismo", "marxismo", "socialismo", "comunismo", "ideologia-e-politica", "dependencia", "imperialismo", "ecossocialismo", "sindicalismo", "luta-negra", "feminismo", "lgbtqia", "deficiencia", "povos-indigenas", "luta-pela-terra", "favelas", "luta-dos-professores", "movimento-estudantil", "pessoas-idosas"],
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

/**
 * Ferramentas de prática ligadas a cada disciplina (rotas em /ferramentas). Aparecem na estante da disciplina e na caixa
 * de ferramentas das aulas dela, junto com as universais. Disciplina sem ferramenta própria fica só com as universais.
 */
export const areaTools: Partial<Record<AreaSlug, string[]>> = {
  alfabetizacao: ["silabario"],
  enem: ["redacao", "cronometro", "resolvedor", "estatistica"],
  portugues: ["redacao"],
  literatura: ["redacao"],
  ingles: ["pronuncia", "frases"],
  espanhol: ["pronuncia", "frases"],
  chines: ["pronuncia"],
  artes: ["cores"],
  desenho: ["cores"],
  design: ["cores", "html"],
  musica: ["afinador", "metronomo", "teclado", "leitura-de-notas"],
  danca: ["metronomo"],
  "educacao-fisica": ["frequencia-cardiaca"],
  matematica: ["resolvedor", "graficos", "estatistica", "tabela-verdade", "conversor-de-unidades"],
  fisica: ["graficos", "conversor-de-unidades", "resolvedor", "sistema-solar"],
  quimica: ["tabela-periodica", "massa-molar", "balanceamento", "conversor-de-unidades"],
  biologia: ["punnett", "estatistica", "conversor-de-unidades"],
  astronomia: ["sistema-solar", "conversor-de-unidades"],
  informatica: ["bases-numericas", "html", "tabela-verdade"],
  programacao: ["python", "php", "html", "bases-numericas", "tabela-verdade"],
  "inteligencia-artificial": ["python", "estatistica", "tabela-verdade"],
  manutencao: ["bases-numericas", "conversor-de-unidades"],
  "primeiros-socorros": ["rcp", "frequencia-cardiaca"],
  geografia: ["escala-cartografica", "fusos-horarios", "estatistica", "conversor-de-unidades"],
  sociologia: ["estatistica"],
  filosofia: ["tabela-verdade"],
  economia: ["juros-compostos", "mais-valia", "estatistica", "resolvedor"],
  politica: ["estatistica"],
  estado: ["estatistica"],
  instituicoes: ["estatistica"],
  eleicoes: ["estatistica"],
  "engenharia-de-sistemas": ["python", "bases-numericas", "tabela-verdade", "conversor-de-unidades"],
  neurodiversidade: ["estatistica"],
  psicologia: ["estatistica"],
  "servico-social": ["estatistica"],
  "educacao-popular": ["silabario"],
  midia: ["cores", "html"],
  "meio-ambiente": ["conversor-de-unidades", "estatistica"],
  arquitetura: ["escala-cartografica", "conversor-de-unidades", "cores"],
  capitalismo: ["mais-valia", "juros-compostos"],
  marxismo: ["mais-valia"],
  socialismo: ["mais-valia"],
  comunismo: ["mais-valia"],
  dependencia: ["estatistica"],
  ecossocialismo: ["conversor-de-unidades"],
  trabalho: ["mais-valia", "juros-compostos"],
  sindicalismo: ["mais-valia"],
  frances: ["pronuncia"],
  russo: ["pronuncia"],
};

/** Ferramentas que servem a qualquer aula: ficam sempre na caixa de ferramentas. */
export const universalTools = ["calculadora", "cronometro", "dicionario"] as const;

export const tools = [
  "resolvedor",
  "calculadora",
  "graficos",
  "estatistica",
  "conversor-de-unidades",
  "tabela-verdade",
  "tabela-periodica",
  "massa-molar",
  "balanceamento",
  "punnett",
  "sistema-solar",
  "python",
  "php",
  "html",
  "bases-numericas",
  "cronometro",
  "redacao",
  "silabario",
  "dicionario",
  "pronuncia",
  "frases",
  "afinador",
  "metronomo",
  "teclado",
  "leitura-de-notas",
  "cores",
  "escala-cartografica",
  "fusos-horarios",
  "juros-compostos",
  "mais-valia",
  "rcp",
  "frequencia-cardiaca",
] as const;
export type ToolId = (typeof tools)[number];

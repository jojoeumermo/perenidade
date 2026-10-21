// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Os nomes e descrições de cada disciplina ficam nos dicionários (i18n/), um por idioma.

export const groups = [
  { id: "percursos", areas: ["alfabetizacao", "enem"] },
  {
    id: "linguagens",
    areas: ["portugues", "literatura", "ingles", "ingles-infantil", "espanhol", "frances", "chines", "russo", "artes", "desenho", "design", "musica", "samba-e-cultura", "danca", "teatro", "cinema", "educacao-fisica"],
  },
  {
    id: "ciencias",
    areas: ["matematica", "fisica", "quimica", "biologia", "astronomia", "primeiros-socorros", "educacao-sexual"],
  },
  {
    id: "tecnologia",
    areas: ["informatica", "programacao", "engenharia-de-sistemas", "redes-e-seguranca", "inteligencia-artificial", "manutencao", "edicao-de-video", "edicao-de-foto", "modelagem-3d"],
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
  { id: "oficios", areas: ["trancista", "costureira", "barbeiro", "eletricista", "oratoria-e-lideranca"] },
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
  fundamental: ["alfabetizacao", "samba-e-cultura", "eletricista", "portugues", "matematica", "ingles", "ingles-infantil", "espanhol", "artes", "desenho", "musica", "danca", "educacao-fisica", "historia", "geografia", "biologia", "informatica", "primeiros-socorros", "educacao-sexual", "meio-ambiente"],
  medio: ["enem", "samba-e-cultura", "eletricista", "portugues", "literatura", "ingles", "espanhol", "frances", "chines", "russo", "artes", "teatro", "cinema", "educacao-fisica", "matematica", "fisica", "quimica", "biologia", "astronomia", "informatica", "programacao", "historia", "geografia", "sociologia", "filosofia", "economia", "politica", "estado", "instituicoes", "eleicoes", "neurodiversidade", "costureira", "midia", "meio-ambiente", "trabalho", "primeiros-socorros", "educacao-sexual", "edicao-de-foto", "modelagem-3d"],
  superior: ["literatura", "design", "cinema", "matematica", "fisica", "quimica", "biologia", "astronomia", "programacao", "engenharia-de-sistemas", "redes-e-seguranca", "inteligencia-artificial", "manutencao", "historia", "geografia", "sociologia", "antropologia", "filosofia", "economia", "politica", "direito", "psicologia", "neurodiversidade", "servico-social", "teologia", "educacao-popular", "midia", "arquitetura", "arquivologia", "capitalismo", "marxismo", "socialismo", "comunismo", "ideologia-e-politica", "dependencia", "imperialismo", "ecossocialismo", "sindicalismo", "luta-negra", "feminismo", "lgbtqia", "deficiencia", "povos-indigenas", "luta-pela-terra", "favelas", "luta-dos-professores", "movimento-estudantil", "pessoas-idosas", "edicao-de-foto", "modelagem-3d"],
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
  matematica: ["resolvedor", "graficos", "simulacoes", "estatistica", "tabela-verdade", "conversor-de-unidades"],
  fisica: ["simulacoes", "fisica-simulada", "graficos", "conversor-de-unidades", "resolvedor", "sistema-solar"],
  quimica: ["simulacoes", "reacoes", "tabela-periodica", "massa-molar", "balanceamento", "conversor-de-unidades"],
  biologia: ["simulacoes", "punnett", "estatistica", "conversor-de-unidades"],
  astronomia: ["simulacoes", "sistema-solar", "conversor-de-unidades"],
  informatica: ["ide", "bases-numericas", "html", "tabela-verdade"],
  programacao: ["ide", "python", "php", "html", "bases-numericas", "tabela-verdade"],
  "inteligencia-artificial": ["ide", "python", "estatistica", "tabela-verdade"],
  manutencao: ["bases-numericas", "conversor-de-unidades"],
  eletricista: ["conversor-de-unidades", "resolvedor"],
  "samba-e-cultura": ["metronomo", "teclado"],
  "primeiros-socorros": ["rcp", "frequencia-cardiaca"],
  geografia: ["escala-cartografica", "fusos-horarios", "estatistica", "conversor-de-unidades"],
  sociologia: ["estatistica"],
  filosofia: ["tabela-verdade"],
  economia: ["juros-compostos", "mais-valia", "estatistica", "resolvedor"],
  politica: ["estatistica"],
  estado: ["estatistica"],
  instituicoes: ["estatistica"],
  eleicoes: ["estatistica"],
  "engenharia-de-sistemas": ["ide", "python", "bases-numericas", "tabela-verdade", "conversor-de-unidades"],
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

/** Os laboratórios do site (páginas inteiras) que também abrem dentro da caixa das aulas, ao lado do texto. */
export const LABS = {
  ide: "/laboratorios/ide",
  linux: "/laboratorios/linux",
  redes: "/laboratorios/redes",
  seguranca: "/laboratorios/seguranca",
  montador: "/laboratorios/montador",
  ia: "/laboratorios/ia",
  escritorio: "/laboratorios/escritorio",
  simulacoes: "/laboratorios/simulacoes",
  eletrica: "/laboratorios/eletrica",
  modelos: "/laboratorios/modelos",
} as const;
export type LabId = keyof typeof LABS;

/** Que laboratórios cada disciplina tem à mão na caixa das aulas. Disciplina fora da lista: nenhum. */
export const areaLabs: Partial<Record<AreaSlug, LabId[]>> = {
  informatica: ["ide", "linux", "escritorio", "montador"],
  programacao: ["ide", "linux"],
  "engenharia-de-sistemas": ["ide", "linux", "redes"],
  "redes-e-seguranca": ["redes", "seguranca", "linux"],
  "inteligencia-artificial": ["ia", "ide"],
  manutencao: ["montador", "eletrica"],
  eletricista: ["eletrica"],
  fisica: ["eletrica", "modelos"],
  matematica: ["modelos"],
  biologia: ["modelos"],
  astronomia: ["modelos"],
  // As simulações do PhET já estão na caixa como ferramenta nas ciências; aqui só onde não estão.
  enem: ["simulacoes", "escritorio"],
  portugues: ["escritorio"],
  literatura: ["escritorio"],
  design: ["escritorio"],
  midia: ["escritorio"],
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
  "ide",
  "simulacoes",
  "fisica-simulada",
  "reacoes",
] as const;
export type ToolId = (typeof tools)[number];

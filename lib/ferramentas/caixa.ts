// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { tools, type AreaSlug, type ToolId } from "../areas";

/**
 * A caixa de ferramentas da aula, disciplina por disciplina: o que abre ao lado do texto nas aulas, trilhas e estantes
 * de cada uma. A ordem conta: a primeira é a que a caixa mostra ao abrir.
 *
 * Cada disciplina tem só o que serve a ela. Trancista não ganha calculadora científica; Inteligência Artificial abre
 * no Python, e tabela-verdade ou estatística só aparecem quando a própria aula pede (o campo `tools` da aula, que
 * sempre entra primeiro, com estrela). O mapa cobre todas as disciplinas (o tipo obriga): disciplina nova só compila
 * quando entra aqui.
 *
 * Os "kits" de base, para as disciplinas sem nada mais específico:
 * - CONTAS (exatas, ENEM, técnicas): calculadora científica e cronômetro de estudo;
 * - LEITURA (humanidades, teoria, lutas, línguas): dicionário e cronômetro de estudo;
 * - OFICIO (ofícios de mão): cronômetro (o tempo do serviço) e as contas do dia a dia (preço e orçamento).
 *
 * As listas de lib/areas.ts (areaTools) continuam valendo para as páginas de /ferramentas, que mostram em que
 * disciplinas cada ferramenta aparece.
 */
const CONTAS = ["calculadora", "cronometro"] as const satisfies readonly ToolId[];
const LEITURA = ["dicionario", "cronometro"] as const satisfies readonly ToolId[];
const OFICIO = ["cronometro", "contas-do-dia-a-dia"] as const satisfies readonly ToolId[];

export const caixaPorDisciplina: Record<AreaSlug, readonly ToolId[]> = {
  // ── Percursos ──
  alfabetizacao: ["silabario", "palavras-geradoras", "contas-do-dia-a-dia", "dicionario"],
  enem: ["redacao", "cronometro", "resolvedor", "estatistica", "corretor-ortografico", "calculadora", "dicionario"],

  // ── Teoria ──
  "formacao-militante": ["mais-valia", "direitos-trabalhistas", ...LEITURA],
  politica: ["estatistica", ...LEITURA],
  "ciencia-politica": ["estatistica", "referencias-abnt", ...LEITURA],
  estado: ["estatistica", ...LEITURA],
  instituicoes: ["estatistica", ...LEITURA],
  eleicoes: ["estatistica", ...LEITURA],
  capitalismo: ["mais-valia", "juros-compostos", ...LEITURA],
  marxismo: ["mais-valia", ...LEITURA],
  socialismo: ["mais-valia", ...LEITURA],
  comunismo: ["mais-valia", ...LEITURA],
  "ideologia-e-politica": [...LEITURA],
  dependencia: ["estatistica", ...LEITURA],
  imperialismo: ["estatistica", ...LEITURA],
  ecossocialismo: ["conversor-de-unidades", "estatistica", ...LEITURA],

  // ── Linguagens ──
  portugues: ["redacao", "corretor-ortografico", "referencias-abnt", ...LEITURA],
  literatura: ["redacao", "corretor-ortografico", "referencias-abnt", ...LEITURA],
  ingles: ["pronuncia", "frases", ...LEITURA],
  "ingles-infantil": ["pronuncia", "frases", "dicionario"],
  espanhol: ["pronuncia", "frases", ...LEITURA],
  frances: ["frases", "pronuncia", ...LEITURA],
  chines: ["pronuncia", "tons-do-mandarim", "dicionario-chines", "escrita-chinesa", "cronometro"],
  russo: ["pronuncia", "alfabetos", ...LEITURA],
  alemao: ["pronuncia", "frases", ...LEITURA],
  artes: ["cores", ...LEITURA],
  desenho: ["cores", "solidos", "cronometro"],
  design: ["cores", "html", "cronometro"],
  musica: ["afinador", "metronomo", "teclado", "leitura-de-notas", "cronometro"],
  "samba-e-cultura": ["metronomo", "teclado", "afinador", ...LEITURA],
  danca: ["metronomo", "frequencia-cardiaca", "cronometro"],
  teatro: [...LEITURA],
  cinema: ["cores", ...LEITURA],
  "educacao-fisica": ["frequencia-cardiaca", "cronometro"],
  "defesa-pessoal": ["cronometro", "frequencia-cardiaca"],

  // ── Ciências ──
  matematica: ["resolvedor", "graficos", "simulacoes", "estatistica", "tabela-verdade", "conversor-de-unidades", "solidos", "contas-do-dia-a-dia", "sudoku", ...CONTAS],
  fisica: ["simulacoes", "fisica-simulada", "graficos", "conversor-de-unidades", "resolvedor", "sistema-solar", ...CONTAS],
  quimica: ["simulacoes", "reacoes", "tabela-periodica", "massa-molar", "balanceamento", "conversor-de-unidades", ...CONTAS],
  biologia: ["simulacoes", "punnett", "estatistica", "conversor-de-unidades", ...CONTAS, "dicionario"],
  astronomia: ["simulacoes", "sistema-solar", "conversor-de-unidades", "ceu", ...CONTAS],
  "primeiros-socorros": ["rcp", "frequencia-cardiaca", "cronometro"],
  "educacao-sexual": [...LEITURA],

  // ── Tecnologia ──
  informatica: ["ide", "bases-numericas", "html", "tabela-verdade", "algoritmos", "criptografia", "cronometro"],
  programacao: ["ide", "python", "php", "html", "bases-numericas", "tabela-verdade", "algoritmos", "grafos", "cronometro"],
  "engenharia-de-sistemas": ["ide", "python", "bases-numericas", "tabela-verdade", "conversor-de-unidades", "algoritmos", "grafos", ...CONTAS],
  "redes-e-seguranca": ["criptografia", "bases-numericas", "grafos", "cronometro"],
  // Python (onde se treina e se roda o modelo), a IDE e os grafos (busca em largura, em profundidade e menor caminho,
  // a base da busca em IA). O laboratório de IA entra pela lista de laboratórios (areaLabs).
  "inteligencia-artificial": ["python", "ide", "grafos", "cronometro"],
  manutencao: ["bases-numericas", "conversor-de-unidades", "calculadoras-de-eletronica", ...CONTAS],
  "web-design": ["html", "cores", "cronometro"],
  fotografia: ["cores", "ceu", "cronometro"],
  "edicao-de-video": ["cores", "cronometro"],
  "edicao-de-foto": ["cores", "cronometro"],
  "modelagem-3d": ["solidos", "conversor-de-unidades", "cores", "cronometro"],

  // ── Humanidades ──
  historia: ["referencias-abnt", ...LEITURA],
  geografia: ["escala-cartografica", "fusos-horarios", "estatistica", "conversor-de-unidades", "ceu", ...CONTAS],
  "ciencias-sociais": ["estatistica", "referencias-abnt", ...LEITURA],
  sociologia: ["estatistica", "referencias-abnt", ...LEITURA],
  antropologia: ["referencias-abnt", ...LEITURA],
  filosofia: ["tabela-verdade", "referencias-abnt", ...LEITURA],
  economia: ["juros-compostos", "mais-valia", "estatistica", "resolvedor", "contas-do-dia-a-dia", ...CONTAS],
  direito: ["direitos-trabalhistas", "referencias-abnt", ...LEITURA],
  psicologia: ["estatistica", "referencias-abnt", ...LEITURA],
  neurodiversidade: ["cronometro", "estatistica", "dicionario"],
  "servico-social": ["direitos-trabalhistas", "contas-do-dia-a-dia", "estatistica", ...LEITURA],
  teologia: ["referencias-abnt", ...LEITURA],
  "educacao-popular": ["silabario", "palavras-geradoras", ...LEITURA],
  midia: ["cores", "html", "corretor-ortografico", "cronometro"],
  "meio-ambiente": ["conversor-de-unidades", "estatistica", ...CONTAS],
  arquitetura: ["escala-cartografica", "conversor-de-unidades", "cores", "solidos", ...CONTAS],
  arquivologia: ["referencias-abnt", ...LEITURA],

  // ── Lutas ──
  trabalho: ["direitos-trabalhistas", "mais-valia", "juros-compostos", "contas-do-dia-a-dia", "quanto-cobrar", "gerador-de-curriculo", "orcamento-e-contrato", "dividas-e-renegociacao", "modelos-de-documentos", ...LEITURA],
  sindicalismo: ["direitos-trabalhistas", "mais-valia", ...LEITURA],
  "luta-negra": ["estatistica", ...LEITURA],
  feminismo: ["estatistica", ...LEITURA],
  lgbtqia: [...LEITURA],
  deficiencia: [...LEITURA],
  "povos-indigenas": [...LEITURA],
  // Hectare, alqueire e metro quadrado; o mapa da terra em escala.
  "luta-pela-terra": ["conversor-de-unidades", "escala-cartografica", ...LEITURA],
  favelas: ["estatistica", ...LEITURA],
  "luta-dos-professores": ["direitos-trabalhistas", ...LEITURA],
  "movimento-estudantil": ["redacao", ...LEITURA],
  "pessoas-idosas": ["contas-do-dia-a-dia", ...LEITURA],

  // ── Ofícios ──
  trancista: [...OFICIO],
  // Medidas em centímetro e polegada.
  costureira: ["conversor-de-unidades", ...OFICIO],
  barbeiro: [...OFICIO],
  eletricista: ["calculadoras-de-eletronica", "conversor-de-unidades", "resolvedor", ...CONTAS],
  // O cronômetro marca o tempo da fala.
  "oratoria-e-lideranca": ["cronometro", "dicionario"],
};

/** O padrão para o que não estiver no mapa (não deve acontecer: o tipo cobre todas as disciplinas). */
export const caixaPadrao: readonly ToolId[] = LEITURA;

/**
 * As ferramentas da caixa: primeiro as que a aula sugere (campo `tools`), depois as da disciplina, sem repetir e só
 * as que existem no site.
 */
export function ferramentasDaCaixa(area: AreaSlug | string, sugeridas: readonly string[] = []): ToolId[] {
  const daDisciplina = (caixaPorDisciplina as Record<string, readonly ToolId[] | undefined>)[area] ?? caixaPadrao;
  return [...new Set([...sugeridas, ...daDisciplina])].filter((id): id is ToolId => (tools as readonly string[]).includes(id));
}

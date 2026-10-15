// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ToolId } from "../areas";

/**
 * Que pedaço dos textos (objeto "tools" dos dicionários) cada ferramenta usa. A página da aula manda para o navegador só
 * os textos das ferramentas daquela disciplina, para ninguém baixar o que não vai abrir.
 */
export const secaoDaFerramenta = {
  resolvedor: "solver",
  calculadora: "calc",
  graficos: "graphs",
  estatistica: "stats",
  "conversor-de-unidades": "units",
  "tabela-verdade": "truth",
  "tabela-periodica": "table",
  "massa-molar": "molar",
  balanceamento: "balance",
  punnett: "punnett",
  "sistema-solar": "solar",
  python: "code",
  php: "code",
  html: "html",
  "bases-numericas": "bases",
  cronometro: "timer",
  redacao: "essay",
  silabario: "syllables",
  dicionario: "dictionary",
  pronuncia: "speak",
  frases: "sentences",
  afinador: "music",
  metronomo: "music",
  teclado: "music",
  "leitura-de-notas": "music",
  cores: "colors",
  "escala-cartografica": "mapScale",
  "fusos-horarios": "timezones",
  "juros-compostos": "interest",
  "mais-valia": "surplus",
  rcp: "cpr",
  "frequencia-cardiaca": "heart",
} as const satisfies Record<ToolId, string>;

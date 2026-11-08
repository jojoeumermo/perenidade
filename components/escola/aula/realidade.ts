// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os blocos do modelo de 9 partes (lib/modelo-de-aula.ts) que a aula da Escola usa fora do lugar de costume: a pergunta
// de "Na sua realidade" (```suarealidade), que sobe para a caixa escura do alto, e o argumento de "O outro lado"
// (```outrolado), que vira a posição de quem o assistente interpreta no treino de conversa. Funções puras, sem "@/" (o
// teste scripts/testar-escola-cadernos.mjs roda este arquivo no Node).

import { partesDoOutroLado } from "../../../lib/modelo-de-aula";

const REALIDADE = /^```suarealidade[ \t]*\n([\s\S]*?)\n```[ \t]*$/m;
const OUTRO_LADO = /^```outrolado[ \t]*\n([\s\S]*?)\n```[ \t]*$/m;

/** A pergunta do bloco ```suarealidade (com o "# título" opcional da primeira linha virando o primeiro parágrafo), ou nula. */
export function perguntaDaRealidade(corpo: string): string | null {
  const achado = REALIDADE.exec(corpo);
  if (!achado) return null;
  const linhas = achado[1].split("\n");
  const titulo = /^#\s+(.+)$/.exec(linhas[0]?.trim() ?? "")?.[1];
  const resto = (titulo ? linhas.slice(1) : linhas).join("\n").trim();
  return [titulo, resto].filter(Boolean).join("\n\n") || null;
}

/** O texto da aula sem o bloco ```suarealidade (ele já está na caixa do alto). */
export const semARealidade = (corpo: string) => corpo.replace(REALIDADE, "");

/** O argumento do bloco ```outrolado, sem o "# título" da primeira linha, ou nulo. */
export function argumentoDoOutroLado(corpo: string): string | null {
  const achado = OUTRO_LADO.exec(corpo);
  if (!achado) return null;
  const { argumento } = partesDoOutroLado(achado[1]);
  return argumento.replace(/^#\s+.+(\n|$)/, "").trim() || null;
}

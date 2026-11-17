// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras da FÓRMULA no texto formatado da Alumia (onda 11, frente 11A). Quem desenha é o KaTeX (a biblioteca que o site já usa
// nas aulas, components/Markdown.tsx), no aparelho de quem lê. As opções abaixo são a trava contra código escondido em fórmula:
//   - trust: false   nenhum comando que gera link, classe, id, estilo ou dado de HTML (\href, \url, \includegraphics,
//                    \htmlClass, \htmlId, \htmlStyle, \htmlData) vira HTML: aparece como erro em vermelho, em texto;
//   - maxExpand      teto de expansão de macros (uma fórmula com \def que se repete não trava o aparelho de quem lê);
//   - maxSize        teto do tamanho de caixas e espaços (ninguém cobre a tela com uma fórmula gigante);
//   - throwOnError: false  fórmula com erro aparece como o texto dela, sem quebrar o post.
// Sem "@/": roda no Node dos testes.

/** A maior fórmula aceita (o resto aparece como texto em letra fixa). */
export const MAXIMO_DA_FORMULA = 1000;

export const OPCOES_DO_KATEX = {
  trust: false,
  strict: "ignore",
  throwOnError: false,
  maxExpand: 200,
  maxSize: 8,
  output: "htmlAndMathml",
} as const;

/** A fórmula pode ir para o KaTeX? (Tamanho dentro do teto e sem caractere de controle.) */
export function formulaCabe(expressao: string): boolean {
  return expressao.trim().length > 0 && expressao.length <= MAXIMO_DA_FORMULA && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(expressao);
}

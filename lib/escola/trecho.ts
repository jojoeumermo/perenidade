// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O trecho de uma aula da Escola citada numa aula do site (P5, B2; components/escola/aulas/TrechoDaEscola.tsx). Puro, sem "@/":
// `npm run testar:escola-aulas-abertas` roda direto no Node.

/** Os primeiros parágrafos do texto puro da aula (/texto: título, trilha, resumo e corpo), sem marcação de Markdown. */
export function trechoDoTexto(texto: string, maximo = 900): { titulo: string; paragrafos: string[] } {
  const [titulo = "", , , ...resto] = texto.replace(/\r\n/g, "\n").split("\n");
  const blocos = resto
    .join("\n")
    // As cercas dos blocos especiais da aula (```provocacao, ```suarealidade…) saem; o texto de dentro fica.
    .replace(/^```[a-z0-9-]*[ \t]*$/gm, "")
    .split(/\n{2,}/)
    .map((b) => b.replace(/^#{1,6}\s+/gm, "").replace(/[*_`>]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim())
    .filter((b) => b && b !== "---");
  const paragrafos: string[] = [];
  let soma = 0;
  for (const b of blocos) {
    if (soma >= maximo) break;
    paragrafos.push(soma + b.length > maximo + 200 ? `${b.slice(0, Math.max(120, maximo - soma)).replace(/\s+\S*$/, "")}…` : b);
    soma += b.length;
  }
  return { titulo: titulo.trim(), paragrafos };
}

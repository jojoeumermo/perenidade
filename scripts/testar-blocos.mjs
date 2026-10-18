// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o editor por blocos: cortar o Markdown em blocos e juntar de novo não pode mudar a aula.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { comMarcas, miolo, partir, textoPuro, tipoDe } from "../lib/blocos.ts";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

const exemplo = [
  "## Título", "", "Um parágrafo com **negrito**.", "Segunda linha do mesmo parágrafo.", "",
  "### Sub", "", "- um", "- dois", "", "1. primeiro", "2. segundo", "", "> citação", "> continua", "",
  "![Mapa](/arquivos/abc12345.webp \"IBGE, domínio público\")", "", "```video", "https://www.youtube.com/watch?v=x", "Legenda", "```", "",
  "$$", "E = mc^2", "$$", "", "```verificar", "Pergunta?", "+ certa", "- errada", "> dica", "```", "",
  "```python", "print(1)", "", "print(2)", "```", "", "[📎 Lista de exercícios](/arquivos/abcdef1234.pdf)", "",
  "| a | b |", "| --- | --- |", "| 1 | 2 |", "", "```conta", "2 + 2", "= 4", "```",
].join("\n");
const blocos = partir(exemplo);
const tipos = blocos.map(tipoDe);
const esperado = ["titulo", "paragrafo", "subtitulo", "lista", "numerada", "citacao", "imagem", "video", "formula", "questao", "codigo", "anexo", "tabela", "conta"];
conferir("tipos reconhecidos", JSON.stringify(tipos) === JSON.stringify(esperado), JSON.stringify(tipos));
conferir("código com linha em branco fica num bloco só", blocos[10].includes("print(1)\n\nprint(2)"));
conferir("juntar devolve o mesmo texto", blocos.join("\n\n") === exemplo);
conferir("miolo do vídeo", miolo(blocos[7]) === "https://www.youtube.com/watch?v=x\nLegenda");
conferir("miolo da fórmula", miolo(blocos[8]) === "E = mc^2");
conferir("lista vira numerada sem perder texto", comMarcas("numerada", textoPuro("- um\n- dois")) === "1. um\n2. dois");
conferir("título vira parágrafo", comMarcas("paragrafo", textoPuro("## Olá")) === "Olá");
conferir("cerca sem fechar não engole o resto em erro", partir("```python\nprint(1)").length === 1);
conferir("lista aninhada fica intocada", tipoDe("- a\n  - b") === "bruto");
conferir("pauta musical fica intocada", tipoDe("```pauta\nC D E\n```") === "bruto");
conferir("CRLF", partir("a\r\n\r\nb").length === 2);

// Toda aula do acervo: partir e juntar (com as linhas em branco normalizadas) preserva o conteúdo.
const raiz = path.join(process.cwd(), "content", "trilhas");
let aulas = 0;
for (const trilha of readdirSync(raiz, { withFileTypes: true })) {
  if (!trilha.isDirectory()) continue;
  for (const arq of readdirSync(path.join(raiz, trilha.name))) {
    if (!arq.endsWith(".md") || arq.startsWith("_")) continue;
    const texto = readFileSync(path.join(raiz, trilha.name, arq), "utf8").replace(/\r\n?/g, "\n");
    const corpo = texto.replace(/^---\n[\s\S]*?\n---\n/, "");
    const semBrancos = (t) => t.split("\n").filter((l) => l.trim() !== "").join("\n");
    const volta = partir(corpo).join("\n\n");
    aulas++;
    if (semBrancos(volta) !== semBrancos(corpo)) falhas.push(`a aula ${trilha.name}/${arq} muda ao passar pelos blocos`);
  }
}
conferir(`${aulas} aulas lidas`, aulas > 100);

for (const f of falhas.slice(0, 20)) console.log(`  ✗ ${f}`);
console.log(`blocos: ${ok} conferências certas, ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);

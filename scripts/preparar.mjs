// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
//
// Copia para public/ os interpretadores de Python e PHP que rodam no navegador (ferramentas de prática).
// Eles vêm das dependências instaladas e não entram no repositório. Roda sozinho depois de "npm install".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PHP = "8.3";

function copiar(origem, destino, arquivos) {
  const de = path.join(raiz, "node_modules", origem);
  const para = path.join(raiz, "public", destino);
  if (!fs.existsSync(de)) return console.warn(`[preparar] ${origem} não está instalado; a ferramenta correspondente fica indisponível.`);
  fs.mkdirSync(para, { recursive: true });
  for (const arquivo of arquivos) {
    const alvo = path.join(para, arquivo);
    if (!fs.existsSync(alvo) || fs.statSync(alvo).size !== fs.statSync(path.join(de, arquivo)).size) fs.copyFileSync(path.join(de, arquivo), alvo);
  }
}

copiar("pyodide", "pyodide", ["pyodide.js", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"].filter((arquivo) => fs.existsSync(path.join(raiz, "node_modules/pyodide", arquivo))));

const php = path.join(raiz, "node_modules/php-wasm");
if (fs.existsSync(php)) {
  const binario = `php${PHP}-web.mjs`;
  const wasm = [...new Set(fs.readFileSync(path.join(php, binario), "utf8").match(/[0-9a-f]{40}\.wasm/g) ?? [])];
  copiar("php-wasm", "php", ["PhpWeb.mjs", "PhpWebBase.mjs", "PhpBase.mjs", "OutputBuffer.mjs", "_Event.mjs", "fsOps.mjs", "resolveDependencies.mjs", "webTransactions.mjs", binario, ...wasm]);
}

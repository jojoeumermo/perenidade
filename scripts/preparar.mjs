// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Copia para public/ os interpretadores que rodam no navegador na IDE (Python, PHP, TypeScript, Lua, Ruby e C/C++).
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

// TypeScript: o compilador e as bibliotecas de tipos da linguagem (lib.*.d.ts), lidas sob demanda pelo worker.
const ts = path.join(raiz, "node_modules/typescript/lib");
if (fs.existsSync(ts)) copiar("typescript/lib", "typescript", ["typescript.js", ...fs.readdirSync(ts).filter((f) => /^lib\.[\w.]+\.d\.ts$/.test(f) && !/^lib\.(dom|webworker|scripthost)/.test(f))]);

// Lua 5.4 (wasmoon) e Ruby 3.4 (ruby.wasm): o pacote para navegador e o WebAssembly.
copiar("wasmoon/dist", "lua", ["index.js", "glue.wasm"]);
copiar("@ruby/3.4-wasm-wasi/dist", "ruby", ["browser.umd.js", "ruby+stdlib.wasm", "LICENSE", "NOTICE"]);

// C e C++ (JSCPP): os módulos CommonJS do interpretador e das três dependências, carregados pelo worker.
const jscpp = path.join(raiz, "node_modules/JSCPP/lib");
if (fs.existsSync(jscpp)) {
  copiar("JSCPP/lib", "jscpp/lib", fs.readdirSync(jscpp).filter((f) => f.endsWith(".js")));
  copiar("JSCPP/lib/includes", "jscpp/lib/includes", fs.readdirSync(path.join(jscpp, "includes")).filter((f) => f.endsWith(".js")));
  copiar("JSCPP/lib/includes/shared", "jscpp/lib/includes/shared", fs.readdirSync(path.join(jscpp, "includes/shared")).filter((f) => f.endsWith(".js")));
  copiar("lodash", "jscpp", ["lodash.js"]);
  copiar("pegjs-util", "jscpp", ["PEGUtil.js"]);
  fs.copyFileSync(path.join(raiz, "node_modules/printf/lib/printf.js"), path.join(raiz, "public/jscpp/printf.js"));
}

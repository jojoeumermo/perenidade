// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Teste estático do pacote "confirms": o painel não pode mais usar confirm, prompt nem alert do navegador.
// Uso: npm run testar:painel-confirms
import fs from "node:fs";
import path from "node:path";

const raiz = process.cwd();
let falhas = 0;
let total = 0;
const confere = (ok, msg) => {
  total++;
  if (!ok) {
    falhas++;
    console.error("FALHA:", msg);
  }
};

function arquivos(pasta) {
  const lista = [];
  if (!fs.existsSync(pasta)) return lista;
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name);
    if (e.isDirectory()) lista.push(...arquivos(p));
    else if (/\.(tsx?|jsx?)$/.test(e.name)) lista.push(p);
  }
  return lista;
}

/** Tira comentários e textos entre aspas, para não confundir a explicação com o uso. */
function semComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const pastas = [path.join(raiz, "components", "painel"), path.join(raiz, "app", "[lang]", "painel")];
const todos = pastas.flatMap(arquivos);
confere(todos.length > 20, "poucos arquivos do painel encontrados (" + todos.length + ")");

// 1. Nenhuma chamada ao confirm, prompt ou alert do navegador.
const proibido = /(?:\bwindow\s*\.\s*|\bglobalThis\s*\.\s*|(?<![\w.$]))(confirm|prompt|alert)\s*\(/;
for (const arq of todos) {
  const limpo = semComentarios(fs.readFileSync(arq, "utf8"));
  limpo.split("\n").forEach((linha, i) => {
    const m = proibido.exec(linha);
    if (m) confere(false, `${path.relative(raiz, arq)}:${i + 1} usa ${m[1]}() do navegador`);
  });
}

// 2. Quem usa confirmarFrase, perguntarTexto, confirmar ou perguntar importa do lugar certo.
for (const arq of todos) {
  const src = fs.readFileSync(arq, "utf8");
  if (arq.endsWith(path.join("ui", "Dialogo.tsx")) || arq.endsWith(path.join("ui", "index.ts"))) continue;
  for (const nome of ["confirmarFrase", "perguntarTexto"]) {
    if (new RegExp(String.raw`\b${nome}\(`).test(src)) {
      confere(new RegExp(String.raw`import\s*\{[^}]*\b${nome}\b[^}]*\}\s*from\s*"[^"]*ui(?:/Dialogo)?"`).test(src), `${path.relative(raiz, arq)} usa ${nome} sem importar de ui`);
    }
  }
}

// 3. Todo await de confirmação está dentro de função async (o tsc também pega, mas aqui falha com mensagem clara).
for (const arq of todos) {
  const src = semComentarios(fs.readFileSync(arq, "utf8"));
  if (/await (confirmarFrase|perguntarTexto|confirmar|perguntar)\b/.test(src)) {
    confere(/\basync\b/.test(src), `${path.relative(raiz, arq)} usa await sem nenhuma função async`);
  }
}

// 4. As peças existem e estão exportadas.
const dialogo = fs.readFileSync(path.join(raiz, "components", "painel", "ui", "Dialogo.tsx"), "utf8");
const indice = fs.readFileSync(path.join(raiz, "components", "painel", "ui", "index.ts"), "utf8");
for (const nome of ["confirmar", "perguntar", "confirmarFrase", "perguntarTexto", "DialogosDoPainel"]) {
  confere(new RegExp(String.raw`export (async )?function ${nome}\b`).test(dialogo), `Dialogo.tsx não exporta ${nome}`);
  confere(new RegExp(String.raw`\b${nome}\b`).test(indice), `ui/index.ts não exporta ${nome}`);
}
const painel = fs.readFileSync(path.join(raiz, "components", "painel", "Painel.tsx"), "utf8");
confere(/<DialogosDoPainel\s*\/>/.test(painel), "Painel.tsx não monta <DialogosDoPainel />");

// 5. A palavra proibida não aparece nos textos novos.
confere(!/universidade|diploma/i.test(dialogo), "Dialogo.tsx tem palavra proibida");

console.log(falhas ? `\n${falhas} falha(s) em ${total} conferências.` : `testar:painel-confirms: ${total} conferências ok, 0 falhas.`);
process.exit(falhas ? 1 : 0);

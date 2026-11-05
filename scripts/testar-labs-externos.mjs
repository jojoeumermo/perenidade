// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o catálogo dos laboratórios externos (docs/LABS-EXTERNOS.md): campos, arquivos locais, licença e crédito à vista,
// hosts de fora liberados no CSP, nenhum quadro de rastreio e dados do gráfico do Our World in Data.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const raiz = process.cwd();
const lerJson = (...p) => JSON.parse(fs.readFileSync(path.join(raiz, ...p), "utf8"));
const catalogo = lerJson("content", "labs-externos", "catalogo.json");
const owid = lerJson("content", "labs-externos", "owid-expectativa-vida.json");
const config = fs.readFileSync(path.join(raiz, "next.config.ts"), "utf8");

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

const ids = new Set();
const FORMAS = ["local", "sob-demanda", "link"];
const AREAS = ["seguranca", "sistemas", "sociais", "simulacoes", "matematica", "musica"];
for (const l of catalogo) {
  ok(!ids.has(l.id), `id repetido: ${l.id}`);
  ids.add(l.id);
  ok(FORMAS.includes(l.forma), `${l.id}: forma inválida`);
  ok(l.areas.length > 0 && l.areas.every((a) => AREAS.includes(a)), `${l.id}: área inválida`);
  for (const campo of ["nome", "licenca", "credito", "conferido_em", "pagina"]) ok(typeof l[campo] === "string" && l[campo].length >= 3, `${l.id}: falta ${campo}`);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(l.conferido_em), `${l.id}: data`);
  ok(l.pt?.descricao && l.en?.descricao, `${l.id}: descrição pt e en`);
  ok(/^https:\/\//.test(l.pagina), `${l.id}: página do projeto deve ser https`);
  const texto = JSON.stringify(l).toLowerCase();
  ok(!texto.includes("universidade") && !texto.includes("diploma"), `${l.id}: palavra proibida`);
  if (l.forma === "local") {
    ok(l.url.startsWith("/labs/"), `${l.id}: cópia local deve ficar em /labs/`);
    ok(fs.existsSync(path.join(raiz, "public", l.url)), `${l.id}: arquivo local não existe: ${l.url}`);
  } else {
    ok(/^https:\/\//.test(l.url), `${l.id}: url externa deve ser https`);
  }
  if (l.forma === "sob-demanda") {
    const host = new URL(l.url).origin;
    ok(config.includes(host), `${l.id}: ${host} falta no frame-src do next.config.ts`);
  }
}

// Peso: cada cópia local abaixo de 15 MB.
function tamanho(dir) {
  let t = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    t += e.isDirectory() ? tamanho(p) : fs.statSync(p).size;
  }
  return t;
}
for (const pasta of ["loopy", "polygons"]) {
  const t = tamanho(path.join(raiz, "public", "labs", pasta));
  ok(t < 15 * 1024 * 1024, `${pasta} passou de 15 MB`);
}
ok(!fs.existsSync(path.join(raiz, "public", "labs", "cyberchef")), "CyberChef passa de 15 MB: só link");

// Licenças copiadas junto.
ok(fs.existsSync(path.join(raiz, "public", "labs", "loopy", "LICENSE.txt")), "LICENSE do LOOPY");
ok(fs.existsSync(path.join(raiz, "public", "labs", "polygons", "LICENSE.txt")), "LICENSE do Polygons");
ok(!fs.existsSync(path.join(raiz, "public", "labs", "chrome-music-lab")), "Chrome Music Lab exige unsafe-eval: só link");

// Sem rastreio nas cópias locais: nenhuma tag de script externa nem Google Analytics.
function varrer(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) varrer(p, fn);
    else if (/\.(html|js)$/.test(e.name)) fn(p, fs.readFileSync(p, "utf8"));
  }
}
for (const pasta of ["loopy", "polygons"]) {
  varrer(path.join(raiz, "public", "labs", pasta), (p, t) => {
    ok(!/<script[^>]+src=["']https?:/i.test(t), `script externo em ${p}`);
    ok(!/google-analytics|googletagmanager|gtag\(/i.test(t), `rastreio em ${p}`);
  });
}

// LOOPY traduzido.
const sidebar = fs.readFileSync(path.join(raiz, "public", "labs", "loopy", "js", "Sidebar.js"), "utf8");
ok(sidebar.includes("apagar círculo") && sidebar.includes("Quantidade inicial"), "LOOPY em português");
ok(!/patreon|amazon\.com/.test(sidebar), "LOOPY sem links de apoio do autor no menu");

// Gráfico do Our World in Data: 1950 a 2023, Brasil e mundo, valores plausíveis (anos de vida).
for (const serie of ["Brasil", "Mundo"]) {
  const d = owid.series[serie];
  ok(d.length === 74 && d[0][0] === 1950 && d.at(-1)[0] === 2023, `${serie}: anos`);
  ok(d.every(([, v]) => v > 30 && v < 90), `${serie}: valores`);
}
ok(/CC BY/.test(owid.licenca) && owid.pagina.startsWith("https://ourworldindata.org/"), "crédito do OWID");

console.log(`labs externos: ${n} verificações, ${catalogo.length} laboratórios, tudo certo.`);

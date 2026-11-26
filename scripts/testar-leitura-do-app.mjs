// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O leitor do jornal do aplicativo lê content/jornal e content/glossario por lib/jornal/leitura-do-app.ts (leitura enxuta,
// para não levar content/ inteiro no rastreio do build). Este roteiro confere que o resultado é IGUAL ao de
// lib/content.ts (getArticles, getGlossary) em todos os idiomas: mesmos itens, mesma ordem, mesmos campos.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-leitura-do-app.mjs
import assert from "node:assert/strict";
import { getArticles, getGlossary } from "../lib/content.ts";
import { materiasDoApp, termosDoApp } from "../lib/jornal/leitura-do-app.ts";

const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
let certos = 0;
const confere = (nome, atual, esperado) => {
  assert.deepStrictEqual(atual, esperado, nome);
  certos++;
};

for (const lang of idiomas) {
  const site = getArticles(lang);
  const app = materiasDoApp(lang);
  confere(`${lang}: mesmas matérias, mesma ordem, mesmos campos`, app, site);
  confere(`${lang}: mesma ordem dos endereços`, app.map((m) => m.slug), site.map((m) => m.slug));
  confere(`${lang}: mesmo glossário, mesma ordem, mesmos campos`, termosDoApp(lang), getGlossary(lang));
}
const pt = materiasDoApp("pt");
assert.ok(pt.length > 0, "o jornal em português não pode estar vazio no teste");
certos++;
assert.ok(termosDoApp("pt").length > 100, "o glossário em português tem mais de cem verbetes");
certos++;

console.log(`${certos} conferências certas, 0 com problema.`);

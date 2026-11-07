// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere a matéria com prazo do Jornal ("sai_do_ar_em", lib/jornal/validade.ts, docs/jornal/EXPIRACAO.md): como a
// data é entendida (sempre hora de Brasília), quando a matéria passa a contar como fora do ar, o endereço que o proxy
// reconhece, a página de "removida" (410) e os prazos lidos direto de content/jornal/ batendo com os de lib/content.ts.
// Uso: npm run testar:jornal-prazo
import assert from "node:assert/strict";
import { FUSO_BRASILIA, instanteDeSaida, materiaDoCaminho, paginaRemovida, saiuDoAr } from "../lib/jornal/validade.ts";
import { prazosDoJornal } from "../lib/jornal/saidas.ts";
import { getArticles, todasAsMaterias } from "../lib/content.ts";

let certos = 0;
const falhas = [];
const ok = (nome, fn) => {
  try {
    fn();
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
};

ok("só a data: vale o dia inteiro, até 23:59:59 de Brasília", () => assert.equal(instanteDeSaida("2026-11-13"), `2026-11-13T23:59:59${FUSO_BRASILIA}`));
ok("data e hora com espaço: hora de Brasília", () => assert.equal(instanteDeSaida("2026-11-13 23:59"), "2026-11-13T23:59:00-03:00"));
ok("data e hora com T: hora de Brasília", () => assert.equal(instanteDeSaida("2026-11-13T23:59"), "2026-11-13T23:59:00-03:00"));
ok("com fuso dito, o fuso vale", () => assert.equal(instanteDeSaida("2026-11-14T02:59:00Z"), "2026-11-14T02:59:00Z"));
ok("data sem aspas (o YAML vira Date à meia-noite UTC) vale o dia inteiro", () => assert.equal(instanteDeSaida(new Date("2026-11-13")), `2026-11-13T23:59:59${FUSO_BRASILIA}`));
ok("data e hora sem aspas (o YAML vira Date em UTC) é recusada: com aspas, a lista e o proxy leem a mesma hora (T33)", () => {
  assert.equal(instanteDeSaida(new Date("2026-11-13T23:59:00Z")), null);
  assert.equal(instanteDeSaida("2026-11-13 23:59:00"), "2026-11-13T23:59:00-03:00");
});
ok("texto que não é data: null", () => {
  assert.equal(instanteDeSaida("semana que vem"), null);
  assert.equal(instanteDeSaida("2026-13-45"), null);
  assert.equal(instanteDeSaida(42), null);
});

const prazo = instanteDeSaida("2026-11-13 23:59");
ok("antes da hora, a matéria está no ar", () => assert.equal(saiuDoAr(prazo, Date.parse("2026-11-13T23:58:00-03:00")), false));
ok("às 23:59 de Brasília em ponto, ainda está no ar", () => assert.equal(saiuDoAr(prazo, Date.parse("2026-11-13T23:59:00-03:00")), false));
ok("um minuto depois, saiu do ar", () => assert.equal(saiuDoAr(prazo, Date.parse("2026-11-14T00:00:00-03:00")), true));
ok("em UTC, 02:59 do dia 14 é a hora do prazo", () => assert.equal(saiuDoAr(prazo, Date.parse("2026-11-14T03:00:00Z")), true));
ok("sem prazo, nunca sai", () => {
  assert.equal(saiuDoAr(""), false);
  assert.equal(saiuDoAr(null), false);
  assert.equal(saiuDoAr(undefined, Date.parse("2100-01-01")), false);
});

ok("caminho de matéria é reconhecido (com e sem barra final)", () => {
  assert.deepEqual(materiaDoCaminho("/pt/jornal/uma-materia"), { lang: "pt", slug: "uma-materia" });
  assert.deepEqual(materiaDoCaminho("/en/jornal/uma-materia/"), { lang: "en", slug: "uma-materia" });
});
ok("a capa do jornal e outros caminhos não são matéria", () => {
  assert.equal(materiaDoCaminho("/pt/jornal"), null);
  assert.equal(materiaDoCaminho("/pt/jornal/"), null);
  assert.equal(materiaDoCaminho("/pt/jornal/a/b"), null);
  assert.equal(materiaDoCaminho("/pt/trilhas/x"), null);
});
ok("página de removida: no idioma, sem script, sem nada de fora, sem indexação", () => {
  const pt = paginaRemovida("pt");
  assert.match(pt, /<html lang="pt">/);
  assert.match(pt, /saiu do ar/);
  assert.match(pt, /noindex/);
  assert.doesNotMatch(pt, /<script|https?:\/\//);
  assert.match(paginaRemovida("en"), /<html lang="en">/);
  assert.match(paginaRemovida("xx"), /<html lang="pt">/);
});

// O acervo de verdade: o que o proxy lê direto dos arquivos tem de bater com o que lib/content.ts entende.
const todas = todasAsMaterias("pt");
const prazos = prazosDoJornal();
ok("todo prazo lido pelo proxy bate com o da matéria", () => {
  for (const materia of todas) assert.equal(prazos.get(materia.slug) ?? "", materia.expires, materia.slug);
  assert.equal(prazos.size, todas.filter((m) => m.expires).length);
});
ok("getArticles deixa de fora só as que já saíram do ar", () => {
  const agora = Date.now();
  const noAr = getArticles("pt").map((m) => m.slug);
  for (const materia of todas) assert.equal(noAr.includes(materia.slug), !saiuDoAr(materia.expires, agora), materia.slug);
});
ok("matéria sobre os povos indígenas (T14) tem prazo em 13/11/2026 23:59 de Brasília", () => {
  const materia = todas.find((m) => m.slug === "2026-11-06-indigenas-sob-ataque-depois-das-urnas");
  assert.ok(materia, "a matéria não está em content/jornal/");
  assert.equal(materia.expires, "2026-11-13T23:59:00-03:00");
  assert.ok(materia.sources.length >= 10, "poucas fontes");
  assert.ok(materia.sources.every((f) => f.url && f.year), "toda fonte com endereço e data");
  assert.doesNotMatch(materia.body, /universidade|diploma/i);
});
ok("nas traduções, a matéria herda o prazo do original", () => {
  for (const materia of todasAsMaterias("en")) assert.equal(prazos.get(materia.slug) ?? "", materia.expires, materia.slug);
});

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):\n  ${falhas.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ matéria com prazo do Jornal: ${certos} conferências`);

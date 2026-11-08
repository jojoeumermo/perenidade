// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere o Jornal: /jornal abre a última matéria, o "Leia também" traz as 3 mais recentes que não são a aberta, a
// matéria em destaque fixo (a dos povos indígenas) continua marcada, e nenhuma matéria tem prazo de validade: o campo
// antigo "sai_do_ar_em" não existe mais em content/jornal/ (docs/jornal/EXPIRACAO.md).
// Uso: npm run testar:jornal
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { leiaTambem, materiaEmDestaque, ultimaMateria } from "../lib/jornal/selecao.ts";
import { getArticles } from "../lib/content.ts";

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

const m = (slug, featured = false) => ({ slug, featured });
const lista = [m("e"), m("d"), m("c", true), m("b"), m("a")];

ok("a última matéria é a primeira da lista", () => assert.equal(ultimaMateria(lista)?.slug, "e"));
ok("sem matéria, não há última", () => assert.equal(ultimaMateria([]), undefined));
ok("leia também: as 3 mais recentes sem a aberta", () => assert.deepEqual(leiaTambem(lista, "e").map((x) => x.slug), ["d", "c", "b"]));
ok("leia também numa matéria do meio pula só ela", () => assert.deepEqual(leiaTambem(lista, "d").map((x) => x.slug), ["e", "c", "b"]));
ok("leia também com poucas matérias traz o que houver", () => assert.deepEqual(leiaTambem([m("x"), m("y")], "x").map((x) => x.slug), ["y"]));
ok("o destaque é a matéria marcada, mesmo sendo antiga", () => assert.equal(materiaEmDestaque(lista)?.slug, "c"));
ok("sem marcada, sem destaque", () => assert.equal(materiaEmDestaque([m("x")]), undefined));

const pasta = path.join(process.cwd(), "content", "jornal");
const arquivos = fs.readdirSync(pasta).filter((nome) => nome.endsWith(".md"));
ok("nenhuma matéria tem prazo (sai_do_ar_em)", () => {
  for (const nome of arquivos) assert.ok(!/^sai_do_ar_em:/m.test(fs.readFileSync(path.join(pasta, nome), "utf8")), nome);
});

const materias = getArticles("pt");
ok("todos os arquivos viram matéria no ar (nada some por data)", () => assert.equal(materias.length, arquivos.filter((n) => /^[a-z0-9-]+\.md$/.test(n)).length));
ok("a lista vem da mais nova para a mais antiga", () => {
  for (let i = 1; i < materias.length; i++) assert.ok(materias[i - 1].date >= materias[i].date, `${materias[i - 1].slug} antes de ${materias[i].slug}`);
});
ok("a matéria dos povos indígenas segue em destaque", () => {
  const destaque = materiaEmDestaque(materias);
  assert.ok(destaque, "nenhuma matéria em destaque");
  assert.match(destaque.slug, /indigenas/);
});
ok("toda matéria tem fonte com endereço", () => {
  for (const materia of materias) assert.ok(materia.sources.some((f) => f.url), materia.slug);
});
for (const lang of ["en", "es", "fr", "ru", "zh"]) {
  ok(`em ${lang}, as mesmas matérias e o mesmo destaque`, () => {
    const outras = getArticles(lang);
    assert.deepEqual(outras.map((x) => x.slug), materias.map((x) => x.slug));
    assert.equal(materiaEmDestaque(outras)?.slug, materiaEmDestaque(materias)?.slug);
  });
}

if (falhas.length) {
  console.error(`${falhas.length} falha(s):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`Jornal: ${certos} conferências certas.`);

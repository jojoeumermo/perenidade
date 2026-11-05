// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Teste (node puro) do pacote Territórios: dados do NoizOcupa e do Coletivo Kamikaze, chaves nos 6 idiomas,
// CSP do Instagram, faixa de temas acessível e o player que só carrega depois do clique.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
let n = 0;
const ok = (nome, fn) => {
  fn();
  n += 1;
  console.log(`ok - ${nome}`);
};

const dados = JSON.parse(ler("content", "territorios.json")).territorios;
const por = (slug) => dados.find((t) => t.slug === slug);

ok("slugs únicos e Na Atividade intacto", () => {
  assert.equal(new Set(dados.map((t) => t.slug)).size, dados.length);
  assert.ok(por("na-atividade"));
  assert.equal(por("na-atividade").visual, undefined);
});

ok("NoizOcupa: grafia, Instagram e post do anúncio", () => {
  const t = por("noizocupa");
  assert.equal(t.nome, "NoizOcupa");
  assert.equal(t.instagram, "noizocupa");
  assert.equal(t.anuncio.post, "DfQT6U0uJ2G");
  assert.equal(t.visual, "noizocupa");
  assert.ok(t.temas.length >= 4);
});

ok("Coletivo Kamikaze: Instagram e post do anúncio", () => {
  const t = por("coletivo-kamikaze");
  assert.equal(t.nome, "Coletivo Kamikaze");
  assert.equal(t.instagram, "coletivokamikaze");
  assert.equal(t.anuncio.post, "DfQoZbIOMZt");
  assert.equal(t.visual, "kamikaze");
  assert.ok(t.temas.length >= 4);
});

ok("trilhas indicadas existem e não há palavras proibidas", () => {
  for (const t of dados) {
    for (const trilha of t.trilhas) assert.ok(fs.existsSync(path.join(raiz, "content", "trilhas", trilha, "_trilha.md")), trilha);
    assert.doesNotMatch(JSON.stringify(t), /universidade|diploma/i);
  }
});

const chaves = ["anuncioKicker", "anuncioLoad", "anuncioAviso", "anuncioAbrir", "anuncioQuadro", "anuncioLocal", "agendaKicker", "agendaQuando", "agendaOnde", "letreiroRotulo", "letreiroPausar", "letreiroRetomar", "cartaoVer"];
ok("chaves novas nos 6 idiomas", () => {
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const d = JSON.parse(ler("i18n", `${l}.json`)).territorios;
    for (const k of chaves) assert.ok(typeof d[k] === "string" && d[k].length > 0, `${l}.${k}`);
  }
});

ok("CSP libera o Instagram só em frame-src", () => {
  const c = ler("next.config.ts");
  assert.match(c, /const instagram = "https:\/\/www\.instagram\.com"/);
  assert.equal((c.match(/\$\{instagram\}/g) ?? []).length, 1);
  assert.match(c, /frame-src[^\n]*\$\{instagram\}/);
});

ok("player: embed só depois do clique, vídeo local sem pré-carga", () => {
  const p = ler("components", "territorios", "PlayerDoAnuncio.tsx");
  assert.match(p, /useState\(false\)/);
  assert.match(p, /aberto \?/);
  assert.match(p, /preload="none"/);
  assert.doesNotMatch(p, /<script/);
  const v = ler("lib", "territorios-video.ts");
  assert.match(v, /anuncio\.mp4/);
  assert.match(v, /A-Za-z0-9_-/);
});

ok("letreiro: lista para leitor de tela, cópias aria-hidden, botão de pausa", () => {
  const l = ler("components", "territorios", "Letreiro.tsx");
  assert.match(l, /sr-only/);
  assert.match(l, /aria-hidden/);
  assert.match(l, /aria-pressed/);
  const css = ler("app", "globals.css");
  assert.match(css, /\.letreiro:hover \.letreiro-trilho/);
  assert.match(css, /\.letreiro:focus-within \.letreiro-trilho/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.letreiro-trilho/);
});

ok("todas as páginas de território usam o letreiro", () => {
  assert.match(ler("app", "[lang]", "territorios", "[slug]", "page.tsx"), /<Letreiro /);
  assert.match(ler("components", "territorios", "PaginaDoColetivo.tsx"), /<Letreiro/);
  assert.match(ler("app", "[lang]", "territorios", "page.tsx"), /<Letreiro /);
});

console.log(`${n} testes passaram`);

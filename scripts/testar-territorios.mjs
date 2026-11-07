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
  // Com o mouse por cima a faixa continua andando (05/11/2026); só o botão para (WCAG 2.2.2).
  assert.doesNotMatch(css, /\.letreiro:hover \.letreiro-trilho/);
  assert.doesNotMatch(css, /\.letreiro:focus-within \.letreiro-trilho/);
  assert.match(css, /\.letreiro\[data-parado\] \.letreiro-trilho \{\s*animation-play-state: paused/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.letreiro-trilho/);
});

ok("o letreiro anda dentro dos territórios e saiu da abertura de /territorios", () => {
  assert.match(ler("app", "[lang]", "territorios", "[slug]", "page.tsx"), /<Letreiro /);
  assert.match(ler("components", "territorios", "PaginaDoColetivo.tsx"), /<Letreiro/);
  assert.doesNotMatch(ler("app", "[lang]", "territorios", "page.tsx"), /<Letreiro/);
});

ok("NoizOcupa e Kamikaze preenchidos com o perfil: imagens existem, em WebP, com texto alternativo e crédito", () => {
  for (const slug of ["noizocupa", "coletivo-kamikaze"]) {
    const t = por(slug);
    const fotos = [t.capa, ...(t.galeria?.fotos ?? []), ...(t.campanhas ?? []).flatMap((c) => c.fotos)].filter(Boolean);
    assert.ok(fotos.length >= 3, `${slug}: poucas imagens`);
    for (const f of fotos) {
      assert.match(f.src, new RegExp(`^/territorios/${slug}/[a-z0-9-]+\\.webp$`), f.src);
      assert.ok(fs.existsSync(path.join(raiz, "public", f.src)), f.src);
      assert.ok(fs.statSync(path.join(raiz, "public", f.src)).size < 300_000, `${f.src} grande demais`);
      assert.ok(f.alt && f.alt.length > 10, `${f.src} sem alt`);
    }
    assert.match(t.credito, new RegExp(`@${t.instagram} no Instagram, uso autorizado pelo coletivo`));
    for (const m of t.marcos.itens) if (m.post) assert.match(m.post, /^[A-Za-z0-9_-]{6,20}$/);
    const video = path.join(raiz, "public", "territorios", slug, "anuncio.mp4");
    if (fs.existsSync(video)) assert.ok(fs.statSync(video).size <= 20 * 1024 * 1024, `${slug}: vídeo acima de 20 MB`);
  }
});

// T20 (06/11/2026): cada coletivo com o seu desenho, a logo na abertura e dois coletivos novos.
const comVisual = dados.filter((t) => t.visual);

ok("Desordem e noismemo studios: territórios novos com Instagram e visual próprio", () => {
  const d = por("coletivo-desordem");
  assert.equal(d.instagram, "coletivodesordem");
  assert.equal(d.visual, "desordem");
  const nm = por("noisme-studios");
  assert.equal(nm.instagram, "noismemostudios");
  assert.equal(nm.visual, "noisme");
  for (const t of [d, nm]) {
    assert.ok(t.temas.length >= 4, `${t.slug}: poucos temas`);
    assert.ok(t.trilhas.length >= 1, `${t.slug}: sem trilha`);
    assert.ok(t.credito && /Logo cedida pelo coletivo/.test(t.credito), `${t.slug}: crédito da logo`);
  }
  assert.equal(new Set(dados.map((t) => t.numero)).size, dados.length);
});

ok("cada coletivo com identidade própria tem a sua (nenhum repete o desenho de outro)", () => {
  const visuais = comVisual.map((t) => t.visual);
  assert.equal(new Set(visuais).size, visuais.length);
  const ids = ler("lib", "territorios-identidades.ts");
  const pagina = ler("components", "territorios", "PaginaDoColetivo.tsx");
  for (const v of visuais) {
    assert.match(ids, new RegExp(`\\b${v}: \\{`), `${v} sem cores`);
    assert.match(pagina, new RegExp(`visual === "${v}" && \\(`), `${v} sem abertura própria`);
  }
});

ok("logo de cada coletivo: WebP leve, alt e crédito \"Logo cedida pelo coletivo\"", () => {
  for (const t of comVisual) {
    assert.ok(t.logo, `${t.slug}: sem logo`);
    assert.equal(t.logo.src, `/territorios/${t.slug}/logo.webp`);
    assert.ok(fs.existsSync(path.join(raiz, "public", t.logo.src)), t.logo.src);
    assert.ok(fs.statSync(path.join(raiz, "public", t.logo.src)).size < 100_000, `${t.logo.src} grande demais`);
    assert.ok(t.logo.alt.length > 20, `${t.slug}: alt da logo`);
    assert.equal(t.logo.credito, "Logo cedida pelo coletivo");
  }
});

ok("Kamikaze não é mais só rosa e preto", () => {
  const ids = ler("lib", "territorios-identidades.ts");
  const linha = ids.split("\n").find((l) => /^\s*kamikaze: \{/.test(l));
  const acentos = linha.match(/acentos: \[([^\]]*)\]/)[1].match(/#[0-9a-f]{6}/gi);
  assert.ok(acentos.length >= 4, "a paleta do Kamikaze precisa de pelo menos 4 cores");
  assert.doesNotMatch(linha, /destaque: "#ff2e88"/);
});

// Contraste WCAG AA entre as cores de cada identidade.
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
ok("contraste AA nas cores de cada identidade", () => {
  const ids = ler("lib", "territorios-identidades.ts");
  for (const linha of ids.split("\n").filter((l) => /^\s*[a-z]+: \{ fundo:/.test(l))) {
    const nome = linha.trim().split(":")[0];
    const cor = (chave) => linha.match(new RegExp(`${chave}: "(#[0-9a-f]{6})"`, "i"))[1];
    const pares = [
      ["tinta/fundo", cor("tinta"), cor("fundo")],
      ["tinta/papel", cor("tinta"), cor("papel")],
      ["rotulo/fundo", cor("rotulo"), cor("fundo")],
      ["botaoTexto/destaque", cor("botaoTexto"), cor("destaque")],
      ...(linha.match(/acentos: \[([^\]]*)\]/)[1].match(/#[0-9a-f]{6}/gi) ?? []).flatMap((a) => [
        [`acento ${a}/fundo`, a, cor("fundo")],
        [`acento ${a}/papel`, a, cor("papel")],
      ]),
    ];
    for (const [qual, a, b] of pares) assert.ok(contraste(a, b) >= 4.5, `${nome} ${qual}: ${contraste(a, b).toFixed(2)}`);
  }
});

console.log(`${n} testes passaram`);

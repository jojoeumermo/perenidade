// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o pacote "mapa" do Vale o Escrito: contas de geografia (lib/vale-o-escrito/geo.ts), os arquivos de malha do IBGE
// e o municipios.json (quando já gerados), a malha do mundo (Natural Earth, Prompt 5 C1), os textos nos 6 idiomas e as
// promessas do componente (carga sob demanda, nenhum endereço de terceiros). Sem rede, sem navegador.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SIGLAS_DE_UF, caixa, centro, contarCasos, contornoExterno, paisDoCaso, pontosDosCasos, ufDoMunicipio, uniaoDeCaixas } from "../lib/vale-o-escrito/geo.ts";
import { IDIOMAS_VE } from "../lib/vale-o-escrito/tipos.ts";
import { lugarDoNo } from "../lib/vale-o-escrito/visual.ts";

let total = 0;
const caso = (nome, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nome}`);
};
const raiz = process.cwd();
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
const existe = (...p) => fs.existsSync(path.join(raiz, ...p));

const quadrado = { type: "Polygon", coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]] };

caso("UF pelo código IBGE do município (Altamira 1500602 → PA; lixo → nada)", () => {
  assert.equal(ufDoMunicipio("1500602"), "PA");
  assert.equal(ufDoMunicipio("3550308"), "SP");
  assert.equal(ufDoMunicipio("9900000"), undefined);
  assert.equal(ufDoMunicipio("150060"), undefined);
  assert.equal(ufDoMunicipio(undefined), undefined);
  assert.equal(SIGLAS_DE_UF.length, 27);
});
caso("caixa e centro de polígono e multipolígono (maior parte manda)", () => {
  assert.deepEqual(caixa(quadrado), [0, 0, 4, 4]);
  assert.deepEqual(centro(quadrado), [2, 2]);
  const multi = { type: "MultiPolygon", coordinates: [quadrado.coordinates, [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]]] };
  assert.deepEqual(centro(multi), [2, 2]);
  assert.deepEqual(caixa(multi), [0, 0, 11, 11]);
  assert.deepEqual(uniaoDeCaixas([[0, 0, 1, 1], undefined, [2, -1, 3, 0]]), [0, -1, 3, 1]);
  assert.equal(uniaoDeCaixas([undefined]), undefined);
});
caso("contagem e pontos: município quando há malha, UF quando não, fora do mapa quando não há nada", () => {
  const casos = [
    { id: "a", titulo: "A", dossie: "x", cor: "vermelho", municipioIbge: "1500602", situacao: "Réu" },
    { id: "b", titulo: "B", dossie: "x", cor: "azul", uf: "PA", situacao: "Investigado" },
    { id: "c", titulo: "C", dossie: "x", cor: "amarelo", uf: "ZZ", situacao: "Suspeito" },
  ];
  const { porUf, porMunicipio } = contarCasos(casos);
  assert.equal(porUf.PA, 2);
  assert.equal(porMunicipio["1500602"], 1);
  const col = pontosDosCasos(casos, { PA: [-52, -3] }, { "1500602": [-52.2, -3.2] });
  assert.equal(col.features.length, 2);
  assert.deepEqual(col.features[0].geometry.coordinates, [-52.2, -3.2]);
  assert.deepEqual(col.features[1].geometry.coordinates, [-52, -3]);
  assert.match(col.features[0].properties.cor, /^#[0-9a-f]{6}$/i);
});
caso("o script das malhas usa só a API do IBGE e a pasta literal de saída", () => {
  const s = ler("scripts", "vale-o-escrito", "gerar-malhas.mjs");
  assert.match(s, /servicodados\.ibge\.gov\.br\/api/);
  assert.match(s, /path\.join\(RAIZ, "public", "vale-o-escrito", "malhas"\)/);
  assert.doesNotMatch(s, /https?:\/\/(?!servicodados\.ibge\.gov\.br)[a-z]/i);
  assert.match(ler("scripts", "vale-o-escrito", "gerar-municipios.mjs"), /localidades\/municipios/);
});
caso("municipios.json: 5.5 mil municípios, código de 7 dígitos, nome e UF (se já gerado)", () => {
  if (!existe("scripts", "vale-o-escrito", "municipios.json")) return;
  const m = JSON.parse(ler("scripts", "vale-o-escrito", "municipios.json"));
  const cods = Object.keys(m);
  assert.ok(cods.length >= 5500, `só ${cods.length}`);
  assert.ok(cods.every((c) => /^\d{7}$/.test(c) && m[c].n && SIGLAS_DE_UF.includes(m[c].uf)));
  assert.deepEqual(m["1500602"], { n: "Altamira", uf: "PA" });
  assert.ok(cods.every((c) => ufDoMunicipio(c) === m[c].uf), "UF do código diverge da UF do arquivo");
});
caso("malhas geradas: país com 27 UFs e um arquivo por UF, leves (se já geradas)", () => {
  const dir = ["public", "vale-o-escrito", "malhas"];
  if (!existe(...dir, "brasil.geojson")) return;
  const br = JSON.parse(ler(...dir, "brasil.geojson"));
  assert.equal(br.features.length, 27);
  assert.ok(br.features.every((f) => f.properties.sigla && f.properties.nome));
  let bytes = 0;
  for (const sigla of SIGLAS_DE_UF) {
    const arq = path.join(raiz, ...dir, "uf", `${sigla}.geojson`);
    assert.ok(fs.existsSync(arq), `falta ${sigla}`);
    const tam = fs.statSync(arq).size;
    bytes += tam;
    assert.ok(tam < 900_000, `${sigla} pesada: ${tam}`);
    const col = JSON.parse(fs.readFileSync(arq, "utf8"));
    assert.ok(col.features.length > 0 && col.features.every((f) => ufDoMunicipio(f.properties.codigo) === sigla), `${sigla}: município de outra UF`);
  }
  assert.ok(bytes < 6_000_000, `malhas somam ${bytes} bytes`);
});
caso("Altamira está na malha do Pará, com nome (se já gerada)", () => {
  const arq = ["public", "vale-o-escrito", "malhas", "uf", "PA.geojson"];
  if (!existe(...arq)) return;
  const f = JSON.parse(ler(...arq)).features.find((x) => x.properties.codigo === "1500602");
  assert.ok(f, "Altamira ausente");
  assert.equal(f.properties.nome, "Altamira");
  assert.ok(centro(f.geometry));
});
caso("os textos do mapa existem nos 6 idiomas, com as mesmas chaves do português", () => {
  const pt = JSON.parse(ler("i18n", "vale-o-escrito", "pt.json").replace(/^﻿/, "")).mapa;
  assert.ok(pt && pt.credito.includes("IBGE"));
  for (const l of IDIOMAS_VE) {
    const m = JSON.parse(ler("i18n", "vale-o-escrito", `${l}.json`).replace(/^﻿/, "")).mapa;
    assert.deepEqual(Object.keys(m).sort(), Object.keys(pt).sort(), l);
    assert.ok(Object.values(m).every((v) => typeof v === "string" && v.length > 0), l);
    assert.match(m.credito, /IBGE/, l);
    assert.match(m.casos, /\{n\}/, l);
  }
});
caso("o componente carrega o MapLibre sob demanda, sem tiles nem endereços de terceiros, e dá o crédito", () => {
  const s = ler("components", "vale-o-escrito", "Mapa.tsx");
  assert.match(s, /await import\("maplibre-gl"\)/);
  assert.doesNotMatch(s, /^import [^t].*from "maplibre-gl"/m, "import estático do maplibre-gl");
  assert.doesNotMatch(s, /https?:\/\//, "endereço externo no componente");
  assert.match(s, /sources: \{\}/);
  assert.doesNotMatch(s, /glyphs|tiles:/);
  assert.match(s, /t\.credito/);
  assert.match(s, /PropsDoMapa/);
});
caso("maplibre-gl está nas dependências", () => {
  assert.ok(JSON.parse(ler("package.json")).dependencies["maplibre-gl"]);
});

caso("T31: contorno de fora do Brasil (divisa entre duas UFs some) e ponto 'aproximado' sem município", () => {
  const a = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] };
  const b = { type: "Polygon", coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] };
  const c = contornoExterno([a, b]);
  assert.equal(c.type, "MultiLineString");
  const segs = c.coordinates.flatMap((l) => l.slice(1).map((q, i) => [l[i], q]));
  assert.equal(segs.length, 6, "8 lados, 2 na divisa interna");
  assert.ok(!segs.some(([p, q]) => p[0] === 1 && q[0] === 1), "a divisa x=1 não aparece");
  const pts = pontosDosCasos([{ id: "a", titulo: "A", dossie: "d", cor: "vermelho", uf: "PA" }], { PA: [-52, -4] }, {});
  assert.equal(pts.features[0].properties.aproximado, 1);
});
caso("T31: mapa neon (contorno fino, calor por densidade, ramificações, reduzir movimento, lista com 'local aproximado')", () => {
  const m = ler("components", "vale-o-escrito", "Mapa.tsx");
  for (const t of ['"contorno"', '"casos-calor"', "heatmap-density", "ve-ramos", "ramosDe", "aoSelecionarNo", "aria-pressed={calmo}", "t.aproximado"]) assert.ok(m.includes(t), t);
  assert.ok(!/https?:\/\/(?!www\.w3)/.test(m.replace(/\/\/.*$/gm, "")), "nenhum endereço de terceiros");
});

// ───────────── Prompt 5, C1: do Brasil para o mundo ─────────────
caso("C1: a malha do mundo vem da Natural Earth pelo world-atlas, sem endereço de fora, e é leve", () => {
  const s = ler("scripts", "vale-o-escrito", "gerar-mundo.mjs");
  assert.match(s, /world-atlas\/countries-110m\.json/);
  assert.doesNotMatch(s, /https?:\/\//, "o script não baixa nada");
  const arq = path.join(raiz, "public", "vale-o-escrito", "malhas", "mundo.geojson");
  assert.ok(fs.existsSync(arq), "falta public/vale-o-escrito/malhas/mundo.geojson (node scripts/vale-o-escrito/gerar-mundo.mjs)");
  assert.ok(fs.statSync(arq).size < 300_000, `mundo.geojson pesado: ${fs.statSync(arq).size}`);
  const mundo = JSON.parse(fs.readFileSync(arq, "utf8"));
  const isos = mundo.features.map((f) => f.properties.iso);
  assert.ok(mundo.features.length > 150, "países demais faltando");
  for (const p of ["US", "IL", "AR", "PT", "CN"]) assert.ok(isos.includes(p), `falta ${p}`);
  assert.ok(!isos.includes("BR"), "o Brasil é do IBGE, não da Natural Earth");
  assert.ok(!isos.includes("AQ"), "a Antártida fica de fora");
  assert.ok(mundo.features.every((f) => f.properties.iso === "" || /^[A-Z]{2}$/.test(f.properties.iso)));
  assert.ok(mundo.features.every((f) => centro(f.geometry)), "todo país tem centro");
});
caso("C1: contagem por país e ponto no centro do país para caso de fora; o Brasil continua por UF e município", () => {
  const casos = [
    { id: "br", titulo: "BR", dossie: "x", cor: "vermelho", pais: "BR", municipioIbge: "1500602", situacao: "Réu" },
    { id: "us", titulo: "US", dossie: "x", cor: "azul", pais: "US", situacao: "Investigado" },
    { id: "il", titulo: "IL", dossie: "x", cor: "amarelo", pais: "il", situacao: "Investigado" },
    { id: "zz", titulo: "ZZ", dossie: "x", cor: "amarelo", pais: "ZZ", situacao: "Investigado" },
    { id: "antigo", titulo: "sem país", dossie: "x", cor: "amarelo", uf: "PA", situacao: "Investigado" },
  ];
  const { porPais, porUf, porMunicipio } = contarCasos(casos);
  assert.deepEqual(porPais, { BR: 2, US: 1, IL: 1, ZZ: 1 });
  assert.equal(porUf.PA, 2, "o caso sem país é do Brasil (os de antes)");
  assert.equal(porMunicipio["1500602"], 1);
  const pts = pontosDosCasos(casos, { PA: [-52, -4] }, { "1500602": [-52.2, -3.2] }, { US: [-98, 39], IL: [35, 31], BR: [-51.9, -10.8] });
  const por = Object.fromEntries(pts.features.map((f) => [f.properties.id, f]));
  assert.deepEqual(por.us.geometry.coordinates, [-98, 39]);
  assert.equal(por.us.properties.aproximado, 1);
  assert.deepEqual(por.il.geometry.coordinates, [35, 31], "o código minúsculo também vale");
  assert.equal(por.zz, undefined, "país sem malha fica só na lista");
  assert.equal(por.br.properties.aproximado, 0);
  assert.equal(paisDoCaso({}), "BR");
});
caso("C1: o mapa começa no mundo, desce ao país, dá o nome do país pelo navegador e mantém a lista acessível", () => {
  const m = ler("components", "vale-o-escrito", "Mapa.tsx");
  for (const t of ['"mundo"', "mundo.geojson", "Intl.DisplayNames", "renderWorldCopies: false", "selecionarPais", "t.aproximadoPais", "t.listaDeCasos", "paisFiltro"]) assert.ok(m.includes(t), t);
  assert.match(m, /NIVEIS: readonly NivelDeZoom\[\] = \["mundo", "pais", "estado", "municipio"\]/);
  // O mundo não ganha brilho largo (line-blur) nem calor próprio: o peso fica no que já existia.
  assert.ok(!/id: "mundo-[a-z]+"[^\n]*line-blur/.test(m), "o mundo sem brilho largo");
  for (const l of IDIOMAS_VE) {
    const j = JSON.parse(ler("i18n", "vale-o-escrito", `${l}.json`).replace(/^﻿/, ""));
    assert.match(j.mapa.credito, /Natural Earth/, l);
    assert.ok(j.zoom.mundo && j.visual.filtroPais && j.visual.todosPaises && j.casca.contadores.paises, l);
  }
  const o = ler("components", "vale-o-escrito", "Observatorio.tsx");
  assert.match(o, /useState<NivelDeZoom>\("mundo"\)/);
  assert.match(o, /ve-filtro-pais/);
});
caso("C1: na teia, caso de fora sem região liga-se ao país; no Brasil, nada muda", () => {
  assert.deepEqual(lugarDoNo({ lugar: { pais: "US", nome: "Estados Unidos" } }), { id: "US", rotulo: "Estados Unidos" });
  assert.deepEqual(lugarDoNo({ lugar: { pais: "IL" } }), { id: "IL", rotulo: "IL" });
  assert.equal(lugarDoNo({ lugar: { pais: "BR" } }), null);
  assert.deepEqual(lugarDoNo({ lugar: { pais: "BR", regiao: "PA" } }), { id: "BR-PA", rotulo: "PA" });
});

console.log(`\n${total} conferências do mapa passaram.`);

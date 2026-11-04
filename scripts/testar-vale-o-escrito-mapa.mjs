// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o pacote "mapa" do Vale o Escrito: contas de geografia (lib/vale-o-escrito/geo.ts), os arquivos de malha do IBGE
// e o municipios.json (quando já gerados), os textos nos 6 idiomas e as promessas do componente (carga sob demanda, nenhum
// endereço de terceiros). Sem rede, sem navegador.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SIGLAS_DE_UF, caixa, centro, contarCasos, pontosDosCasos, ufDoMunicipio, uniaoDeCaixas } from "../lib/vale-o-escrito/geo.ts";
import { IDIOMAS_VE } from "../lib/vale-o-escrito/tipos.ts";

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

console.log(`\n${total} conferências do mapa passaram.`);

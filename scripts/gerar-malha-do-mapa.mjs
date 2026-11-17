// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Gera o desenho do Brasil do mapa da Alumia (frente 13B) a partir das malhas PÚBLICAS do IBGE, já baixadas numa pasta:
//   uf.json     malha dos estados, qualidade mínima  (API de malhas v3 do IBGE: /malhas/paises/BR, intrarregiao=UF)
//   mun.json    malha dos municípios, qualidade mínima (a mesma API, intrarregiao=municipio)
//   nomes.json  os nomes dos municípios              (API de localidades v1 do IBGE: /localidades/municipios)
// Saída: lib/rede/mapa/malha-brasil.json (os 27 estados em caminhos SVG, simplificados) e lib/rede/mapa/municipios.json (cada
// município: nome e o ponto do centro dele no desenho, um inteiro de ~4 km). Nenhuma posição de pessoa: só a geografia pública.
// Uso: node scripts/gerar-malha-do-mapa.mjs <pasta-com-os-três-arquivos> lib/rede/mapa
import fs from "node:fs";
import path from "node:path";
const [, , dirIbge, dirSaida] = process.argv;
const ler = (n) => JSON.parse(fs.readFileSync(path.join(dirIbge, n), "utf8"));
const uf = ler("uf.json");
const mun = ler("mun.json");
const nomes = ler("nomes.json");

const SIGLA = { 11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF" };

// Polígonos de cada geometria, deixando de fora ilhas oceânicas muito longe da costa (Trindade e Martim Vaz, São Pedro e São Paulo):
// elas esticariam o desenho sem ninguém para marcar lá.
function poligonos(g) {
  const lista = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return lista.filter((p) => p[0].every(([lon]) => lon < -32));
}

let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
for (const f of uf.features) for (const p of poligonos(f.geometry)) for (const [lon, lat] of p[0]) {
  lonMin = Math.min(lonMin, lon); lonMax = Math.max(lonMax, lon); latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
}
const lat0 = ((latMin + latMax) / 2) * Math.PI / 180;
const LARGURA = 1000;
const escala = LARGURA / ((lonMax - lonMin) * Math.cos(lat0));
const ALTURA = Math.ceil((latMax - latMin) * escala);
const projetar = ([lon, lat]) => [(lon - lonMin) * Math.cos(lat0) * escala, (latMax - lat) * escala];

// Douglas-Peucker sobre o anel projetado.
function simplificar(pts, tol) {
  if (pts.length < 4) return pts;
  const manter = new Uint8Array(pts.length);
  manter[0] = manter[pts.length - 1] = 1;
  const pilha = [[0, pts.length - 1]];
  while (pilha.length) {
    const [a, b] = pilha.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy;
    let maior = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const t = d2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / d2)) : 0;
      const qx = ax + t * dx - px, qy = ay + t * dy - py;
      const d = qx * qx + qy * qy;
      if (d > maior) { maior = d; idx = i; }
    }
    if (maior > tol * tol) { manter[idx] = 1; pilha.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => manter[i]);
}

const r1 = (n) => Math.round(n * 10) / 10;
const estados = {};
const centros = {};
for (const f of uf.features) {
  const sigla = SIGLA[f.properties.codarea];
  let d = "";
  let maiorArea = 0;
  for (const p of poligonos(f.geometry)) {
    const anel = simplificar(p[0].map(projetar), 0.6).map(([x, y]) => [r1(x), r1(y)]);
    if (anel.length < 4) continue;
    d += "M" + anel.slice(0, -1).map(([x, y]) => `${x} ${y}`).join("L") + "Z";
    // Centro do maior pedaço (para o rótulo da sigla).
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < anel.length - 1; i++) {
      const [x0, y0] = anel[i], [x1, y1] = anel[i + 1];
      const c = x0 * y1 - x1 * y0;
      a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    }
    if (Math.abs(a) > maiorArea) { maiorArea = Math.abs(a); centros[sigla] = [Math.round(cx / (3 * a)), Math.round(cy / (3 * a))]; }
  }
  estados[sigla] = d;
}

// Municípios: o centro de área do maior polígono, projetado e arredondado para um inteiro do desenho (~4 km).
const nomePorId = new Map(nomes.map((n) => [String(n.id), n.nome]));
const porUf = {};
let semNome = 0;
for (const f of mun.features) {
  const id = f.properties.codarea;
  const nome = nomePorId.get(id);
  if (!nome) { semNome++; continue; }
  const sigla = SIGLA[id.slice(0, 2)];
  let melhor = null, maior = 0;
  const lista = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of lista) {
    const anel = p[0].map(projetar);
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < anel.length - 1; i++) {
      const [x0, y0] = anel[i], [x1, y1] = anel[i + 1];
      const c = x0 * y1 - x1 * y0;
      a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    }
    if (Math.abs(a) >= maior) {
      maior = Math.abs(a);
      melhor = a ? [cx / (3 * a), cy / (3 * a)] : anel[0];
    }
  }
  (porUf[sigla] ??= []).push([nome, Math.round(melhor[0]), Math.round(melhor[1])]);
}
for (const s of Object.keys(porUf)) porUf[s].sort((a, b) => a[0].localeCompare(b[0], "pt"));

const ordem = Object.keys(estados).sort();
const malha = { largura: LARGURA, altura: ALTURA, estados: Object.fromEntries(ordem.map((s) => [s, { d: estados[s], centro: centros[s] }])) };
// Uma linha por UF: "Nome|x|y" separados por ";" (o arquivo fica pequeno e o navegador só o baixa na tela do mapa).
const indice = Object.fromEntries(Object.keys(porUf).sort().map((s) => [s, porUf[s].map(([n, x, y]) => `${n}|${x}|${y}`).join(";")]));

fs.writeFileSync(path.join(dirSaida, "malha-brasil.json"), JSON.stringify(malha));
fs.writeFileSync(path.join(dirSaida, "municipios.json"), JSON.stringify(indice));
console.log({ ALTURA, semNome, municipios: Object.values(porUf).reduce((n, l) => n + l.length, 0), malha: fs.statSync(path.join(dirSaida, "malha-brasil.json")).size, indice: fs.statSync(path.join(dirSaida, "municipios.json")).size, lonMin, lonMax, latMin, latMax });

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito, Prompt 5 (C1): a malha do MUNDO para o mapa (components/vale-o-escrito/Mapa.tsx), ao lado das malhas do IBGE que
// gerar-malhas.mjs já faz para o Brasil. Base: Natural Earth 1:110 milhões (domínio público), pelo pacote world-atlas que já está
// nas dependências (nada é baixado da internet aqui). A geometria de 1:110m é a simplificada, própria para ver o mundo inteiro;
// o detalhe do Brasil continua sendo o do IBGE, que aparece ao aproximar.
//
// Sai em public/vale-o-escrito/malhas/mundo.geojson: um polígono por país, com o código ISO 3166-1 alfa-2 ("iso") e o nome em
// inglês da Natural Earth ("nome", só reserva: a tela escreve o nome no idioma da página pelo próprio navegador). Ficam de fora o
// Brasil (que o IBGE desenha) e a Antártida (sem caso, e é o que mais pesa no desenho). Coordenadas com 2 casas (~1 km).
//
// Uso: node scripts/vale-o-escrito/gerar-mundo.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const exigir = createRequire(import.meta.url);
const { feature } = exigir("topojson-client");
const paises = exigir("i18n-iso-countries");
const topo = exigir("world-atlas/countries-110m.json");

const FORA = new Set(["BR", "AQ"]);
const casas = (n) => Math.round(n * 100) / 100;
/**
 * Arredonda e tira o ponto repetido que o arredondamento cria (anel com menos de 4 pontos some). Anel que atravessa a linha da
 * data (a Rússia em Chukotka, Fiji) pula de +180 a -180 e o mapa desenharia um traço de um lado ao outro do mundo: os pontos
 * do lado de lá passam a -180 (o pedaço fica colado na borda, sem traço).
 */
function anel(a) {
  const saida = [];
  const cruza = a.some(([x], i) => i > 0 && Math.abs(x - a[i - 1][0]) > 180);
  // Do lado com mais pontos fica o anel; os poucos do outro lado encostam na borda.
  const lado = cruza && a.filter(([x]) => x < 0).length >= a.length / 2 ? -1 : 1;
  for (const [x0, y] of a) {
    const x = cruza && Math.sign(x0) !== lado && Math.abs(x0) > 90 ? lado * 180 : x0;
    const p = [casas(x), casas(y)];
    const u = saida[saida.length - 1];
    if (!u || u[0] !== p[0] || u[1] !== p[1]) saida.push(p);
  }
  return saida.length >= 4 ? saida : null;
}
function geometria(g) {
  const polis = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  const limpos = polis.map((p) => p.map(anel).filter(Boolean)).filter((p) => p.length > 0);
  if (!limpos.length) return null;
  return limpos.length === 1 ? { type: "Polygon", coordinates: limpos[0] } : { type: "MultiPolygon", coordinates: limpos };
}

const colecao = feature(topo, topo.objects.countries);
const features = [];
const semCodigo = [];
for (const f of colecao.features) {
  const iso = f.id != null ? paises.numericToAlpha2(String(f.id).padStart(3, "0")) : undefined;
  if (!iso) {
    // Território sem código ISO na Natural Earth (Kosovo, Chipre do Norte, Somalilândia): entra no desenho, sem filtro nem caso.
    semCodigo.push(f.properties?.name ?? "?");
  }
  if (iso && FORA.has(iso)) continue;
  const g = geometria(f.geometry);
  if (!g) continue;
  features.push({ type: "Feature", properties: { iso: iso ?? "", nome: String(f.properties?.name ?? "") }, geometry: g });
}
features.sort((a, b) => (a.properties.iso || "ZZ").localeCompare(b.properties.iso || "ZZ") || a.properties.nome.localeCompare(b.properties.nome));
const saida = path.join(RAIZ, "public", "vale-o-escrito", "malhas", "mundo.geojson");
fs.writeFileSync(saida, JSON.stringify({ type: "FeatureCollection", features }));
console.log(`Gravado: ${path.relative(RAIZ, saida)} (${features.length} países, ${fs.statSync(saida).size} bytes; sem código ISO: ${semCodigo.join(", ") || "nenhum"}).`);

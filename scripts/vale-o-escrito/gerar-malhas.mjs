// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito, pacote "mapa": gera em arquivo as malhas do IBGE que o mapa usa, para não depender da API em cada visita
// (custo zero: arquivos estáticos cacheados) e sem tiles de terceiros.
//   public/vale-o-escrito/malhas/brasil.geojson     país com as 27 UFs
//   public/vale-o-escrito/malhas/uf/<SIGLA>.geojson cada UF com os municípios
//   public/vale-o-escrito/malhas/indice.json        código IBGE da UF → sigla e nome
// Fonte: API de malhas do IBGE (https://servicodados.ibge.gov.br/api/v3/malhas/), qualidade "minima", e localidades
// (https://servicodados.ibge.gov.br/api/v1/localidades/). Dados do IBGE (crédito obrigatório na página).
// As coordenadas são arredondadas a 3 casas (~110 m) e pontos repetidos são descartados, para ficar leve.
// Uso: node scripts/vale-o-escrito/gerar-malhas.mjs [--so-brasil]   (precisa de rede; sem rede, o mapa usa o que houver)
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const RAIZ = process.cwd();
const SAIDA = path.join(RAIZ, "public", "vale-o-escrito", "malhas");
const BASE = "https://servicodados.ibge.gov.br/api";
const FORMATO = "application/vnd.geo+json";
const so_brasil = process.argv.includes("--so-brasil");

/** Busca JSON com repetição simples (a API do IBGE às vezes oscila). */
async function buscar(url, tentativas = 4) {
  let erro;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      erro = e;
      await new Promise((ok) => setTimeout(ok, 1000 * (i + 1)));
    }
  }
  throw new Error(`falhou ${url}: ${erro?.message ?? erro}`);
}

const arredonda = (n) => Math.round(n * 1000) / 1000;

/** Arredonda um anel e tira pontos repetidos; anel com menos de 4 pontos some. */
function anel(pontos) {
  const saida = [];
  for (const [x, y] of pontos) {
    const p = [arredonda(x), arredonda(y)];
    const ult = saida[saida.length - 1];
    if (!ult || ult[0] !== p[0] || ult[1] !== p[1]) saida.push(p);
  }
  return saida.length >= 4 ? saida : null;
}

function leve(geometria) {
  if (geometria.type === "Polygon") {
    const aneis = geometria.coordinates.map(anel).filter(Boolean);
    return aneis.length ? { type: "Polygon", coordinates: aneis } : null;
  }
  if (geometria.type === "MultiPolygon") {
    const polis = geometria.coordinates.map((p) => p.map(anel).filter(Boolean)).filter((p) => p.length);
    return polis.length ? { type: "MultiPolygon", coordinates: polis } : null;
  }
  return null;
}

function colecao(features, props) {
  return {
    type: "FeatureCollection",
    features: features
      .map((f) => {
        const g = leve(f.geometry);
        const codigo = String(f.properties?.codarea ?? "");
        return g ? { type: "Feature", geometry: g, properties: { codigo, ...(props(codigo) ?? {}) } } : null;
      })
      .filter(Boolean),
  };
}

async function main() {
  await mkdir(path.join(SAIDA, "uf"), { recursive: true });
  const estados = await buscar(`${BASE}/v1/localidades/estados?orderBy=nome`);
  const porCodigo = new Map(estados.map((e) => [String(e.id), e]));
  await writeFile(
    path.join(SAIDA, "indice.json"),
    JSON.stringify(estados.map((e) => ({ codigo: String(e.id), sigla: e.sigla, nome: e.nome }))),
  );

  const pais = await buscar(`${BASE}/v3/malhas/paises/BR?formato=${FORMATO}&qualidade=minima&intrarregiao=UF`);
  const brasil = colecao(pais.features, (c) => {
    const e = porCodigo.get(c);
    return e ? { sigla: e.sigla, nome: e.nome } : {};
  });
  await writeFile(path.join(SAIDA, "brasil.geojson"), JSON.stringify(brasil));
  console.log(`brasil.geojson: ${brasil.features.length} UFs`);
  if (so_brasil) return;

  // Os nomes dos municípios vêm de scripts/vale-o-escrito/municipios.json (gerado por gerar-municipios.mjs), se existir.
  let nomes = {};
  try {
    nomes = JSON.parse(await readFile(path.join(RAIZ, "scripts", "vale-o-escrito", "municipios.json"), "utf8"));
  } catch {
    console.warn("municipios.json ausente: os municípios saem sem nome (rode gerar-municipios.mjs antes).");
  }

  for (const e of estados) {
    const malha = await buscar(`${BASE}/v3/malhas/estados/${e.id}?formato=${FORMATO}&qualidade=minima&intrarregiao=municipio`);
    const col = colecao(malha.features, (c) => ({ nome: nomes[c]?.n ?? "", uf: e.sigla }));
    await writeFile(path.join(SAIDA, "uf", `${e.sigla}.geojson`), JSON.stringify(col));
    console.log(`uf/${e.sigla}.geojson: ${col.features.length} municípios`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

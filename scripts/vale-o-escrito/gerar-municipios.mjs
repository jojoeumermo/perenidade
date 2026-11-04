// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: gera scripts/vale-o-escrito/municipios.json (código IBGE de 7 dígitos → {n: nome, uf: sigla}) a partir do
// serviço de localidades do IBGE (https://servicodados.ibge.gov.br/api/v1/localidades/municipios). O robô usa o arquivo
// no filtro por municípios; o mapa usa os nomes. Uso: node scripts/vale-o-escrito/gerar-municipios.mjs
import { writeFile } from "node:fs/promises";
import path from "node:path";

const URL_MUNICIPIOS = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";

async function main() {
  const r = await fetch(URL_MUNICIPIOS, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const lista = await r.json();
  const saida = {};
  for (const m of lista) {
    // A UF vem por caminhos diferentes conforme o município (microrregião ou região imediata).
    const uf = m.microrregiao?.mesorregiao?.UF?.sigla ?? m["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla;
    if (m.id && m.nome && uf) saida[String(m.id)] = { n: m.nome, uf };
  }
  const codigos = Object.keys(saida).sort();
  const ordenado = Object.fromEntries(codigos.map((c) => [c, saida[c]]));
  await writeFile(path.join(process.cwd(), "scripts", "vale-o-escrito", "municipios.json"), JSON.stringify(ordenado));
  console.log(`municipios.json: ${codigos.length} municípios`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

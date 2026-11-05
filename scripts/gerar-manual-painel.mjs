// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Copia docs/MANUAL-DA-COORDENACAO.md para components/painel/manual-texto.ts, para o painel mostrar o mesmo texto
// sem ler disco em tempo de execução. Rodar: npm run manual-painel  (o teste confere se a cópia está em dia).
import fs from "node:fs";
import path from "node:path";

const raiz = path.join(import.meta.dirname, "..");
const origem = path.join(raiz, "docs", "MANUAL-DA-COORDENACAO.md");
const destino = path.join(raiz, "components", "painel", "manual-texto.ts");

export function gerar(texto) {
  const limpo = texto.replace(/\r\n/g, "\n");
  return [
    "// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).",
    "// GERADO por scripts/gerar-manual-painel.mjs a partir de docs/MANUAL-DA-COORDENACAO.md. Não edite aqui: edite o .md e rode `npm run manual-painel`.",
    `export const MANUAL_DA_COORDENACAO = ${JSON.stringify(limpo)};`,
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  fs.writeFileSync(destino, gerar(fs.readFileSync(origem, "utf8")), "utf8");
  console.log("manual-texto.ts atualizado.");
}

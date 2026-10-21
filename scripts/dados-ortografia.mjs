// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Copia o dicionário Hunspell de português do Brasil (VERO, de Raimundo Moura e equipe, via o pacote dictionary-pt;
// LGPL-3.0 ou MPL-2.0) para public/dados/ortografia, comprimido, com a licença ao lado. O corretor carrega estes
// arquivos do próprio site, só quando alguém o abre. Uso: node scripts/dados-ortografia.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const raiz = path.resolve(import.meta.dirname, "..");
const origem = path.join(raiz, "node_modules/dictionary-pt");
const destino = path.join(raiz, "public/dados/ortografia");
fs.mkdirSync(destino, { recursive: true });
for (const [de, para] of [["index.aff", "pt-br.aff.gzip"], ["index.dic", "pt-br.dic.gzip"]]) {
  fs.writeFileSync(path.join(destino, para), zlib.gzipSync(fs.readFileSync(path.join(origem, de)), { level: 9 }));
}
fs.copyFileSync(path.join(origem, "license"), path.join(destino, "LICENCA-VERO.txt"));
const versao = JSON.parse(fs.readFileSync(path.join(origem, "package.json"), "utf8")).version;
fs.writeFileSync(path.join(destino, "meta.json"), JSON.stringify({ fonte: `dictionary-pt ${versao} (VERO, LibreOffice)`, licenca: "LGPL-3.0 ou MPL-2.0", copiado_em: new Date().toISOString().slice(0, 10) }, null, 1));
console.log("ok", fs.readdirSync(destino).map((n) => `${n} ${Math.round(fs.statSync(path.join(destino, n)).size / 1024)} KB`).join(", "));

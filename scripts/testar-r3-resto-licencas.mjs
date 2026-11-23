// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (g): a licença exata da @wireapp/core-crypto na tag da versão fixada e a cláusula do asn1-parser,
// conferidas e registradas em THIRD_PARTY_LICENSES.md e docs/NOTICE.md. Este teste prende o registro ao que está instalado: se a
// versão do package-lock.json mudar, ou se o asn1-parser passar a trazer o Anexo B da MPL-2.0, o registro precisa ser refeito.
// Uso: node scripts/testar-r3-resto-licencas.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

const trava = JSON.parse(ler("package-lock.json"));
const cc = trava.packages["node_modules/@wireapp/core-crypto"];
const asn = trava.packages["node_modules/asn1-parser"];
const terceiros = ler("THIRD_PARTY_LICENSES.md");
const aviso = ler("docs/NOTICE.md");

ok("a core-crypto fixada é a 11.0.1 (a tag conferida)", cc?.version === "11.0.1");
ok("o registro diz a licença exata da tag (GPL-3.0-only) e o commit dela", /tag `v11\.0\.1`/.test(terceiros) && /GPL-3\.0-only/.test(terceiros) && /20babc2ae47cbd0b2edd8ce32d0bb955317a9f14/.test(terceiros));
ok("o registro guarda o resumo do LICENSE da tag", /198fa22b0f276c8810470fbb3cec7fac6fb48473092daeb150668c1610a7f52f/.test(terceiros));
ok("o NOTICE diz GPL-3.0-only", /GPL-3\.0-only/.test(aviso));
ok("nada ficou como \"não conferido\" na licença da core-crypto", !/não feito nesta revisão, sem acesso à rede/.test(terceiros));
ok("o asn1-parser fixado é o 1.1.8", asn?.version === "1.1.8");
const arquivo = path.join(raiz, "node_modules/asn1-parser/asn1-parser.js");
if (fs.existsSync(arquivo)) {
  const fonte = fs.readFileSync(arquivo, "utf8");
  ok("o asn1-parser traz o Anexo A da MPL-2.0", /Mozilla Public\s*\n?\s*\*?\s*License, v\. 2\.0/.test(fonte));
  ok("o asn1-parser não traz o Anexo B (incompatível com licenças secundárias)", !/Incompatible With Secondary Licenses/i.test(fonte));
} else falhas.push("node_modules/asn1-parser/asn1-parser.js não está instalado");
ok("o registro diz que o asn1-parser não traz a cláusula", /sem a cláusula "Incompatible With Secondary Licenses"/.test(terceiros) && !/não foi conferida no repositório de origem/.test(terceiros));

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);

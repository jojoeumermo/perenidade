// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Cola supabase/migracoes/20261110-alumia-b1-comunidade.sql inteira no supabase/install.sql: troca a cópia anterior NO LUGAR (o fim
// da onda, 20261111-alumia-onda6-fim.sql, continua por último); sem cópia anterior, cola no fim.
// Uso: node scripts/colar-b1-comunidade.mjs
import fs from "node:fs";

const inst = new URL("../supabase/install.sql", import.meta.url);
const mig = fs.readFileSync(new URL("../supabase/migracoes/20261110-alumia-b1-comunidade.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
let t = fs.readFileSync(inst, "utf8");
const crlf = t.includes("\r\n");
t = t.replace(/\r\n/g, "\n");
const colar = mig.replace(/\n*$/, "\n");
const ini = t.indexOf("-- ═══════════════════════════ Alumia · B1 · comunidade:");
let onde = "no fim";
if (ini >= 0) {
  const cab = t.lastIndexOf("-- Instituto Lúcia", ini);
  const marca = "-- ═══════════════════════════ fim da Alumia · B1 · comunidade ═══════════════════════════";
  const fim = t.indexOf(marca, ini);
  if (cab < 0 || fim < 0) throw new Error("install.sql: cópia anterior da B1 comunidade sem começo ou fim");
  // O que vem depois da cópia (o fim da onda) fica onde está, com a linha em branco de sempre entre os blocos.
  const resto = t.slice(fim + marca.length).replace(/^\n+/, "");
  t = t.slice(0, cab) + colar + (resto ? "\n" + resto : "");
  onde = "no lugar da cópia anterior";
} else {
  t = t.replace(/\n*$/, "\n") + "\n" + colar;
}
fs.writeFileSync(inst, crlf ? t.replace(/\n/g, "\r\n") : t);
console.log(`install.sql: B1 comunidade colada ${onde}.`);

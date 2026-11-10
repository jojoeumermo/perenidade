// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Cola supabase/migracoes/20261110-alumia-b1-comunidade.sql inteira no fim do supabase/install.sql (troca a cópia anterior, se houver).
// Uso: node scripts/colar-b1-comunidade.mjs
import fs from "node:fs";

const inst = new URL("../supabase/install.sql", import.meta.url);
const mig = fs.readFileSync(new URL("../supabase/migracoes/20261110-alumia-b1-comunidade.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
let t = fs.readFileSync(inst, "utf8");
const crlf = t.includes("\r\n");
t = t.replace(/\r\n/g, "\n");
const ini = t.indexOf("-- ═══════════════════════════ Alumia · B1 · comunidade:");
if (ini >= 0) {
  const cab = t.lastIndexOf("-- Instituto Lúcia", ini);
  const marca = "-- ═══════════════════════════ fim da Alumia · B1 · comunidade ═══════════════════════════";
  const fim = t.indexOf(marca, ini);
  if (cab < 0 || fim < 0) throw new Error("install.sql: cópia anterior da B1 comunidade sem começo ou fim");
  t = t.slice(0, cab) + t.slice(fim + marca.length).replace(/^\n+/, "");
}
t = t.replace(/\n*$/, "\n") + "\n" + mig.replace(/\n*$/, "\n");
fs.writeFileSync(inst, crlf ? t.replace(/\n/g, "\r\n") : t);
console.log("install.sql: B1 comunidade colada no fim.");

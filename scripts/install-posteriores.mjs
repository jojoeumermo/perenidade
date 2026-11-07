// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os testes que conferem "o install.sql termina com a migração X" precisam ignorar as migrações que entraram DEPOIS de X.
// As migrações novas têm nome com data (AAAAMMDD-algo.sql, ex.: 20261106-pessoas-painel.sql) e são acrescentadas inteiras
// no fim do install.sql. Esta função tira do fim, uma a uma, todas as que estiverem lá inteiras (em qualquer ordem) e devolve
// o resto. Assim, cada frente nova não precisa reescrever a lista de ordem em cada teste.
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

/** As migrações com nome datado (AAAAMMDD-*.sql), já normalizadas. */
export function migracoesDatadas() {
  const pasta = path.join(raiz, "supabase", "migracoes");
  return fs
    .readdirSync(pasta)
    .filter((n) => /^\d{8}-.+\.sql$/.test(n))
    .map((n) => ({ nome: n, sql: normal(fs.readFileSync(path.join(pasta, n), "utf8")) }));
}

/** O texto do install.sql (ou o passado) sem as migrações datadas que estão inteiras no fim. */
export function semPosteriores(texto = fs.readFileSync(path.join(raiz, "supabase", "install.sql"), "utf8")) {
  let resto = normal(texto);
  const blocos = migracoesDatadas();
  for (let mudou = true; mudou; ) {
    mudou = false;
    for (const { sql } of blocos) {
      if (sql && resto.endsWith(sql)) {
        resto = resto.slice(0, -sql.length).trim();
        mudou = true;
      }
    }
  }
  return resto;
}

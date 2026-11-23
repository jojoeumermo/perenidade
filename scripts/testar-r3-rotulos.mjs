// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Junção da R3: os rótulos da cifra de todas as frentes da R2 e da R3 juntos em lib/rede/cifra/rotulos.ts, sem repetição e sem um ser
// começo de outro; os que só existem fora do TypeScript (Rust, SQL do chat, cerimônia) escritos igual no arquivo de origem; e todo
// rótulo "alumia/r3/..." escrito no código está numa lista (um rótulo novo esquecido fora da lista faz o teste falhar).
// Uso: npm run testar:r3-rotulos
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let falhas = 0;
let total = 0;
const ok = (nome, cond, extra = "") => {
  total++;
  if (cond) console.log(`ok   ${nome}`);
  else {
    falhas++;
    console.log(`FALHA ${nome}${extra ? ` (${extra})` : ""}`);
  }
};

const rotulos = await import("../lib/rede/cifra/rotulos.ts");
const todos = new Set(Object.values(rotulos.LISTAS).flatMap((l) => Object.values(l)));

ok("as listas da R2 continuam", ["caixas", "dupla", "cofres", "grupos", "membros", "voto"].every((f) => Object.keys(rotulos.LISTAS[f] ?? {}).length > 0));
ok(
  "as listas da R3 estão juntas",
  ["equipe", "folhas", "enquete", "pq", "trava", "malha", "passes", "instancias", "fora-do-ts"].every((f) => Object.keys(rotulos.LISTAS[f] ?? {}).length > 0),
  Object.keys(rotulos.LISTAS).join(","),
);
ok("nenhum rótulo se repete (R2 e R3)", rotulos.rotulosRepetidos().length === 0, JSON.stringify(rotulos.rotulosRepetidos()));
ok("nenhum é começo de outro (fora o separador /)", rotulos.rotulosPrefixos().length === 0, JSON.stringify(rotulos.rotulosPrefixos()));
ok("as cópias de outra frente são iguais ao original", rotulos.copiasDiferentes().length === 0, rotulos.copiasDiferentes().join(","));
for (const [arquivo, lista] of Object.entries(rotulos.FORA_DO_TS)) {
  const texto = readFileSync(arquivo, "utf8");
  for (const r of lista) ok(`${r} está escrito em ${arquivo}`, texto.includes(r));
}

// Todo "alumia/r3/<...>/vN" escrito no código de lib/, nativo/ (fora de target/) e scripts/segredos está numa lista.
const achados = new Map();
const andar = (dir) => {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === "target" || nome.startsWith(".")) continue;
    const c = join(dir, nome);
    if (statSync(c).isDirectory()) andar(c);
    else if (/\.(ts|tsx|mjs|rs|sql|kt)$/.test(nome)) {
      for (const m of readFileSync(c, "utf8").matchAll(/alumia\/r3\/[a-z0-9\-/]+\/v\d+/g)) {
        if (!achados.has(m[0])) achados.set(m[0], c);
      }
    }
  }
};
for (const d of ["lib", "nativo", "scripts/segredos", "android/app/src/main"]) {
  try {
    andar(d);
  } catch {
    /* pasta ausente */
  }
}
const fora = [...achados].filter(([r]) => !todos.has(r));
ok("todo rótulo alumia/r3/… do código está numa lista", fora.length === 0, fora.map(([r, c]) => `${r} em ${c}`).join("; "));

// O ataque: um rótulo novo repetido entre duas frentes é achado.
ok("um rótulo da R3 repetido de propósito é achado", rotulos.rotulosRepetidos({ ...rotulos.LISTAS, x: { y: "alumia/r3/pq/camada/v1" } }).length === 1);

console.log(`\n${total - falhas}/${total} ok`);
process.exit(falhas ? 1 : 0);

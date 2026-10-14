#!/bin/sh
# Validador rápido do conteúdo de content/ (as mesmas regras do build, em ~2 s). Uso, da raiz do projeto: sh docs/rodada-geral/validar-conteudo.sh
set -e
ROOT="$(pwd)"
mkdir -p "$ROOT/node_modules/.cache"; OUT="$(mktemp -d "$ROOT/node_modules/.cache/validar-XXXXXX")"
cat > "$OUT/entry.ts" <<EOT
import * as c from "$ROOT/lib/content";
const langs = ["pt", "en", "es", "zh", "ru"] as const;
const skip = ["getCatalog", "getTrack", "getBook", "getPage"];
let errors = 0;
const counts: Record<string, number> = {};
for (const lang of langs) for (const [name, fn] of Object.entries(c)) {
  if (!name.startsWith("get") || typeof fn !== "function" || skip.includes(name)) continue;
  try { const r = (fn as (l: string) => unknown)(lang); if (lang === "pt" && Array.isArray(r)) counts[name] = r.length; }
  catch (e) { errors++; console.error("[" + lang + "] " + name + ": " + (e as Error).message); }
}
console.log(JSON.stringify(counts));
console.log(errors ? errors + " erro(s)" : "conteudo ok");
process.exit(errors ? 1 : 0);
EOT
npx --yes esbuild@0.25.12 "$OUT/entry.ts" --bundle --platform=node --format=esm --outfile="$OUT/out.mjs" --tsconfig="$ROOT/tsconfig.json" --external:react --log-level=error --define:process.env.NODE_ENV='"production"' --banner:js="import {createRequire} from 'module';const require=createRequire(import.meta.url);"
cd "$ROOT" && node "$OUT/out.mjs" || { rm -rf "$OUT"; exit 1; }
rm -rf "$OUT"

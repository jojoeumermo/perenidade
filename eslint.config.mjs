// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Interpretadores copiados das dependências (scripts/preparar.mjs).
    "public/pyodide/**",
    "public/php/**",
    "public/typescript/**",
    "public/lua/**",
    "public/ruby/**",
    "public/jscpp/**",
    // Livros digitais gerados a cada montagem (npm run epub).
    "public/epub/**",
    // Função que roda no serviço de contas (Deno), fora do site.
    "supabase/functions/**",
    // Pacotes oficiais dos editores avançados (PhotoCraft, FilmCraft, Blockbench, three.js…), baixados por
    // scripts/editores.mjs e publicados sem modificação. Nada ali é código nosso.
    "estudio/site/**",
  ]),
]);

export default eslintConfig;

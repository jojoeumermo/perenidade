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
    // Vozes e o motor de fala baixados no prebuild (scripts/vozes-baixar.mjs), fora do git.
    "public/vozes/**",
    // Cópias locais de LOOPY e Parable of the Polygons (CC0, Nicky Case), sem modificação do código (docs/LABS-EXTERNOS.md).
    "public/labs/loopy/**",
    "public/labs/polygons/**",
    // Livros digitais gerados a cada montagem (npm run epub).
    "public/epub/**",
    // Função que roda no serviço de contas (Deno), fora do site.
    "supabase/functions/**",
    // Pacotes oficiais dos editores avançados (PhotoCraft, FilmCraft, Blockbench, three.js…), baixados por
    // scripts/editores.mjs e publicados sem modificação. Nada ali é código nosso.
    "estudio/site/**",
    // Pastas ocultas das ferramentas locais de cada pessoa (podem conter cópias do projeto já montadas).
    ".*/**",
    // O painel de monitoramento tem o próprio projeto, com a própria configuração.
    "sentinela/**",
    // A casca do chat montada (casca/montar.mjs) e a cópia dela dentro do projeto Android (npx cap sync): saída do build.
    "casca/saida/**",
    "casca/.next/**",
    "casca/public/cifra/**",
    "android/**",
    // As saídas do Cargo (o app do computador e os crates nativos): o Tauri gera lá cópias comprimidas da casca com nome .js.
    "desktop/src-tauri/target/**",
    "nativo/**/target/**",
  ]),
]);

export default eslintConfig;

// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
//
// Sobe o banco de teste local e o site apontando para ele. Uso: npm run dev:local [porta]
import { spawn } from "node:child_process";
import { CHAVE_ANON, iniciar, URL_LOCAL } from "./backend-local.mjs";

await iniciar();
const porta = process.argv[2] ?? "3100";
const site = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", porta], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: URL_LOCAL, NEXT_PUBLIC_SUPABASE_ANON_KEY: CHAVE_ANON, NEXT_PUBLIC_AUTH_GOOGLE: "" },
});
site.on("exit", (codigo) => process.exit(codigo ?? 0));

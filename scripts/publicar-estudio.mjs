// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Publica estudio.institutolucia.org na Cloudflare: os arquivos acima de 25 MiB vão para o bucket R2
// (estudio-lucia-grandes) e ficam fora dos arquivos estáticos (.assetsignore); depois o Worker é publicado com a pasta
// estudio/site. Antes, monte a pasta com node scripts/editores.mjs. Precisa estar logado: npx wrangler login.
//
// Uso: node scripts/publicar-estudio.mjs [--sem-r2]   (--sem-r2: publica sem os arquivos grandes, enquanto o R2 não
// estiver ativado na conta; o FilmCraft e o EffectCraft ficam sem abrir até a próxima publicação completa)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const ESTUDIO = path.join(RAIZ, "estudio");
const SITE = path.join(ESTUDIO, "site");
const LIMITE = 25 * 1024 * 1024;
const BALDE = "estudio-lucia-grandes";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const wrangler = (...args) => execFileSync(npx, ["--yes", "wrangler@4", ...args], { cwd: ESTUDIO, stdio: "inherit", shell: process.platform === "win32" });

function arquivos(pasta, base = "") {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? arquivos(path.join(pasta, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]));
}

if (!fs.existsSync(path.join(SITE, "_headers"))) throw new Error("Monte a pasta antes: node scripts/editores.mjs");
const grandes = arquivos(SITE).filter((f) => fs.statSync(path.join(SITE, f)).size > LIMITE);
fs.writeFileSync(path.join(SITE, ".assetsignore"), [".versao.json", "**/.versao.json", ...grandes].join("\n") + "\n");
console.log(`Acima de 25 MiB (vão para o R2): ${grandes.join(", ") || "nenhum"}`);

if (process.argv.includes("--sem-r2")) {
  const config = JSON.parse(fs.readFileSync(path.join(ESTUDIO, "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, ""));
  delete config.r2_buckets;
  fs.writeFileSync(path.join(ESTUDIO, "wrangler.sem-r2.json"), JSON.stringify(config, null, 2));
  wrangler("deploy", "--config", "wrangler.sem-r2.json");
} else {
  try {
    wrangler("r2", "bucket", "create", BALDE);
  } catch {
    console.log(`(o bucket ${BALDE} já existe)`);
  }
  for (const f of grandes) wrangler("r2", "object", "put", `${BALDE}/${f}`, "--file", path.join(SITE, f), "--remote", "--content-type", f.endsWith(".wasm") ? "application/wasm" : "application/octet-stream");
  wrangler("deploy");
}
console.log("Pronto: https://estudio.institutolucia.org/");

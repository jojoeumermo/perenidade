// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Publica estudio.institutolucia.org na Cloudflare. A Cloudflare não aceita arquivo estático acima de 25 MiB, e o
// WebAssembly do FilmCraft, do EffectCraft e do WordCraft passa disso: cada um sobe cortado em partes de 20 MiB
// (<arquivo>.parte-0, .parte-1…) com um índice (<arquivo>.partes.json), e o Worker (estudio/worker.js) emenda as partes
// na hora em que o navegador pede o arquivo. O original fica fora da publicação (.assetsignore). Não precisa de R2.
// Antes, monte a pasta com node scripts/editores.mjs. Precisa estar logado: npx wrangler login.
//
// Uso: node scripts/publicar-estudio.mjs            (corta, confere e publica)
//      node scripts/publicar-estudio.mjs --so-cortar (só corta e confere, sem publicar: para testar)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const ESTUDIO = path.join(RAIZ, "estudio");
const SITE = path.join(ESTUDIO, "site");
const LIMITE = 25 * 1024 * 1024;
const PARTE = 20 * 1024 * 1024;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const wrangler = (...args) => execFileSync(npx, ["--yes", "wrangler@4", ...args], { cwd: ESTUDIO, stdio: "inherit", shell: process.platform === "win32" });

function arquivos(pasta, base = "") {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? arquivos(path.join(pasta, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]));
}

/** Corta um arquivo em partes e escreve o índice. Devolve os nomes das partes (relativos à pasta do site). */
export function cortar(site, relativo, tamanhoDaParte = PARTE) {
  const dados = fs.readFileSync(path.join(site, relativo));
  const partes = [];
  for (let i = 0, n = 0; i < dados.length; i += tamanhoDaParte, n++) {
    const nome = `${relativo}.parte-${n}`;
    fs.writeFileSync(path.join(site, nome), dados.subarray(i, i + tamanhoDaParte));
    partes.push(nome);
  }
  const sha256 = createHash("sha256").update(dados).digest("hex");
  fs.writeFileSync(path.join(site, `${relativo}.partes.json`), JSON.stringify({ tamanho: dados.length, partes, sha256 }));
  return partes;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  if (!fs.existsSync(path.join(SITE, "_headers"))) throw new Error("Monte a pasta antes: node scripts/editores.mjs");
  // Partes de uma publicação anterior saem antes: a versão pode ter mudado.
  for (const f of arquivos(SITE)) if (/\.parte-\d+$|\.partes\.json$/.test(f)) fs.rmSync(path.join(SITE, f));
  const grandes = arquivos(SITE).filter((f) => fs.statSync(path.join(SITE, f)).size > LIMITE);
  for (const f of grandes) {
    const partes = cortar(SITE, f);
    // Conferência: as partes emendadas têm de dar exatamente o arquivo de antes.
    const junto = Buffer.concat(partes.map((p) => fs.readFileSync(path.join(SITE, p))));
    if (!junto.equals(fs.readFileSync(path.join(SITE, f)))) throw new Error(`as partes de ${f} não conferem`);
    console.log(`${f}: ${(junto.length / 1048576).toFixed(1)} MB em ${partes.length} partes`);
  }
  fs.writeFileSync(path.join(SITE, ".assetsignore"), [".versao.json", "**/.versao.json", ...grandes].join("\n") + "\n");
  if (!grandes.length) console.log("Nenhum arquivo acima de 25 MiB.");
  if (process.argv.includes("--so-cortar")) process.exit(0);
  // Publicar troca o estúdio inteiro: o que não estiver na pasta SAI do ar. Sem um editor ou sem o laboratório /kali
  // montado aqui, a publicação para (aconteceu: uma publicação sem o kali deixou o laboratório de segurança preto).
  const faltam = ["photocraft", "filmcraft", "effectcraft", "wordcraft", "gridcraft", "deckcraft", "blockbench", "sculptgl", "threejs", "kali"].filter((pasta) => !fs.existsSync(path.join(SITE, pasta)));
  if (faltam.length && !process.argv.includes("--mesmo-incompleto")) {
    console.error(`Falta montar: ${faltam.join(", ")}. Rode node scripts/editores.mjs e node scripts/kali.mjs antes (ou --mesmo-incompleto, se for de propósito).`);
    process.exit(1);
  }
  wrangler("deploy");
  console.log("Pronto: https://estudio.institutolucia.org/");
}

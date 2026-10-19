// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os editores de 3D do Estúdio de prática (Blockbench, SculptGL e o editor do three.js) não publicam um pacote web
// pronto como os do ArtCraft. Então o instituto compila cada um a partir do código oficial, na versão e no commit
// fixados abaixo, SEM mudar uma linha: clona o repositório, confere o commit, instala as dependências pelo lockfile
// (npm ci confere a integridade de cada pacote) e roda o build do próprio projeto. O resultado vai para
// estudio/site/<editor>/, ao lado dos editores do ArtCraft. Precisa de git e Node no computador.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const LIVRES = {
  blockbench: { repo: "https://github.com/JannisX11/blockbench.git", ref: "v5.2.2", commit: "c9ace42ef1b770bdadfe656729c7833b8feb37d2", entrada: "index.html" },
  sculptgl: { repo: "https://github.com/stephomi/sculptgl.git", ref: "master", commit: "8e45dafc0f7906e5238dfffc1a2df742bd25f29d", entrada: "index.html" },
  threejs: { repo: "https://github.com/mrdoob/three.js.git", ref: "r186", commit: "9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8", entrada: "editor/index.html" },
};

// O que cada editor precisa para funcionar no navegador (o resto do repositório é código-fonte, testes e o app de computador).
const COPIAR = {
  blockbench: ["index.html", "manifest.webmanifest", "favicon.png", "icon.png", "icon_full.png", "icon_maskable.png", "dist/bundle.js", "css", "assets", "font", "icons", "lang", "lib", "content", "keymaps", "themes", "LICENSE.MD"],
  sculptgl: ["app/index.html", "app/sculptgl.js", "app/sculptgl.js.LICENSE.txt", "app/css", "app/resources", "app/worker", "LICENSE"],
  threejs: ["editor", "build", "examples/jsm", "LICENSE"],
};

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const rodar = (cmd, args, cwd, env = {}) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, ...env }, shell: process.platform === "win32" && cmd.endsWith(".cmd") });

function copiar(de, para) {
  const st = fs.statSync(de);
  if (st.isDirectory()) {
    fs.mkdirSync(para, { recursive: true });
    for (const nome of fs.readdirSync(de)) copiar(path.join(de, nome), path.join(para, nome));
  } else if (!de.endsWith(".map")) {
    fs.mkdirSync(path.dirname(para), { recursive: true });
    fs.copyFileSync(de, para);
  }
}

function tamanho(pasta) {
  let total = 0;
  for (const nome of fs.readdirSync(pasta, { withFileTypes: true })) total += nome.isDirectory() ? tamanho(path.join(pasta, nome.name)) : fs.statSync(path.join(pasta, nome.name)).size;
  return total;
}

/** Clona, confere o commit, compila (quando o projeto pede) e copia o necessário para destino/<id>/. */
export function montarLivre(id, destino) {
  const f = LIVRES[id];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `estudio-${id}-`));
  console.log(`${id} ${f.ref}: clonando ${f.repo}`);
  if (id === "threejs") {
    // O repositório do three.js é enorme: baixa só as pastas que o editor usa.
    rodar("git", ["clone", "-q", "--depth", "1", "--branch", f.ref, "--filter=blob:none", "--sparse", f.repo, tmp], os.tmpdir());
    rodar("git", ["sparse-checkout", "set", ...COPIAR.threejs.filter((x) => x !== "LICENSE")], tmp);
  } else {
    rodar("git", ["clone", "-q", f.repo, tmp], os.tmpdir());
    rodar("git", ["-c", "advice.detachedHead=false", "checkout", "-q", f.commit], tmp);
  }
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: tmp }).toString().trim();
  if (commit !== f.commit) throw new Error(`${id}: o commit não confere (esperado ${f.commit}, veio ${commit})`);
  if (id === "blockbench") {
    rodar(npm, ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], tmp);
    rodar(npm, ["run", "build-web"], tmp);
  }
  if (id === "sculptgl") {
    rodar(npm, ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--legacy-peer-deps"], tmp);
    // O webpack 5.21 usa um hash que o OpenSSL 3 só aceita no modo legado.
    rodar(process.execPath, [path.join(tmp, "node_modules", "webpack", "bin", "webpack.js"), "--env", "release"], tmp, { NODE_OPTIONS: "--openssl-legacy-provider" });
  }
  const pasta = path.join(destino, id);
  fs.rmSync(pasta, { recursive: true, force: true });
  for (const item of COPIAR[id]) {
    const de = path.join(tmp, item);
    if (!fs.existsSync(de)) throw new Error(`${id}: falta ${item} depois do build`);
    copiar(de, path.join(pasta, id === "sculptgl" ? item.replace(/^app\//, "") : item));
  }
  fs.writeFileSync(path.join(pasta, ".versao.json"), JSON.stringify({ editor: id, versao: f.ref, commit, montado_em: new Date().toISOString() }, null, 2));
  fs.rmSync(tmp, { recursive: true, force: true });
  const mb = tamanho(pasta) / 1048576;
  console.log(`  commit ${commit.slice(0, 12)} confere; ${mb.toFixed(1)} MB em estudio/site/${id}/`);
  return { id, versao: f.ref, mb, grandes: [] };
}

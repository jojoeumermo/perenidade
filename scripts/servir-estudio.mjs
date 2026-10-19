// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Serve a pasta estudio/site no computador (http://localhost:4600), aplicando as regras do _headers do mesmo jeito
// que a Cloudflare Pages: para testar os editores avançados antes de publicar. Uso: node scripts/servir-estudio.mjs
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "estudio", "site");
const PORTA = Number(process.env.PORTA ?? 4600);
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".css": "text/css", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ttf": "font/ttf", ".woff2": "font/woff2", ".woff": "font/woff", ".webp": "image/webp", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".hdr": "application/octet-stream" };

/** As regras do _headers: [{ padrao: RegExp, cabecalhos: [nome, valor][], tirar: string[] }]. */
function lerRegras() {
  const arquivo = path.join(RAIZ, "_headers");
  if (!fs.existsSync(arquivo)) return [];
  const regras = [];
  let atual = null;
  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    if (!linha.trim() || linha.trim().startsWith("#")) continue;
    if (!/^\s/.test(linha)) {
      const padrao = new RegExp(`^${linha.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
      atual = { padrao, cabecalhos: [], tirar: [] };
      regras.push(atual);
    } else if (atual) {
      const texto = linha.trim();
      if (texto.startsWith("!")) atual.tirar.push(texto.slice(1).trim().toLowerCase());
      else {
        const i = texto.indexOf(":");
        atual.cabecalhos.push([texto.slice(0, i).trim(), texto.slice(i + 1).trim()]);
      }
    }
  }
  return regras;
}

http
  .createServer((req, res) => {
    const caminho = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let arquivo = path.normalize(path.join(RAIZ, caminho));
    if (!arquivo.startsWith(RAIZ)) return res.writeHead(403).end();
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, "index.html");
    if (!fs.existsSync(arquivo)) return res.writeHead(404).end("404");
    const cabecalhos = new Map([["content-type", TIPOS[path.extname(arquivo)] ?? "application/octet-stream"]]);
    for (const regra of lerRegras()) {
      if (!regra.padrao.test(caminho)) continue;
      for (const nome of regra.tirar) cabecalhos.delete(nome);
      for (const [nome, valor] of regra.cabecalhos) cabecalhos.set(nome.toLowerCase(), valor);
    }
    res.writeHead(200, Object.fromEntries(cabecalhos));
    fs.createReadStream(arquivo).pipe(res);
  })
  .listen(PORTA, () => console.log(`Estúdio em http://localhost:${PORTA}/ (pasta ${RAIZ})`));

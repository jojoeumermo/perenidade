// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As capas das obras do acervo, guardadas no próprio site (public/capas/<id>.webp): o visitante nunca carrega imagem
// de outro endereço. Só fontes de capa aberta: Project Gutenberg (capas das edições em domínio público) e OpenStax
// (livros CC BY, capa pela API pública deles). As outras obras (Arquivo Marxista, leis, SciELO…) não têm capa
// publicada que possa ser reaproveitada: o site desenha uma capa tipográfica para elas.
// Cada capa é reduzida (240 px de largura) e regravada em WebP sem metadados. O crédito de cada uma fica em
// content/capas.json. Baixa devagar (uma por segundo) e pula as que já existem. A capa que o Gutenberg gera sozinho
// (desenho geométrico colorido, sem relação com a obra; scripts/capa-gerada.mjs) não é guardada: fica marcada como
// "gerada" e a obra usa a capa tipográfica do site.
//
// Uso: node scripts/capas.mjs            (baixa o que falta)
//      node scripts/capas.mjs --refazer  (baixa tudo de novo)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { capaGerada } from "./capa-gerada.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaAcervo = path.join(raiz, "content", "acervo");
const pastaCapas = path.join(raiz, "public", "capas");
const arquivoCreditos = path.join(raiz, "content", "capas.json");
const refazer = process.argv.includes("--refazer");
const AGENTE = "InstitutoLucia-capas/1.0 (+https://institutolucia.org; biblioteca comunitária sem fins lucrativos)";
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

function cabecalho(texto) {
  const m = /^---\n([\s\S]*?)\n---/.exec(texto.replace(/\r\n/g, "\n"));
  const dados = {};
  for (const linha of (m?.[1] ?? "").split("\n")) {
    const par = /^(\w+):\s*"?(.*?)"?\s*$/.exec(linha);
    if (par) dados[par[1]] = par[2];
  }
  return dados;
}

async function baixar(url) {
  const r = await fetch(url, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function gravar(id, dados) {
  const saida = path.join(pastaCapas, `${id}.webp`);
  await sharp(dados, { density: 150 }).resize({ width: 240, height: 360, fit: "cover", position: "top" }).webp({ quality: 72 }).toFile(saida);
  return fs.statSync(saida).size;
}

fs.mkdirSync(pastaCapas, { recursive: true });
const creditos = fs.existsSync(arquivoCreditos) ? JSON.parse(fs.readFileSync(arquivoCreditos, "utf8")) : {};
const obras = fs.readdirSync(pastaAcervo).filter((f) => f.endsWith(".md") && !/\.\w\w\.md$/.test(f)).map((f) => ({ id: f.replace(/\.md$/, ""), ...cabecalho(fs.readFileSync(path.join(pastaAcervo, f), "utf8")) }));

// OpenStax: a lista de livros com a capa, numa chamada só.
let capasOpenstax = new Map();
if (obras.some((o) => String(o.url).includes("openstax.org"))) {
  try {
    const lista = JSON.parse((await baixar("https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&fields=title,cover_url,slug&limit=300")).toString("utf8"));
    capasOpenstax = new Map((lista.items ?? []).map((b) => [b.meta?.slug ?? b.slug, b.cover_url]).filter(([s, c]) => s && c));
  } catch (erro) {
    console.log("OpenStax: a lista não veio:", erro.message);
  }
}

let novas = 0;
let bytes = 0;
for (const obra of obras) {
  const destino = path.join(pastaCapas, `${obra.id}.webp`);
  if (!refazer && (fs.existsSync(destino) || creditos[obra.id]?.gerada)) continue;
  let origem = null;
  let fonte = "";
  const gutenberg = /gutenberg\.org\/ebooks\/(\d+)/.exec(obra.url ?? "");
  const openstax = /openstax\.org\/details\/books\/([a-z0-9-]+)/.exec(obra.url ?? "");
  if (gutenberg) {
    origem = `https://www.gutenberg.org/cache/epub/${gutenberg[1]}/pg${gutenberg[1]}.cover.medium.jpg`;
    fonte = "Project Gutenberg (domínio público)";
  } else if (openstax && capasOpenstax.get(openstax[1])) {
    origem = capasOpenstax.get(openstax[1]);
    fonte = "OpenStax (CC BY 4.0)";
  }
  if (!origem) continue;
  try {
    const imagem = await baixar(origem);
    if (await capaGerada(imagem)) {
      creditos[obra.id] = { fonte, origem, gerada: true };
      if (fs.existsSync(destino)) fs.rmSync(destino);
      await espera(1000);
      continue;
    }
    const tamanho = await gravar(obra.id, imagem);
    creditos[obra.id] = { fonte, origem };
    novas++;
    bytes += tamanho;
    if (novas % 25 === 0) console.log(`${novas} capas (${(bytes / 1048576).toFixed(1)} MB)…`);
  } catch (erro) {
    console.log(`${obra.id}: sem capa (${erro.message})`);
  }
  await espera(1000);
}
fs.writeFileSync(arquivoCreditos, `${JSON.stringify(Object.fromEntries(Object.entries(creditos).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
console.log(`Pronto: ${novas} capas novas, ${(bytes / 1048576).toFixed(1)} MB; ${Object.keys(creditos).length} no total.`);

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Monta o site separado dos editores avançados (estudio.institutolucia.org): baixa o pacote web OFICIAL de cada um
// (PhotoCraft, FilmCraft, EffectCraft) da página de releases do GitHub, na versão fixada abaixo, confere o SHA-256
// contra o SHA256SUMS.txt publicado pelo projeto e extrai sem modificar nada em estudio/site/<editor>/.
// Depois é só publicar a pasta estudio/site num projeto próprio (veja docs/ESTUDIO-EDITORES.md). Nada é automático:
// trocar de versão é mudar o número aqui e em lib/estudio.ts, rodar de novo, testar e publicar.
//
// Os de 3D (Blockbench, SculptGL e o editor do three.js) são compilados do código oficial: veja scripts/editores-livres.mjs.
//
// Uso: node scripts/editores.mjs [photocraft|filmcraft|effectcraft|blockbench|sculptgl|threejs ...]   (sem nome: todos)
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { LIVRES, montarLivre } from "./editores-livres.mjs";

export const VERSOES = {
  photocraft: "0.10.0",
  filmcraft: "0.9.0",
  effectcraft: "0.11.1",
};
const LIMITE_POR_ARQUIVO = 25 * 1024 * 1024; // Cloudflare Pages: 25 MiB por arquivo; acima disso, R2.

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const DESTINO = path.join(RAIZ, "estudio", "site");

async function baixar(url) {
  const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "InstitutoLucia-estudio/1.0" } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/** Lê o .zip (guardado ou deflate) e devolve [{nome, dados}]; recusa caminho absoluto ou com "..". */
export function lerZip(zip) {
  const saida = [];
  // O diretório central fica no fim: acha o registro de fim e percorre as entradas a partir dele.
  let fim = zip.length - 22;
  while (fim >= 0 && zip.readUInt32LE(fim) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error("zip sem diretório central");
  const total = zip.readUInt16LE(fim + 10);
  let pos = zip.readUInt32LE(fim + 16);
  for (let i = 0; i < total; i++) {
    if (zip.readUInt32LE(pos) !== 0x02014b50) throw new Error("diretório central inválido");
    const metodo = zip.readUInt16LE(pos + 10);
    const comprimido = zip.readUInt32LE(pos + 20);
    const nomeLen = zip.readUInt16LE(pos + 28);
    const extraLen = zip.readUInt16LE(pos + 30);
    const comentLen = zip.readUInt16LE(pos + 32);
    const local = zip.readUInt32LE(pos + 42);
    const nome = zip.subarray(pos + 46, pos + 46 + nomeLen).toString("utf8");
    pos += 46 + nomeLen + extraLen + comentLen;
    if (nome.endsWith("/")) continue;
    if (path.isAbsolute(nome) || nome.split(/[\\/]/).includes("..")) throw new Error(`caminho recusado: ${nome}`);
    const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const corpo = zip.subarray(inicio, inicio + comprimido);
    const dados = metodo === 0 ? corpo : metodo === 8 ? inflateRawSync(corpo) : null;
    if (!dados) throw new Error(`método de compressão ${metodo} não suportado em ${nome}`);
    saida.push({ nome, dados });
  }
  return saida;
}

async function montar(id) {
  const versao = VERSOES[id];
  const base = `https://github.com/storytold/${id}/releases/download/v${versao}`;
  const pacote = `${id}-web-${versao}.zip`;
  console.log(`${id} ${versao}: baixando ${pacote} e SHA256SUMS.txt`);
  const somas = (await baixar(`${base}/SHA256SUMS.txt`)).toString("utf8");
  const esperado = somas.split("\n").map((l) => l.trim().split(/\s+\*?/)).find(([, nome]) => nome === pacote)?.[0];
  if (!esperado) throw new Error(`${pacote} não aparece no SHA256SUMS.txt`);
  const zip = await baixar(`${base}/${pacote}`);
  const obtido = createHash("sha256").update(zip).digest("hex");
  if (obtido !== esperado.toLowerCase()) throw new Error(`SHA-256 não confere para ${pacote}: esperado ${esperado}, obtido ${obtido}`);
  console.log(`  SHA-256 confere (${obtido.slice(0, 16)}…), ${(zip.length / 1048576).toFixed(1)} MB`);
  const arquivos = lerZip(zip);
  // Muitos pacotes trazem tudo dentro de uma pasta só: ela vira a raiz do editor.
  const primeiros = new Set(arquivos.map((a) => a.nome.split("/")[0]));
  const prefixo = primeiros.size === 1 && arquivos.every((a) => a.nome.includes("/")) ? `${[...primeiros][0]}/` : "";
  const pasta = path.join(DESTINO, id);
  fs.rmSync(pasta, { recursive: true, force: true });
  let total = 0;
  const grandes = [];
  for (const a of arquivos) {
    const relativo = a.nome.slice(prefixo.length);
    const alvo = path.join(pasta, relativo);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, a.dados);
    total += a.dados.length;
    if (a.dados.length > LIMITE_POR_ARQUIVO) grandes.push(`${relativo} (${(a.dados.length / 1048576).toFixed(1)} MB)`);
  }
  fs.writeFileSync(path.join(pasta, ".versao.json"), JSON.stringify({ editor: id, versao, pacote, sha256: obtido, montado_em: new Date().toISOString() }, null, 2));
  console.log(`  ${arquivos.length} arquivos, ${(total / 1048576).toFixed(1)} MB extraídos em estudio/site/${id}/`);
  if (grandes.length) console.log(`  ATENÇÃO: acima de 25 MiB (vão pelo R2): ${grandes.join(", ")}`);
  return { id, versao, mb: total / 1048576, grandes };
}

/**
 * As regras de cabeçalho do site inteiro (formato _headers da Cloudflare Pages): as que cada pacote já traz, com o
 * caminho do editor na frente, e uma CSP restrita por editor, com o hash dos scripts escritos dentro do index.html.
 * Nada do site do instituto entra nos editores. Eles só podem ser embutidos pelas páginas do próprio instituto
 * (frame-ancestors), que os mostram dentro de institutolucia.org sem dar a eles acesso à sessão: a origem continua outra.
 */
const ANCESTRAIS = "'self' https://institutolucia.org https://www.institutolucia.org http://localhost:3000 http://localhost:3100";
// O que algum editor precisa a mais (conferido abrindo cada um com a CSP aplicada).
// Os de 3D usam eval e scripts escritos no HTML (manipuladores e trechos gerados): só neles, e esta origem não guarda
// nada do instituto. Com 'unsafe-inline', os hashes saem (o navegador ignora 'unsafe-inline' quando há hash).
const LIBERA = "'unsafe-eval' 'unsafe-inline'";
const EXTRA = { blockbench: { script: LIBERA }, sculptgl: { script: LIBERA }, // O editor do three.js traz, no próprio importmap, duas bibliotecas por versão fixa no jsDelivr (o traçador de
  // caminhos e o codificador Draco): sem elas, o editor não abre.
  threejs: { script: `${LIBERA} https://cdn.jsdelivr.net`, connect: "https://cdn.jsdelivr.net" } };
export function regrasDeCabecalho(pastas) {
  const linhas = [
    "# Gerado por scripts/editores.mjs. Não edite à mão: rode o script de novo.",
    "/*",
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: no-referrer",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "  Cross-Origin-Resource-Policy: same-origin",
    "",
  ];
  for (const { id, pasta, entrada = "index.html" } of pastas) {
    const inline = [...fs.readFileSync(path.join(pasta, entrada), "utf8").matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`);
    const proprio = path.join(pasta, "_headers");
    if (fs.existsSync(proprio)) {
      linhas.push(`# Regras do próprio pacote do ${id}, com o caminho /${id} na frente.`);
      for (const linha of fs.readFileSync(proprio, "utf8").split(/\r?\n/)) {
        if (linha.startsWith("#") || linha.trim() === "") continue;
        linhas.push(/^\s/.test(linha) ? linha : `/${id}${linha.startsWith("/") ? linha : `/${linha}`}`);
      }
    }
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'wasm-unsafe-eval' ${EXTRA[id]?.script ?? ""} ${EXTRA[id]?.script?.includes("unsafe-inline") ? "" : inline.join(" ")}`.replace(/\s+/g, " ").trim(),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' data: blob: ${EXTRA[id]?.connect ?? ""}`.trim(),
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      `frame-ancestors ${ANCESTRAIS}`,
    ].join("; ");
    const inicio = `/${id}/${path.dirname(entrada) === "." ? "" : `${path.dirname(entrada)}/`}`;
    linhas.push("", `/${id}/*`, `  Content-Security-Policy: ${csp}`, "", inicio, "  Cache-Control: no-cache", "");
  }
  return `${linhas.join("\n")}\n`;
}

const pedidos = process.argv.slice(2).filter((x) => x in VERSOES || x in LIVRES);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  const lista = pedidos.length ? pedidos : [...Object.keys(VERSOES), ...Object.keys(LIVRES)];
  for (const id of lista) {
    if (id in LIVRES) montarLivre(id, DESTINO);
    else await montar(id);
  }
  // As regras valem para todos os editores já montados na pasta (os de antes e os de agora).
  const todos = [...Object.keys(VERSOES).map((id) => ({ id, entrada: "index.html" })), ...Object.entries(LIVRES).map(([id, f]) => ({ id, entrada: f.entrada }))];
  const montados = todos.filter(({ id, entrada }) => fs.existsSync(path.join(DESTINO, id, entrada))).map(({ id, entrada }) => ({ id, entrada, pasta: path.join(DESTINO, id) }));
  fs.writeFileSync(path.join(DESTINO, "_headers"), regrasDeCabecalho(montados));
  console.log(`Regras de cabeçalho para: ${montados.map((m) => m.id).join(", ")}.`);
  console.log("Pronto. Publique a pasta estudio/site (veja docs/ESTUDIO-EDITORES.md).");
}

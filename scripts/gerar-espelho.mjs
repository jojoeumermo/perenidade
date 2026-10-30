// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O espelho estático: uma cópia só de leitura das aulas e do acervo, em HTML puro (sem JavaScript, sem banco), para ser
// servida de outro lugar se o site principal for derrubado, ou baixada num .zip e aberta sem internet. Não depende da
// montagem do Next: lê direto content/trilhas e content/acervo.
//
//   node scripts/gerar-espelho.mjs            → grava em espelho/ (fora do Git) e espelho.zip
//
// Como ativar o espelho num ataque: docs/ESPELHO-E-COPIAS.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { lerCabecalho } from "./cabecalho.mjs";
import { comFatos } from "./enem-fatos.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destino = path.join(raiz, "espelho");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://institutolucia.org").replace(/\/$/, "");
const hoje = new Date().toISOString().slice(0, 10).split("-").reverse().join("/");
const esc = (texto) => String(texto ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Os blocos do site (exercício, vídeo, partitura e os de sala) viram texto comum: aqui não há JavaScript. */
function simplificar(corpo) {
  return corpo.replace(/```(\w+)\r?\n([\s\S]*?)```/g, (inteiro, tipo, miolo) => {
    const linhas = miolo.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean);
    if (tipo === "verificar") {
      const pergunta = linhas.find((linha) => !/^[-+>]/.test(linha)) ?? "";
      const opcoes = linhas.filter((linha) => /^[-+]/.test(linha));
      return [`> **Para pensar:** ${pergunta}`, ">", ...opcoes.map((opcao) => `> - ${opcao.slice(1).trim()}`)].join("\n");
    }
    if (tipo === "video") {
      const endereco = linhas.find((linha) => /^https:\/\//.test(linha));
      return endereco ? `*Vídeo indicado nesta aula:* <${endereco}>` : "";
    }
    if (["provocacao", "navidareal", "escondido", "historia", "realidade", "formula"].includes(tipo)) return linhas.map((linha) => `> ${linha}`).join("\n");
    if (tipo === "leve" || tipo === "roda") return linhas.join("\n");
    if (tipo === "conta") return "```\n" + miolo + "```";
    return "";
  });
}
const componentes = {
  img: () => null,
  a: ({ href = "", children }) => createElement("a", { href: href.startsWith("/") ? `${SITE}/pt${href}` : href }, children),
};
const html = (texto) => renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: componentes }, simplificar(texto)));

const ESTILO = `body{font-family:Georgia,serif;line-height:1.6;max-width:44rem;margin:0 auto;padding:1rem;background:#f4ecd8;color:#1f1a14}
a{color:#6e1f1a}header{border-bottom:3px solid #1f1a14;margin-bottom:1.5rem;padding-bottom:.5rem}
header p{font-family:monospace;font-size:.8rem;letter-spacing:.15em;text-transform:uppercase;color:#c21f16;margin:0}
h1{line-height:1.15}blockquote{border-left:4px solid #c21f16;margin:1rem 0;padding:.2rem 1rem;background:#efe4c8}
pre{white-space:pre-wrap;background:#efe4c8;padding:.6rem}table{border-collapse:collapse}td,th{border:1px solid #1f1a14;padding:.3rem}
.resumo{font-style:italic}footer{margin-top:3rem;border-top:1px solid #1f1a14;font-size:.85rem;padding-top:.5rem}`;

const pagina = (titulo, miolo, nivel = 0) => {
  const volta = "../".repeat(nivel);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)} · Instituto Lúcia (espelho)</title><link rel="stylesheet" href="${volta}estilo.css"></head><body>
<header><p>Instituto Lúcia · espelho de leitura · ${hoje}</p><a href="${volta}index.html">Início do espelho</a></header>
${miolo}
<footer>Cópia de leitura do site <a href="${SITE}">${SITE.replace(/^https?:\/\//, "")}</a>. Aulas: CC BY-SA 4.0 (copie, distribua e adapte, citando a fonte). Obras do acervo: conforme a licença indicada em cada uma.</footer>
</body></html>
`;
};

fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(path.join(destino, "trilhas"), { recursive: true });
fs.mkdirSync(path.join(destino, "acervo"), { recursive: true });
fs.writeFileSync(path.join(destino, "estilo.css"), ESTILO);
const arquivos = [["estilo.css", ESTILO]];
const gravar = (relativo, conteudo) => {
  fs.mkdirSync(path.dirname(path.join(destino, relativo)), { recursive: true });
  fs.writeFileSync(path.join(destino, relativo), conteudo);
  arquivos.push([relativo, conteudo]);
};

// ───────────── As trilhas e as aulas ─────────────
const trilhas = [];
const pastaTrilhas = path.join(raiz, "content", "trilhas");
for (const pasta of fs.readdirSync(pastaTrilhas, { withFileTypes: true }).filter((entrada) => entrada.isDirectory())) {
  const base = path.join(pastaTrilhas, pasta.name);
  if (!fs.existsSync(path.join(base, "_trilha.md"))) continue;
  const trilha = lerCabecalho(fs.readFileSync(path.join(base, "_trilha.md"), "utf8"));
  const roteiro = fs.existsSync(path.join(base, "plano.json")) ? JSON.parse(fs.readFileSync(path.join(base, "plano.json"), "utf8")).map((item) => item.slug) : [];
  const aulas = fs
    .readdirSync(base)
    .filter((nome) => nome.endsWith(".md") && nome !== "_trilha.md" && !/\.(en|es|zh|ru|fr)\.md$/.test(nome))
    .map((nome) => ({ slug: nome.replace(/^\d+-/, "").replace(/\.md$/, ""), ...lerCabecalho(comFatos(fs.readFileSync(path.join(base, nome), "utf8"))) }))
    .filter((aula) => aula.dados.ativo !== false && aula.dados.titulo)
    .sort((a, b) => (roteiro.indexOf(a.slug) + 1 || 9999) - (roteiro.indexOf(b.slug) + 1 || 9999) || a.slug.localeCompare(b.slug));
  if (aulas.length === 0) continue;
  const titulo = String(trilha.dados.titulo ?? pasta.name);
  trilhas.push({ slug: pasta.name, titulo, resumo: trilha.dados.resumo ?? "", n: aulas.length });
  for (const aula of aulas) {
    const fontes = Array.isArray(aula.dados.fontes) ? aula.dados.fontes : [];
    const miolo = [
      `<p><a href="index.html">← ${esc(titulo)}</a></p>`,
      `<h1>${esc(aula.dados.titulo)}</h1>`,
      aula.dados.resumo ? `<p class="resumo">${esc(aula.dados.resumo)}</p>` : "",
      html(aula.corpo),
      fontes.length ? `<h2>Fontes</h2><ul>${fontes.map((f) => `<li>${[f.titulo, f.autor, f.ano].filter(Boolean).map(esc).join(". ")}${f.url ? `. <a href="${esc(f.url)}">${esc(f.url)}</a>` : ""}</li>`).join("")}</ul>` : "",
    ].join("\n");
    gravar(`trilhas/${pasta.name}/${aula.slug}.html`, pagina(aula.dados.titulo, miolo, 2));
  }
  gravar(
    `trilhas/${pasta.name}/index.html`,
    pagina(titulo, `<h1>${esc(titulo)}</h1>${trilha.dados.resumo ? `<p class="resumo">${esc(trilha.dados.resumo)}</p>` : ""}<ol>${aulas.map((aula) => `<li><a href="${aula.slug}.html">${esc(aula.dados.titulo)}</a></li>`).join("")}</ol>`, 2),
  );
}

// ───────────── O acervo: ficha de cada obra, com a fonte e a licença ─────────────
const obras = [];
const pastaAcervo = path.join(raiz, "content", "acervo");
for (const nome of fs.readdirSync(pastaAcervo).filter((n) => n.endsWith(".md") && !/\.(en|es|zh|ru|fr)\.md$/.test(n))) {
  const obra = lerCabecalho(fs.readFileSync(path.join(pastaAcervo, nome), "utf8"));
  if (!obra.dados.titulo || obra.dados.ativo === false) continue;
  const slug = nome.replace(/\.md$/, "");
  obras.push({ slug, titulo: String(obra.dados.titulo), autor: String(obra.dados.autor ?? "") });
  const ficha = [["Autor", obra.dados.autor], ["Ano", obra.dados.ano], ["Fonte", obra.dados.fonte], ["Licença", obra.dados.licenca]].filter(([, v]) => v);
  gravar(
    `acervo/${slug}.html`,
    pagina(obra.dados.titulo, `<p><a href="index.html">← Acervo</a></p><h1>${esc(obra.dados.titulo)}</h1><ul>${ficha.map(([k, v]) => `<li><strong>${k}:</strong> ${esc(v)}</li>`).join("")}</ul>${obra.dados.url ? `<p><a href="${esc(obra.dados.url)}">Ler a obra na fonte</a></p>` : ""}${html(obra.corpo)}`, 1),
  );
}
obras.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
gravar("acervo/index.html", pagina("Acervo", `<h1>Acervo</h1><ul>${obras.map((o) => `<li><a href="${o.slug}.html">${esc(o.titulo)}</a>${o.autor ? ` · ${esc(o.autor)}` : ""}</li>`).join("")}</ul>`, 1));

trilhas.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
gravar(
  "index.html",
  pagina(
    "Espelho de leitura",
    `<h1>Instituto Lúcia: espelho de leitura</h1><p>Uma cópia só de leitura das aulas e do acervo, para estudar mesmo se o site estiver fora do ar. Gerada em ${hoje}.</p>
<h2>Trilhas (${trilhas.length})</h2><ul>${trilhas.map((t) => `<li><a href="trilhas/${t.slug}/index.html">${esc(t.titulo)}</a> · ${t.n} aula(s)</li>`).join("")}</ul>
<h2><a href="acervo/index.html">Acervo (${obras.length} obras)</a></h2>`,
  ),
);

// ───────────── O pacote .zip (sem compressão nativa do Node: deflate por arquivo) ─────────────
const tabela = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (dados) => {
  let c = 0xffffffff;
  for (const byte of dados) c = tabela[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const partes = [];
const indice = [];
let posicao = 0;
for (const [nome, conteudo] of arquivos) {
  const dados = Buffer.from(conteudo, "utf8");
  const titulo = Buffer.from(`instituto-lucia-espelho/${nome}`, "utf8");
  const corpo = zlib.deflateRawSync(dados, { level: 9 });
  const cabeca = Buffer.alloc(30);
  cabeca.writeUInt32LE(0x04034b50, 0);
  cabeca.writeUInt16LE(20, 4);
  cabeca.writeUInt16LE(0x0800, 6);
  cabeca.writeUInt16LE(8, 8);
  cabeca.writeUInt16LE(0x21, 12);
  cabeca.writeUInt32LE(crc32(dados), 14);
  cabeca.writeUInt32LE(corpo.length, 18);
  cabeca.writeUInt32LE(dados.length, 22);
  cabeca.writeUInt16LE(titulo.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  cabeca.copy(central, 6, 4, 30);
  central.writeUInt32LE(posicao, 42);
  indice.push(central, titulo);
  partes.push(cabeca, titulo, corpo);
  posicao += cabeca.length + titulo.length + corpo.length;
}
const tamanho = indice.reduce((soma, parte) => soma + parte.length, 0);
const fim = Buffer.alloc(22);
fim.writeUInt32LE(0x06054b50, 0);
fim.writeUInt16LE(Math.min(arquivos.length, 0xffff), 8);
fim.writeUInt16LE(Math.min(arquivos.length, 0xffff), 10);
fim.writeUInt32LE(tamanho, 12);
fim.writeUInt32LE(posicao, 16);
fs.writeFileSync(path.join(raiz, "espelho.zip"), Buffer.concat([...partes, ...indice, fim]));
console.log(`espelho: ${trilhas.length} trilhas, ${obras.length} obras, ${arquivos.length} arquivos · espelho/ e espelho.zip`);

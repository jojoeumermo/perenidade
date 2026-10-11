// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Monta um livro digital (EPUB 3) para cada trilha que já tem aula escrita e grava em public/epub/<trilha>.epub.
// Serve em Kindle (pelo "Enviar para o Kindle"), Kobo e qualquer aplicativo de leitura. Roda sozinho antes de
// "npm run build"; para gerar à mão: npm run epub
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { lerCabecalho } from "./cabecalho.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trilhas = path.join(raiz, "content", "trilhas");
const destino = path.join(raiz, "public", "epub");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://institutolucia.org").replace(/\/$/, "");
const agora = new Date().toISOString().replace(/\.\d+Z$/, "Z");

const xml = (texto) => String(texto ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ───────────── ZIP mínimo (o EPUB é um ZIP com o primeiro arquivo sem compressão) ─────────────
const tabela = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(dados) {
  let c = 0xffffffff;
  for (const byte of dados) c = tabela[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(arquivos) {
  const partes = [];
  const indice = [];
  let posicao = 0;
  for (const { nome, dados, cru } of arquivos) {
    const titulo = Buffer.from(nome, "utf8");
    const corpo = cru ? dados : zlib.deflateRawSync(dados, { level: 9 });
    const cabeca = Buffer.alloc(30);
    cabeca.writeUInt32LE(0x04034b50, 0);
    cabeca.writeUInt16LE(20, 4);
    cabeca.writeUInt16LE(0x0800, 6);
    cabeca.writeUInt16LE(cru ? 0 : 8, 8);
    cabeca.writeUInt16LE(0, 10);
    cabeca.writeUInt16LE(0x21, 12);
    cabeca.writeUInt32LE(crc32(dados), 14);
    cabeca.writeUInt32LE(corpo.length, 18);
    cabeca.writeUInt32LE(dados.length, 22);
    cabeca.writeUInt16LE(titulo.length, 26);
    cabeca.writeUInt16LE(0, 28);
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
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(tamanho, 12);
  fim.writeUInt32LE(posicao, 16);
  return Buffer.concat([...partes, ...indice, fim]);
}

// ───────────── Do texto da aula para XHTML ─────────────

/** Os blocos próprios do site (exercício no meio do texto, conta, vídeo, partitura) viram texto comum. */
function simplificar(corpo) {
  return corpo.replace(/```(\w+)\r?\n([\s\S]*?)```/g, (inteiro, tipo, miolo) => {
    const linhas = miolo.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean);
    if (tipo === "verificar") {
      const pergunta = linhas.find((linha) => !/^[-+>]/.test(linha)) ?? "";
      const opcoes = linhas.filter((linha) => /^[-+]/.test(linha));
      const certa = opcoes.find((linha) => linha.startsWith("+"));
      const letras = "abcdefgh";
      return [`> **Para pensar:** ${pergunta}`, ">", ...opcoes.map((opcao, i) => `> ${letras[i]}) ${opcao.slice(1).trim()}  `), ">", certa ? `> *Resposta: ${letras[opcoes.indexOf(certa)]}) ${certa.slice(1).trim()}*` : ""].join("\n");
    }
    if (tipo === "conta") return "```\n" + miolo + "```";
    if (tipo === "video") {
      const endereco = linhas.find((linha) => /^https:\/\//.test(linha));
      return endereco ? `*Vídeo indicado nesta aula:* <${endereco}>` : "";
    }
    if (tipo === "pauta" || tipo === "teclado") return "*(Aqui há uma partitura ou um teclado desenhado, que só aparece na versão do site.)*";
    return inteiro;
  });
}

const componentes = {
  // Imagens ficam de fora (o livro precisa abrir sem internet); links internos passam a apontar para o site.
  img: () => null,
  a: ({ href = "", children }) => createElement("a", { href: href.startsWith("/") ? `${SITE}/pt${href}` : href }, children),
};
const html = (texto) => renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: componentes }, simplificar(texto)));

const pagina = (titulo, miolo) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR" xml:lang="pt-BR">
<head><meta charset="utf-8"/><title>${xml(titulo)}</title><link rel="stylesheet" type="text/css" href="estilo.css"/></head>
<body>
${miolo}
</body>
</html>
`;

const ESTILO = `body { font-family: serif; line-height: 1.5; margin: 0 4%; }
h1 { font-size: 1.6em; line-height: 1.2; margin: 1em 0 0.4em; }
h2 { font-size: 1.25em; margin: 1.2em 0 0.3em; }
h3 { font-size: 1.1em; margin: 1em 0 0.2em; }
p { margin: 0 0 0.8em; }
blockquote { margin: 1em 0; padding: 0.4em 1em; border-left: 3px solid #000; }
pre { white-space: pre-wrap; font-family: monospace; font-size: 0.9em; border: 1px solid #000; padding: 0.6em; }
code { font-family: monospace; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #000; padding: 0.3em 0.4em; text-align: left; vertical-align: top; }
.resumo { font-style: italic; }
.capa { text-align: center; margin-top: 20%; }
.menor { font-size: 0.85em; }
`;

function aulaEmXhtml(aula, numero) {
  const quiz = Array.isArray(aula.dados.quiz) ? aula.dados.quiz : [];
  const fontes = Array.isArray(aula.dados.fontes) ? aula.dados.fontes : [];
  const letras = "abcdefgh";
  const partes = [`<h1>${numero}. ${xml(aula.dados.titulo)}</h1>`];
  if (aula.dados.resumo) partes.push(`<p class="resumo">${xml(aula.dados.resumo)}</p>`);
  partes.push(html(aula.corpo));
  if (quiz.length > 0) {
    partes.push("<h2>Teste</h2>");
    quiz.forEach((questao, i) => {
      partes.push(`<p><strong>${i + 1}. ${xml(questao.pergunta)}</strong></p><p>${(questao.opcoes ?? []).map((opcao, n) => `${letras[n]}) ${xml(opcao)}`).join("<br/>")}</p>`);
    });
    partes.push("<h3>Respostas</h3>");
    quiz.forEach((questao, i) => {
      partes.push(`<p class="menor"><strong>${i + 1}.</strong> ${letras[questao.resposta] ?? "?"}) ${xml((questao.opcoes ?? [])[questao.resposta])}${questao.explicacao ? ` — ${xml(questao.explicacao)}` : ""}</p>`);
    });
  }
  if (fontes.length > 0) {
    partes.push("<h2>Fontes</h2><ul>");
    for (const fonte of fontes) {
      const rotulo = [fonte.titulo, fonte.autor, fonte.ano].filter(Boolean).map(xml).join(". ");
      partes.push(`<li class="menor">${rotulo}${fonte.url ? `. <a href="${xml(fonte.url)}">${xml(fonte.url)}</a>` : ""}</li>`);
    }
    partes.push("</ul>");
  }
  return pagina(aula.dados.titulo, partes.join("\n"));
}

// ───────────── Um livro por trilha ─────────────
fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });
let livros = 0;
for (const pasta of fs.readdirSync(trilhas, { withFileTypes: true }).filter((entrada) => entrada.isDirectory())) {
  const base = path.join(trilhas, pasta.name);
  const arquivoDaTrilha = path.join(base, "_trilha.md");
  if (!fs.existsSync(arquivoDaTrilha)) continue;
  const trilha = lerCabecalho(fs.readFileSync(arquivoDaTrilha, "utf8"));
  const roteiro = fs.existsSync(path.join(base, "plano.json")) ? JSON.parse(fs.readFileSync(path.join(base, "plano.json"), "utf8")).map((item) => item.slug) : [];
  const aulas = fs
    .readdirSync(base)
    .filter((nome) => nome.endsWith(".md") && nome !== "_trilha.md" && !/\.(en|es|zh|ru)\.md$/.test(nome))
    .map((nome) => ({ slug: nome.replace(/^\d+-/, "").replace(/\.md$/, ""), ...lerCabecalho(fs.readFileSync(path.join(base, nome), "utf8")) }))
    .filter((aula) => aula.dados.ativo !== false && aula.dados.titulo)
    .sort((a, b) => (roteiro.indexOf(a.slug) + 1 || 9999) - (roteiro.indexOf(b.slug) + 1 || 9999) || a.slug.localeCompare(b.slug));
  if (aulas.length === 0) continue;

  const titulo = String(trilha.dados.titulo ?? pasta.name);
  const marca = crypto.createHash("sha1").update(`instituto-lucia:${pasta.name}`).digest("hex");
  const id = `urn:uuid:${marca.slice(0, 8)}-${marca.slice(8, 12)}-5${marca.slice(13, 16)}-a${marca.slice(17, 20)}-${marca.slice(20, 32)}`;
  const capa = pagina(titulo, `<div class="capa"><p>Instituto Lúcia</p><h1>${xml(titulo)}</h1>${trilha.dados.resumo ? `<p class="resumo">${xml(trilha.dados.resumo)}</p>` : ""}<p class="menor">${aulas.length} aula(s) · gerado em ${agora.slice(0, 10).split("-").reverse().join("/")}</p><p class="menor">Conteúdo livre: Creative Commons Atribuição-CompartilhaIgual 4.0. Copie, distribua e adapte, citando a fonte.</p><p class="menor"><a href="${SITE}/pt/trilhas/${pasta.name}">${SITE.replace(/^https?:\/\//, "")}/pt/trilhas/${pasta.name}</a></p></div>`);
  const itens = aulas.map((aula, i) => ({ id: `aula-${i + 1}`, arquivo: `aula-${i + 1}.xhtml`, titulo: aula.dados.titulo, xhtml: aulaEmXhtml(aula, i + 1) }));
  const sumario = pagina("Sumário", `<nav epub:type="toc" id="toc"><h1>Sumário</h1><ol>${itens.map((item) => `<li><a href="${item.arquivo}">${xml(item.titulo)}</a></li>`).join("")}</ol></nav>`);
  const ncx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${id}"/></head><docTitle><text>${xml(titulo)}</text></docTitle><navMap>
${itens.map((item, i) => `<navPoint id="${item.id}" playOrder="${i + 1}"><navLabel><text>${xml(item.titulo)}</text></navLabel><content src="${item.arquivo}"/></navPoint>`).join("\n")}
</navMap></ncx>
`;
  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id" xml:lang="pt-BR">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="id">${id}</dc:identifier>
<dc:title>${xml(titulo)}</dc:title>
<dc:language>pt-BR</dc:language>
<dc:creator>Instituto Lúcia</dc:creator>
<dc:publisher>Instituto Lúcia</dc:publisher>
<dc:rights>Creative Commons Atribuição-CompartilhaIgual 4.0 Internacional (CC BY-SA 4.0)</dc:rights>
<dc:source>${SITE}/pt/trilhas/${pasta.name}</dc:source>
<meta property="dcterms:modified">${agora}</meta>
</metadata>
<manifest>
<item id="nav" href="sumario.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="estilo" href="estilo.css" media-type="text/css"/>
<item id="capa" href="capa.xhtml" media-type="application/xhtml+xml"/>
${itens.map((item) => `<item id="${item.id}" href="${item.arquivo}" media-type="application/xhtml+xml"/>`).join("\n")}
</manifest>
<spine toc="ncx">
<itemref idref="capa"/>
<itemref idref="nav"/>
${itens.map((item) => `<itemref idref="${item.id}"/>`).join("\n")}
</spine>
</package>
`;
  const arquivos = [
    { nome: "mimetype", dados: Buffer.from("application/epub+zip"), cru: true },
    { nome: "META-INF/container.xml", dados: Buffer.from(`<?xml version="1.0" encoding="utf-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/livro.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n`) },
    { nome: "OEBPS/livro.opf", dados: Buffer.from(opf) },
    { nome: "OEBPS/toc.ncx", dados: Buffer.from(ncx) },
    { nome: "OEBPS/estilo.css", dados: Buffer.from(ESTILO) },
    { nome: "OEBPS/capa.xhtml", dados: Buffer.from(capa) },
    { nome: "OEBPS/sumario.xhtml", dados: Buffer.from(sumario) },
    ...itens.map((item) => ({ nome: `OEBPS/${item.arquivo}`, dados: Buffer.from(item.xhtml) })),
  ];
  fs.writeFileSync(path.join(destino, `${pasta.name}.epub`), zip(arquivos));
  livros++;
}
console.log(`[epub] ${livros} livro(s) em public/epub`);

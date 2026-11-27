// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Regressão da prévia de PDF da videoaula: o <object> executa HTML/SVG na origem do app se o arquivo
// escolhido não for PDF de verdade, e o `type` do navegador vem só da extensão. O crivo pdfDeVerdade
// (tipo declarado + cabeçalho "%PDF-" nos primeiros 1024 bytes) precisa barrar os disfarces e aceitar
// PDFs legítimos. Roda só no Node, sem rede: node scripts/testar-pdf-previa.mjs
import { pdfDeVerdade } from "../lib/pdf.ts";

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

const pdfBom = "%PDF-1.7\nconteúdo qualquer da página um %%EOF";
const pdfComSobra = "﻿ \n%PDF-1.4\nresto"; // BOM e espaços antes do cabeçalho: o formato permite
const htmlDisfarcado = '<!doctype html><script>alert(1)</scr' + "ipt>"; // "x.pdf" com HTML dentro
const svgReal = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</scr' + "ipt></svg>";

ok("PDF legítimo passa", await pdfDeVerdade(new File([pdfBom], "aula.pdf", { type: "application/pdf" })));
ok("PDF com bytes antes do cabeçalho passa", await pdfDeVerdade(new File([pdfComSobra], "aula.pdf", { type: "application/pdf" })));
ok("HTML disfarçado de .pdf é barrado", !(await pdfDeVerdade(new File([htmlDisfarcado], "x.pdf", { type: "application/pdf" }))));
ok("PDF com tipo errado (text/html) é barrado", !(await pdfDeVerdade(new File([pdfBom], "x.html", { type: "text/html" }))));
ok("SVG ativo é barrado", !(await pdfDeVerdade(new File([svgReal], "x.svg", { type: "image/svg+xml" }))));
ok("Arquivo vazio com tipo PDF é barrado", !(await pdfDeVerdade(new File([], "x.pdf", { type: "application/pdf" }))));

if (falhas.length) {
  console.error(`FALHOU (${falhas.length}):`, falhas);
  process.exit(1);
}
console.log(`prévia de PDF: ${certos}/6 verificações passaram.`);

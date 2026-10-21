// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Auditoria de proveniência do acervo, SÓ DE LEITURA: lista cada obra (content/acervo e os catálogos importados em
// content/catalogo) com a fonte, a licença declarada e a situação de direitos que dá para afirmar a partir disso:
//   domínio público · licença aberta · autorizada · só ficha (direitos reservados, sem cópia no site) · desconhecida.
// Destaca as que não têm fonte, licença ou endereço. Não esconde nem remove nada: o relatório é para revisão humana.
// As obras já escondidas (content/acervo-ocultas.json) aparecem marcadas.
//
// Uso: node scripts/proveniencia.mjs   → docs/proveniencia-do-acervo.csv e um resumo na tela.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ocultas = new Set(JSON.parse(fs.readFileSync(path.join(raiz, "content", "acervo-ocultas.json"), "utf8")).ocultas.map((o) => o.id));

function cabecalho(texto) {
  const m = /^---\n([\s\S]*?)\n---/.exec(texto.replace(/\r\n/g, "\n"));
  const dados = {};
  for (const linha of (m?.[1] ?? "").split("\n")) {
    const par = /^(\w+):\s*"?(.*?)"?\s*$/.exec(linha);
    if (par) dados[par[1]] = par[2];
  }
  return dados;
}

/** A situação de direitos pela licença declarada; "conforme a fonte" vira desconhecida até alguém conferir. */
function situacao(licenca, fonte) {
  const l = (licenca ?? "").toLowerCase();
  if (!l) return "desconhecida";
  if (l.includes("domínio público") || l.includes("dominio publico")) return "domínio público";
  if (/^cc[ -]/.test(l) || l.includes("creative commons") || l.includes("gfdl") || l.includes("gpl")) return "licença aberta";
  if (l.includes("autoriza")) return "autorizada";
  if (l.includes("reservados")) return "só ficha (direitos reservados)";
  // Leis e documentos oficiais (Lei 9.610, art. 8º, IV: textos de lei e atos oficiais não são protegidos).
  if (/planalto|inep|câmara|senado/i.test(fonte ?? "")) return "ato oficial (livre)";
  return "desconhecida";
}

const linhas = [];
const pastaAcervo = path.join(raiz, "content", "acervo");
for (const arq of fs.readdirSync(pastaAcervo).filter((f) => f.endsWith(".md") && !/\.\w\w\.md$/.test(f))) {
  const d = cabecalho(fs.readFileSync(path.join(pastaAcervo, arq), "utf8"));
  const id = arq.replace(/\.md$/, "");
  const faltas = [!d.fonte && "fonte", !d.licenca && "licença", !d.url && "endereço", !d.autor && "autor"].filter(Boolean);
  linhas.push({ origem: "acervo", id, titulo: d.titulo ?? "", autor: d.autor ?? "", fonte: d.fonte ?? "", licenca: d.licenca ?? "", url: d.url ?? "", situacao: situacao(d.licenca, d.fonte), faltas: faltas.join(" "), oculta: ocultas.has(id) ? "sim" : "" });
}
const pastaCatalogo = path.join(raiz, "content", "catalogo");
for (const arq of fs.readdirSync(pastaCatalogo).filter((f) => f.endsWith(".json"))) {
  for (const o of JSON.parse(fs.readFileSync(path.join(pastaCatalogo, arq), "utf8"))) {
    const faltas = [!o.f && "fonte", !o.l && "licença", !o.u && "endereço", !o.a && "autor"].filter(Boolean);
    linhas.push({ origem: `catálogo ${arq.replace(/\.json$/, "")}`, id: "", titulo: o.t ?? "", autor: o.a ?? "", fonte: o.f ?? "", licenca: o.l ?? "", url: o.u ?? "", situacao: situacao(o.l, o.f), faltas: faltas.join(" "), oculta: "" });
  }
}

const campos = ["origem", "id", "titulo", "autor", "fonte", "licenca", "url", "situacao", "faltas", "oculta"];
const celula = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = [campos.join(","), ...linhas.map((l) => campos.map((c) => celula(l[c])).join(","))].join("\n");
fs.mkdirSync(path.join(raiz, "docs"), { recursive: true });
fs.writeFileSync(path.join(raiz, "docs", "proveniencia-do-acervo.csv"), `﻿${csv}\n`);

const conta = (f) => linhas.reduce((m, l) => ((m[f(l)] = (m[f(l)] ?? 0) + 1), m), {});
console.log(`${linhas.length} obras (${linhas.filter((l) => l.origem === "acervo").length} no acervo, o resto nos catálogos).`);
console.log("Situação de direitos:", conta((l) => l.situacao));
console.log("Sem algum metadado:", linhas.filter((l) => l.faltas).length, conta((l) => l.faltas || "completo"));
console.log("Relatório: docs/proveniencia-do-acervo.csv (abre em planilha). Nada foi escondido nem removido.");

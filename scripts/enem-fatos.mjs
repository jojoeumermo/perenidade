// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Troca {{enem:<id>}} pelos fatos de content/enem/edicao.yml nos roteiros que leem as aulas direto do disco e rodam
// sem o carregador de TypeScript (livro EPUB, espelho estático). É a mesma regra de formatarFato em lib/enem.ts;
// `npm run testar:enem` confere que as duas escrevem cada fato igual.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE_SCHEMA, load } from "js-yaml";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function escreverFato(f) {
  if (!f || f.valor === undefined) return "confirmar no edital";
  const v = f.valor;
  if (f.tipo === "data") {
    const [a, m, d] = String(v).split("-").map(Number);
    return `${d} de ${MESES[m - 1]} de ${a}`;
  }
  if (f.tipo === "hora") {
    const [h, m] = String(v).split(":");
    return `${Number(h)}h${m === "00" ? "" : m}`;
  }
  if (f.tipo === "minutos") {
    const n = Number(v);
    if (n < 60) return `${n} minutos`;
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m ? `${h}h${String(m).padStart(2, "0")}` : `${h} ${h === 1 ? "hora" : "horas"}`;
  }
  if (f.tipo === "dinheiro") return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
  if (f.tipo === "lista") return v.join("; ");
  return String(v);
}

let fatos = null;
export function comFatos(texto) {
  if (!texto.includes("{{enem:")) return texto;
  fatos ??= load(fs.readFileSync(path.join(raiz, "content/enem/edicao.yml"), "utf8"), { schema: CORE_SCHEMA }).fatos;
  return texto.replace(/\{\{enem:([a-z0-9-]+)\}\}/g, (_, id) => escreverFato(fatos[id]));
}

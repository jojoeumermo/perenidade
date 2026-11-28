// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Regressão da variante CN 1093 (reaplicação Enem 2022) — a ÚNICA variante com validação populacional
// completa nesta fase: sem os itens dela, o estimador caía no caderno de referência e media viés
// sistemático de até 15,1 pontos nos participantes do 1093 (n = 949); com ela, nenhum caso acima de
// 0,05 ponto (estimador EAP do repositório, microdados oficiais, antes/depois com o mesmo leitor).
// As variantes MT 1081 e LC 1073 existem no branch tri-cadernos-variantes, mas NÃO foram validadas
// populacionalmente e por isso NÃO entram neste recorte — este teste trava a ausência delas até que
// sejam medidas (quando forem, este teste deve ser atualizado junto).
//
// O teste confere:
//   1. natureza 2022 tem exatamente a variante 1093, com 45 itens e 44/45 em comum com o caderno de
//      referência (1087) — medido na validação.
//   2. Formato vigente dos itens ({co, p, g, a, b, c, h} ou anulado sem parâmetros com gabarito
//      original), sem ligação com questões do site (sem "q").
//   3. Mudança estritamente aditiva: o caderno de referência não carrega campo de variante.
//   4. linguagens/matematica/humanas NÃO têm variantes neste recorte (pendentes de validação).
// Uso: node scripts/testar-tri-variantes-cn.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dados = JSON.parse(fs.readFileSync(path.join(raiz, "public", "tri", "enem-2022.json"), "utf8"));

let falhas = 0;
const confere = (nome, ok, detalhe) => {
  console.log(`${ok ? "ok" : "FALHA"} — ${nome}${ok ? "" : `: ${detalhe}`}`);
  if (!ok) falhas++;
};

const A = dados.areas.natureza;
const variantes = A.variantes ?? [];
confere("natureza: exatamente 1 variante", variantes.length === 1, `${variantes.length}`);
if (variantes.length) {
  const v = variantes[0];
  confere("natureza: provas = [1093]", JSON.stringify(v.provas) === JSON.stringify([1093]), JSON.stringify(v.provas));
  confere("natureza: 45 itens na variante", v.itens.length === 45, `${v.itens.length}`);
  const formato = v.itens.every((i) =>
    Number.isInteger(i.co) && Number.isInteger(i.p) && i.q === undefined &&
    (i.aban === true ? (/^[A-EX]$/.test(i.g) && i.a === undefined) : (/^[A-E]$/.test(i.g) && typeof i.a === "number" && typeof i.b === "number" && typeof i.c === "number")));
  confere("natureza: formato vigente, sem ligação \"q\"", formato, JSON.stringify(v.itens.find((i) => i.q !== undefined) ?? v.itens[0]));
  const base = new Set(A.itens.map((i) => i.co));
  const comuns = v.itens.filter((i) => base.has(i.co)).length;
  confere("natureza: 44/45 itens em comum com o caderno de referência (medido)", comuns === 44, `${comuns}`);
  confere("natureza: caderno de referência sem campo de variante (mudança aditiva)", A.itens.every((i) => !("variante" in i)), "item do caderno base alterado");
}

for (const area of ["linguagens", "matematica", "humanas"]) {
  confere(`${area}: SEM variantes neste recorte (pendente de validação populacional)`, (dados.areas[area].variantes ?? []).length === 0, JSON.stringify(dados.areas[area].variantes));
}

if (falhas) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTodos os testes da variante CN 1093 passaram.");

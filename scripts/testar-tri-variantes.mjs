// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Regressão da estrutura "variantes" dos cadernos TRI (fase 1: Enem 2022): cadernos REGULARES cujo conjunto
// de itens difere do caderno de referência publicado, mas tem ao menos um item em comum com ele — caso da
// 2022 CN (caderno 1093, 44/45 itens comuns com o 1087), MT (1081 e 1082, mesmos 45 itens, posições, gabaritos e
// parâmetros) e LC (1073). Pelo dicionário oficial, 1093 e 1073 são "Verde - Videoprova - Libras" e 1082 é "Laranja - Adaptada
// Ledor": cadernos de acessibilidade, não reaplicação. O 1081 consta no ITENS_PROVA, mas não no dicionário e sem participantes. Medição populacional nos microdados 2022 (EAP do repositório, antes/depois, mesmo leitor):
// ver corpo do PR. Cadernos especiais (CN 1165-1168, MT 1155-1158, LC 1145-1148) seguem sem cobertura. Sem esses itens, o estimador media viés
// sistemático de até 15,1 pontos nos participantes do 1093 (n = 949; com a variante, nenhum caso acima de
// 0,05 ponto — medido com o estimador EAP do repositório sobre os microdados oficiais).
//
// O teste trava a estrutura aditiva:
//   1. natureza/matematica/linguagens 2022 têm exatamente a variante esperada (1093/1081/1073) e humanas não tem.
//   2. Contagem de itens por variante (45/45/40) e formato vigente ({co, p, g, a, b, c, h} ou {co, p, g, aban, h}),
//      sem ligação com questões do site (sem "q").
//   3. Cada variante tem ao menos um item em comum com o caderno de referência; a CN 1093 tem exatamente 44/45.
//   4. Mudança estritamente aditiva: os itens do caderno de referência não carregam campo de variante.
// Uso: npm run testar:tri-variantes
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

const ESPERADAS = { natureza: { provas: [1093], itens: 45, comuns: 44 }, matematica: { provas: [1081], itens: 45 }, linguagens: { provas: [1073], itens: 40 } };

for (const [area, esp] of Object.entries(ESPERADAS)) {
  const A = dados.areas[area];
  const variantes = A.variantes ?? [];
  confere(`${area}: exatamente 1 variante`, variantes.length === 1, `${variantes.length}`);
  if (!variantes.length) continue;
  const v = variantes[0];
  confere(`${area}: provas = ${JSON.stringify(esp.provas)}`, JSON.stringify(v.provas) === JSON.stringify(esp.provas), JSON.stringify(v.provas));
  confere(`${area}: ${esp.itens} itens na variante`, v.itens.length === esp.itens, `${v.itens.length}`);
  const formato = v.itens.every((i) =>
    Number.isInteger(i.co) && Number.isInteger(i.p) && i.q === undefined &&
    (i.aban === true ? (/^[A-EX]$/.test(i.g) && i.a === undefined) : (/^[A-E]$/.test(i.g) && typeof i.a === "number" && typeof i.b === "number" && typeof i.c === "number")));
  confere(`${area}: formato vigente, sem ligação "q"`, formato, JSON.stringify(v.itens.find((i) => i.q !== undefined) ?? v.itens[0]));
  const base = new Set(A.itens.map((i) => i.co));
  const comuns = v.itens.filter((i) => base.has(i.co)).length;
  confere(`${area}: variante tem item em comum com o caderno de referência`, comuns >= 1, `${comuns}`);
  if (esp.comuns !== undefined) confere(`${area}: ${esp.comuns}/${esp.itens} itens em comum (medido na validação)`, comuns === esp.comuns, `${comuns}`);
  confere(`${area}: caderno de referência sem campo de variante (mudança aditiva)`, A.itens.every((i) => !("variante" in i)), "item do caderno base alterado");
}

confere("humanas: sem variantes nesta fase", (dados.areas.humanas.variantes ?? []).length === 0, JSON.stringify(dados.areas.humanas.variantes));

if (falhas) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTodos os testes das variantes TRI passaram.");

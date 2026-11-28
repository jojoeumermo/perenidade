// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Regressão do item 53958 (Enem 2015, CN): o Inep neutralizou esse item publicando parâmetros em logits
// a = 0,01929, b = 61,05459, c = 0,21513 (curva quase plana: acertar/errar quase não muda θ). A heurística
// do gerador ("|b| > 20 ⇒ veio na escala (500,100)") convertia esses brutos para a = 1,929, b = −4,3894541,
// e o item passava a puxar a nota de quem acertava. Medido na população regular CN 2015 (n = 5.746.265,
// estimador EAP do repositório, microdados oficiais): com o valor convertido, erro médio de 53,53 pontos e
// máximo de 291,95; com os brutos, nenhum caso acima de 0,05 ponto.
//
// Este teste trava as duas pontas:
//   1. O dado publicado (public/tri/enem-2015.json) mantém os brutos oficiais do item 53958.
//   2. A heurística do gerador (scripts/enem/gerar-parametros-tri.mjs) só converte (500,100) quando
//      a > 0,05 — a assinatura de item neutralizado (a ≈ 0,02) não volta a ser convertida.
// Uso: node scripts/testar-tri-parametros.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), "utf8");

let falhas = 0;
const confere = (nome, ok, detalhe) => {
  console.log(`${ok ? "ok" : "FALHA"} — ${nome}${ok ? "" : `: ${detalhe}`}`);
  if (!ok) falhas++;
};

// 1. O dado publicado mantém os brutos oficiais (ITENS_PROVA_2015.csv, CO_ITEM 53958).
const dados = JSON.parse(ler("public/tri/enem-2015.json"));
const item = dados.areas.natureza.itens.find((i) => i.co === 53958);
confere("item 53958 existe em enem-2015.json (natureza)", !!item, JSON.stringify(dados.areas.natureza.itens.slice(0, 3)));
if (item) {
  confere("53958.a = 0,01929 (bruto oficial)", item.a === 0.01929, `a = ${item.a}`);
  confere("53958.b = 61,05459 (bruto oficial)", item.b === 61.05459, `b = ${item.b}`);
  confere("53958.c = 0,21513 (bruto oficial)", item.c === 0.21513, `c = ${item.c}`);
}

// 2. A heurística do gerador não converte item neutralizado (a ≤ 0,05) nem deixa de converter escala (500,100).
const gerador = ler("scripts/enem/gerar-parametros-tri.mjs");
const m = gerador.match(/if \(b !== null && Math\.abs\(b\) > 20 && a !== null && a > 0\.05\) \{ b = \(b - 500\) \/ 100; a = a \* 100; \}/);
confere("gerador só converte (500,100) com a > 0,05 (guarda do 53958)", !!m, "linha da heurística não encontrada na forma protegida");

// 3. Comportamento da heurística nos três casos (reimplementação fiel da linha, para regressão de lógica).
const converte = (a, b) => {
  if (b !== null && Math.abs(b) > 20 && a !== null && a > 0.05) { return { b: (b - 500) / 100, a: a * 100 }; }
  return { a, b };
};
const neutro = converte(0.01929, 61.05459);
confere("item neutralizado (a=0,01929, b=61,05459) NÃO é convertido", neutro.a === 0.01929 && neutro.b === 61.05459, JSON.stringify(neutro));
const escala = converte(1.5, 620);
confere("parametro na escala (500,100) (a=1,5, b=620) continua convertido", escala.a === 150 && escala.b === 1.2, JSON.stringify(escala));
const logit = converte(1.2, -2.5);
confere("logit comum (|b| ≤ 20) passa inalterado", logit.a === 1.2 && logit.b === -2.5, JSON.stringify(logit));

if (falhas) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTodos os testes do item 53958 passaram.");

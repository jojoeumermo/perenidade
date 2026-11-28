// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Regressão do item 53958 (Enem 2015, CN). Os parâmetros oficiais publicados pelo Inep para este item —
// a = 0,01929, b = 61,05459, c = 0,21513, idênticos nas 5 provas CN de 2015 (235–238 e 252,
// ITENS_PROVA_2015.csv) — formam uma curva quase plana: na prática, acertar ou errar este item quase não
// muda θ (efeito neutro na pontuação). A heurística do gerador ("|b| > 20 ⇒ veio na escala (500,100)")
// convertia esses brutos para a = 1,929, b = −4,3894541, e o item passava a deslocar a nota de quem
// acertava. Medido na população regular CN 2015 (n = 5.746.265, estimador EAP do repositório, microdados
// oficiais, antes/depois com o mesmo leitor): com o valor convertido, erro médio de 53,53 pontos e máximo
// de 291,95; com os brutos oficiais, nenhum caso acima de 0,05 ponto.
//
// Limites desta afirmação: o Inep NÃO marcou o item como abandonado (IN_ITEM_ABAN = 0) e não localizamos
// documento oficial que o classifique como anulado ou neutralizado. O que está provado é o efeito medido
// dos parâmetros publicados, não uma classificação oficial.
//
// Por que exceção nomeada e não regra geral por assinatura numérica (a ≤ 0,05 com |b| > 20): a assinatura,
// isoladamente, não prova a natureza do item; e a série verificada nos brutos é 2009–2022 (14 edições),
// em que o 53958 é o ÚNICO item com |b| > 20 — 2023–2025 ainda não foram verificados nos brutos. Com a
// exceção nomeada, qualquer caso novo segue a regra antiga (visível na validação TRI populacional) e só
// entra aqui depois de medido. Efeito de regenerar os demais arquivos: nenhum — para 2009–2022 o único
// item que a regra |b| > 20 alcançava era o 53958; para 2023–2025 o comportamento fica idêntico ao
// gerador original.
//
// Este teste trava as duas pontas:
//   1. O dado publicado (public/tri/enem-2015.json) mantém os brutos oficiais do item 53958.
//   2. O gerador mantém a exceção nomeada (CO_ITEM 53958) na regra de conversão (500,100).
// Uso: npm run testar:tri-parametros
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

// 2. O gerador mantém a exceção nomeada na regra de conversão (500,100).
const gerador = ler("scripts/enem/gerar-parametros-tri.mjs");
const m = gerador.match(/if \(b !== null && Math\.abs\(b\) > 20 && r\.CO_ITEM !== "53958"\) \{ b = \(b - 500\) \/ 100; a = a === null \? null : a \* 100; \}/);
confere("gerador: exceção nomeada CO_ITEM 53958 na regra (500,100)", !!m, "linha da heurística não encontrada na forma protegida");

// 3. Comportamento da regra nos casos relevantes (reimplementação fiel da linha, para regressão de lógica).
const converte = (co, a, b) => {
  if (b !== null && Math.abs(b) > 20 && co !== "53958") { return { b: (b - 500) / 100, a: a === null ? null : a * 100 }; }
  return { a, b };
};
const excecao = converte("53958", 0.01929, 61.05459);
confere("53958 (a=0,01929, b=61,05459) NÃO é convertido", excecao.a === 0.01929 && excecao.b === 61.05459, JSON.stringify(excecao));
const escala = converte("99999", 1.5, 620);
confere("outro item na escala (500,100) (a=1,5, b=620) continua convertido", escala.a === 150 && escala.b === 1.2, JSON.stringify(escala));
const logit = converte("99998", 1.2, -2.5);
confere("logit comum (|b| ≤ 20) passa inalterado", logit.a === 1.2 && logit.b === -2.5, JSON.stringify(logit));
const novoCaso = converte("99997", 0.03, 55);
confere("caso novo com a mesma assinatura segue a regra antiga até ser medido e nomeado", novoCaso.a === 3 && novoCaso.b === -4.45, JSON.stringify(novoCaso));

if (falhas) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTodos os testes do item 53958 passaram.");

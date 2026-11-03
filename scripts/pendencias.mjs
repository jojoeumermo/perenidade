// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Pendências de revisão e do modelo de aula. Só lê os arquivos de content/; não muda nada.
//
//   npm run pendencias                          resumo do acervo inteiro
//   npm run pendencias -- matematica-fundamental   aula por aula de uma ou mais trilhas
//   npm run pendencias -- --estrito trilha       falha se alguma aula da trilha não seguir o modelo
//
// Sempre falha (para a CI pegar) se o campo "revisoes" de alguma aula ou um arquivo de exercícios estiver errado.
import { PARTES, PARTES_NOVAS } from "../lib/modelo-de-aula.ts";
import { lerPendencias } from "../lib/pendencias.ts";

const args = process.argv.slice(2);
const estrito = args.includes("--estrito");
const trilhas = args.filter((a) => !a.startsWith("--"));
const { aulas, exercicios, exerciciosEmRevisao, erros } = lerPendencias();

const NOMES = { objetivo: "objetivo", explicacao: "explicação", exemplo: "exemplo resolvido", exercicio: "exercício", resumo: "resumo", fontes: "fontes" };
// As 3 partes novas do modelo de 9 partes: opcionais nas aulas antigas; a aula que declara `modelo: 9` tem de levar as três.
const NOMES_NOVAS = { "na-sua-realidade": "na sua realidade (antes da explicação)", "outro-lado": "o outro lado (com treino de resposta)", agir: "agir" };
// As seções a mais das aulas do percurso ENEM (docs/ENEM.md).
const NOMES_ENEM = { "como-cai": "como isso cai no ENEM", "questao-comentada": "questão comentada", aprofundar: "para aprofundar" };
const conta = (f) => aulas.filter(f).length;

console.log("Pendências de revisão e do modelo de aula (docs/MODELO-DE-AULA.md, docs/CHECKLIST-DE-REVISAO.md)\n");
console.log(`Aulas: ${aulas.length} · revisadas com histórico: ${conta((a) => a.situacao === "revisada")} · aprovadas no painel: ${conta((a) => a.situacao === "aprovada")} · em revisão: ${conta((a) => a.situacao === "em-revisao")}`);
console.log(`Exercícios com explicação: ${exercicios} · em revisão: ${exerciciosEmRevisao}`);
console.log(`Seguem o modelo inteiro: ${conta((a) => a.faltam.length === 0)} aulas`);
console.log(`Falta, por parte: ${PARTES.map((p) => `${NOMES[p]} ${conta((a) => a.faltam.includes(p))}`).join(" · ")}`);
console.log(`Modelo de 9 partes: ${conta((a) => a.modelo9)} aulas declaram "modelo: 9" · com as 3 partes novas: ${conta((a) => a.faltamNovas.length === 0)} · de trilha de entrada ou militância ainda sem "modelo: 9": ${conta((a) => a.exigeNovas && !a.modelo9)} (opcional nas antigas)`);
console.log(`Partes novas ausentes nas aulas com "modelo: 9": ${PARTES_NOVAS.map((p) => `${NOMES_NOVAS[p].split(" (")[0]} ${conta((a) => a.modelo9 && a.faltamNovas.includes(p))}`).join(" · ")}`);

let problemas = 0;
for (const trilha of trilhas) {
  const lista = aulas.filter((a) => a.trilha === trilha);
  console.log(`\n${trilha}${lista.length ? "" : ": nenhuma aula com esse nome de trilha"}`);
  for (const a of lista) {
    const situacao = a.situacao === "revisada" ? `revisada por ${a.revisoes[0].funcao} em ${a.revisoes[0].data}` : a.situacao === "aprovada" ? "aprovada no painel" : "em revisão";
    const todas = [...a.faltam.map((p) => NOMES[p]), ...(a.modelo9 ? a.faltamNovas.map((p) => NOMES_NOVAS[p]) : []), ...a.faltamEnem.map((s) => NOMES_ENEM[s])];
    const falta = (todas.length ? `falta: ${todas.join(", ")}` : a.modelo9 ? "segue o modelo de 9 partes" : "segue o modelo") + (a.modelo9 || !a.exigeNovas ? "" : " · sem as 3 partes novas (modelo: 9)");
    const ex = a.exercicios ? ` · ${a.exercicios} exercícios (${a.exerciciosEmRevisao} em revisão)` : "";
    console.log(`  ${a.aula.padEnd(44)} ${situacao} · ${falta}${ex}`);
    if (estrito && todas.length) problemas++;
  }
}

if (erros.length) {
  console.log("\nErros de formato (corrija):");
  for (const e of erros) console.log(`  ✗ ${e}`);
}
process.exit(erros.length || problemas ? 1 : 0);

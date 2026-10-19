// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o que os recursos novos guardam no aparelho (lib/meu-estudo.ts), a leitura das flags (lib/recursos.ts) e
// que a cópia de segurança de lib/estudo.ts leva e junta as chaves novas sem perder nada. Sem rede, sem navegador.
import { lerCopia, montarCopia, restaurarCopia } from "../lib/estudo.ts";
import {
  aulasNaSemana,
  apagarProgresso,
  CAIXA_APRENDIDA,
  carimbarConclusoes,
  emRevisao,
  inicioDaSemana,
  lerDatas,
  lerRespostas,
  lerTestes,
  paraRevisar,
  porTema,
  proximaRevisao,
  registrarTeste,
  responderExercicio,
} from "../lib/meu-estudo.ts";
import { ligado, lerRecursos, RECURSOS } from "../lib/recursos.ts";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

class Memoria {
  constructor(d = {}) {
    this.d = { ...d };
  }
  get length() {
    return Object.keys(this.d).length;
  }
  key(i) {
    return Object.keys(this.d)[i] ?? null;
  }
  getItem(k) {
    return k in this.d ? this.d[k] : null;
  }
  setItem(k, v) {
    this.d[k] = String(v);
  }
  removeItem(k) {
    delete this.d[k];
  }
}
globalThis.localStorage = new Memoria();

// Flags
conferir("sem variável, tudo desligado", Object.keys(RECURSOS).every((r) => !ligado(r, lerRecursos(undefined))));
conferir("lista com espaços e maiúsculas", ligado("meu-estudo", lerRecursos(" Meu-Estudo , exercicios")) && ligado("exercicios", lerRecursos("meu-estudo,exercicios")) && !ligado("turma", lerRecursos("meu-estudo")));
conferir("todos liga tudo", Object.keys(RECURSOS).every((r) => ligado(r, lerRecursos("todos"))));

// Testes de fim de aula
registrarTeste("matematica-fundamental/fracoes", 2, 3, 1000);
registrarTeste("matematica-fundamental/fracoes", 3, 3, 2000);
const t = lerTestes()["matematica-fundamental/fracoes"];
conferir("vale o último teste e conta as vezes", t.acertos === 3 && t.total === 3 && t.vezes === 2 && t.quando === 2000);
registrarTeste("", 1, 1);
registrarTeste("x/y", 5, 3);
conferir("ignora aula vazia e limita acertos", !("" in lerTestes()) && lerTestes()["x/y"].acertos === 3);

// Revisão espaçada dos erros
const dia = "2026-10-19";
conferir("errou volta amanhã, na caixa 0", JSON.stringify(proximaRevisao(3, false, dia)) === JSON.stringify({ caixa: 0, proxima: "2026-10-20" }));
conferir("acertou sobe e espera mais", proximaRevisao(0, true, dia).caixa === 1 && proximaRevisao(0, true, dia).proxima === "2026-10-20" && proximaRevisao(2, true, dia).proxima === "2026-10-26");
const info = { aula: "matematica-fundamental/fracoes", tema: "Somar frações", dificuldade: 2 };
responderExercicio("fracoes-03", info, false, new Date("2026-10-19T15:00:00"));
conferir("o erro não é para hoje", paraRevisar(lerRespostas(), "2026-10-19").length === 0);
conferir("o erro é para amanhã", paraRevisar(lerRespostas(), "2026-10-20")[0] === "fracoes-03");
responderExercicio("fracoes-04", { ...info, tema: "Fração de uma quantidade" }, true, new Date("2026-10-19T15:00:00"));
conferir("acerto de primeira não entra na revisão", !paraRevisar(lerRespostas(), "2030-01-01").includes("fracoes-04") && emRevisao().length === 1);
let r;
for (let i = 0; i < CAIXA_APRENDIDA; i++) r = responderExercicio("fracoes-03", info, true, new Date(`2026-11-${String(10 + i * 5).padStart(2, "0")}T10:00:00`));
conferir("acertos seguidos tiram da revisão", r.caixa >= CAIXA_APRENDIDA && paraRevisar(lerRespostas(), "2031-01-01").length === 0);
conferir("tentativas e acertos", lerRespostas()["fracoes-03"].tentativas === 1 + CAIXA_APRENDIDA && lerRespostas()["fracoes-03"].acertos === CAIXA_APRENDIDA);
responderExercicio("fracoes-03", info, false, new Date("2026-12-20T10:00:00"));
conferir("errou de novo, volta para a revisão", lerRespostas()["fracoes-03"].caixa === 0 && paraRevisar(lerRespostas(), "2026-12-21").includes("fracoes-03"));
const temas = porTema();
conferir("acertos por tema", temas.length === 2 && temas.find((x) => x.tema === "Somar frações").tentativas === 2 + CAIXA_APRENDIDA);

// Datas de conclusão e a semana
localStorage.setItem("lucia:concluidas", JSON.stringify(["a/1", "a/2"]));
carimbarConclusoes(["a/1", "a/2"], new Date("2026-10-21T10:00:00").getTime());
conferir("o que já estava feito entra sem data", lerDatas()["a/1"] === 0 && lerDatas()["a/2"] === 0);
carimbarConclusoes(["a/1", "a/2", "a/3"], new Date("2026-10-21T10:00:00").getTime());
conferir("aula nova ganha a data", lerDatas()["a/3"] === new Date("2026-10-21T10:00:00").getTime());
carimbarConclusoes(["a/1", "a/3"], Date.now());
conferir("desmarcada perde a data", !("a/2" in lerDatas()));
conferir("a semana começa na segunda", inicioDaSemana(new Date("2026-10-25T23:00:00")).getDay() === 1 && inicioDaSemana(new Date("2026-10-19T08:00:00")).getDate() === 19);
conferir("conta só esta semana", aulasNaSemana(lerDatas(), new Date("2026-10-22T12:00:00")) === 1 && aulasNaSemana(lerDatas(), new Date("2026-10-30T12:00:00")) === 0);

// Cópia de segurança: leva as chaves novas e junta sem perder
const copia = lerCopia(JSON.stringify(montarCopia(localStorage)));
conferir("a cópia leva testes, exercícios e datas", ["lucia:testes", "lucia:exercicios", "lucia:concluidas-em"].every((k) => k in copia.dados));
const outro = new Memoria({ "lucia:testes": JSON.stringify({ "b/1": { quando: 5, acertos: 1, total: 2, vezes: 1 }, "matematica-fundamental/fracoes": { quando: 99999, acertos: 0, total: 3, vezes: 9 } }) });
restaurarCopia(copia, outro);
const juntos = JSON.parse(outro.getItem("lucia:testes"));
conferir("junta os testes dos dois aparelhos", "b/1" in juntos && "x/y" in juntos);
conferir("no mesmo item vence o mais recente", juntos["matematica-fundamental/fracoes"].quando === 99999);

// Apagar o progresso
localStorage.setItem("lucia:caderno", "[]");
const n = apagarProgresso(localStorage);
conferir("apaga o progresso", n >= 4 && lerTestes()["x/y"] === undefined && localStorage.getItem("lucia:concluidas") === null);
conferir("as notas do caderno ficam", localStorage.getItem("lucia:caderno") === "[]");

console.log(`meu estudo: ${ok} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);

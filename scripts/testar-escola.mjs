// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a base da Escola Revolucionária Lúcia Maria (E4-01, docs/ESCOLA.md): o estudante no aparelho (matrícula, cursos, caderneta e
// o apagar), o tempo (semestres e semana de provas), o modelo de curso (validação, horas e progresso), TODOS os cursos de
// content/escola/cursos, as rotas e o trecho publicado da abertura. Sem rede, sem navegador.
import fs from "node:fs";
import path from "node:path";
import {
  ALFABETO,
  CHAVES_DA_ESCOLA,
  CHAVES_PRIVADAS,
  FORMATO_DO_NUMERO,
  MAX_CADERNETA,
  aberturaVista,
  acrescentarNaCaderneta,
  apagarEscola,
  gravarMatricula,
  inscrever,
  lerCaderneta,
  lerInscricoes,
  lerMatricula,
  marcarAberturaVista,
  marcarDispensa,
  marcarFormatura,
  novaMatricula,
  numeroDeMatricula,
  trancar,
  validarMatricula,
} from "../lib/escola/estudante.ts";
import { AVISO_SEM_TEXTO, aberturaDoQuemFoi } from "../lib/escola/quem-foi.ts";
import { ANO_LETIVO, calendarioProposto, hojeEmBrasilia, semanaDeProvas, semestreDe } from "../lib/escola/tempo.ts";
import { aulaAtual, arredondarHoras, cicloDeRequisitos, horasDoCurso, horasFeitas, moduloDe, proximaDoCurso, tempoDaAula, validarCurso } from "../lib/escola/cursos.ts";
import { existeAula, existeMemorial, existeObra, lerCursosComErros, minutosDaAula } from "../lib/escola/cursos-servidor.ts";
import { ROTAS_DA_ESCOLA, abertaNaFaixa, FAIXA_DA_ESCOLA, GRUPOS_DA_ESCOLA, mapaDaEscola } from "../lib/escola/rotas.ts";
import { textosDaBase, trechoDoQuemSomos } from "../lib/escola/textos.ts";
import { chavesDeEstudo, chavesSoApagar, entraNaCopia, montarCopia, PREFIXOS_SO_APAGAR, SO_APAGAR } from "../lib/estudo.ts";
import { areaDoCaminho } from "../lib/interdicao.ts";

const raiz = path.resolve(import.meta.dirname, "..");
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
let avisos = 0;
globalThis.dispatchEvent = (e) => {
  if (e.type === "lucia:estudo") avisos++;
  return true;
};

// ───────────── Número de matrícula ─────────────
conferir("número com bytes zerados", numeroDeMatricula(new Uint8Array(5)) === "LM-0000-0000");
conferir("número com bytes cheios", numeroDeMatricula(new Uint8Array([255, 255, 255, 255, 255])) === "LM-ZZZZ-ZZZZ");
conferir("número conhecido", numeroDeMatricula(new Uint8Array([0, 0, 0, 0, 1])) === "LM-0000-0001" && numeroDeMatricula(new Uint8Array([0, 0, 0, 0, 32])) === "LM-0000-0010");
conferir("alfabeto de Crockford", ALFABETO.length === 32 && !/[ILOU]/.test(ALFABETO) && new Set(ALFABETO).size === 32);
let todosNoFormato = true;
for (let i = 0; i < 2000; i++) {
  const n = numeroDeMatricula();
  if (!FORMATO_DO_NUMERO.test(n) || /[ILOU]/.test(n.slice(3))) todosNoFormato = false;
}
conferir("2000 números sorteados no formato LM-XXXX-XXXX, sem I, L, O, U", todosNoFormato);

// ───────────── Matrícula ─────────────
const respostas = { apelido: "  Dona Cida  ", objetivo: "terminar-a-escola", tempo: "1-3h", acesso: "pacote-acaba", nivelamento: ["ler-e-escrever", "ler-e-escrever"] };
// 01/03/2026 às 02:00 UTC ainda é 28/02 em Brasília.
const m = novaMatricula(respostas, new Date("2026-03-01T02:00:00Z"), new Uint8Array([1, 2, 3, 4, 5]));
conferir("matrícula nova", m.versao === 1 && m.criadaEm === "2026-02-28" && m.apelido === "Dona Cida" && m.nivelamento.length === 1 && FORMATO_DO_NUMERO.test(m.numero));
conferir("apelido cortado em 40", novaMatricula({ ...respostas, apelido: "x".repeat(80) }).apelido.length === 40);
conferir("sem apelido não grava o campo", !("apelido" in novaMatricula({ ...respostas, apelido: "   " })));
conferir("matrícula válida passa", JSON.stringify(validarMatricula(m)) === JSON.stringify(m));
for (const [nome, ruim] of [
  ["nulo", null],
  ["texto", "LM-0000-0000"],
  ["lista", []],
  ["versão 2", { ...m, versao: 2 }],
  ["número errado", { ...m, numero: "LM-OOOO-0000" }],
  ["data errada", { ...m, criadaEm: "28/02/2026" }],
  ["apelido longo", { ...m, apelido: "y".repeat(41) }],
  ["objetivo desconhecido", { ...m, objetivo: "ficar-rico" }],
  ["tempo desconhecido", { ...m, tempo: "10h" }],
  ["acesso desconhecido", { ...m, acesso: "satelite" }],
  ["nivelamento não é lista", { ...m, nivelamento: "x" }],
]) {
  let lancou = false;
  let r;
  try {
    r = validarMatricula(ruim);
  } catch {
    lancou = true;
  }
  conferir(`matrícula ruim vira null (${nome})`, !lancou && r === null);
}
avisos = 0;
conferir("grava e lê a matrícula", gravarMatricula(m) && lerMatricula()?.numero === m.numero && avisos === 1);
localStorage.setItem(CHAVES_DA_ESCOLA.matricula, "{estragado");
conferir("matrícula estragada no aparelho vira null", lerMatricula() === null);
conferir("não grava forma errada", gravarMatricula({ ...m, objetivo: "x" }) === false);

// ───────────── Inscrições ─────────────
const curso = "eja-ler-e-escrever";
const i1 = inscrever(curso, new Date("2026-08-10T12:00:00Z"));
conferir("inscrever", i1.semestre === "2026.2" && i1.entrouEm === "2026-08-10" && lerInscricoes().length === 1);
inscrever(curso, new Date("2026-09-10T12:00:00Z"));
conferir("inscrever de novo não duplica nem muda a data", lerInscricoes().length === 1 && lerInscricoes()[0].entrouEm === "2026-08-10");
conferir("semestre de março é .1", inscrever("outro", new Date("2026-03-10T12:00:00Z")).semestre === "2026.1");
trancar(curso, new Date("2026-09-01T12:00:00Z"));
conferir("trancar", lerInscricoes().find((x) => x.curso === curso)?.trancadoEm === "2026-09-01");
inscrever(curso);
conferir("voltar destranca", !lerInscricoes().find((x) => x.curso === curso)?.trancadoEm);
marcarDispensa(curso, "matematica-fundamental");
marcarDispensa(curso, "matematica-fundamental");
conferir("dispensa sem repetir", lerInscricoes().find((x) => x.curso === curso)?.dispensas.join() === "matematica-fundamental");
conferir("formatura com data errada não grava", marcarFormatura(curso, "ontem") === null);
marcarFormatura(curso, "2026-12-15");
conferir("formatura", lerInscricoes().find((x) => x.curso === curso)?.formadoEm === "2026-12-15");
conferir("curso que não existe na lista", trancar("nenhum") === null);
localStorage.setItem(CHAVES_DA_ESCOLA.cursos, JSON.stringify([{ curso: "a" }, 3, null, { curso: "b", entrouEm: "2026-01-01", semestre: "2026.1", dispensas: [] }]));
conferir("inscrição estragada é ignorada", lerInscricoes().length === 1 && lerInscricoes()[0].curso === "b");

// ───────────── Caderneta ─────────────
localStorage.removeItem(CHAVES_DA_ESCOLA.caderneta);
const r1 = acrescentarNaCaderneta({ tipo: "tarefa", data: "2026-10-01", titulo: "t".repeat(300), detalhe: "d".repeat(3000) });
conferir("registro na caderneta (título e detalhe cortados)", r1 && r1.titulo.length === 160 && r1.detalhe.length === 2000 && lerCaderneta().length === 1);
conferir("registro com tipo errado não entra", acrescentarNaCaderneta({ tipo: "nota", data: "2026-10-01", titulo: "x", detalhe: "" }) === null);
for (let i = 0; i < MAX_CADERNETA + 20; i++) acrescentarNaCaderneta({ id: `r${i}`, tipo: "outro", data: "2026-10-02", titulo: `n${i}`, detalhe: "" });
const caderneta = lerCaderneta();
conferir("caderneta guarda no máximo 500 (saem os mais velhos)", caderneta.length === MAX_CADERNETA && caderneta.at(-1).id === `r${MAX_CADERNETA + 19}` && !caderneta.some((r) => r.id === r1.id));

// ───────────── Abertura ─────────────
localStorage.removeItem(CHAVES_DA_ESCOLA.abertura);
conferir("abertura ainda não vista", aberturaVista() === false);
marcarAberturaVista(new Date("2026-11-03T12:00:00Z"));
conferir("abertura vista", aberturaVista() === true && JSON.parse(localStorage.getItem(CHAVES_DA_ESCOLA.abertura)) === "2026-11-03");

// ───────────── Cópia e apagar ─────────────
conferir("chaves da Escola entram na cópia", Object.values(CHAVES_DA_ESCOLA).every(entraNaCopia));
conferir("chaves privadas ficam fora da cópia", Object.values(CHAVES_PRIVADAS).every((k) => !entraNaCopia(k)));
conferir("chaves novas de estudo da onda 1 entram na cópia", ["lucia:posicao-da-aula", "lucia:aula-em-partes", "lucia:uma-mao"].every(entraNaCopia));
conferir("lista só apagar", SO_APAGAR.includes("lucia:historico") && SO_APAGAR.includes("lucia:historico-ligado") && SO_APAGAR.includes("lucia:radio-retomar") && SO_APAGAR.includes("lucia:modo-pacote-convite") && PREFIXOS_SO_APAGAR.includes("lucia:escola-privado:") && PREFIXOS_SO_APAGAR.includes("lucia:ajudou-contou:"));
conferir("só apagar fica fora da cópia", [...SO_APAGAR, "lucia:ajudou-contou:trilha/aula", "lucia:escola-privado:conversas"].every((k) => !entraNaCopia(k)));
const aparelho = new Memoria({
  "lucia:escola:matricula": "{}",
  "lucia:escola:qualquer-coisa-nova": "1",
  "lucia:escola-privado:conversas": "[]",
  "lucia:escola-privado:trabalho": "{}",
  "lucia:historico": "[]",
  "lucia:historico-ligado": "1",
  "lucia:radio-retomar": "{}",
  "lucia:modo-pacote-convite": "1",
  "lucia:ajudou-contou:matematica/fracoes": "1",
  "lucia:posicao-da-aula": "{}",
  "lucia:caderno": "[]",
  "lucia:escolar": "não é da Escola",
  "lucia:sessao": "credencial",
});
conferir("chavesSoApagar", chavesSoApagar(aparelho).sort().join() === ["lucia:ajudou-contou:matematica/fracoes", "lucia:escola-privado:conversas", "lucia:escola-privado:trabalho", "lucia:historico", "lucia:historico-ligado", "lucia:modo-pacote-convite", "lucia:radio-retomar"].join());
const copia = montarCopia(aparelho);
conferir("a cópia leva a Escola e deixa o privado", "lucia:escola:matricula" in copia.dados && "lucia:escola:qualquer-coisa-nova" in copia.dados && !("lucia:escola-privado:conversas" in copia.dados) && !("lucia:historico" in copia.dados));
// O "apagar meus dados" (components/DataPanel.tsx): estudo, só apagar e a Escola inteira.
globalThis.localStorage = aparelho;
for (const k of chavesDeEstudo(aparelho)) aparelho.removeItem(k);
for (const k of chavesSoApagar(aparelho)) aparelho.removeItem(k);
apagarEscola();
const sobrou = Object.keys(aparelho.d);
conferir("o apagar não deixa nenhuma chave da Escola nem da lista só apagar", !sobrou.some((k) => k.startsWith("lucia:escola:") || k.startsWith("lucia:escola-privado:") || SO_APAGAR.includes(k) || PREFIXOS_SO_APAGAR.some((p) => k.startsWith(p)) || k === "lucia:posicao-da-aula" || k === "lucia:caderno"), sobrou.join());
conferir("o apagar não mexe no que não é estudo", sobrou.includes("lucia:escolar") && sobrou.includes("lucia:sessao"));
globalThis.localStorage = new Memoria({ "lucia:escola:a": "1", "lucia:escola-privado:b": "2", "lucia:caderno": "[]", "lucia:escolar": "x" });
conferir("apagarEscola só os dois prefixos", apagarEscola() === 2 && Object.keys(globalThis.localStorage.d).sort().join() === "lucia:caderno,lucia:escolar");

// ───────────── Tempo ─────────────
const sem = (d) => semestreDe(d);
conferir("02/01 é férias do 2º semestre do ano anterior", sem("2026-01-02").id === "2025.2" && sem("2026-01-02").situacao === "ferias" && sem("2026-01-02").proximo.id === "2026.1");
conferir("31/01 ainda é férias", sem("2026-01-31").situacao === "ferias");
conferir("01/02 começa o 1º semestre", sem("2026-02-01").id === "2026.1" && sem("2026-02-01").situacao === "aulas" && sem("2026-02-01").inicio === "2026-02-01" && sem("2026-02-01").fim === "2026-06-30");
conferir("30/06 ainda é aula", sem("2026-06-30").id === "2026.1" && sem("2026-06-30").situacao === "aulas");
conferir("julho é férias", sem("2026-07-15").id === "2026.1" && sem("2026-07-15").situacao === "ferias" && sem("2026-07-15").proximo.id === "2026.2" && sem("2026-07-15").proximo.inicio === "2026-08-01");
conferir("01/08 começa o 2º semestre", sem("2026-08-01").id === "2026.2" && sem("2026-08-01").situacao === "aulas");
conferir("15/12 ainda é aula", sem("2026-12-15").id === "2026.2" && sem("2026-12-15").situacao === "aulas");
conferir("16/12 é férias e o próximo é o do ano seguinte", sem("2026-12-16").situacao === "ferias" && sem("2026-12-16").proximo.id === "2027.1" && sem("2026-12-16").proximo.inicio === "2027-02-01");
conferir("virada do ano", sem("2026-12-31").id === "2026.2" && sem("2027-01-01").id === "2026.2" && sem("2027-01-01").proximo.id === "2027.1");
conferir("recesso é férias sem trocar de semestre", (() => {
  const r = semestreDe("2026-04-03", { ...ANO_LETIVO, recessos: [{ inicio: "2026-04-01", fim: "2026-04-05" }] });
  return r.id === "2026.1" && r.situacao === "ferias";
})());
conferir("semana de provas do 1º semestre", JSON.stringify(semanaDeProvas(sem("2026-03-01"))) === JSON.stringify({ inicio: "2026-06-17", fim: "2026-06-30" }));
conferir("semana de provas do 2º semestre", JSON.stringify(semanaDeProvas(sem("2026-09-01"))) === JSON.stringify({ inicio: "2026-12-02", fim: "2026-12-15" }));
conferir("semana de provas nunca começa antes do semestre", semanaDeProvas({ inicio: "2026-02-01", fim: "2026-02-05" }).inicio === "2026-02-01");
conferir("hoje em Brasília", hojeEmBrasilia(new Date("2026-11-04T02:59:00Z")) === "2026-11-03" && hojeEmBrasilia(new Date("2026-11-04T03:00:00Z")) === "2026-11-04");
conferir("semestre a partir de Date", semestreDe(new Date("2026-08-01T02:00:00Z")).id === "2026.1" && semestreDe(new Date("2026-08-01T03:00:00Z")).id === "2026.2");
conferir("calendário ainda é proposta", ANO_LETIVO.confirmado === false && calendarioProposto() && ANO_LETIVO.fuso === "America/Sao_Paulo" && ANO_LETIVO.provas.regra === "duas-ultimas-semanas");

// ───────────── Modelo de curso ─────────────
const aulas = ["t1/a1", "t1/a2", "t1/a3", "t2/b1", "t2/b2", "t2/b3", "t2/b4"];
const conferidores = {
  existeAula: (a) => aulas.includes(a),
  existeMemorial: (s) => s === "pessoa-do-memorial",
  existeObra: (s) => s === "obra-do-acervo",
  existeCurso: (s) => ["base", "a", "b"].includes(s),
  requisitosDe: (s) => ({ base: [], a: ["b"], b: ["a"] })[s],
};
const cursoBom = {
  slug: "curso-de-teste",
  titulo: "Curso de teste",
  ciclo: "basico",
  formato: "regular",
  area: "matematica",
  resumo: "r",
  objetivo: "o",
  objetivos: ["enem"],
  modulos: [
    { titulo: "M1", aulas: ["t1/a1", "t1/a2", "t1/a3"] },
    { titulo: "M2", aulas: ["t2/b1", "t2/b2", "t2/b3"], pratica: ["fazer algo"] },
  ],
  requisitos: ["base"],
  patrono: { memorial: "pessoa-do-memorial", motivo: "m", confirmado: false },
  leituras: [{ obra: "obra-do-acervo", ordem: 1, porque: "p" }],
  tarefaNoMundo: "t",
  projetoFinal: "p",
  semanas: 8,
};
conferir("curso bom passa", validarCurso(cursoBom, conferidores).length === 0, validarCurso(cursoBom, conferidores).join("; "));
const erroCom = (mudanca, trecho) => validarCurso({ ...cursoBom, ...mudanca }, conferidores).some((e) => e.includes(trecho));
conferir("aula inexistente", erroCom({ modulos: [{ titulo: "M", aulas: ["t1/a1", "t1/a2", "t1/a3", "t2/b1", "t2/b2", "t9/zz"] }] }, "aula não existe: t9/zz"));
conferir("menos de 6 aulas", erroCom({ modulos: [{ titulo: "M", aulas: ["t1/a1", "t1/a2", "t1/a3", "t2/b1", "t2/b2"] }] }, "o mínimo é 6"));
conferir("aula repetida", erroCom({ modulos: [{ titulo: "M", aulas: ["t1/a1", "t1/a2", "t1/a3", "t2/b1", "t2/b2", "t2/b3", "t1/a1"] }] }, "aula repetida: t1/a1"));
conferir("aula em formato errado", erroCom({ modulos: [{ titulo: "M", aulas: ["t1-a1", "t1/a2", "t1/a3", "t2/b1", "t2/b2", "t2/b3"] }] }, "formato errado"));
conferir("patrono inexistente", erroCom({ patrono: { memorial: "inventada", motivo: "m", confirmado: false } }, "patrono não está no Memorial"));
conferir("obra inexistente", erroCom({ leituras: [{ obra: "sem-obra", ordem: 1, porque: "p" }] }, "obra não está no Acervo"));
conferir("requisito inexistente", erroCom({ requisitos: ["fantasma"] }, "requisito não existe"));
conferir("requisito de si mesmo", erroCom({ requisitos: ["curso-de-teste"] }, "requisito de si mesmo"));
conferir("ciclo de requisitos", validarCurso({ ...cursoBom, slug: "a", requisitos: ["b"] }, conferidores).some((e) => e.includes("ciclo")));
conferir("ciclo longo", cicloDeRequisitos("x", ["y"], (s) => ({ y: ["z"], z: ["x"] })[s])?.join() === "x,y,z,x" && cicloDeRequisitos("x", ["y"], (s) => ({ y: ["z"], z: [] })[s]) === null);
conferir("ciclo e formato inválidos", erroCom({ ciclo: "doutorado" }, "ciclo inválido") && erroCom({ formato: "ead" }, "formato inválido") && erroCom({ semanas: 0 }, "semanas") && erroCom({ titulo: "" }, 'falta "titulo"'));

conferir("tempo da aula (estimativa)", tempoDaAula({ minutes: 10, quiz: 5, exercicios: 2 }) === 26 && tempoDaAula({ minutes: 3, quiz: 0, exercicios: 0 }) === 3);
conferir("arredonda para meia hora", arredondarHoras(0) === 0 && arredondarHoras(5) === 0.5 && arredondarHoras(44) === 0.5 && arredondarHoras(46) === 1 && arredondarHoras(90) === 1.5);
const minutos = () => 20;
conferir("horas do curso", horasDoCurso(cursoBom, minutos) === 2);
conferir("horas feitas contam dispensa", horasFeitas(cursoBom, ["t1/a1"], ["t2"], minutos) === 1.5 && horasFeitas(cursoBom, [], [], minutos) === 0);
conferir("próxima do curso", proximaDoCurso(cursoBom, ["t1/a1"], []) === "t1/a2" && proximaDoCurso(cursoBom, ["t1/a1", "t1/a2", "t1/a3"], ["t2"]) === null && proximaDoCurso(cursoBom, new Set(), ["t1"]) === "t2/b1");
conferir("aula atual", aulaAtual(cursoBom, ["t1/a1"], [], "t1/a3") === "t1/a3" && aulaAtual(cursoBom, ["t1/a1"], [], "t1/a1") === "t1/a2" && aulaAtual(cursoBom, [], [], "fora/x") === "t1/a1");
conferir("módulo de uma aula", moduloDe(cursoBom, "t2/b2")?.indice === 1 && moduloDe(cursoBom, "t2/b2")?.titulo === "M2" && moduloDe(cursoBom, "x/y") === null);

// Os conferidores de verdade (repositório).
conferir("aula de verdade existe pelo slug do endereço", existeAula("matematica-fundamental/fracoes") && !existeAula("matematica-fundamental/01-fracoes") && !existeAula("matematica-fundamental/_trilha") && !existeAula("nao-existe/aula") && !existeAula("../x/y"));
conferir("minutos de uma aula de verdade", minutosDaAula("matematica-fundamental/fracoes") > 0 && minutosDaAula("nao-existe/aula") === 0);
const umaPessoa = fs.readdirSync(path.join(raiz, "content", "memorial")).find((n) => /^[a-z0-9-]+\.md$/.test(n))?.replace(/\.md$/, "");
const umaObra = fs.readdirSync(path.join(raiz, "content", "acervo")).find((n) => /^[a-z0-9-]+\.md$/.test(n))?.replace(/\.md$/, "");
conferir("Memorial e Acervo de verdade", existeMemorial(umaPessoa) && existeObra(umaObra) && !existeMemorial("pessoa-inventada-zzz") && !existeObra("obra-inventada-zzz"));

// TODOS os cursos de content/escola/cursos (os do E4-07 entram aqui). Pasta vazia é válida.
const lidos = lerCursosComErros();
for (const l of lidos) conferir(`curso ${l.arquivo}`, l.erros.length === 0, l.erros.join("; "));
console.log(`cursos em content/escola/cursos: ${lidos.length}`);

// ───────────── Rotas, interdição e textos ─────────────
// F7 (prancha Mapa): cursos, campus e vida saíram de /escola e voltaram ao site aberto. Enquanto lib/escola/rotas.ts (da F1)
// ainda os listar, a página deles é procurada no endereço novo, para onde next.config.ts redireciona o antigo (308).
const MOVIDAS_PARA_O_SITE_ABERTO = ["/escola/cursos", "/escola/campus", "/escola/vida"];
const pastaDaRota = (caminho) => {
  const movida = MOVIDAS_PARA_O_SITE_ABERTO.some((m) => caminho === m || caminho.startsWith(`${m}/`));
  return path.join(raiz, "app", "[lang]", ...(movida ? caminho.replace(/^\/escola/, "") : caminho).split("/").filter(Boolean), "page.tsx");
};
for (const r of ROTAS_DA_ESCOLA) conferir(`página de ${r.caminho}`, fs.existsSync(pastaDaRota(r.caminho)));
// Cada pacote que entrega a sua página tira dela a marca de provisória.
// A marca confere com a página: provisória usa EmConstrucao; a que o pacote dono entregou tem página própria.
conferir("provisórias usam EmConstrucao e as entregues não", ROTAS_DA_ESCOLA.every((r) => /EmConstrucao/.test(fs.readFileSync(pastaDaRota(r.caminho), "utf8")) === Boolean(r.provisoria)));
// T15: a Militância (chamado de voluntários militantes) e o Manifesto da Frente Revolucionária Lúcia entram logo depois de "Quem foi".
conferir("faixa da Escola", FAIXA_DA_ESCOLA.map((r) => r.chave).join() === "entrada,quemFoi,militantes,manifesto,cursos,matricula,calendario,campus,turmas,acompanhante,caderneta");
conferir("link aberto na faixa", abertaNaFaixa("/escola") === "entrada" && abertaNaFaixa("/escola/cursos/eja") === "cursos" && abertaNaFaixa("/escola/plano") === null && abertaNaFaixa("/escolar") === null);
conferir("rotas da etapa na interdição (área estudo)", ["/escola", "/escola/cursos", "/cursos", "/cursos/eja", "/campus", "/vida/tarefas", "/libras", "/aula-do-dia"].every((c) => areaDoCaminho(c) === "estudo"));
// F7: as páginas movidas não ficam mais dentro de /escola (onde a porta pede conta).
for (const m of MOVIDAS_PARA_O_SITE_ABERTO) {
  const aberta = m.replace(/^\/escola\//, "");
  conferir(`${m} saiu da Escola`, !fs.existsSync(path.join(raiz, "app", "[lang]", ...m.split("/").filter(Boolean))));
  conferir(`/${aberta} tem a página no site aberto`, fs.existsSync(path.join(raiz, "app", "[lang]", aberta, "page.tsx")));
  conferir(`/${aberta} continua preso ao recurso escola`, /ligado\("escola"\)\) notFound\(\)/.test(fs.readFileSync(path.join(raiz, "app", "[lang]", aberta, "layout.tsx"), "utf8")));
}
const pt = textosDaBase("pt");
conferir("textos de toda rota", ROTAS_DA_ESCOLA.every((r) => (r.naFaixa ? pt.nav[r.chave] : pt.paginas[r.chave])) && ROTAS_DA_ESCOLA.filter((r) => r.provisoria).every((r) => pt.paginas[r.chave]));
conferir("idioma desconhecido cai no português", textosDaBase("xx") === pt && textosDaBase("en") !== pt);

// "Quem foi Lúcia Maria": era só o marcador até a T15, que escreveu o texto a partir das fontes anotadas em
// docs/escola-revolucionaria/FONTES-LUCIA-MARIA.md (npm run testar:militantes confere o resto).
const quemFoi = fs.readFileSync(path.join(raiz, "content", "escola", "quem-foi-lucia-maria.md"), "utf8");
conferir("Quem foi Lúcia Maria tem o título e o texto (sem o marcador)", /^---\r?\ntitulo: "Quem foi Lúcia Maria"\r?\n---\r?\n/.test(quemFoi) && !quemFoi.includes("[TEXTO A ENVIAR PELA COORDENAÇÃO]") && quemFoi.replace(/^---[\s\S]*?---/, "").trim().length > 500);
// O 2º quadro da abertura (texto puro, 10 s) leva só o 1º parágrafo: nada de intertítulo, ênfase, link ou "---".
const quadroDeLucia = aberturaDoQuemFoi(quemFoi.replace(/^---[\s\S]*?---/, "").trim());
conferir("abertura: quadro de Lúcia é só o 1º parágrafo, sem Markdown", quadroDeLucia.length > 0 && quadroDeLucia.length < 400 && !/##|\*|\[|\]\(|---/.test(quadroDeLucia) && quemFoi.includes(quadroDeLucia));
conferir("abertura: corta antes do intertítulo e limpa ênfase e link", aberturaDoQuemFoi("Um *dois* [três](/x).\nQuatro.\n\n## Título\n\nOutro.") === "Um dois três. Quatro." && aberturaDoQuemFoi("Só\n## Título") === "Só" && aberturaDoQuemFoi("[TEXTO A ENVIAR PELA COORDENAÇÃO]") === AVISO_SEM_TEXTO);

// O trecho da abertura é cópia literal do "Quem somos" publicado (em cada idioma que tem a página).
for (const nome of fs.readdirSync(path.join(raiz, "content", "paginas")).filter((n) => /^quem-somos(\.[a-z]{2})?\.md$/.test(n))) {
  const texto = fs.readFileSync(path.join(raiz, "content", "paginas", nome), "utf8");
  const trecho = trechoDoQuemSomos(texto);
  conferir(`trecho literal de ${nome}`, Boolean(trecho) && texto.replace(/\*\*|\*/g, "").includes(trecho), String(trecho));
}

// ───────────── Nome, porta, faixa e aviso de matrícula (pedido da coordenação, nov/2026) ─────────────
const lerArq = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
const NOME = "Escola Revolucionária Lúcia Maria";
conferir("nome novo no título e na entrada", pt.meta.titulo === NOME && pt.entrada.titulo === NOME && pt.abertura.q1Titulo.includes(NOME));
const pastasDaEscola = fs.readdirSync(path.join(raiz, "i18n", "escola")).filter((n) => fs.existsSync(path.join(raiz, "i18n", "escola", n, "pt.json")));
const valores = (o) => (o && typeof o === "object" ? Object.values(o).flatMap(valores) : typeof o === "string" ? [o] : []);
for (const pasta of pastasDaEscola) {
  const textos = valores(JSON.parse(lerArq("i18n", "escola", pasta, "pt.json")));
  conferir(`i18n/escola/${pasta}/pt.json sem o nome antigo`, !textos.some((t) => /Escola Lúcia Maria/.test(t)));
  conferir(`i18n/escola/${pasta}/pt.json sem "Acompanhante" visível`, !textos.some((t) => /acompanhante/i.test(t)));
}
conferir("Acompanhante virou Assistente (a rota e a chave continuam)", pt.nav.acompanhante === "Assistente" && pt.paginas.acompanhante === "Assistente" && ROTAS_DA_ESCOLA.some((r) => r.chave === "acompanhante" && r.caminho === "/escola/acompanhante"));
for (const l of ["en", "es", "fr", "ru", "zh"]) conferir(`base ${l}: tradução marcada como rascunho`, textosDaBase(l)._rascunho === true);
conferir("base pt não é rascunho", !("_rascunho" in pt));

// A porta (Escola de Formação, F1): só entra militante, conferido no banco (useEscola → escola_eu); o resto vê a porta
// vermelha, que leva ao /entrar da Comunidade. O teste do banco e da porta por militância é o testar:escola-acesso.
const layoutDaEscola = lerArq("app", "[lang]", "escola", "layout.tsx");
const porta = lerArq("components", "escola", "PortaDaEscola.tsx");
const portaVermelha = lerArq("components", "escola", "porta", "PortaVermelha.tsx");
conferir("layout da Escola passa pela porta", /<PortaDaEscola[\s\S]*\{children\}[\s\S]*<\/PortaDaEscola>/.test(layoutDaEscola) && !/<NavDaEscola|<EstacaoDoAno|<FeriadoDoCampus/.test(layoutDaEscola));
conferir("porta confere a militância no banco (useEscola de lib/escola/acesso)", /import \{[^}]*\buseEscola\b[^}]*\} from "@\/lib\/escola\/acesso"/.test(porta) && /estado === "militante"/.test(porta) && /<Casca\b/.test(porta));
conferir("porta vermelha leva ao /entrar da Comunidade", portaVermelha.includes('"/entrar?volta=/escola"'));
conferir("porta não pede dado nenhum", !/<input|<form|rpc\(/.test(porta) && !/<input|<form|rpc\(/.test(portaVermelha));
conferir("textos da porta", ["lead", "comoEntrar", "entrar", "criar", "cadastroFechado", "menores", "conferindo", "semServico", "abertas", "verAulas", "privacidade"].every((k) => typeof pt.porta[k] === "string" && pt.porta[k].trim()) && pt.porta.passos.length === 3);

// A faixa centrada no eixo do conteúdo e rolável no celular.
const cssBase = lerArq("styles", "escola-base.css");
conferir("faixa centrada (margin-inline: auto) e rolável", /\.faixa-da-escola ul \{[^}]*margin-inline: auto/.test(cssBase) && !/\.faixa-da-escola ul \{[^}]*min-width: 100%/.test(cssBase) && /\.faixa-da-escola \{[^}]*overflow-x: auto/.test(cssBase));

// O mapa da entrada: toda página (menos a entrada) num grupo, e todo grupo com nome.
conferir("toda página da Escola no mapa da entrada", ROTAS_DA_ESCOLA.filter((r) => r.chave !== "entrada").every((r) => GRUPOS_DA_ESCOLA.includes(r.grupo)));
conferir("mapa sem grupo vazio e com nome", mapaDaEscola().every((g) => g.rotas.length > 0 && pt.mapa.grupos[g.grupo]));

// Aviso de matrícula: um só por tela, com botão de texto visível (o --paper não existe: o texto ficava preto no preto).
const cssFormatura = lerArq("styles", "escola-formatura.css");
conferir("botão cheio sem var(--paper)", !cssFormatura.includes("var(--paper)") && /\.formatura-botao,\s*\.formatura-botao:visited \{[^}]*color: var\(--parchment\)/.test(cssFormatura));
const conviteEm = (...p) => (lerArq(...p).match(/<ConviteDeMatricula\b/g) ?? []).length;
conferir("caderneta: importar e exportar não repetem o aviso", conviteEm("components", "escola", "caderneta", "ImportarComprovante.tsx") === 0 && conviteEm("components", "escola", "caderneta", "ExportarCaderneta.tsx") === 0 && conviteEm("components", "escola", "caderneta", "CadernetaDoTrabalhador.tsx") === 1);
conferir("carteirinha e plano usam o mesmo aviso", conviteEm("components", "escola", "carteirinha", "Carteirinha.tsx") === 1 && conviteEm("components", "escola", "plano", "PlanoDaSemana.tsx") === 1);
const aviso = lerArq("components", "escola", "formatura", "ConviteDeMatricula.tsx");
conferir("aviso diz o que é, o que dá e o que pede, com botão", ["semMatriculaOQueE", "semMatriculaOQueDa", "semMatriculaOQuePede"].every((k) => aviso.includes(`c.${k}`)) && /data-fazer-matricula/.test(aviso) && /text-parchment/.test(aviso));

console.log(`escola: ${ok} conferências certas, ${falhas.length} falhas`);
if (falhas.length) {
  console.error(falhas.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}

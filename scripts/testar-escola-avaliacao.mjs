// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a avaliação e o aprender ativo da Escola Lúcia Maria (E4-13, docs/escola/avaliacao.md): o retorno por
// competência (limites e pouco dado), a regra da dispensa, a revisão que mistura matérias (3 trilhas), a resposta
// digitada com erro de digitação perdoado (acentos, distâncias, números, palavras curtas), a gravação da prova (limite
// de 20), a regra do "lembra da aula anterior" (dia e conclusão), as explicações, a semana de provas e o .ics, e as
// promessas de privacidade e de "sem nota" no código. Sem rede, sem navegador.
import fs from "node:fs";
import path from "node:path";
import {
  aulaParaLembrar,
  COMPETENCIAS,
  competenciaDe,
  detalheDoReconhecimento,
  explicacaoDe,
  gravarExplicacao,
  gravarProva,
  icsDaSemanaDeProvas,
  lerAvaliacoes,
  lerExplicacoes,
  lerProvas,
  marcarLembrado,
  MAX_EXPLICACAO,
  MAX_PROVAS_POR_TRILHA,
  modoDoEndereco,
  ordemDasOpcoes,
  podeDispensar,
  porTemaDe,
  questoesDoDia,
  registrarRecuperacao,
  registrosDaProva,
  registrosDoModulo,
  retornoPorCompetencia,
  semanaParaMostrar,
  UM_DIA,
  apagarExplicacao,
} from "../lib/escola/avaliacao.ts";
import { CHAVES_DA_ESCOLA, diaEmBrasilia } from "../lib/escola/estudante.ts";
import { ROTAS_DA_ESCOLA } from "../lib/escola/rotas.ts";
import { entraNaCopia, intercalar, paraHoje } from "../lib/estudo.ts";
import { areaDoCaminho } from "../lib/interdicao.ts";
import { confere as confereDaPratica, conferirDigitada } from "../lib/pratica.ts";
import { confere, distancia, normalizarResposta, tolerancia } from "../lib/resposta-confere.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
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
globalThis.dispatchEvent = () => {
  avisos++;
  return true;
};

// ───────────── Retorno por competência ─────────────
conferir("3 de 3 é já sabe", competenciaDe(3, 3) === "ja-sabe");
conferir("4 de 5 (80%) é já sabe", competenciaDe(4, 5) === "ja-sabe");
conferir("3 de 4 (75%) é quase", competenciaDe(3, 4) === "quase");
conferir("2 de 4 (50%) é quase", competenciaDe(2, 4) === "quase");
conferir("1 de 3 é rever", competenciaDe(1, 3) === "rever");
conferir("0 de 5 é rever", competenciaDe(0, 5) === "rever");
conferir("2 de 2 é pouco dado (menos de 3)", competenciaDe(2, 2) === "pouco-dado");
conferir("0 de 0 é pouco dado", competenciaDe(0, 0) === "pouco-dado");
conferir("79 de 100 é quase", competenciaDe(79, 100) === "quase");
conferir("49 de 100 é rever", competenciaDe(49, 100) === "rever");

const retorno = retornoPorCompetencia([
  { tema: "t/a", aula: "t/a", acertos: 1, total: 2 },
  { tema: "t/a", aula: "t/a", acertos: 2, total: 2 },
  { tema: "t/b", aula: "t/b", acertos: 0, total: 3 },
  { tema: "t/c", aula: "t/c", acertos: 1, total: 1 },
  { tema: "frações", aula: "t/d", acertos: 2, total: 4 },
  { tema: "frações", aula: "t/e", acertos: 0, total: 0 },
  { tema: "", acertos: 1, total: 1 },
]);
conferir("retorno soma o mesmo tema (3 de 4 vira quase)", retorno.find((r) => r.tema === "t/a")?.competencia === "quase");
conferir("retorno: ordem rever, quase, pouco dado, já sabe", retorno.map((r) => r.competencia).join() === "rever,quase,quase,pouco-dado", retorno.map((r) => `${r.tema}:${r.competencia}`).join());
conferir("retorno ignora tema vazio e total zero", retorno.length === 4 && retorno.find((r) => r.tema === "frações")?.aulas.join() === "t/d");
conferir("retorno não devolve número", retorno.every((r) => Object.keys(r).sort().join() === "aulas,competencia,tema"));
conferir("quatro competências", COMPETENCIAS.length === 4);

// ───────────── Dispensa pela proficiência ─────────────
const disp = { "t/a": 5, "t/b": 2 };
conferir("dispensa: tudo já sabe", podeDispensar([{ tema: "t/a", acertos: 4, total: 5 }, { tema: "t/b", acertos: 2, total: 2 }], disp));
conferir("dispensa: aula de 2 questões pede as 2 certas", !podeDispensar([{ tema: "t/a", acertos: 5, total: 5 }, { tema: "t/b", acertos: 1, total: 2 }], disp));
conferir("dispensa: tema quase não dispensa", !podeDispensar([{ tema: "t/a", acertos: 3, total: 5 }, { tema: "t/b", acertos: 2, total: 2 }], disp));
conferir("dispensa: tema sem resposta não dispensa", !podeDispensar([{ tema: "t/a", acertos: 5, total: 5 }], disp));
conferir("dispensa: sem nada não dispensa", !podeDispensar([], {}) && !podeDispensar([], disp));
conferir("dispensa: aula de 5 respondida pela metade é pouco dado", !podeDispensar([{ tema: "t/a", acertos: 2, total: 2 }, { tema: "t/b", acertos: 2, total: 2 }], disp));

// ───────────── Revisão que mistura matérias (3 trilhas) ─────────────
const cartoes = [
  { id: "a2", trilha: "historia", proxima: "2026-05-03" },
  { id: "a1", trilha: "historia", proxima: "2026-05-01" },
  { id: "a3", trilha: "historia", proxima: "2026-05-04" },
  { id: "b1", trilha: "quimica", proxima: "2026-05-02" },
  { id: "c1", trilha: "fisica", proxima: "2026-05-02" },
  { id: "c2", trilha: "fisica", proxima: "2026-05-05" },
];
const misturada = intercalar(cartoes).map((c) => c.id);
conferir("intercalar: um de cada trilha por vez", misturada.join() === "a1,b1,c1,a2,c2,a3", misturada.join());
conferir("intercalar: mesmo conjunto", [...misturada].sort().join() === cartoes.map((c) => c.id).sort().join());
conferir("intercalar: determinístico", intercalar(cartoes).map((c) => c.id).join() === misturada.join());
conferir("intercalar: começa depois da última trilha", intercalar(cartoes, undefined, "historia").map((c) => c.id).join() === "b1,c1,a1,c2,a2,a3");
conferir("intercalar: trilha desconhecida não muda", intercalar(cartoes, undefined, "xx").map((c) => c.id).join() === misturada.join());
conferir("intercalar: lista vazia", intercalar([]).length === 0);
conferir("intercalar: sem trilha usa a origem", intercalar([{ origem: "A" }, { origem: "A" }, { origem: "B" }]).map((c) => c.origem).join() === "A,B,A");
conferir("intercalar: chave própria", intercalar([{ x: 1, t: "p" }, { x: 2, t: "p" }, { x: 3, t: "q" }], (i) => i.t).map((i) => i.x).join() === "1,3,2");
const baralho = [
  { id: "x", frente: "1", verso: "1", origem: "A", caixa: 0, proxima: "2026-05-01", criado: 0 },
  { id: "y", frente: "2", verso: "2", origem: "B", caixa: 0, proxima: "2026-05-09", criado: 0 },
  { id: "z", frente: "3", verso: "3", origem: "A", caixa: 0, proxima: "2026-05-02", criado: 0 },
];
conferir("paraHoje continua o mesmo conjunto", paraHoje(baralho, "2026-05-05").map((c) => c.id).join() === "x,z");
conferir("intercalar(paraHoje()) não acrescenta", intercalar(paraHoje(baralho, "2026-05-05")).length === 2);

// ───────────── Resposta digitada (erros de digitação perdoados) ─────────────
conferir("normaliza minúsculas, pontas e pontuação", normalizarResposta("  Olá, Mundo!! ") === "ola mundo" && normalizarResposta("Olá", false) === "olá");
conferir("distância: troca", distancia("janela", "janelq") === 1);
conferir("distância: inversão de vizinhas conta 1", distancia("carro", "caror") === 1);
conferir("distância: falta e sobra", distancia("casa", "cas") === 1 && distancia("casa", "casas") === 1);
conferir("distância: vazio", distancia("", "abc") === 3 && distancia("abc", "") === 3);
conferir("tolerância por tamanho", tolerancia("casa") === 0 && tolerancia("janela") === 1 && tolerancia("abcdefgh") === 1 && tolerancia("paralelepipedo") === 2);
conferir("tolerância: número e ideograma não têm", tolerancia("123456789") === 0 && tolerancia("中华人民共和国") === 0 && tolerancia("abc12345") === 0);
const exata = confere("Você", "você");
conferir("exata", exata.certo && !exata.quase && exata.grafia === null);
conferir("acento não conta por padrão", confere("voce", "você").certo && !confere("voce", "você").quase);
const acento = confere("cafe", "café", { acento: "quase" });
conferir("acento nos idiomas é quase, com a grafia", acento.certo && acento.quase && acento.grafia === "café");
conferir("acento certo nos idiomas é exato", confere("café", "café", { acento: "quase" }).quase === false);
const digitada = confere("janelq", "janela");
conferir("palavra de 6 letras aceita 1 erro (quase)", digitada.certo && digitada.quase && digitada.grafia === "janela");
conferir("palavra de 6 letras não aceita 2 erros", !confere("jenelq", "janela").certo);
conferir("palavra de 5 letras aceita inversão", confere("caror", "carro").quase);
conferir("palavra de 4 letras não aceita erro", !confere("caza", "casa").certo && !confere("mau", "mar").certo);
conferir("palavra de 9+ letras aceita 2 erros", confere("paralelepipdo", "paralelepípedo").quase && confere("paralelpipdo", "paralelepipedo").quase);
conferir("palavra de 9+ letras não aceita 3 erros", !confere("parlelpipdo", "paralelepipedo").certo);
conferir("número não aceita erro", !confere("1946", "1945").certo && confere("1945", "1945").certo && !confere("123456", "123465").certo);
conferir("ideograma não aceita erro", !confere("中华人民共和", "中华人民共和国").certo && confere("你好", "你好").certo);
conferir("frase: cada palavra na sua tolerância", confere("a revolucao fracesa", "A Revolução Francesa").quase && !confere("a revolucao", "A Revolução Francesa").certo);
conferir("várias respostas aceitas: a exata vence", confere("feliz", ["felis", "feliz"]).quase === false);
conferir("várias respostas: grafia da que bateu", confere("alegrya", ["contente", "alegria"]).grafia === "alegria");
conferir("vazio é errado", !confere("", "casa").certo && !confere("casa", "").certo && !confere("   ", ["  "]).certo);
conferir("sem tolerância: só exata ou sem acento", !confere("janelq", "janela", { tolerante: false }).certo && confere("voce", "você", { tolerante: false }).certo);
conferir("prática de idiomas sem a Escola: igual a antes", confereDaPratica("Voce!", "você") && !confereDaPratica("janelq", "janela") && confereDaPratica("hello", ["hi", "Hello"]));
conferir("prática de idiomas com a Escola: quase", conferirDigitada("janelq", "janela", true).quase && conferirDigitada("cafe", "café", true).quase && !conferirDigitada("janelq", "janela", false).certo);

// ───────────── Gravação da prova (limite de 20) ─────────────
const respostas = [
  { tema: "t/a", certo: true },
  { tema: "t/a", certo: false },
  { tema: "t/b", certo: true },
];
const prova = gravarProva("t", respostas, "normal", new Date("2026-05-10T15:00:00Z"));
conferir("prova gravada", prova && prova.acertos === 2 && prova.total === 3 && prova.modo === "normal" && prova.data === "2026-05-10");
conferir("prova por tema", JSON.stringify(prova?.porTema) === JSON.stringify({ "t/a": { acertos: 1, total: 2 }, "t/b": { acertos: 1, total: 1 } }));
conferir("prova na chave lucia:escola:provas", JSON.parse(localStorage.getItem(CHAVES_DA_ESCOLA.provas)).t.length === 1 && avisos > 0);
for (let i = 0; i < 25; i++) gravarProva("t", [{ tema: "t/a", certo: i % 2 === 0 }], i % 3 === 0 ? "dupla" : "proficiencia", new Date(Date.UTC(2026, 5, 1 + i, 15)));
const lidas = lerProvas().t;
conferir("no máximo 20 por trilha", lidas.length === MAX_PROVAS_POR_TRILHA);
conferir("ficam as mais novas", lidas.at(-1).data === "2026-06-25" && lidas[0].data === "2026-06-06");
conferir("modos guardados", lidas.some((p) => p.modo === "dupla") && lidas.some((p) => p.modo === "proficiencia"));
conferir("trilha vazia ou sem resposta não grava", gravarProva("", respostas, "normal") === null && gravarProva("t", [], "normal") === null);
localStorage.setItem(CHAVES_DA_ESCOLA.provas, JSON.stringify({ t: [{ data: "x" }, { data: "2026-01-01", acertos: 5, total: 3, modo: "normal", porTema: {} }, { data: "2026-01-02", acertos: 1, total: 2, modo: "outro", porTema: {} }, { data: "2026-01-03", acertos: 1, total: 2, modo: "dupla", porTema: { a: { acertos: 1, total: 2 }, b: "x" } }], u: "lixo" }));
conferir("leitura descarta o estragado", lerProvas().t.length === 1 && Object.keys(lerProvas().t[0].porTema).join() === "a" && !("u" in lerProvas()));
localStorage.setItem(CHAVES_DA_ESCOLA.provas, "{quebrado");
conferir("JSON quebrado vira vazio", Object.keys(lerProvas()).length === 0);
conferir("registros da prova (tema = aula)", registrosDaProva(porTemaDe(respostas)).map((r) => `${r.tema}:${r.aula}:${r.acertos}/${r.total}`).join() === "t/a:t/a:1/2,t/b:t/b:1/1");
conferir("modo pelo endereço", modoDoEndereco("?modo=dupla") === "dupla" && modoDoEndereco("modo=proficiencia") === "proficiencia" && modoDoEndereco("?modo=x") === "normal" && modoDoEndereco("") === "normal");

// ───────────── Módulo do curso ─────────────
const doModulo = registrosDoModulo(
  ["t/a", "t/b"],
  { "t/a": { quando: 1, acertos: 2, total: 3, vezes: 1 }, "t/z": { quando: 1, acertos: 0, total: 3, vezes: 1 } },
  {
    e1: { aula: "t/a", tema: "frações", dificuldade: 1, tentativas: 2, acertos: 1, errou: true, caixa: 0, proxima: "2026-01-01", quando: 1 },
    e2: { aula: "t/b", tema: "frações", dificuldade: 1, tentativas: 3, acertos: 0, errou: true, caixa: 0, proxima: "2026-01-01", quando: 1 },
    e3: { aula: "x/y", tema: "outro", dificuldade: 1, tentativas: 1, acertos: 1, errou: false, caixa: 0, proxima: "2026-01-01", quando: 1 },
  },
);
conferir("módulo: teste da aula e exercícios do módulo", doModulo.length === 2 && doModulo[0].tema === "t/a" && doModulo[1].tema === "frações" && doModulo[1].total === 5 && doModulo[1].acertos === 1);
conferir("módulo: rever na aula com mais erros", doModulo[1].aula === "t/b");

// ───────────── Lembra da aula anterior (dia e conclusão) ─────────────
const agora = new Date("2026-05-10T15:00:00Z");
const ctx = (extra = {}) => ({ concluidasEm: { "t/a": agora.getTime() - 2 * UM_DIA }, cursosInscritos: [], lembrados: {}, agora, ...extra });
const trilhaAnterior = { aula: "t/a", questoes: 3 };
conferir("lembra: concluída há 2 dias", aulaParaLembrar("t/b", [trilhaAnterior], ctx()) === "t/a");
conferir("lembra: concluída há 1 hora não", aulaParaLembrar("t/b", [trilhaAnterior], ctx({ concluidasEm: { "t/a": agora.getTime() - 3_600_000 } })) === null);
conferir("lembra: exatamente 1 dia ainda não", aulaParaLembrar("t/b", [trilhaAnterior], ctx({ concluidasEm: { "t/a": agora.getTime() - UM_DIA } })) === null);
conferir("lembra: conclusão antiga sem data (0) vale", aulaParaLembrar("t/b", [trilhaAnterior], ctx({ concluidasEm: { "t/a": 0 } })) === "t/a");
conferir("lembra: não concluída não", aulaParaLembrar("t/b", [trilhaAnterior], ctx({ concluidasEm: {} })) === null);
conferir("lembra: sem teste não", aulaParaLembrar("t/b", [{ aula: "t/a", questoes: 0 }], ctx()) === null);
conferir("lembra: já apareceu hoje nesta aula não", aulaParaLembrar("t/b", [trilhaAnterior], ctx({ lembrados: { "t/b": diaEmBrasilia(agora) } })) === null);
conferir("lembra: apareceu ontem volta hoje", aulaParaLembrar("t/b", [trilhaAnterior], ctx({ lembrados: { "t/b": "2026-05-09" } })) === "t/a");
const doCurso = { aula: "u/z", questoes: 2, curso: "eja" };
const ctxCurso = ctx({ concluidasEm: { "t/a": agora.getTime() - 3 * UM_DIA, "u/z": agora.getTime() - 3 * UM_DIA } });
conferir("lembra: a do curso inscrito vem antes", aulaParaLembrar("t/b", [trilhaAnterior, doCurso], { ...ctxCurso, cursosInscritos: ["eja"] }) === "u/z");
conferir("lembra: curso não inscrito fica de fora", aulaParaLembrar("t/b", [trilhaAnterior, doCurso], ctxCurso) === "t/a");
conferir("lembra: a própria aula nunca", aulaParaLembrar("t/a", [trilhaAnterior], ctx()) === null);
const dia1 = questoesDoDia(6, "t/a", "2026-05-10");
conferir("duas questões distintas", dia1.length === 2 && dia1[0] !== dia1[1] && dia1.every((i) => i >= 0 && i < 6));
conferir("mesmo dia, mesmas questões", questoesDoDia(6, "t/a", "2026-05-10").join() === dia1.join());
const outrosDias = ["2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14"].map((d) => questoesDoDia(6, "t/a", d).join());
conferir("outro dia, outras questões (em algum dos próximos)", outrosDias.some((x) => x !== dia1.join()));
conferir("aula com 1 questão dá 1; sem questão, nenhuma", questoesDoDia(1, "t/a", "2026-05-10").join() === "0" && questoesDoDia(0, "t/a", "2026-05-10").length === 0);
marcarLembrado("t/b", agora);
conferir("marcar lembrado guarda o dia", lerAvaliacoes().lembrados["t/b"] === "2026-05-10");
marcarLembrado("t/c", new Date(agora.getTime() + 10 * UM_DIA));
conferir("marcas velhas saem", !("t/b" in lerAvaliacoes().lembrados) && lerAvaliacoes().lembrados["t/c"] === "2026-05-20");
registrarRecuperacao("t/a", 5, 2, agora);
registrarRecuperacao("", 1, 2, agora);
conferir("recuperação guardada com origem", lerAvaliacoes().recuperacoes.length === 1 && lerAvaliacoes().recuperacoes[0].origem === "recuperacao" && lerAvaliacoes().recuperacoes[0].acertos === 2);
conferir("ordem das opções: permutação estável", ordemDasOpcoes(4, "pergunta").slice().sort().join() === "0,1,2,3" && ordemDasOpcoes(4, "pergunta").join() === ordemDasOpcoes(4, "pergunta").join());

// ───────────── Explique com suas palavras ─────────────
gravarExplicacao("t/a", "x".repeat(1500), 1000);
conferir("explicação cortada em 1000", explicacaoDe("t/a")?.texto.length === MAX_EXPLICACAO && explicacaoDe("t/a")?.em === 1000);
gravarExplicacao("t/b", "Entendi que...", 2000);
apagarExplicacao("t/a");
conferir("apagar a explicação", explicacaoDe("t/a") === null && Object.keys(lerExplicacoes()).join() === "t/b");
gravarExplicacao("t/b", "   ");
conferir("texto vazio apaga", explicacaoDe("t/b") === null);
conferir("as três chaves entram na cópia de segurança", [CHAVES_DA_ESCOLA.provas, CHAVES_DA_ESCOLA.avaliacoes, CHAVES_DA_ESCOLA.explicacoes].every(entraNaCopia));
const dataPanel = ler("components", "DataPanel.tsx");
conferir("o 'apagar meus dados' apaga a base dos áudios", dataPanel.includes('deleteDatabase("lucia-explicacoes")'));

// ───────────── Semana de provas ─────────────
const antes = semanaParaMostrar("2026-03-10");
conferir("semana: antes, no 1º semestre", antes.quando === "antes" && antes.semestre === "2026.1" && antes.inicio === "2026-06-17" && antes.fim === "2026-06-30");
const durante = semanaParaMostrar("2026-06-20");
conferir("semana: durante", durante.quando === "durante" && durante.semestre === "2026.1");
const ferias = semanaParaMostrar("2026-07-10");
conferir("semana: nas férias, a do próximo semestre", ferias.quando === "antes" && ferias.semestre === "2026.2" && ferias.inicio === "2026-12-02" && ferias.fim === "2026-12-15");
conferir("semana: virada do ano", semanaParaMostrar("2026-12-20").semestre === "2027.1" && semanaParaMostrar("2026-01-10").semestre === "2026.1");
conferir("semana: último dia ainda é durante", semanaParaMostrar("2026-12-15").quando === "durante");
const ics = icsDaSemanaDeProvas({ inicio: "2026-06-17", fim: "2026-06-30", semestre: "2026.1", titulo: "Semana de provas, Escola; teste", descricao: "Sem nota", url: "https://institutolucia.org/pt/escola/provas" }, new Date("2026-05-01T12:00:00Z"));
conferir("ics: evento de dia inteiro", ics.includes("DTSTART;VALUE=DATE:20260617\r\n") && ics.includes("DTEND;VALUE=DATE:20260701\r\n"));
conferir("ics: formato da agenda", ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0") && ics.includes("UID:semana-de-provas-2026.1@institutolucia.org") && ics.includes("SUMMARY:Semana de provas\\, Escola\\; teste") && ics.endsWith("END:VCALENDAR\r\n"));
conferir("ics: linhas de até 75", ics.split("\r\n").every((l) => l.length <= 75));

// ───────────── Reconhecimento de saberes ─────────────
const detalhe = detalheDoReconhecimento({ trilhas: ["Costura"], praticas: ["Medir", "Cortar"], observacao: " ok ", rotulos: { trilhas: "T", praticas: "P", observacao: "O" } });
conferir("detalhe do reconhecimento", detalhe === "T: Costura\nP: Medir; Cortar\nO: ok");
conferir("detalhe sem nada é vazio", detalheDoReconhecimento({ trilhas: [], praticas: [], rotulos: { trilhas: "T", praticas: "P", observacao: "O" } }) === "");

// ───────────── Rotas, textos e promessas no código ─────────────
for (const caminho of ["/escola/provas", "/escola/saberes"]) {
  const rota = ROTAS_DA_ESCOLA.find((r) => r.caminho === caminho);
  conferir(`${caminho} não é mais provisória`, rota && rota.pacote === "E4-13" && !rota.provisoria);
  conferir(`${caminho} na interdição (área estudo)`, areaDoCaminho(caminho) === "estudo");
  conferir(`${caminho} tem página própria`, !ler("app", "[lang]", ...caminho.split("/").filter(Boolean), "page.tsx").includes("EmConstrucao"));
}
conferir("módulo do curso na interdição", areaDoCaminho("/escola/cursos/eja/modulo/1") === "estudo");
conferir("página do módulo existe", fs.existsSync(path.join(raiz, "app", "[lang]", "escola", "cursos", "[curso]", "modulo", "[n]", "page.tsx")));

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
for (const lang of IDIOMAS) {
  const t = JSON.parse(ler("i18n", "escola", "avaliacao", `${lang}.json`));
  const r = JSON.stringify(t.retorno);
  conferir(`${lang}: o retorno não tem número nem porcentagem`, !/\{[an]\}|%|\d/.test(r));
  conferir(`${lang}: honesto sobre a certificação`, t.saberes.naoEhCertificacao.length > 20 && t.saberes.encceja.includes("ENCCEJA"));
  const nucleo = JSON.parse(ler("i18n", `${lang}.json`));
  conferir(`${lang}: "quase" e "o que explicou" no núcleo`, nucleo.blocks.almost.includes("{w}") && nucleo.lesson.yourExplanation.length > 5);
}

const fonte = (...p) => ler(...p);
const meus = [
  ["components", "escola", "avaliacao", "RetornoPorCompetencia.tsx"],
  ["components", "escola", "avaliacao", "SemanaDeProvas.tsx"],
  ["components", "escola", "avaliacao", "ProvaEmDupla.tsx"],
  ["components", "escola", "avaliacao", "Proficiencia.tsx"],
  ["components", "escola", "avaliacao", "ReconhecimentoDeSaberes.tsx"],
  ["components", "escola", "avaliacao", "QuestoesDaProva.tsx"],
  ["components", "escola", "avaliacao", "usar-prova.ts"],
  ["components", "aula", "LembraDaAnterior.tsx"],
  ["components", "aula", "ExpliqueComSuasPalavras.tsx"],
  ["lib", "escola", "avaliacao.ts"],
  ["lib", "resposta-confere.ts"],
];
for (const p of meus) {
  const codigo = fonte(...p);
  conferir(`${p.at(-1)} não manda nada para servidor`, !/\bfetch\(|\brpc\(|@\/lib\/backend|sendBeacon|XMLHttpRequest/.test(codigo));
}
const retornoTsx = fonte("components", "escola", "avaliacao", "RetornoPorCompetencia.tsx");
conferir("o retorno não mostra acertos, total nem porcentagem", !/\.acertos|\.total|%|toFixed|Math\.round/.test(retornoTsx));
const proficiencia = fonte("components", "escola", "avaliacao", "Proficiencia.tsx");
conferir("a proficiência só marca a dispensa (não esconde aula)", proficiencia.includes("marcarDispensa(") && !/hidden|esconder|remove/i.test(proficiencia.replace(/Nenhuma aula some|nenhuma aula some/g, "")));
const aula = fonte("app", "[lang]", "trilhas", "[track]", "[lesson]", "page.tsx");
const pos = (x) => aula.indexOf(x);
conferir("aula: o 'lembra?' vem antes do texto", pos("<LembraDaAnterior") > 0 && pos("<LembraDaAnterior") < pos("{textoCompleto}") );
conferir("aula: o 'explique' vem antes do CompleteButton", pos("<ExpliqueComSuasPalavras") > 0 && pos("<ExpliqueComSuasPalavras") < pos("<CompleteButton"));
conferir("aula: os dois só com a Escola ligada", /avaliacao = sa \?/.test(aula) && aula.includes("{avaliacao && <ExpliqueComSuasPalavras"));
const exame = fonte("components", "Exam.tsx");
conferir("prova: sem a Escola, fica como sempre", exame.includes("<ProvaDeSempre") && exame.includes("<Quiz key={round.n}"));
conferir("estudo: a revisão do caderno e o Praticar usam a fila intercalada", fonte("components", "caderno", "Estudo.tsx").includes("intercalar(paraHoje(cartoes)") && fonte("components", "estudo", "Praticar.tsx").includes("intercalar(atrasados"));
const criancas = fonte("components", "criancas", "Letras.tsx");
conferir("Cantinho da Lua (Letras) não guarda nem envia nada", !/localStorage|fetch\(|rpc\(/.test(criancas));

console.log(`avaliação da escola: ${ok} conferências certas, ${falhas.length} falhas`);
if (falhas.length) {
  console.error(falhas.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}

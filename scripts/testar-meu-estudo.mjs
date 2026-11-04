// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o que os recursos novos guardam no aparelho (lib/meu-estudo.ts), a leitura das flags (lib/recursos.ts) e
// que a cópia de segurança de lib/estudo.ts leva e junta as chaves novas sem perder nada. Sem rede, sem navegador.
import { chavesDeEstudo, entraNaCopia, lerCopia, montarCopia, restaurarCopia } from "../lib/estudo.ts";
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
  gravarMetas,
  lerMetas,
  registrarTeste,
  responderExercicio,
  sugerirInicio,
} from "../lib/meu-estudo.ts";
import fs from "node:fs";
import { CORE_SCHEMA, load } from "js-yaml";
import { validarMapa } from "../lib/mapa-curricular.ts";
import { icsSemanal } from "../lib/agenda.ts";
import { conferirModelo, conferirPartesNovas, exigeAsPartesNovas, lerRevisoes, partesDoOutroLado, tarefaDoAgir } from "../lib/modelo-de-aula.ts";
import { aulaDoEndereco, chaveDoAgir, guardarAgir, lerAgir } from "../lib/agir.ts";
import { lerAvisos, marcarAviso, novidades } from "../lib/avise.ts";
import { LIMITE_DO_ARQUIVO, montarArquivoUnico, nomeDoArquivo, tamanhoEmBytes } from "../lib/arquivo-unico.ts";
import { codificarSequencia, codigoDaSequencia, gerarComprovante, lerComprovante, lerComprovantes, lerSequencia } from "../lib/turma.ts";
import { ligado, lerRecursos, PADRAO, RECURSOS, SO_PELO_NOME } from "../lib/recursos.ts";

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
// Sem variável, só os de PADRAO (os já testados que a produção já liga); a Escola nunca.
conferir("sem variável, só os padrões", Object.keys(RECURSOS).every((r) => ligado(r, lerRecursos(undefined)) === PADRAO.includes(r)));
conferir("escola não é padrão", !PADRAO.includes("escola") && !ligado("escola", lerRecursos(undefined)));
conferir("lista com espaços e maiúsculas", ligado("escola", lerRecursos(" Escola , exercicios")) && ligado("enem-curso", lerRecursos("meu-estudo,enem-curso")) && !ligado("enem-video", lerRecursos("enem-curso")));
conferir("todos liga tudo menos o que é só pelo nome", Object.keys(RECURSOS).every((r) => ligado(r, lerRecursos("todos")) === !SO_PELO_NOME.includes(r)));
conferir("todos com os só pelo nome liga tudo", Object.keys(RECURSOS).every((r) => ligado(r, lerRecursos(`todos,${SO_PELO_NOME.join(",")}`))));
conferir("-nome desliga um padrão", !ligado("vlibras", lerRecursos("-vlibras")) && ligado("meu-estudo", lerRecursos("-vlibras")) && !ligado("vlibras", lerRecursos("todos,-vlibras")));
conferir("nenhum desliga os padrões", PADRAO.every((r) => !ligado(r, lerRecursos("nenhum"))) && ligado("turma", lerRecursos("nenhum,turma")));

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

// Modelo de aula e revisões
const linhas = (...l) => l.join("\n");
const corpo = linhas("## O que você vai aprender", "", "Somar frações.", "", "## Partes", "", "palavra ".repeat(260), "", "## Exemplo resolvido", "", "1 + 1", "", "## Resumo", "", "- isso");
conferir("aula no modelo", conferirModelo({ corpo, quiz: 3, fontes: 1 }).every((p) => p.ok));
const faltando = conferirModelo({ corpo: linhas("## Partes", "", "curto"), quiz: 0, fontes: 1 }).filter((p) => !p.ok).map((p) => p.parte);
conferir("aponta o que falta", JSON.stringify(faltando) === JSON.stringify(["objetivo", "explicacao", "exemplo", "exercicio", "resumo"]));
const blocos = linhas("```conta", "1+1", "```", "```verificar", "p", "+ a", "```");
conferir("bloco conta vale como exemplo e verificar como exercício", conferirModelo({ corpo: blocos, quiz: 0, fontes: 1 }).filter((p) => p.ok).map((p) => p.parte).join() === "exemplo,exercicio,fontes");
// As 3 partes novas do modelo de 9 partes: opcionais nas aulas antigas (conferirModelo não muda), conferidas à parte
conferir("conferirModelo segue com as 6 partes", conferirModelo({ corpo, quiz: 3, fontes: 1 }).length === 6);
conferir("aula antiga: as 3 partes novas faltam, sem quebrar nada", conferirPartesNovas(corpo).map((p) => p.motivo).join() === "falta,falta,falta");
const completa = linhas("## O que você vai aprender", "", "Algo.", "", "```suarealidade", "E no seu trabalho?", "```", "", "## Partes", "", "texto", "", "```outrolado", "# O mais forte", "Argumento.", "---", "Como responderia?", "---", "Uma resposta.", "```", "", "```agir", "Anote uma coisa.", "```", "", "## Resumo", "", "- ok");
conferir("aula de 9 partes: as 3 novas ok", conferirPartesNovas(completa).every((p) => p.ok));
const depois = linhas("## O que você vai aprender", "", "x", "", "## Partes", "", "texto", "", "```suarealidade", "E no seu trabalho?", "```", "", "```outrolado", "Argumento.", "```", "", "```agir", "Faça.", "```");
conferir("Na sua realidade depois da explicação é apontada", conferirPartesNovas(depois)[0].motivo === "ordem");
conferir("O outro lado sem treino é apontado", conferirPartesNovas(depois)[1].motivo === "treino");
conferir("Na sua realidade pode ficar dentro da seção do objetivo", conferirPartesNovas(linhas("## O que você vai aprender", "", "```suarealidade", "P?", "```", "", "## Partes"))[0].ok);
conferir("título ## Agir também vale", conferirPartesNovas("## Agir\n\nFaça isto.")[2].ok && tarefaDoAgir("## Agir\n\nFaça isto.\n\n## Resumo") === "Faça isto.");
conferir("bloco dentro de código não conta como título", conferirPartesNovas("```\n## Agir\n```")[2].motivo === "falta");
conferir("o treino do outro lado separa em três", JSON.stringify(partesDoOutroLado("A\n---\nB\n---\nC")) === JSON.stringify({ argumento: "A", treino: "B", resposta: "C" }));
conferir("tarefa do bloco agir", tarefaDoAgir(completa) === "Anote uma coisa." && tarefaDoAgir(corpo) === null);
conferir("trilhas que exigem as 3 partes", exigeAsPartesNovas({ stage: "fundamental" }) && exigeAsPartesNovas({ area: "alfabetizacao" }) && exigeAsPartesNovas({ area: "formacao-militante", stage: "medio" }) && !exigeAsPartesNovas({ stage: "medio", area: "matematica" }));
// "Como foi?": só no aparelho, com o prefixo lucia:
const aparelho = new Memoria({});
conferir("sem registro, nada guardado", lerAgir("a/1", aparelho) === null);
guardarAgir("a/1", { estado: "vou" }, aparelho, 10);
guardarAgir("a/1", { estado: "em-parte", nota: " deu certo " }, aparelho, 20);
const reg = lerAgir("a/1", aparelho);
conferir("guarda o estado e a nota com a data", reg?.estado === "em-parte" && reg.nota === "deu certo" && reg.em === 20 && chaveDoAgir("a/1") === "lucia:agir:a/1" && aparelho.getItem("lucia:agir:a/1") !== null);
aparelho.setItem("lucia:agir:b/2", "{lixo");
conferir("registro estragado vira nada", lerAgir("b/2", aparelho) === null);
conferir("o registro entra na cópia e no apagar", entraNaCopia("lucia:agir:a/1") && chavesDeEstudo(aparelho).includes("lucia:agir:a/1"));
conferir("armazenamento bloqueado não quebra", guardarAgir("a/1", { estado: "fiz" }, { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } }) === false);
conferir("a aula vem do endereço", aulaDoEndereco("/en/trilhas/mat/fracoes") === "mat/fracoes" && aulaDoEndereco("/trilhas/mat/fracoes/") === "mat/fracoes" && aulaDoEndereco("/sobre") === null);
// "Me avise quando sair" (catálogo honesto): só no aparelho, uma chave só
const avisos = new Memoria({});
conferir("sem avisos, objeto vazio", JSON.stringify(lerAvisos(avisos)) === "{}");
marcarAviso("ofícios-x", 2, avisos);
marcarAviso("oficios-cozinha", 0, avisos);
marcarAviso("mei", 3, avisos);
conferir("slug estranho é ignorado na leitura", !("ofícios-x" in lerAvisos(avisos)) && lerAvisos(avisos).mei === 3);
conferir("aula nova aparece como novidade", JSON.stringify(novidades(lerAvisos(avisos), { "oficios-cozinha": 2, mei: 3 })) === JSON.stringify([{ trilha: "oficios-cozinha", novas: 2 }]));
marcarAviso("mei", null, avisos);
conferir("desligar tira a trilha", !("mei" in lerAvisos(avisos)) && entraNaCopia("lucia:avise") && entraNaCopia("lucia:bloco:/trilhas/a/b:outrolado:abc"));
avisos.setItem("lucia:avise", "[1,2]");
conferir("aviso estragado vira vazio", JSON.stringify(lerAvisos(avisos)) === "{}");
// "Baixar para o WhatsApp": arquivo único, sem script nem evento, pequeno
const arquivo = montarArquivoUnico({ titulo: "Frações <1>", conteudo: '<h1 onclick="x()">Oi</h1><script>alert(1)</script><a href="javascript:alert(1)">a</a><iframe src="https://x"></iframe><p>texto</p>', url: "https://site/pt/trilhas/mat/fracoes", lang: "pt", fonte: "Baixado de", rodape: "Funciona sem internet." });
conferir("arquivo único sem script, evento nem iframe", !/<script|onclick|javascript:|<iframe/i.test(arquivo) && arquivo.includes("<p>texto</p>") && arquivo.includes("Frações &lt;1&gt;"));
conferir("arquivo único pequeno", tamanhoEmBytes(arquivo) < LIMITE_DO_ARQUIVO && tamanhoEmBytes("ção") === 5);
conferir("nome do arquivo pela aula", nomeDoArquivo("/en/trilhas/mat/fracoes") === "mat-fracoes.html" && nomeDoArquivo("/") === "aula.html");
conferir("sem revisões é em revisão", lerRevisoes(undefined, "x").length === 0);
const rev = lerRevisoes([{ funcao: "revisão", data: "2026-10-01" }, { funcao: "educador de matemática", nome: "Ana", data: new Date("2026-10-20"), nota: "ok" }], "x");
conferir("revisões em ordem, a mais nova primeiro", rev[0].data === "2026-10-20" && rev[0].nome === "Ana" && rev[1].funcao === "revisão");
let recusou = 0;
for (const errado of [[{ data: "2026-10-01" }], [{ funcao: "x", data: "ontem" }], "revisada"]) {
  try {
    lerRevisoes(errado, "x");
  } catch {
    recusou++;
  }
}
conferir("recusa revisão sem função, sem data ou fora de lista", recusou === 3);

// Modo turma: a sequência vai e volta pelo link; o comprovante confere erro de cópia
const seq = { v: 1, titulo: "6º B: frações, semana 1 — ção", aulas: ["matematica-fundamental/fracoes", "matematica-fundamental/numeros-decimais", "matematica-fundamental/fracoes", "../x"], recado: "Até sexta!" };
const fragmento = codificarSequencia(seq);
const lida = lerSequencia(`#${fragmento}`);
conferir("sequência vai e volta pelo link", lida && lida.titulo === seq.titulo && lida.recado === "Até sexta!");
conferir("tira repetidas e endereços estranhos", lida.aulas.length === 2 && !lida.aulas.includes("../x"));
conferir("link sem dados não abre", lerSequencia("") === null && lerSequencia("t=@@@") === null && lerSequencia(`t=${fragmento.slice(2, 20)}`) === null);
conferir("o código da sequência é estável", codigoDaSequencia(lida) === codigoDaSequencia(lerSequencia(fragmento)) && /^T-[0-9A-Z]{6}$/.test(codigoDaSequencia(lida)));
const recibo = gerarComprovante(lida, new Set(["matematica-fundamental/numeros-decimais"]), "Maria da Silva", "2026-10-19");
const lido = lerComprovante(recibo);
conferir("comprovante lido de volta", lido && lido.n === "Maria da Silva" && JSON.stringify(lido.c) === "[1]" && lido.t === 2 && lido.s === codigoDaSequencia(lida));
const meio = Math.floor(recibo.length / 2);
const trocado = recibo.slice(0, meio) + (recibo[meio] === "A" ? "B" : "A") + recibo.slice(meio + 1);
conferir("comprovante alterado na cópia é recusado", lerComprovante(trocado) === null && lerComprovante(recibo.slice(0, -3)) === null);
const varios = lerComprovantes(`oi professora\n${recibo}\n${gerarComprovante(lida, new Set(), "", "2026-10-20")} e ${trocado}`);
conferir("vários comprovantes colados juntos", varios.lidos.length === 2 && varios.invalidos === 1);

// Mapa curricular: só a forma dos códigos oficiais, e o arquivo de verdade
const mapaOk = validarMapa({ fontes: ["BNCC"], aulas: { fracoes: { bncc: [{ codigo: "EF06MA07", resumo: "r", situacao: "a-confirmar" }], enem: [{ competencia: 1, habilidade: 3, resumo: "r", situacao: "confirmado" }] } } }, "teste");
conferir("mapa válido", mapaOk.aulas.fracoes.bncc[0].codigo === "EF06MA07" && mapaOk.aulas.fracoes.enem[0].area === "matematica");
let recusouMapa = 0;
for (const errado of [
  { codigo: "EF6MA07", competencia: 1, habilidade: 3 },
  { codigo: "EF96MA07", competencia: 1, habilidade: 3 },
  { codigo: "EF06MA07", competencia: 8, habilidade: 3 },
  { codigo: "EF06MA07", competencia: 1, habilidade: 12 },
  { codigo: "EF06MA07", competencia: 1, habilidade: 3, situacao: "talvez" },
]) {
  try {
    validarMapa({ fontes: ["BNCC"], aulas: { a: { bncc: [{ codigo: errado.codigo, resumo: "r", situacao: errado.situacao ?? "a-confirmar" }], enem: [{ competencia: errado.competencia, habilidade: errado.habilidade, resumo: "r", situacao: "a-confirmar" }] } } }, "teste");
  } catch {
    recusouMapa++;
  }
}
conferir("recusa código fora da forma, competência e habilidade que não existem, situação errada", recusouMapa === 5);
for (const nome of fs.existsSync("content/curriculo") ? fs.readdirSync("content/curriculo").filter((n) => n.endsWith(".yml")) : []) {
  const trilha = nome.slice(0, -4);
  try {
    const mapa = validarMapa(load(fs.readFileSync(`content/curriculo/${nome}`, "utf8"), { schema: CORE_SCHEMA }), nome);
    const aulas = fs.readdirSync(`content/trilhas/${trilha}`);
    for (const aula of Object.keys(mapa.aulas)) conferir(`${nome}: a aula ${aula} existe`, aulas.some((a) => a === `${aula}.md` || new RegExp(`^\\d+-${aula}\\.md$`).test(a)));
  } catch (erro) {
    falhas.push(erro.message);
  }
}

// Nivelamento: a primeira aula do roteiro em que a pessoa escorregou (ou disse "não sei")
const roteiro = ["t/a", "t/b", "t/c", "t/d", "t/e"];
const cobertas = ["t/a", "t/c", "t/d"];
conferir("começa pela primeira que escorregou", sugerirInicio(roteiro, { "t/a": true, "t/c": false, "t/d": false }, cobertas) === "t/c");
conferir("não respondida conta como não sei", sugerirInicio(roteiro, { "t/a": true }, cobertas) === "t/c");
conferir("acertou tudo: a seguinte à última coberta", sugerirInicio(roteiro, { "t/a": true, "t/c": true, "t/d": true }, cobertas) === "t/e");
conferir("cobre até o fim: nenhuma sugestão", sugerirInicio(["t/a"], { "t/a": true }, ["t/a"]) === null);

// Meta da semana e o lembrete .ics
gravarMetas({ porSemana: 3, dias: [1, 3, 9], hora: "07:30" });
conferir("meta guardada e saneada", lerMetas().porSemana === 3 && JSON.stringify(lerMetas().dias) === "[1,3]" && lerMetas().hora === "07:30");
localStorage.setItem("lucia:metas", "{quebrado");
conferir("meta ilegível vira sem meta", lerMetas().porSemana === 0);
const ics = icsSemanal({ dias: [3, 1], hora: "19:00", titulo: "Hora de estudar; e revisar, ok", descricao: "Linha 1\nLinha 2", url: "https://institutolucia.org/pt/meu-estudo", inicio: new Date("2026-10-21T08:00:00"), id: "semanal" }, new Date("2026-10-19T12:00:00Z"));
conferir("ics começa no primeiro dia escolhido", ics.includes("DTSTART:20261021T190000") && ics.includes("RRULE:FREQ=WEEKLY;BYDAY=MO,WE"));
conferir("ics escapa vírgula, ponto e vírgula e quebra de linha", ics.includes("Hora de estudar\\; e revisar\\, ok") && ics.includes("Linha 1\\nLinha 2"));
conferir("ics com aviso e linhas CRLF", ics.includes("BEGIN:VALARM") && ics.split("\r\n").length > 10 && ics.split("\r\n").every((l) => l.length <= 75));
let semDia = false;
try {
  icsSemanal({ dias: [], hora: "19:00", titulo: "x", descricao: "", url: "https://x", inicio: new Date(), id: "x" });
} catch {
  semDia = true;
}
conferir("sem dia escolhido, sem arquivo", semDia);

console.log(`meu estudo: ${ok} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);

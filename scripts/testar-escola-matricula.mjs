// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a matrícula, a carteirinha e o plano da semana da Escola Lúcia Maria (E4-08, docs/escola/matricula.md):
// sugerirCursos (cada objetivo, ?curso=, tempo curto, sem cursos, aprender-a-estudar), montarPlano (orçamento, dias,
// dispensas, aula que não existe, meta), reajustar (o que não foi feito anda, duas semanas paradas), a semana ISO na
// virada do ano, os textos nos 6 idiomas e o aviso da carteirinha. Os cursos daqui são de TESTE (ficam neste arquivo,
// não em content/), para o pacote funcionar antes do E4-07. Sem rede, sem navegador.
import fs from "node:fs";
import path from "node:path";
import { OBJETIVOS, novaMatricula } from "../lib/escola/estudante.ts";
import {
  CURSO_PARA_ESTUDAR,
  HORAS_DE_CURSO_LONGO,
  MAX_SUGESTOES,
  cursoAtual,
  dadosDaCarteirinha,
  editarMatricula,
  iniciais,
  limparApelido,
  sugerirCursos,
  trilhasDoNivelamento,
} from "../lib/escola/matricula.ts";
import {
  DIAS_PADRAO,
  ORCAMENTO,
  aulasPendentes,
  diaDaSemana,
  montarPlano,
  ordenarDias,
  planoDeHoje,
  reajustar,
  semanaISO,
  ultimaAulaFeita,
  validarPlano,
} from "../lib/escola/plano.ts";

let certos = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const igual = (nome, valor, esperado) => conferir(nome, JSON.stringify(valor) === JSON.stringify(esperado), `veio ${JSON.stringify(valor)}, esperado ${JSON.stringify(esperado)}`);

// ───────────── Cursos de teste ─────────────

const aulas = (trilha, n) => Array.from({ length: n }, (_, i) => `${trilha}/aula-${i + 1}`);
const curso = (slug, { ciclo = "basico", objetivos = [], requisitos = [], horas = 20, modulos } = {}) => ({
  slug,
  titulo: `Curso ${slug}`,
  resumo: "",
  ciclo,
  objetivos,
  requisitos,
  horas,
  modulos: modulos ?? [{ titulo: "Módulo 1", aulas: aulas(slug, 6) }],
});
const CURSOS = [
  curso("ler-e-escrever", { objetivos: ["terminar-a-escola", "ajudar-em-casa"] }),
  curso("matematica-do-dia", { objetivos: ["terminar-a-escola", "trabalho-e-renda", "enem"], modulos: [{ titulo: "M1", aulas: aulas("matematica", 6) }] }),
  curso("historia-do-trabalho", { ciclo: "profissional", objetivos: ["trabalho-e-renda", "entender-o-mundo"], requisitos: ["ler-e-escrever"] }),
  curso("redacao-enem", { ciclo: "profissional", objetivos: ["enem"], requisitos: ["ler-e-escrever"], horas: 120 }),
  curso("mundo-hoje", { objetivos: ["entender-o-mundo"], horas: 90 }),
  curso("economia-politica", { ciclo: "avancado", objetivos: ["entender-o-mundo"], requisitos: ["mundo-hoje"] }),
  curso("cuidar-da-casa", { objetivos: ["ajudar-em-casa"] }),
  curso(CURSO_PARA_ESTUDAR, { objetivos: OBJETIVOS.filter((o) => o !== "outro") }),
];
const m = (objetivo, tempo = "3-6h") => ({ objetivo, tempo });

// ───────────── sugerirCursos ─────────────

for (const objetivo of OBJETIVOS) {
  const { cursos, antes } = sugerirCursos(m(objetivo), CURSOS);
  conferir(`${objetivo}: de 1 a ${MAX_SUGESTOES} cursos`, cursos.length >= 1 && cursos.length <= MAX_SUGESTOES, String(cursos.length));
  conferir(`${objetivo}: sem repetir`, new Set(cursos.map((c) => c.slug)).size === cursos.length);
  conferir(`${objetivo}: aprender-a-estudar fica à parte`, !cursos.some((c) => c.slug === CURSO_PARA_ESTUDAR) && antes?.slug === CURSO_PARA_ESTUDAR);
  if (objetivo !== "outro") {
    conferir(`${objetivo}: todos combinam com o objetivo`, cursos.every((c) => CURSOS.find((x) => x.slug === c.slug).objetivos.includes(objetivo) && c.motivo === "objetivo"));
  }
}
igual("terminar a escola: ciclo básico sem requisito primeiro", sugerirCursos(m("terminar-a-escola"), CURSOS).cursos.map((c) => c.slug), ["ler-e-escrever", "matematica-do-dia"]);
igual("trabalho e renda: o básico vem antes do profissional", sugerirCursos(m("trabalho-e-renda"), CURSOS).cursos.map((c) => c.slug), ["matematica-do-dia", "historia-do-trabalho"]);
igual("entender o mundo: básico, profissional, avançado", sugerirCursos(m("entender-o-mundo"), CURSOS).cursos.map((c) => c.slug), ["mundo-hoje", "historia-do-trabalho", "economia-politica"]);
const outro = sugerirCursos(m("outro"), CURSOS).cursos;
conferir("outro (nenhum curso marca): sugere os de começo livre", outro.length > 0 && outro.every((c) => c.motivo === "comeco" && CURSOS.find((x) => x.slug === c.slug).ciclo === "basico"));

// ?curso= vindo do catálogo
const pedido = sugerirCursos(m("terminar-a-escola"), CURSOS, [], "economia-politica").cursos;
igual("?curso=: o pedido vem primeiro", pedido[0], { slug: "economia-politica", motivo: "pedido", comeceDoModulo1: false, nivelado: false });
conferir("?curso=: continua com até 3", pedido.length === 3 && pedido.filter((c) => c.slug === "economia-politica").length === 1);
igual("?curso= que não existe é ignorado", sugerirCursos(m("enem"), CURSOS, [], "nao-existe").cursos.map((c) => c.slug), sugerirCursos(m("enem"), CURSOS).cursos.map((c) => c.slug));
const estudarPedido = sugerirCursos(m("enem"), CURSOS, [], CURSO_PARA_ESTUDAR);
conferir("?curso=aprender-a-estudar entra na lista e não repete em 'antes'", estudarPedido.cursos[0].slug === CURSO_PARA_ESTUDAR && estudarPedido.antes === null);

// tempo curto
const curto = sugerirCursos(m("enem", "ate-1h"), CURSOS).cursos;
conferir("até 1 h e curso de mais de 80 h: comece pelo módulo 1", curto.find((c) => c.slug === "redacao-enem")?.comeceDoModulo1 === true);
conferir("até 1 h e curso curto: sem aviso", curto.find((c) => c.slug === "matematica-do-dia")?.comeceDoModulo1 === false);
conferir("com mais tempo, curso longo sem aviso", sugerirCursos(m("enem", "3-6h"), CURSOS).cursos.every((c) => !c.comeceDoModulo1));
conferir("80 h exatas não é longo", !sugerirCursos(m("outro", "ate-1h"), [curso("oitenta", { horas: HORAS_DE_CURSO_LONGO })]).cursos[0].comeceDoModulo1);

// sem cursos, só aprender-a-estudar, nivelamento
igual("sem cursos: nada a sugerir", sugerirCursos(m("enem"), []), { cursos: [], antes: null });
const soEstudar = sugerirCursos(m("enem"), [curso(CURSO_PARA_ESTUDAR)]);
conferir("só aprender-a-estudar: lista vazia e ele em 'antes'", soEstudar.cursos.length === 0 && soEstudar.antes?.slug === CURSO_PARA_ESTUDAR);
conferir("sem aprender-a-estudar: 'antes' é null", sugerirCursos(m("enem"), CURSOS.filter((c) => c.slug !== CURSO_PARA_ESTUDAR)).antes === null);
const nivelado = sugerirCursos(m("ajudar-em-casa"), CURSOS, ["cuidar-da-casa"]).cursos;
igual("nivelamento põe na frente o curso com a trilha sugerida", nivelado.map((c) => [c.slug, c.nivelado]), [["cuidar-da-casa", true], ["ler-e-escrever", false]]);
igual("trilhasDoNivelamento: só as com sugestão, mais recentes primeiro", trilhasDoNivelamento({ a: { sugestao: "a/x", quando: 1 }, b: { sugestao: null, quando: 5 }, c: { sugestao: "c/y", quando: 9 }, "X Y": { sugestao: "z", quando: 2 } }), ["c", "a"]);
igual("trilhasDoNivelamento: nada guardado", trilhasDoNivelamento(null), []);

// matrícula, edição e carteirinha
const bytes = new Uint8Array([1, 2, 3, 4, 5]);
const mat = novaMatricula({ objetivo: "enem", tempo: "1-3h", acesso: "pacote-acaba", apelido: "  Zé da Vila  " }, new Date("2026-03-10T15:00:00Z"), bytes);
const editada = editarMatricula(mat, { objetivo: "trabalho-e-renda", apelido: "" });
conferir("editar mantém número e data", editada.numero === mat.numero && editada.criadaEm === mat.criadaEm);
conferir("editar troca a resposta e tira o apelido vazio", editada.objetivo === "trabalho-e-renda" && editada.apelido === undefined && editada.tempo === "1-3h");
igual("apelido limpo", limparApelido("Ana\nMaria   da  Silva".padEnd(60, "x")).length, 40);
igual("iniciais", [iniciais("Zé da Vila"), iniciais("ana"), iniciais(undefined)], ["ZV", "A", ""]);
const insc = [
  { curso: "ler-e-escrever", entrouEm: "2026-02-01", semestre: "2026.1", dispensas: [] },
  { curso: "mundo-hoje", entrouEm: "2026-03-01", semestre: "2026.1", dispensas: [], trancadoEm: "2026-03-05" },
  { curso: "matematica-do-dia", entrouEm: "2026-02-15", semestre: "2026.1", dispensas: [] },
];
igual("curso atual: o em andamento mais recente", cursoAtual(insc)?.curso, "matematica-do-dia");
igual("sem curso em andamento", cursoAtual([insc[1]]), null);
const cart = dadosDaCarteirinha(mat, insc, (s) => CURSOS.find((c) => c.slug === s)?.titulo ?? null, "2026-09-01");
igual("carteirinha: dados do aparelho", cart, { apelido: "Zé da Vila", numero: mat.numero, curso: "Curso matematica-do-dia", semestre: "2026.2", desde: "2026", iniciais: "ZV" });
igual("carteirinha sem apelido nem curso", dadosDaCarteirinha({ ...mat, apelido: undefined }, [], () => null, "2027-03-01").apelido, null);

// ───────────── Semana ISO ─────────────

igual("semana ISO: 2026-11-03", semanaISO("2026-11-03"), "2026-W45");
igual("virada: 2020-12-31 (quinta) é 2020-W53", semanaISO("2020-12-31"), "2020-W53");
igual("virada: 2021-01-03 (domingo) ainda é 2020-W53", semanaISO("2021-01-03"), "2020-W53");
igual("virada: 2021-01-04 é 2021-W01", semanaISO("2021-01-04"), "2021-W01");
igual("virada: 2024-12-30 (segunda) já é 2025-W01", semanaISO("2024-12-30"), "2025-W01");
igual("virada: 2026-12-31 é 2026-W53", semanaISO("2026-12-31"), "2026-W53");
igual("virada: 2027-01-01 (sexta) é 2026-W53", semanaISO("2027-01-01"), "2026-W53");
igual("dia da semana", diaDaSemana("2026-11-02"), 1);
igual("dias: padrão seg, qua, sex", ordenarDias([]), DIAS_PADRAO);
igual("dias: domingo vai para o fim, sem repetir", ordenarDias([0, 6, 2, 2, 9]), [2, 6, 0]);

// ───────────── montarPlano ─────────────

const CURSOS_DO_PLANO = [
  { slug: "a", modulos: [{ titulo: "1", aulas: ["ta/a1", "ta/a2", "ta/a3", "ta/a4", "ta/a5", "ta/a6"] }] },
  { slug: "b", modulos: [{ titulo: "1", aulas: ["tb/b1", "tb/b2", "tx/b3", "tb/b4"] }] },
];
const MIN = { "ta/a1": 20, "ta/a2": 20, "ta/a3": 20, "ta/a4": 20, "ta/a5": 20, "ta/a6": 20, "tb/b1": 25, "tb/b2": 25, "tx/b3": 25, "tb/b4": 25 };
const minutosDaAula = (a) => MIN[a] ?? 0;
const inscA = { curso: "a", entrouEm: "2026-10-01", semestre: "2026.2", dispensas: [] };
const inscB = { curso: "b", entrouEm: "2026-10-02", semestre: "2026.2", dispensas: [] };
const SEGUNDA = "2026-11-02";
const base = { tempo: "ate-1h", inscricoes: [inscA], concluidas: [], cursos: CURSOS_DO_PLANO, minutosDaAula, hoje: SEGUNDA };

const p1 = montarPlano(base);
const total = (p) => p.dias.reduce((s, d) => s + d.minutos, 0);
igual("padrão: segunda, quarta e sexta da semana", p1.dias.map((d) => d.data), ["2026-11-02", "2026-11-04", "2026-11-06"]);
igual("semana do plano", p1.semana, "2026-W45");
conferir("até 1 h: não passa de 60 minutos", total(p1) <= ORCAMENTO["ate-1h"], String(total(p1)));
igual("até 1 h: uma aula de 20 min por dia, na ordem do curso", p1.dias.map((d) => d.aulas), [["ta/a1"], ["ta/a2"], ["ta/a3"]]);
const p2 = montarPlano({ ...base, tempo: "1-3h" });
conferir("1 a 3 h: até 150 minutos", total(p2) <= 150 && total(p2) >= 120, String(total(p2)));
igual("1 a 3 h: tudo o que cabe, na ordem", p2.dias.flatMap((d) => d.aulas), ["ta/a1", "ta/a2", "ta/a3", "ta/a4", "ta/a5", "ta/a6"]);
igual("orçamentos", ORCAMENTO, { "ate-1h": 60, "1-3h": 150, "3-6h": 270, "mais-6h": 420 });
const pTerca = montarPlano({ ...base, dias: [2, 4] });
igual("dias trocados: terça e quinta", pTerca.dias.map((d) => diaDaSemana(d.data)), [2, 4]);
igual("dias trocados: 30 min por dia", pTerca.dias.map((d) => d.minutos), [20, 20]);
const pQuarta = montarPlano({ ...base, hoje: "2026-11-04" });
igual("montado na quarta: a segunda já passou e fica de fora", pQuarta.dias.map((d) => d.data), ["2026-11-04", "2026-11-06"]);
const pSabado = montarPlano({ ...base, hoje: "2026-11-07" });
igual("montado no sábado: plano da semana seguinte", [pSabado.semana, pSabado.dias[0].data], ["2026-W46", "2026-11-09"]);
const pDois = montarPlano({ ...base, tempo: "mais-6h", inscricoes: [inscA, { ...inscB, dispensas: ["tx"] }] });
const ordem = pDois.dias.flatMap((d) => d.aulas);
conferir("dois cursos: alterna entre eles", ordem[0] === "ta/a1" && ordem[1] === "tb/b1" && ordem[2] === "ta/a2");
conferir("dispensa: a trilha dispensada fica fora", !ordem.includes("tx/b3") && ordem.includes("tb/b4"));
const pFeitas = montarPlano({ ...base, concluidas: ["ta/a1", "ta/a2"] });
igual("aulas feitas ficam fora", pFeitas.dias[0].aulas, ["ta/a3"]);
const pFantasma = montarPlano({ ...base, tempo: "mais-6h", inscricoes: [inscB] , cursos: [{ slug: "b", modulos: [{ titulo: "1", aulas: ["tb/b1", "tb/sumiu", "tb/b2"] }] }] });
igual("aula que não existe (0 minuto) fica fora", pFantasma.dias.flatMap((d) => d.aulas), ["tb/b1", "tb/b2"]);
igual("curso que não existe: plano vazio", montarPlano({ ...base, inscricoes: [{ ...inscA, curso: "sumiu" }] }).dias.flatMap((d) => d.aulas), []);
igual("curso trancado não entra", montarPlano({ ...base, inscricoes: [{ ...inscA, trancadoEm: "2026-10-10" }] }).dias.flatMap((d) => d.aulas), []);
const pGrande = montarPlano({ ...base, minutosDaAula: () => 45 });
igual("aula maior que a parte do dia entra sozinha, sem passar da semana", pGrande.dias.map((d) => d.aulas.length), [1, 0, 0]);
const pMeta = montarPlano({ ...base, meta: 5 });
igual("meta de 5 aulas: o número da meta, dividido pelos dias", pMeta.dias.map((d) => d.aulas.length), [2, 2, 1]);
const pMetaQuarta = montarPlano({ ...base, meta: 6, hoje: "2026-11-04" });
igual("meta no meio da semana: a parte dos dias que sobram", pMetaQuarta.dias.map((d) => d.aulas.length), [2, 2]);
const pCalma = montarPlano({ ...base, tempo: "1-3h", calma: true });
conferir("calma: metade do tempo", pCalma.minutosDaSemana === 75 && total(pCalma) <= 75, String(total(pCalma)));
igual("aulasPendentes", aulasPendentes({ ...base, inscricoes: [inscB], concluidas: ["tb/b1"] }), ["tb/b2", "tx/b3", "tb/b4"]);

// ───────────── reajustar ─────────────

const quarta = reajustar(p1, ["ta/a1"], "2026-11-04");
igual("feita na segunda fica na segunda", quarta.dias[0].aulas, ["ta/a1"]);
igual("feita conta como último dia com aula", quarta.ultimoFeito, "2026-11-04");
const naoFez = reajustar(p1, [], "2026-11-04");
igual("não feita na segunda vai para o próximo dia livre (quarta)", naoFez.dias.map((d) => d.aulas), [[], ["ta/a2", "ta/a1"], ["ta/a3"]]);
igual("e os minutos acompanham", naoFez.dias.map((d) => d.minutos), [0, 40, 20]);
igual("reajustar duas vezes dá o mesmo", reajustar(naoFez, [], "2026-11-04"), naoFez);
const sabado = reajustar(p1, [], "2026-11-07");
igual("sem dia de estudo pela frente: vai para depois", sabado.paraDepois, ["ta/a1", "ta/a2", "ta/a3"]);
conferir("nada é chamado de atrasado", !JSON.stringify(sabado).includes("atrasad"));

// duas semanas paradas
const parado = montarPlano({ ...base, anterior: { comecouEm: "2026-10-19" } });
conferir("plano novo não oferece calma", !reajustar(p1, [], "2026-11-04").oferecerCalma);
conferir("duas semanas sem nada feito: oferece recomeçar com calma", reajustar(parado, [], SEGUNDA).oferecerCalma);
conferir("13 dias: não oferece", !reajustar({ ...parado, comecouEm: "2026-10-20" }, [], SEGUNDA).oferecerCalma);
conferir("aula feita fora do plano há pouco: não oferece", !reajustar(parado, [], SEGUNDA, "2026-10-30").oferecerCalma);
conferir("aula feita há 20 dias: oferece", reajustar(parado, [], SEGUNDA, "2026-10-13").oferecerCalma);
conferir("já com calma: não oferece de novo", !reajustar({ ...parado, calma: true }, [], SEGUNDA).oferecerCalma);

// planoDeHoje e guardar
const semanaQueVem = planoDeHoje(p1, { ...base, hoje: "2026-11-09" });
conferir("plano de outra semana é montado de novo, com os mesmos dias", semanaQueVem.semana === "2026-W46" && JSON.stringify(semanaQueVem.diasDaSemana) === JSON.stringify(p1.diasDaSemana));
igual("e guarda o começo do anterior", semanaQueVem.comecouEm, p1.comecouEm);
igual("mesma semana: usa o guardado", planoDeHoje(p1, { ...base, hoje: "2026-11-04", tempo: "mais-6h" }).minutosDaSemana, 60);
igual("validarPlano devolve o mesmo", validarPlano(JSON.parse(JSON.stringify(naoFez))), naoFez);
igual("validarPlano recusa lixo", [validarPlano(null), validarPlano({ versao: 2 }), validarPlano({ ...p1, semana: "2026-45" })], [null, null, null]);
igual("ultimaAulaFeita", ultimaAulaFeita({ x: new Date(2026, 9, 3, 12).getTime(), y: new Date(2026, 9, 1).getTime() }), "2026-10-03");
igual("ultimaAulaFeita sem nada", ultimaAulaFeita({}), null);

// ───────────── Textos ─────────────

const raiz = path.resolve(import.meta.dirname, "..");
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const textos = Object.fromEntries(IDIOMAS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(raiz, "i18n", "escola", "matricula", `${l}.json`), "utf8"))]));
conferir("aviso da carteirinha em português, como no desenho", textos.pt.carteirinha.avisoNaoDocumento === "Esta carteirinha não é documento oficial e não vale como carteira de estudante para meia-entrada. Foi feita neste aparelho; nada foi enviado.");
conferir("a lei citada é a 12.933/2013 (lida em leis-do-brasil)", textos.pt.carteirinha.leiNaoVale.includes("12.933/2013"));
for (const l of IDIOMAS) {
  const t = textos[l];
  conferir(`${l}: os 6 objetivos`, OBJETIVOS.every((o) => t.fluxo.objetivo.opcoes[o]?.titulo));
  conferir(`${l}: o aviso da meia-entrada existe`, t.carteirinha.avisoNaoDocumento.length > 40 && t.carteirinha.leiNaoVale.includes("12.933"));
  conferir(`${l}: plano diz que não é IA`, t.plano.regra.length > 20);
  conferir(`${l}: 7 dias da semana`, t.plano.dias.length === 7 && t.plano.diasCurtos.length === 7);
  conferir(`${l}: sem "atrasado"`, !/atrasad|overdue|retrasad|en retard|просроч|逾期/i.test(JSON.stringify(t.plano)));
}

console.log(`escola-matricula: ${certos} conferências certas, ${falhas.length} falha(s).`);
if (falhas.length) {
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}

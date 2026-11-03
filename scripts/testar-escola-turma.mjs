// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere as turmas por curso da Escola Lúcia Maria (E4-15, docs/escola/turma.md): turmaDoCurso (rodízio, módulo grande,
// mês seguinte, quartas certas na virada do mês, seminário no último encontro), o .ics, a validação da monitoria e dos
// orientadores (sem autorização falha) e as listas de content/escola, a sequência do círculo dentro de MAX_AULAS, os
// círculos guardados (no máximo 10), o registro da banca, o aviso de nome no cartaz, as páginas e os textos do
// consentimento. Sem rede, sem navegador.
import fs from "node:fs";
import path from "node:path";
import { carregarCursos } from "../lib/escola/cursos-servidor.ts";
import {
  AULAS_POR_MES,
  MAX_CIRCULOS,
  MAX_VAGAS,
  apagarCirculo,
  frasesDoCartaz,
  guardarCirculo,
  icsDosEncontros,
  indiceDoModulo,
  lerCirculos,
  mesSeguinte,
  monitoresDoMes,
  novoCirculo,
  orientadoresComVaga,
  pareceNomeCompleto,
  registroDaBanca,
  semestreDoCartaz,
  sequenciaDoCirculo,
  temTurma,
  turmaDoCurso,
  validarMonitoria,
  validarOrientadores,
} from "../lib/escola/turma-do-curso.ts";
import { site } from "../lib/site.ts";
import { MAX_AULAS, codificarSequencia, lerSequencia } from "../lib/turma.ts";

const RAIZ = process.cwd();
let certos = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") =>
  cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`);

// Cursos de TESTE (ficam aqui): o rodízio não depende do conteúdo real.
const aulas = (prefixo, n) =>
  Array.from({ length: n }, (_, i) => `trilha-${prefixo}/aula-${i + 1}`);
const tres = {
  slug: "teste",
  modulos: [
    { titulo: "A", aulas: aulas("a", 4) },
    { titulo: "B", aulas: aulas("b", 6) },
    { titulo: "C", aulas: aulas("c", 2) },
  ],
};
const grande = {
  slug: "grande",
  modulos: [{ titulo: "Grande", aulas: aulas("g", 11) }],
};

// ── Rodízio ──
const meses = [
  "2026-10",
  "2026-11",
  "2026-12",
  "2027-01",
  "2027-02",
  "2027-03",
];
const indices = meses.map((m) => turmaDoCurso(tres, m).modulo.indice);
conferir(
  "rodízio: índice = (ano × 12 + mês) módulo nº de módulos",
  meses.every(
    (m, i) =>
      indices[i] === (Number(m.slice(0, 4)) * 12 + Number(m.slice(5))) % 3,
  ),
  indices.join(","),
);
conferir(
  "rodízio: meses seguidos andam um módulo",
  indices.every((x, i) => i === 0 || x === (indices[i - 1] + 1) % 3),
  indices.join(","),
);
conferir(
  "rodízio: determinístico",
  JSON.stringify(turmaDoCurso(tres, "2026-11")) ===
    JSON.stringify(turmaDoCurso(tres, "2026-11")),
);
conferir(
  "rodízio: indiceDoModulo com mês inválido dá 0",
  indiceDoModulo("2026-13", 3) === 0 && indiceDoModulo("x", 3) === 0,
);
conferir(
  "mês inválido: null",
  turmaDoCurso(tres, "2026-13") === null &&
    turmaDoCurso(tres, "26-11") === null,
);
conferir(
  "curso sem módulo: null",
  turmaDoCurso({ slug: "x", modulos: [] }, "2026-11") === null,
);

// ── Módulo grande e pequeno ──
const g = turmaDoCurso(grande, "2026-11");
const nG = g.semanas.flatMap((s) => s.aulas).length;
conferir(
  "módulo grande: entra com até 8 aulas",
  nG === AULAS_POR_MES,
  String(nG),
);
conferir("módulo grande: aviso 'continua no mês que vem'", g.continua === true);
conferir(
  "módulo grande: 2 aulas por semana",
  g.semanas.every((s) => s.aulas.length === 2),
);
conferir(
  "módulo grande: as 8 primeiras, na ordem",
  g.semanas.flatMap((s) => s.aulas).join() ===
    grande.modulos[0].aulas.slice(0, 8).join(),
);
const pequeno = turmaDoCurso(
  { slug: "p", modulos: [{ titulo: "P", aulas: aulas("p", 3) }] },
  "2026-11",
);
conferir(
  "módulo pequeno: não continua, semanas finais vazias",
  pequeno.continua === false &&
    pequeno.semanas[0].aulas.length === 2 &&
    pequeno.semanas[1].aulas.length === 1 &&
    pequeno.semanas[3].aulas.length === 0,
);

// ── Mês seguinte ──
conferir(
  "mês seguinte: dezembro vira janeiro do ano seguinte",
  mesSeguinte("2026-12") === "2027-01",
);
conferir(
  "mês seguinte: novembro vira dezembro",
  mesSeguinte("2026-11") === "2026-12",
);
conferir(
  "mês seguinte: o módulo do mês seguinte é o próximo do rodízio",
  turmaDoCurso(tres, mesSeguinte("2026-12")).modulo.indice ===
    (turmaDoCurso(tres, "2026-12").modulo.indice + 1) % 3,
);

// ── Quartas certas na virada do mês ──
const todosOsMeses = [];
for (let ano = 2024; ano <= 2028; ano++)
  for (let m = 1; m <= 12; m++)
    todosOsMeses.push(`${ano}-${String(m).padStart(2, "0")}`);
let quartas = true;
let noMes = true;
let dentroDaSemana = true;
let seminarioUltimo = true;
for (const mes of todosOsMeses) {
  const t = turmaDoCurso(tres, mes);
  for (const s of t.semanas) {
    const e = new Date(`${s.encontro}T12:00:00Z`);
    const i = new Date(`${s.inicio}T12:00:00Z`);
    if (e.getUTCDay() !== 3) quartas = false;
    if (s.encontro.slice(0, 7) !== mes || s.inicio.slice(0, 7) !== mes)
      noMes = false;
    const dias = (e - i) / 86400000;
    if (dias < 0 || dias > 6) dentroDaSemana = false;
  }
  if (t.seminario !== t.semanas[3].encontro) seminarioUltimo = false;
}
conferir("encontros: sempre quarta-feira (5 anos de meses)", quartas);
conferir(
  "encontros: nunca saem do mês (a quarta da semana 4 cai até o dia 28)",
  noMes,
);
conferir(
  "encontros: na primeira quarta a partir do começo da semana",
  dentroDaSemana,
);
conferir("seminário: é o último encontro do mês", seminarioUltimo);
const nov = turmaDoCurso(tres, "2026-11");
conferir(
  "novembro de 2026: quartas 4, 11, 18 e 25",
  nov.semanas.map((s) => s.encontro).join() ===
    "2026-11-04,2026-11-11,2026-11-18,2026-11-25",
  nov.semanas.map((s) => s.encontro).join(),
);
const jan = turmaDoCurso(tres, "2027-01");
conferir(
  "janeiro de 2027 (começa numa sexta): quartas 6, 13, 20 e 27",
  jan.semanas.map((s) => s.encontro).join() ===
    "2027-01-06,2027-01-13,2027-01-20,2027-01-27",
  jan.semanas.map((s) => s.encontro).join(),
);
const set = turmaDoCurso(tres, "2027-09");
conferir(
  "setembro de 2027 (começa numa quarta): o dia 1 já é encontro",
  set.semanas[0].encontro === "2027-09-01",
);

// ── .ics ──
const ics = icsDosEncontros(
  nov,
  { titulo: "Curso de teste", seminario: "Seminário", descricao: "Encontro" },
  "https://institutolucia.org/pt/escola/turmas/teste",
  new Date("2026-11-01T00:00:00Z"),
);
conferir(".ics: 4 encontros", (ics.match(/BEGIN:VEVENT/g) ?? []).length === 4);
conferir(
  ".ics: 19h30 de Brasília = 22h30 UTC",
  ics.includes("DTSTART:20261104T223000Z") &&
    ics.includes("DTSTART:20261125T223000Z"),
);
conferir(
  ".ics: o último é o seminário",
  /DTSTART:20261125T223000Z\r\nSUMMARY:Curso de teste · Seminário/.test(ics),
);
conferir(
  ".ics: sem link de sala",
  !/meet|jitsi|InstitutoLucia-Curso/i.test(ics),
);
conferir(".ics: linhas com CRLF", ics.includes("\r\n") && !/[^\r]\n/.test(ics));

// ── Monitoria e orientadores ──
const cursos = new Set(["teste", "grande"]);
const monitorBom = {
  curso: "teste",
  mes: "2026-11",
  apelido: "Dona Cida",
  horario: "terças, 20h",
  autorizacao: true,
};
conferir(
  "monitoria: lista vazia vale",
  validarMonitoria([], cursos).length === 0,
);
conferir(
  "monitoria: monitor certo vale",
  validarMonitoria([monitorBom], cursos).length === 0,
  validarMonitoria([monitorBom], cursos).join("; "),
);
conferir(
  "monitoria: sem autorização falha",
  validarMonitoria([{ ...monitorBom, autorizacao: undefined }], cursos).length >
    0,
);
conferir(
  "monitoria: autorização falsa falha",
  validarMonitoria([{ ...monitorBom, autorizacao: false }], cursos).length > 0,
);
conferir(
  "monitoria: curso que não existe falha",
  validarMonitoria([{ ...monitorBom, curso: "nao-existe" }], cursos).length > 0,
);
conferir(
  "monitoria: mês errado falha",
  validarMonitoria([{ ...monitorBom, mes: "2026-13" }], cursos).length > 0,
);
conferir(
  "monitoria: sem apelido falha",
  validarMonitoria([{ ...monitorBom, apelido: " " }], cursos).length > 0,
);
conferir(
  "monitoria: não é lista falha",
  validarMonitoria({}, cursos).length > 0,
);
conferir(
  "monitoria: só os do curso e do mês",
  monitoresDoMes(
    [
      monitorBom,
      { ...monitorBom, mes: "2026-12" },
      { ...monitorBom, curso: "grande" },
    ],
    "teste",
    "2026-11",
  ).length === 1,
);
const orientadorBom = {
  apelido: "Prof. Zé",
  cursos: ["teste"],
  vagasSemestre: 2,
  contato: { tipo: "rede", valor: "@prof_ze" },
  autorizacao: true,
};
const porEmail = {
  ...orientadorBom,
  contato: { tipo: "email-do-instituto", valor: site.newsletter },
};
conferir(
  "orientadores: lista vazia vale",
  validarOrientadores([], cursos).length === 0,
);
conferir(
  "orientadores: pela rede vale",
  validarOrientadores([orientadorBom], cursos).length === 0,
  validarOrientadores([orientadorBom], cursos).join("; "),
);
conferir(
  "orientadores: pelo e-mail do Instituto vale",
  validarOrientadores([porEmail], cursos).length === 0,
  validarOrientadores([porEmail], cursos).join("; "),
);
conferir(
  "orientadores: sem autorização falha",
  validarOrientadores([{ ...orientadorBom, autorizacao: undefined }], cursos)
    .length > 0,
);
conferir(
  "orientadores: e-mail pessoal falha (só o público do Instituto)",
  validarOrientadores(
    [
      {
        ...porEmail,
        contato: { tipo: "email-do-instituto", valor: "fulana@exemplo.com" },
      },
    ],
    cursos,
  ).length > 0,
);
conferir(
  `orientadores: mais de ${MAX_VAGAS} vagas falha`,
  validarOrientadores(
    [{ ...orientadorBom, vagasSemestre: MAX_VAGAS + 1 }],
    cursos,
  ).length > 0,
);
conferir(
  "orientadores: vaga negativa ou quebrada falha",
  validarOrientadores([{ ...orientadorBom, vagasSemestre: -1 }], cursos)
    .length > 0 &&
    validarOrientadores([{ ...orientadorBom, vagasSemestre: 1.5 }], cursos)
      .length > 0,
);
conferir(
  "orientadores: curso que não existe falha",
  validarOrientadores([{ ...orientadorBom, cursos: ["nao-existe"] }], cursos)
    .length > 0,
);
conferir(
  "orientadores: tipo de contato desconhecido falha",
  validarOrientadores(
    [{ ...orientadorBom, contato: { tipo: "whatsapp", valor: "11999999999" } }],
    cursos,
  ).length > 0,
);
conferir(
  "orientadores: só quem tem vaga no curso",
  orientadoresComVaga(
    [
      orientadorBom,
      { ...orientadorBom, apelido: "Sem vaga", vagasSemestre: 0 },
      { ...orientadorBom, apelido: "Outro", cursos: ["grande"] },
    ],
    "teste",
  ).length === 1,
);

// As listas reais: começam vazias e, quando a coordenação preencher, precisam passar na validação.
const reais = new Set(carregarCursos().map((c) => c.slug));
const lerJson = (arquivo) =>
  JSON.parse(
    fs.readFileSync(path.join(RAIZ, "content", "escola", arquivo), "utf8"),
  );
const monitoria = lerJson("monitoria.json");
const orientadores = lerJson("orientadores.json");
conferir(
  "content/escola/monitoria.json é válido",
  validarMonitoria(monitoria, reais).length === 0,
  validarMonitoria(monitoria, reais).join("; "),
);
conferir(
  "content/escola/orientadores.json é válido",
  validarOrientadores(orientadores, reais).length === 0,
  validarOrientadores(orientadores, reais).join("; "),
);

// ── Círculo de cultura digital ──
const muitas = Array.from(
  { length: MAX_AULAS + 10 },
  (_, i) => `trilha/aula-${i}`,
);
const seq = sequenciaDoCirculo("Água e saneamento", muitas);
conferir(
  `círculo: a sequência fica dentro de MAX_AULAS (${MAX_AULAS})`,
  seq && seq.aulas.length === MAX_AULAS,
  String(seq?.aulas.length),
);
const lida = lerSequencia(`#${codificarSequencia(seq)}`);
conferir(
  "círculo: o link do modo turma volta igual",
  lida &&
    lida.titulo === "Água e saneamento" &&
    lida.aulas.length === MAX_AULAS,
);
conferir(
  "círculo: sem aula, sem sequência",
  sequenciaDoCirculo("Tema", []) === null,
);
conferir(
  "círculo: sem tema, sem sequência",
  sequenciaDoCirculo("  ", ["a/b"]) === null,
);
let lista = [];
for (let i = 0; i < MAX_CIRCULOS + 3; i++)
  lista = guardarCirculo(lista, {
    ...novoCirculo("2026-11-03"),
    id: `c-${i}`,
    palavras: ["fome", "Fome", "  aluguel  "],
  });
conferir(
  `círculo: no máximo ${MAX_CIRCULOS} guardados (os mais velhos saem)`,
  lista.length === MAX_CIRCULOS && lista[0].id === "c-3",
);
conferir(
  "círculo: palavras sem repetir e limpas",
  lista[0].palavras.join("|") === "fome|aluguel",
  lista[0].palavras.join("|"),
);
conferir(
  "círculo: lerCirculos devolve o que foi guardado",
  lerCirculos(JSON.stringify(lista)).length === MAX_CIRCULOS,
);
conferir(
  "círculo: lixo vira lista vazia",
  lerCirculos("{x").length === 0 &&
    lerCirculos(null).length === 0 &&
    lerCirculos('[{"id":"!","data":"x"}]').length === 0,
);
conferir(
  "círculo: apagar tira só o escolhido",
  apagarCirculo(lista, "c-5").length === MAX_CIRCULOS - 1 &&
    !apagarCirculo(lista, "c-5").some((c) => c.id === "c-5"),
);
conferir(
  "círculo: trocar pelo id não duplica",
  guardarCirculo(lista, { ...lista[2], tema: "Novo" }).length === MAX_CIRCULOS,
);

// ── Banca ──
const rotulos = {
  clareza: "Clareza",
  curso: "Ligação com o curso",
  vida: "Ligação com a vida",
  proximo: "Próximo passo",
};
const r = registroDaBanca(
  {
    curso: "teste",
    data: "2026-11-25",
    devolutiva: { clareza: "Bem explicado.", proximo: "Levar à associação." },
    pessoas: ["Ana", " ", "Bia", "Ana"],
  },
  rotulos,
  "Projeto apresentado em banca",
);
conferir(
  "banca: registro tipo 'banca' com o curso e a data",
  r && r.tipo === "banca" && r.curso === "teste" && r.data === "2026-11-25",
);
conferir("banca: título fixo", r?.titulo === "Projeto apresentado em banca");
conferir(
  "banca: devolutiva por competência, só as preenchidas",
  r?.detalhe === "Clareza: Bem explicado.\nPróximo passo: Levar à associação.",
  r?.detalhe,
);
conferir(
  "banca: pessoas digitadas, sem vazio e sem repetir",
  r?.pessoas?.join() === "Ana,Bia",
  r?.pessoas?.join(),
);
conferir(
  "banca: sem devolutiva, sem registro",
  registroDaBanca(
    { curso: "teste", data: "2026-11-25", devolutiva: {}, pessoas: [] },
    rotulos,
    "x",
  ) === null,
);
conferir(
  "banca: sem curso, sem registro",
  registroDaBanca(
    {
      curso: "",
      data: "2026-11-25",
      devolutiva: { clareza: "a" },
      pessoas: [],
    },
    rotulos,
    "x",
  ) === null,
);
conferir(
  "banca: sem pessoas, sem campo pessoas",
  !(
    "pessoas" in
    registroDaBanca(
      {
        curso: "teste",
        data: "2026-11-25",
        devolutiva: { vida: "a" },
        pessoas: [],
      },
      rotulos,
      "x",
    )
  ),
);

// ── Cartaz ──
conferir(
  "cartaz: frases limpas, sem repetir",
  frasesDoCartaz(["  Aprendi junto.  ", "aprendi junto.", ""]).join("|") ===
    "Aprendi junto.",
);
conferir(
  "cartaz: semestre pela data",
  semestreDoCartaz("2026-11-03") === "2026.2" &&
    semestreDoCartaz("2027-03-10") === "2027.1",
);
conferir(
  "cartaz: aviso de nome completo",
  pareceNomeCompleto("Obrigada, Maria da Silva Souza") &&
    pareceNomeCompleto("Eu sou Ana Paula"),
);
conferir(
  "cartaz: frase comum sem aviso",
  !pareceNomeCompleto("Aprendi a fazer conta de luz") &&
    !pareceNomeCompleto("Saudade da turma"),
);

// ── Conteúdo real e páginas ──
const comTurma = carregarCursos().filter(temTurma);
conferir("há cursos com turma", comTurma.length > 0);
conferir(
  "todo curso com turma tem a turma do mês",
  comTurma.every(
    (c) => turmaDoCurso(c, "2026-11") && turmaDoCurso(c, "2026-12"),
  ),
);
conferir(
  "nenhum curso se chama circulo, banca ou cartaz (as páginas fixas de /escola/turmas)",
  !comTurma.some((c) => ["circulo", "banca", "cartaz"].includes(c.slug)),
);
const sensiveis = carregarCursos()
  .filter((c) => c.sensivel)
  .map((c) => c.slug);
conferir(
  "o Ano de formação política é curso sensível",
  sensiveis.includes("ano-de-formacao-politica"),
  sensiveis.join(","),
);
for (const pagina of [
  "page.tsx",
  "[curso]/page.tsx",
  "circulo/page.tsx",
  "banca/page.tsx",
  "cartaz/page.tsx",
]) {
  const arquivo = path.join(RAIZ, "app", "[lang]", "escola", "turmas", pagina);
  const existe = fs.existsSync(arquivo);
  conferir(`página /escola/turmas/${pagina}`, existe);
  if (existe)
    conferir(
      `página ${pagina} não é a provisória`,
      !fs.readFileSync(arquivo, "utf8").includes("EmConstrucao"),
    );
}
const componente = fs.readFileSync(
  path.join(RAIZ, "components", "escola", "turma", "TurmaDoCurso.tsx"),
  "utf8",
);
conferir(
  "curso sensível: sem 'Concordo' não chama a RPC (o retorno vem antes do pedido)",
  /if \(entrar && ehSensivel && !concordo\) \{[\s\S]*?return;[\s\S]*?\}[\s\S]*?entrarNaTurmaDoCurso/.test(
    componente,
  ),
);
conferir(
  "sair chama turma_curso_entrar com entrar=false",
  /mudar\(false\)/.test(componente),
);

// ── Textos ──
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const textos = Object.fromEntries(
  IDIOMAS.map((l) => [
    l,
    JSON.parse(
      fs.readFileSync(
        path.join(RAIZ, "i18n", "escola", "turma", `${l}.json`),
        "utf8",
      ),
    ),
  ]),
);
conferir(
  "o quadro do consentimento diz o que o desenho manda (pt)",
  textos.pt.turma.sensivelTexto ===
    "Para entrar na turma, o Instituto guarda que esta conta está na turma deste curso, que trata de política. Só a sua conta vê; você pode sair quando quiser, e sair apaga o registro.",
);
for (const l of IDIOMAS) {
  conferir(
    `${l}: cita a lei e os artigos certos`,
    /13[.,]709/.test(textos[l].turma.sensivelLei) &&
      /11/.test(textos[l].turma.sensivelLei) &&
      /5/.test(textos[l].turma.sensivelLei),
  );
  conferir(
    `${l}: o roteiro da banca soma 30 minutos`,
    textos[l].banca.roteiro.reduce(
      (s, [t]) => s + Number(/\d+/.exec(t)[0]),
      0,
    ) === 30,
  );
  conferir(
    `${l}: 5 perguntas-guia no círculo`,
    textos[l].circulo.p3Guias.length === 5,
  );
  conferir(
    `${l}: o roteiro do seminário tem 4 partes`,
    textos[l].seminario.roteiro.length === 4,
  );
}

console.log(
  `escola-turma: ${certos} conferências certas, ${falhas.length} falha(s).`,
);
if (falhas.length) {
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o campus e o calendário da Escola Lúcia Maria (E4-09, docs/escola/campus.md): toda seção da lista do "Mais"
// em exatamente um prédio; predioDoCaminho; o passaporte (o modo seguro não carimba); eventosDoSemestre (bordas e
// férias); os feriados do campus contra content/neste-dia.json e components/Festa.tsx; os exames do ENEM iguais a
// content/enem/edicao.yml; icsDoEvento válido (CRLF, UID, DTSTART em data); e os textos nos 6 idiomas.
// Sem rede, sem navegador.
import fs from "node:fs";
import path from "node:path";
import { CORE_SCHEMA, load } from "js-yaml";
import { ehAulaMagna, eventosDoSemestre, estacaoDe, feriadoDoDia, FERIADOS, EXAMES, icsDoEvento, janelaDoSemestre, proximoEvento, semestrePorId, semestresDoCalendario } from "../lib/escola/calendario.ts";
import { IDS_DOS_PREDIOS, PREDIOS, TONS, filtrarCampus, montarCampus, predioDoCaminho, semIdioma } from "../lib/escola/campus.ts";
import { CHAVE_DO_PASSAPORTE, carimbar, carimbarCaminho, lerPassaporte, validarPassaporte, visitados } from "../lib/escola/passaporte.ts";
import { CHAVES_DA_ESCOLA } from "../lib/escola/estudante.ts";
import { ROTAS_DA_ESCOLA } from "../lib/escola/rotas.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), "utf8");
let certos = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const igual = (nome, valor, esperado) => conferir(nome, JSON.stringify(valor) === JSON.stringify(esperado), `veio ${JSON.stringify(valor)}, esperado ${JSON.stringify(esperado)}`);

// ───────────── Prédios sobre a lista do "Mais" ─────────────
const fonteDoMais = ler("lib/secoes-do-site.ts");
// Cada item da lista é [rótulo, "/caminho", descrição]: o caminho é a segunda posição, sempre uma string que começa com "/".
const hrefsDoMais = [...fonteDoMais.matchAll(/\[\s*[^,\]]+,\s*"(\/[a-z0-9/-]*)"\s*,/g)].map((m) => m[1]);
conferir("a lista do Mais foi lida", hrefsDoMais.length >= 50, `só ${hrefsDoMais.length}`);
const contagem = new Map();
for (const p of PREDIOS) for (const h of p.secoes) contagem.set(h, (contagem.get(h) ?? 0) + 1);
for (const h of hrefsDoMais) conferir(`"${h}" do Mais está em exatamente um prédio`, contagem.get(h) === 1, `está em ${contagem.get(h) ?? 0}`);
for (const h of contagem.keys()) conferir(`"${h}" do prédio existe no Mais`, hrefsDoMais.includes(h));
igual("oito prédios, na ordem", PREDIOS.map((p) => p.id), [...IDS_DOS_PREDIOS]);
const todosOsHrefs = PREDIOS.flatMap((p) => [...p.secoes, ...p.outras]);
conferir("nenhum endereço repetido entre prédios", new Set(todosOsHrefs).size === todosOsHrefs.length);
for (const p of PREDIOS) {
  conferir(`tom de ${p.id} é um atalho que já existe`, TONS.includes(p.tom));
  for (const h of p.outras) conferir(`a página ${h} (${p.id}) existe`, fs.existsSync(path.join(raiz, "app", "[lang]", h.slice(1))));
}
// O tom e o desenho batem com components/celular/Atalhos.tsx (a cor sai de lá, nunca de uma paleta nova).
const atalhos = ler("components/celular/Atalhos.tsx");
for (const p of PREDIOS) {
  const m = new RegExp(`"${p.desenho}": predio\\(\\s*"([a-zA-Z]+)"`).exec(atalhos);
  conferir(`desenho ${p.desenho} existe em Atalhos`, Boolean(m));
  if (m) igual(`tom de ${p.id} igual ao de Atalhos`, m[1], p.tom);
}
conferir("Atalhos não ganhou cor nova", (atalhos.match(/#[0-9a-f]{3,6}\b/gi) ?? []).every((c) => ["#c21f16", "#fff", "#23408e", "#ea7a24", "#1f1a14", "#2e6b4f", "#1f8a85", "#f0b323", "#e4577f"].includes(c.toLowerCase())), (atalhos.match(/#[0-9a-f]{3,6}\b/gi) ?? []).join(" "));

// montarCampus e filtrarCampus
const itens = hrefsDoMais.map((h) => ({ label: `Rótulo ${h}`, path: h, description: "" }));
const nomes = Object.fromEntries(IDS_DOS_PREDIOS.map((id) => [id, { nome: id === "praca" ? "Praça" : id, frase: "" }]));
const montado = montarCampus(itens, nomes);
igual("montarCampus põe todos os itens", montado.reduce((n, p) => n + p.itens.length, 0), itens.length);
const comSolto = montarCampus([...itens, { label: "Solto", path: "/solto", description: "" }], nomes);
conferir("item sem prédio vai para a Secretaria (nenhum link some)", comSolto.at(-1).itens.some((i) => i.path === "/solto"));
const semRadio = montarCampus(itens.filter((i) => !["/radio", "/podcasts", "/videos"].includes(i.path)), nomes);
conferir("prédio vazio sai do mapa", !semRadio.some((p) => p.id === "radio"));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
igual("busca pelo nome do prédio traz o prédio inteiro", filtrarCampus(montado, "praca", norm).map((p) => [p.id, p.itens.length]), [["praca", PREDIOS.find((p) => p.id === "praca").secoes.length]]);
igual("busca por item traz só o item", filtrarCampus(montado, norm("rótulo /acervo"), norm).map((p) => [p.id, p.itens.map((i) => i.path)]), [["biblioteca", ["/acervo"]]]);
igual("busca sem nada", filtrarCampus(montado, "zzz-nada", norm), []);

// predioDoCaminho
igual("semIdioma", [semIdioma("/pt/acervo/x"), semIdioma("/zh"), semIdioma("/acervo/?q=1#a"), semIdioma("/ptx/a")], ["/acervo/x", "/", "/acervo", "/ptx/a"]);
igual("predioDoCaminho", ["/pt/trilhas/a/b", "/en/contribuir/guia", "/pt/contribuir", "/es/escola/campus", "/pt", "/pt/painel", "/fr/enem/simulado", "/pt/radiox", "/pt/eventos"].map(predioDoCaminho), ["escola", "secretaria", "secretaria", "escola", null, null, "escola", null, "territorio"]);

// ───────────── Passaporte ─────────────
const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
igual("chave do passaporte", CHAVE_DO_PASSAPORTE, "lucia:escola:passaporte");
const local = memoria();
const desligado = memoria();
const seguro = memoria();
seguro.setItem("lucia-seguro", "1");
conferir("carimba a primeira visita", carimbar("biblioteca", "2026-11-03", local, desligado));
conferir("não carimba de novo", !carimbar("biblioteca", "2026-11-04", local, desligado));
igual("guarda a data da primeira", lerPassaporte(local), { biblioteca: "2026-11-03" });
conferir("modo seguro não carimba", !carimbar("radio", "2026-11-03", local, seguro));
igual("modo seguro não mexeu", lerPassaporte(local), { biblioteca: "2026-11-03" });
igual("carimbarCaminho", carimbarCaminho("/pt/radio", "2026-11-05", local, desligado), "radio");
igual("carimbarCaminho fora do campus", carimbarCaminho("/pt", "2026-11-05", local, desligado), null);
igual("carimbarCaminho no modo seguro", carimbarCaminho("/pt/memorial", "2026-11-05", local, seguro), null);
igual("visitados", visitados(lerPassaporte(local)), 2);
igual("validarPassaporte limpa o que não presta", validarPassaporte({ radio: "2026-11-03", lua: "2026-11-03", praca: "ontem", escola: 3 }), { radio: "2026-11-03" });
conferir("sem armazenamento não quebra", !carimbar("escola", "2026-11-03", null, desligado));
conferir("armazenamento cheio não quebra", !carimbar("escola", "2026-11-03", { getItem: () => null, setItem: () => { throw new Error("cheio"); } }, desligado));

// ───────────── Calendário ─────────────
const s1 = semestrePorId("2027.1");
const s2 = semestrePorId("2026.2");
igual("semestrePorId", [s1.id, s1.inicio, s1.fim, s2.inicio, s2.fim], ["2027.1", "2027-02-01", "2027-06-30", "2026-08-01", "2026-12-15"]);
igual("janela do 1º semestre começa nas férias de verão", janelaDoSemestre(s1), { de: "2026-12-16", ate: "2027-06-30" });
igual("janela do 2º semestre começa nas férias de julho", janelaDoSemestre(s2), { de: "2026-07-01", ate: "2026-12-15" });
const fontesDeTeste = {
  aulasMagnas: [
    { semestre: "2027.1", titulo: "Aula magna de teste", data: "2027-02-03" },
    { semestre: "2027.1", titulo: "Aula magna sem data" },
    { semestre: "2026.2", titulo: "Outra", data: "2026-08-02" },
  ],
  feriados: [
    { dia: "12-16", nome: "Borda de férias", fonte: "https://exemplo.org/a", origem: "neste-dia" },
    { dia: "07-10", nome: "Feriado de julho", fonte: "https://exemplo.org/b", origem: "neste-dia" },
    { dia: "06-30", nome: "Último dia", fonte: "https://exemplo.org/c", origem: "neste-dia" },
  ],
  exames: [{ exame: "X", edicao: 2027, etapa: "Prova", data: "2027-01-10", fonte: "https://www.gov.br/x", orgao: "Inep", consultadoEm: "2026-11-03" }],
};
const ev1 = eventosDoSemestre(s1, fontesDeTeste);
igual(
  "eventos do 1º semestre (bordas, férias e a magna sem data no fim)",
  ev1.map((e) => `${e.tipo}:${e.data}`),
  ["feriado:2026-12-16", "exame:2027-01-10", "inicio:2027-02-01", "aula-magna:2027-02-03", "provas:2027-06-17", "feriado:2027-06-30", "fim:2027-06-30", "aula-magna:"],
);
conferir("feriado de julho fica no 2º semestre", eventosDoSemestre(s2, fontesDeTeste).some((e) => e.titulo === "Feriado de julho" && e.data === "2026-07-10"));
conferir("feriado de julho não entra no 1º", !ev1.some((e) => e.titulo === "Feriado de julho"));
igual("provas vêm de semanaDeProvas", ev1.find((e) => e.tipo === "provas").ate, "2027-06-30");
conferir("ano letivo não confirmado marca proposto", ev1.filter((e) => ["inicio", "fim", "provas"].includes(e.tipo)).every((e) => e.proposto === true));
conferir("exame leva a fonte", ev1.find((e) => e.tipo === "exame").fonte === "https://www.gov.br/x");
const reais = eventosDoSemestre(s2);
conferir("ENEM no 2º semestre de 2026", reais.some((e) => e.tipo === "exame" && e.data === "2026-11-08" && e.link === "/enem"));
conferir("20 de novembro no 2º semestre, com a aula", reais.some((e) => e.tipo === "feriado" && e.data === "2026-11-20" && e.link === "/trilhas/luta-negra-fundamental/o-20-de-novembro"));
igual("semestres do calendário em aula", semestresDoCalendario("2026-11-03").map((s) => s.id), ["2026.2", "2027.1"]);
igual("semestres do calendário nas férias de verão", semestresDoCalendario("2027-01-10").map((s) => s.id), ["2027.1", "2027.2"]);
igual("semestres do calendário nas férias de julho", semestresDoCalendario("2027-07-10").map((s) => s.id), ["2027.2", "2028.1"]);
igual("semestres no último dia", semestresDoCalendario("2026-12-15").map((s) => s.id), ["2026.2", "2027.1"]);
igual("estacaoDe", ["2026-11-03", "2027-01-10", "2027-03-01", "2027-07-15", "2026-12-15", "2026-12-16"].map((d) => estacaoDe(d)), ["2", "ferias", "1", "ferias", "2", "ferias"]);
igual("proximoEvento", proximoEvento("2027-06-20", ev1)?.tipo, "provas");
igual("proximoEvento ignora magna sem data", proximoEvento("2027-07-01", ev1), null);
igual("feriadoDoDia", [feriadoDoDia("2026-11-20")?.nome, feriadoDoDia("2026-11-21")], ["Dia de Zumbi e da Consciência Negra", null]);
igual("ehAulaMagna", ["Aula magna: o 20 de novembro", "AULA MAGNA", "  aula Mágna", "Aula sobre magna"].map(ehAulaMagna), [true, true, true, false]);

// icsDoEvento
const evIcs = ev1.find((e) => e.tipo === "provas");
const ics = icsDoEvento(evIcs, "https://institutolucia.org/pt/escola/provas", new Date("2026-11-03T12:00:00Z"));
conferir("ics: linhas com CRLF", ics.includes("\r\n") && !/[^\r]\n/.test(ics));
conferir("ics: BEGIN/END", ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.trimEnd().endsWith("END:VCALENDAR"));
conferir("ics: UID", /\r\nUID:escola-[A-Za-z0-9.-]+@institutolucia\.org\r\n/.test(ics));
conferir("ics: DTSTART em data", ics.includes("\r\nDTSTART;VALUE=DATE:20270617\r\n"));
conferir("ics: DTEND no dia seguinte ao último", ics.includes("\r\nDTEND;VALUE=DATE:20270701\r\n"));
conferir("ics: sem recorrência e sem alarme", !ics.includes("RRULE") && !ics.includes("VALARM"));
conferir("ics: linhas de até 75", ics.split("\r\n").every((l) => l.length <= 75));
conferir("ics: avisa que é proposta", ics.includes("proposta"));
const icsEx = icsDoEvento({ tipo: "exame", data: "2026-11-08", titulo: "ENEM 2026; dia, 1", link: "/enem", id: "exame-x" }, "https://institutolucia.org/pt/enem");
conferir("ics: escapa ; e ,", icsEx.includes("SUMMARY:ENEM 2026\\; dia\\, 1"));
let semData = false;
try {
  icsDoEvento({ tipo: "aula-magna", data: "", titulo: "x", link: "/ao-vivo", id: "x" }, "https://x");
} catch {
  semData = true;
}
conferir("ics: evento sem data recusa", semData);

// ───────────── Feriados contra a origem ─────────────
const nesteDia = JSON.parse(ler("content/neste-dia.json")).fatos;
const arquivoDaAula = (aula) => path.join(raiz, "content", "trilhas", `${aula}.md`);
for (const f of FERIADOS) {
  conferir(`feriado ${f.dia}: formato`, /^\d{2}-\d{2}$/.test(f.dia) && /^https:\/\//.test(f.fonte) && f.nome.length > 3);
  const [m, d] = f.dia.split("-").map(Number);
  if (f.origem === "neste-dia") {
    const fatos = nesteDia.filter((x) => x.dia === f.dia);
    conferir(`feriado ${f.dia}: está em neste-dia.json com o mesmo link`, fatos.some((x) => x.link === f.fonte), f.fonte);
  } else if (f.origem === "festa") {
    // Festa.tsx tem JSX (o Node não lê): confere a linha de festaDe que devolve a festa nesse dia exato.
    conferir(`feriado ${f.dia}: festaDe dá a mesma festa`, ler("components/Festa.tsx").includes(`if (md === ${m * 100 + d}) return "${f.festa}";`), f.festa);
    conferir(`feriado ${f.dia}: a fonte está na aula ligada`, Boolean(f.aula) && fs.existsSync(arquivoDaAula(f.aula)) && fs.readFileSync(arquivoDaAula(f.aula), "utf8").includes(f.fonte));
  } else conferir(`feriado ${f.dia}: origem conhecida`, false, f.origem);
  // O nome tem de estar escrito na origem (no fato do Neste dia ou no resumo da aula ligada), sem nome inventado.
  const textos = [...nesteDia.filter((x) => x.dia === f.dia).map((x) => x.texto), f.aula && fs.existsSync(arquivoDaAula(f.aula)) ? fs.readFileSync(arquivoDaAula(f.aula), "utf8").slice(0, 1500) : ""].join(" ");
  conferir(`feriado ${f.dia}: o nome "${f.nome}" está na origem`, textos.includes(f.nome));
  if (f.aula) conferir(`feriado ${f.dia}: a aula ${f.aula} existe`, fs.existsSync(arquivoDaAula(f.aula)));
}
conferir("feriados sem dia repetido", new Set(FERIADOS.map((f) => f.dia)).size === FERIADOS.length);

// ───────────── Exames: o ENEM igual a edicao.yml ─────────────
const edicao = load(ler("content/enem/edicao.yml"), { schema: CORE_SCHEMA });
const esperado = Object.entries(edicao.fatos)
  .filter(([, f]) => f.tipo === "data" && typeof f.valor === "string")
  .map(([k, f]) => ({ exame: "ENEM", edicao: edicao.edicao, etapa: f.afirmacao, data: f.valor, fonte: edicao.fontes[f.fonte].url, orgao: edicao.fontes[f.fonte].orgao, consultadoEm: f.conferido, curso: "enem", fato: k }))
  .sort((a, b) => a.data.localeCompare(b.data));
igual("exames do ENEM iguais a edicao.yml", EXAMES.filter((e) => e.exame === "ENEM"), esperado);
for (const e of EXAMES) {
  conferir(`exame ${e.exame} ${e.data}: fonte oficial`, /^https:\/\/([a-z0-9-]+\.)*(gov\.br|in\.gov\.br|inep\.gov\.br|mec\.gov\.br)\//.test(e.fonte), e.fonte);
  conferir(`exame ${e.exame} ${e.data}: consultadoEm`, /^\d{4}-\d{2}-\d{2}$/.test(e.consultadoEm));
}
conferir("só ENEM e ENCCEJA", EXAMES.every((e) => ["ENEM", "ENCCEJA"].includes(e.exame)));
for (const e of EXAMES.filter((x) => x.exame === "ENCCEJA")) conferir("ENCCEJA vai para o curso EJA", e.curso === "eja-de-ponta-a-ponta");

// ───────────── Conteúdo curado começa honesto ─────────────
const calendarioJson = JSON.parse(ler("content/escola/calendario.json"));
conferir("calendario.json: confirmado é booleano", typeof calendarioJson.confirmado === "boolean");
for (const m of calendarioJson.aulasMagnas) conferir(`aula magna "${m.titulo}": semestre e data`, /^\d{4}\.[12]$/.test(m.semestre) && (!m.data || /^\d{4}-\d{2}-\d{2}$/.test(m.data)));
const avisosJson = JSON.parse(ler("content/escola/avisos.json"));
const ids = new Set();
for (const a of avisosJson.avisos) {
  conferir(`aviso ${a.id}: forma`, typeof a.id === "string" && !ids.has(a.id) && typeof a.texto === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.desde) && /^\d{4}-\d{2}-\d{2}$/.test(a.ate) && a.desde <= a.ate);
  ids.add(a.id);
}
igual("chave dos avisos lidos", CHAVES_DA_ESCOLA.avisosLidos, "lucia:escola:avisos-lidos");

// ───────────── Rotas e textos ─────────────
for (const caminho of ["/escola/campus", "/escola/calendario"]) {
  const r = ROTAS_DA_ESCOLA.find((x) => x.caminho === caminho);
  conferir(`${caminho} é do E4-09 e não é mais provisória`, r?.pacote === "E4-09" && !r.provisoria);
  conferir(`${caminho} não usa mais EmConstrucao`, !ler(`app/[lang]${caminho}/page.tsx`).includes("EmConstrucao"));
}
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const achatar = (v, p = "", s = new Map()) => {
  if (v && typeof v === "object") for (const k of Object.keys(v)) achatar(v[k], p ? `${p}.${k}` : k, s);
  else s.set(p, v);
  return s;
};
const pt = achatar(JSON.parse(ler("i18n/escola/campus/pt.json")));
for (const lang of IDIOMAS) {
  const t = achatar(JSON.parse(ler(`i18n/escola/campus/${lang}.json`)));
  for (const [k, v] of pt) {
    conferir(`${lang}: ${k}`, typeof t.get(k) === "string" && t.get(k).trim() !== "");
    const marcas = (texto) => (String(texto).match(/\{\w+\}/g) ?? []).sort().join(",");
    conferir(`${lang}: ${k} com as mesmas marcas`, marcas(t.get(k)) === marcas(v), `${marcas(t.get(k))} x ${marcas(v)}`);
  }
  conferir(`${lang}: sem chave a mais`, [...t.keys()].every((k) => pt.has(k)));
}

// ───────────── Sem a flag, nada muda fora da Escola ─────────────
for (const [arquivo, marca] of [
  ["app/[lang]/layout.tsx", 'ligado("escola")'],
  ["app/[lang]/page.tsx", 'ligado("escola")'],
  ["app/[lang]/explorar/page.tsx", 'ligado("escola")'],
  ["components/inicio/Janelas.tsx", 'ligado("escola")'],
])
  conferir(`${arquivo} só muda com a Escola ligada`, ler(arquivo).includes(marca));
conferir("MaisGaveta sem campus é a de sempre", /campus && mapa \?/.test(ler("components/MaisGaveta.tsx")));
conferir("nenhuma notificação", !/Notification|showNotification|serviceWorker/.test([ler("components/escola/QuadroDeAvisos.tsx"), ler("components/escola/calendario/CalendarioDaEscola.tsx")].join("")));
conferir("CSS do pacote sem cor nova", !/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(ler("styles/escola-campus.css")));

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s) no campus e calendário da Escola:\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ campus e calendário da Escola: ${certos} conferências`);

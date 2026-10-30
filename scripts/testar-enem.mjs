// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere o curso ENEM inteiro (docs/ENEM.md): o formato de cada arquivo de content/enem, as ligações entre eles
// (aula, habilidade, objeto, questão oficial, exercício), os fatos citados nas aulas e as contas das funções puras
// (fatos, numeração das provas, incidência, plano de estudos, laboratório da TRI, média do Sisu). Uso: npm run testar:enem
import fs from "node:fs";
import path from "node:path";
import { acharNaMatriz, areaPelaNumeracao, AREAS_DO_ENEM, calcularIncidencia, diasAte, fatosCitados, formatarFato, substituirFatos, todosOsObjetos, validarEdicao, validarMatriz } from "../lib/enem.ts";
import { competenciaDaHabilidade, FAIXAS_DO_ENEM } from "../lib/mapa-curricular.ts";
import { conferirSecoesDoEnem, ehOrientacao, ehRedacao } from "../lib/modelo-de-aula.ts";
import { anosImportados, carregarAulas, carregarClassificacoes, carregarSimulados, carregarEdicao, carregarExercicios, carregarMapas, carregarMatriz, carregarRedacao, existeArquivo, importadasDe, lerYaml, raiz, textoDaIncidencia } from "./enem-dados.mjs";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const recusa = (nome, fn, trecho) => {
  try {
    fn();
    falhas.push(`${nome}: deveria recusar`);
  } catch (erro) {
    conferir(nome, !trecho || erro.message.includes(trecho), erro.message);
  }
};
const tentar = (nome, fn) => {
  try {
    return fn();
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return null;
  }
};

// ── 1. Funções puras ──
const fato = (tipo, valor) => ({ id: "x", afirmacao: "x", tipo, valor, situacao: "confirmado", fonte: "f", trecho: "t", conferido: "2026-10-30" });
conferir("data por extenso", formatarFato(fato("data", "2026-11-08")) === "8 de novembro de 2026");
conferir("hora cheia", formatarFato(fato("hora", "12:00")) === "12h");
conferir("hora e minutos", formatarFato(fato("hora", "13:30")) === "13h30");
conferir("duração em horas e minutos", formatarFato(fato("minutos", 330)) === "5h30");
conferir("duração em horas", formatarFato(fato("minutos", 300)) === "5 horas" && formatarFato(fato("minutos", 60)) === "1 hora");
conferir("duração em minutos", formatarFato(fato("minutos", 30)) === "30 minutos");
conferir("dinheiro", formatarFato(fato("dinheiro", 85)) === "R$ 85,00");
conferir("lista", formatarFato(fato("lista", ["a", "b"])) === "a; b");
conferir("fato a confirmar", formatarFato({ ...fato("data"), valor: undefined, situacao: "confirmar-no-edital" }) === "confirmar no edital");
conferir("dias até a prova", diasAte("2026-11-08", new Date(2026, 9, 30)) === 9 && diasAte("2026-11-08", new Date(2026, 10, 8)) === 0 && diasAte("2026-11-08", new Date(2026, 10, 9)) === -1);
conferir("numeração até 2016", areaPelaNumeracao(2015, 1).area === "humanas" && areaPelaNumeracao(2015, 46).area === "natureza" && areaPelaNumeracao(2015, 93).lingua && areaPelaNumeracao(2015, 136).area === "matematica");
conferir("numeração desde 2017", areaPelaNumeracao(2023, 3).lingua && areaPelaNumeracao(2023, 46).area === "humanas" && areaPelaNumeracao(2023, 100).area === "natureza" && areaPelaNumeracao(2023, 180).area === "matematica" && areaPelaNumeracao(2023, 181) === null);
conferir("dia pela numeração", areaPelaNumeracao(2023, 90).dia === 1 && areaPelaNumeracao(2023, 91).dia === 2);
conferir("competência da habilidade", competenciaDaHabilidade("linguagens", 12) === 4 && competenciaDaHabilidade("natureza", 20) === 6 && competenciaDaHabilidade("humanas", 30) === 6 && competenciaDaHabilidade("matematica", 27) === 7);
conferir("faixas cobrem H1 a H30 sem buraco", AREAS_DO_ENEM.every((a) => FAIXAS_DO_ENEM[a].every(([de], i, l) => (i === 0 ? de === 1 : de === l[i - 1][1] + 1)) && FAIXAS_DO_ENEM[a].at(-1)[1] === 30));
const inc = calcularIncidencia(
  [
    { ano: 2023, area: "matematica", objeto: "mat-numeros", habilidade: 3 },
    { ano: 2023, area: "matematica", objeto: "mat-numeros", habilidade: 16 },
    { ano: 2022, area: "matematica", objeto: "mat-geometria", habilidade: 8 },
    { ano: 2010, area: "matematica", objeto: "mat-geometria", habilidade: 8 },
  ],
  2,
);
conferir("incidência: só as últimas edições", inc.base.anos.join() === "2022,2023" && inc.base.classificadas === 3);
conferir("incidência: ordem e parte", inc.objetos.matematica[0].id === "mat-numeros" && inc.objetos.matematica[0].questoes === 2 && inc.objetos.matematica[0].parte === 66.7);

// ── 2. Matriz ──
const matriz = tentar("matriz.yml", carregarMatriz);
if (matriz) {
  const objetos = todosOsObjetos(matriz);
  conferir("matriz: 120 habilidades", AREAS_DO_ENEM.reduce((s, a) => s + matriz.areas[a].competencias.flatMap((c) => c.habilidades).length, 0) === 120);
  conferir("matriz: objetos do anexo nas 4 áreas", AREAS_DO_ENEM.every((a) => matriz.areas[a].objetos.length > 0));
  conferir("matriz: tópico acha o objeto", acharNaMatriz(matriz, "mat-numeros-porcentagem")?.objeto.id === "mat-numeros" && acharNaMatriz(matriz, "mat-numeros")?.topico === undefined && acharNaMatriz(matriz, "mat-inexistente") === null);
  conferir("matriz: 5 competências da redação", matriz.redacao.competencias.length === 5);
  console.log(`matriz: ${objetos.length} objetos, ${objetos.reduce((s, o) => s + o.topicos.length, 0)} tópicos`);
  const bruta = lerYaml("content/enem/matriz.yml");
  const semH5 = structuredClone(bruta);
  semH5.areas.matematica.objetos.forEach((o) => (o.habilidades = o.habilidades.filter((h) => h !== 5)));
  recusa("matriz: habilidade sem objeto é recusada", () => validarMatriz(semH5), "H5");
  const topicoTorto = structuredClone(bruta);
  topicoTorto.areas.matematica.objetos[0].topicos[0].id = "mat-outro-porcentagem";
  recusa("matriz: tópico fora do objeto é recusado", () => validarMatriz(topicoTorto), "deve começar com o id do objeto");
}

// ── 3. Edição ──
const edicao = tentar("edicao.yml", carregarEdicao);
if (edicao) {
  const bruta = lerYaml("content/enem/edicao.yml");
  const semDia = structuredClone(bruta);
  delete semDia.fatos["aplicacao-dia-1"];
  recusa("edição: fato usado pelas páginas não pode faltar", () => validarEdicao(semDia), "aplicacao-dia-1");
  const jornal = structuredClone(bruta);
  jornal.fontes["edital-64"].url = "https://g1.globo.com/x";
  recusa("edição: só fonte oficial", () => validarEdicao(jornal), "oficial");
  const semTrecho = structuredClone(bruta);
  delete semTrecho.fatos["caneta"].trecho;
  recusa("edição: fato sem trecho conferido é recusado", () => validarEdicao(semTrecho), "trecho");
  const aConfirmar = structuredClone(bruta);
  aConfirmar.fatos["resultado-data"].valor = "2027-01-15";
  recusa("edição: fato a confirmar não leva valor", () => validarEdicao(aConfirmar), "não leva");
  const { escreverFato } = await import("./enem-fatos.mjs");
  conferir("edição: o roteiro do EPUB escreve cada fato igual ao site", Object.values(edicao.fatos).every((f) => escreverFato(f) === formatarFato(f)));
  conferir("edição: substitui o fato no texto", substituirFatos("Prova em {{enem:aplicacao-dia-1}}.", edicao, "x") === "Prova em 8 de novembro de 2026.");
  recusa("edição: fato inexistente na aula para a montagem", () => substituirFatos("{{enem:nao-existe}}", edicao, "aula.md"), "não existe");
  conferir("edição: duração do 1º dia bate com os horários", edicao.fatos["duracao-dia-1"].valor === 330 && edicao.fatos["prova-inicio"].valor === "13:30" && edicao.fatos["prova-fim-dia-1"].valor === "19:00");
  conferir("edição: duração do 2º dia bate com os horários", edicao.fatos["duracao-dia-2"].valor === 300 && edicao.fatos["prova-fim-dia-2"].valor === "18:30");
  for (const f of Object.values(edicao.fatos)) conferir(`edição: ${f.id} conferido depois da publicação da fonte`, !edicao.fontes[f.fonte].publicado || f.conferido >= edicao.fontes[f.fonte].publicado);
}

// ── 4. Aulas, mapa curricular e fatos citados ──
const trilhas = carregarAulas();
const aulaExiste = new Set(trilhas.flatMap((t) => t.aulas.map((a) => `${t.slug}/${a.slug}`)));
const mapas = tentar("mapa curricular", carregarMapas) ?? new Map();
if (matriz) {
  for (const [trilha, mapa] of mapas)
    for (const [aula, m] of Object.entries(mapa.aulas)) {
      conferir(`mapa ${trilha}/${aula}: a aula existe`, aulaExiste.has(`${trilha}/${aula}`));
      for (const id of m.objetos) {
        const achado = acharNaMatriz(matriz, id);
        conferir(`mapa ${trilha}/${aula}: objeto ${id} existe na matriz`, Boolean(achado));
      }
    }
}
for (const t of trilhas)
  for (const a of t.aulas) {
    const citados = fatosCitados(a.corpo);
    if (edicao) for (const id of citados) conferir(`${a.arquivo}: {{enem:${id}}} existe`, Boolean(edicao.fatos[id]));
  }
const doPercurso = trilhas.filter((t) => t.slug.startsWith("enem-"));
for (const t of doPercurso) conferir(`trilha ${t.slug}: disciplina enem`, t.area === "enem", t.area);

// ── 5. Exercícios com etiquetas do ENEM ──
const exercicios = tentar("exercícios", carregarExercicios) ?? [];
const comEtiqueta = exercicios.filter((e) => e.ex.enem);
if (matriz)
  for (const { ex, arquivo } of comEtiqueta) {
    if (!ex.enem.objeto) continue;
    const achado = acharNaMatriz(matriz, ex.enem.objeto);
    conferir(`${arquivo} ${ex.id}: objeto ${ex.enem.objeto} existe`, Boolean(achado));
    if (achado) conferir(`${arquivo} ${ex.id}: objeto é da área ${ex.enem.area}`, achado.objeto.area === ex.enem.area, achado.objeto.area);
  }
for (const { ex, arquivo, trilha, aula } of exercicios.filter((e) => e.trilha.startsWith("enem-"))) {
  if (!ehOrientacao(trilha, aula) && !ehRedacao(trilha, aula)) conferir(`${arquivo} ${ex.id}: exercício do percurso tem as etiquetas do ENEM (area, habilidade, objeto)`, Boolean(ex.enem?.objeto));
  conferir(`${arquivo} ${ex.id}: nasce em revisão`, ex.revisao.status === "em-revisao");
}

// ── 6. Questões oficiais classificadas ──
let classificacoes = [];
if (matriz) {
  classificacoes = tentar("questões oficiais", () => carregarClassificacoes(matriz)) ?? [];
  for (const c of classificacoes) for (const a of c.aulas) conferir(`${c.id}: a aula ${a} existe`, aulaExiste.has(a));
  const imp = importadasDe(2023);
  conferir("provas importadas: todo id de 2023 tem área pela numeração", [...imp.values()].every((q) => areaPelaNumeracao(2023, q.n)));
  conferir("provas importadas: anos de 2009 a 2023", anosImportados().length >= 15);
  console.log(`questões oficiais classificadas: ${classificacoes.length}`);
  // Uma classificação com área errada é recusada.
  const exemplo = [...imp.values()].find((q) => q.n === 136);
  if (exemplo) {
    const { validarClassificacoes } = await import("../lib/enem.ts");
    const errada = { ano: 2023, questoes: [{ id: exemplo.id, area: "natureza", competencia: 1, habilidade: 1, objeto: "nat-fis-ondas", dificuldade: 1, situacao: "a-confirmar", gabarito: "ABCDE"[exemplo.resposta], resolucao: "x ".repeat(30), enganos: {} }] };
    recusa("questão oficial: área contra a numeração é recusada", () => validarClassificacoes(errada, "content/enem/questoes-oficiais/2023.yml", imp, (id) => acharNaMatriz(matriz, id)?.objeto ?? null), "pela numeração");
    const gabaritoErrado = { ano: 2023, questoes: [{ id: exemplo.id, area: "matematica", competencia: 1, habilidade: 3, objeto: "mat-numeros", dificuldade: 1, situacao: "a-confirmar", gabarito: "ABCDE"[(exemplo.resposta + 1) % 5], resolucao: "x ".repeat(30), enganos: {} }] };
    recusa("questão oficial: gabarito diferente do importado é recusado", () => validarClassificacoes(gabaritoErrado, "content/enem/questoes-oficiais/2023.yml", imp, (id) => acharNaMatriz(matriz, id)?.objeto ?? null), "gabarito importado");
    recusa("questão oficial: id que não existe é recusado", () => validarClassificacoes({ ano: 2023, questoes: [{ id: "enem-2023-999" }] }, "content/enem/questoes-oficiais/2023.yml", imp, () => null), "não existe");
  }
}

// ── 6b. Diagnóstico e minissimulados ──
if (matriz) {
  const sim = tentar("simulados", () => carregarSimulados(matriz));
  if (sim) {
    conferir("diagnóstico: 60 questões, 15 por área", Object.values(sim.diagnostico).flat().length === 60);
    const porId = new Map(classificacoes.map((c) => [c.id, c]));
    conferir("diagnóstico: cada questão ligada a uma habilidade", Object.values(sim.diagnostico).flat().every((id) => porId.get(id)?.habilidade));
    conferir("minissimulados: 10 por área", AREAS_DO_ENEM.every((a) => sim.minissimulados.filter((m) => m.area === a).length === 10));
  }
}

// ── 7. Incidência em dia ──
if (matriz) {
  const atual = existeArquivo("content/enem/incidencia.yml") ? fs.readFileSync(path.join(raiz, "content/enem/incidencia.yml"), "utf8") : "";
  conferir("incidencia.yml em dia com as classificações (npm run incidencia:enem)", atual === textoDaIncidencia());
}

// ── 8. Redação ──
const redacao = tentar("redação", carregarRedacao);
if (redacao) {
  const anos = redacao.temas.map((t) => `${t.ano}-${t.aplicacao}`);
  conferir("temas oficiais sem repetição", new Set(anos).size === anos.length);
  for (const p of redacao.propostas) conferir(`proposta ${p.id}: textos com fonte`, p.textos.every((t) => t.fonte));
  const ids = new Set(redacao.repertorio.map((r) => r.id));
  conferir("repertório sem id repetido", ids.size === redacao.repertorio.length);
}

// ── 9. Seções do percurso ──
conferir("seções do ENEM: trilha de orientação não cobra", conferirSecoesDoEnem("enem-como-funciona", "## Nada").length === 0);
conferir("seções do ENEM: aula de conteúdo cobra as três", conferirSecoesDoEnem("enem-reta-final", "## Nada").length === 3);
conferir("seções do ENEM: aceita os títulos", conferirSecoesDoEnem("enem-reta-final", "## Como isso cai no ENEM\n## Questão comentada\n## Para aprofundar").length === 0);
conferir("seções do ENEM: redação não cobra questão comentada", conferirSecoesDoEnem("enem-redacao", "## Como isso cai no ENEM\n## Para aprofundar").length === 0 && conferirSecoesDoEnem("enem-reta-final", "## Como isso cai no ENEM\n## Para aprofundar", "redacao-expressa-x").length === 0);
conferir("seções do ENEM: aula de orientação na reta final não cobra", conferirSecoesDoEnem("enem-reta-final", "## Nada", "a-vespera-e-o-dia-da-prova").length === 0);

// ── 10. Plano de estudos (lib/enem-plano.ts) ──
{
  const { gerarPlano, icsDoPlano } = await import("../lib/enem-plano.ts");
  const topicos = ["matematica", "natureza", "linguagens", "humanas"].flatMap((area, i) => Array.from({ length: 6 }, (_, j) => ({ id: `${area}-t${j}`, nome: `${area} ${j}`, area, peso: 10 - j + i, href: "/enem/praticar" })));
  const base = { hoje: "2026-10-30", prova: "2026-11-08", modo: "reta-final", horasPorSemana: 10, dias: [1, 2, 3, 4, 5, 6], trabalha: false, topicos };
  const itens = (pl) => pl.semanas.flatMap((s) => s.itens);
  const porDia = (pl) => {
    const m = new Map();
    for (const i of itens(pl)) m.set(i.dia, (m.get(i.dia) ?? 0) + i.minutos);
    return m;
  };
  const p1 = gerarPlano(base);
  conferir("plano: reta final até a véspera, em 2 semanas", p1.semanas.length === 2 && itens(p1).every((i) => i.dia < "2026-11-08") && p1.diasAteAProva === 9);
  conferir("plano: só nos dias escolhidos", itens(p1).every((i) => new Date(`${i.dia}T12:00:00Z`).getUTCDay() !== 0));
  conferir("plano: nenhum dia passa do tempo que a pessoa tem", [...porDia(p1).values()].every((m) => m <= Math.round(600 / 6)));
  conferir("plano: redação toda semana e simulado na reta final", p1.semanas.every((s) => s.itens.some((i) => i.tipo === "redacao")) && itens(p1).some((i) => i.tipo === "simulado"));
  conferir("plano: revisões espaçadas depois do estudo", itens(p1).filter((i) => i.tipo === "revisao").every((r) => itens(p1).some((e) => e.tipo === "estudo" && e.topico === r.topico && e.dia < r.dia)));
  const amanha = gerarPlano({ ...base, hoje: "2026-11-07" });
  conferir("plano: prova amanhã (só hoje, uma semana)", amanha.semanas.length === 1 && itens(amanha).every((i) => i.dia === "2026-11-07") && amanha.diasAteAProva === 1);
  const passou = gerarPlano({ ...base, hoje: "2026-12-01", modo: "3-meses" });
  conferir("plano: prova já passou (vale para a próxima, pelo modo)", passou.provaPassou && passou.semanas.length === 13);
  const pouco = gerarPlano({ ...base, horasPorSemana: 1 });
  conferir("plano: pouco tempo (o que não cabe é contado, sem estourar o dia)", pouco.ficaramDeFora > 0 && [...porDia(pouco).values()].every((m) => m <= 60));
  const pesada = gerarPlano({ ...base, modo: "1-mes", prova: null, pesos: { matematica: 4 } });
  const primeiros = itens(pesada).filter((i) => i.tipo === "estudo").slice(0, 8);
  conferir("plano: peso maior põe a área mais vezes no começo", primeiros.filter((i) => i.area === "matematica").length >= 3);
  const ics = icsDoPlano(p1, "19:00", "https://institutolucia.org/pt", new Date("2026-10-30T12:00:00Z"));
  conferir("plano: arquivo de agenda com um evento por dia de estudo", ics.startsWith("BEGIN:VCALENDAR") && (ics.match(/BEGIN:VEVENT/g) ?? []).length === porDia(p1).size && ics.split("\r\n").every((l) => l.length <= 75));
}

// ── 11. Laboratório da TRI e média do Sisu ──
{
  const { estimarTheta, ITENS_ILUSTRATIVOS, probabilidade } = await import("../lib/enem-tri.ts");
  const it = { a: 1.5, b: 0, c: 0.2 };
  conferir("TRI: na dificuldade, a chance é c + (1 − c)/2", Math.abs(probabilidade(it, 0) - 0.6) < 1e-12);
  conferir("TRI: muito abaixo, sobra o chute", Math.abs(probabilidade(it, -20) - 0.2) < 1e-6 && probabilidade(it, 20) > 0.999);
  const coerente = ITENS_ILUSTRATIVOS.map((_, i) => i < 5);
  const incoerente = ITENS_ILUSTRATIVOS.map((_, i) => i >= 5);
  conferir("TRI: mesmos acertos, quem acerta as fáceis fica acima", estimarTheta(ITENS_ILUSTRATIVOS, coerente) > estimarTheta(ITENS_ILUSTRATIVOS, incoerente));
  conferir("TRI: mais acertos coerentes, proficiência maior", estimarTheta(ITENS_ILUSTRATIVOS, ITENS_ILUSTRATIVOS.map((_, i) => i < 7)) > estimarTheta(ITENS_ILUSTRATIVOS, coerente));
  conferir("TRI: acertar ou errar tudo não vai ao infinito", Math.abs(estimarTheta(ITENS_ILUSTRATIVOS, ITENS_ILUSTRATIVOS.map(() => true))) < 4 && Math.abs(estimarTheta(ITENS_ILUSTRATIVOS, ITENS_ILUSTRATIVOS.map(() => false))) < 4);
  const { mediaPonderada } = await import("../lib/enem-sisu.ts");
  const notas = { linguagens: 600, humanas: 650, natureza: 550, matematica: 700, redacao: 800 };
  conferir("Sisu: pesos iguais dão a média simples", mediaPonderada(notas, { linguagens: 1, humanas: 1, natureza: 1, matematica: 1, redacao: 1 }) === 660);
  conferir("Sisu: média ponderada", mediaPonderada(notas, { linguagens: 1, humanas: 1, natureza: 2, matematica: 3, redacao: 1 }) === (600 + 650 + 1100 + 2100 + 800) / 8);
  conferir("Sisu: nota faltando ou fora de 0 a 1000 não calcula", mediaPonderada({ ...notas, redacao: undefined }, { linguagens: 1, humanas: 1, natureza: 1, matematica: 1, redacao: 1 }) === null && mediaPonderada({ ...notas, matematica: 1200 }, { linguagens: 1, humanas: 1, natureza: 1, matematica: 1, redacao: 1 }) === null);
  conferir("Sisu: pesos zerados não calculam", mediaPonderada(notas, { linguagens: 0, humanas: 0, natureza: 0, matematica: 0, redacao: 0 }) === null);
}

console.log(`enem: ${ok} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);

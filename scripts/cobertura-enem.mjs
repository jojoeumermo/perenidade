// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A cobertura do curso ENEM contra a Matriz de Referência: por área, competência, habilidade, objeto e tópico, quantas
// aulas do percurso (ligadas no mapa curricular), quantos exercícios do instituto e quantas questões oficiais
// classificadas. Aponta as lacunas na ordem da incidência. Grava docs/enem/COBERTURA.md e a tabela de fatos,
// docs/enem/FATOS.md (afirmação → fonte → trecho → data → onde aparece). Uso: npm run cobertura:enem
import fs from "node:fs";
import path from "node:path";
import { AREAS_DO_ENEM, fatosCitados, formatarFato, todosOsObjetos } from "../lib/enem.ts";
import { carregarAulas, carregarClassificacoes, carregarEdicao, carregarExercicios, carregarMapas, carregarMatriz, carregarRedacao, raiz } from "./enem-dados.mjs";

const META_EX_HAB = 10;
const matriz = carregarMatriz();
const edicao = carregarEdicao();
const trilhas = carregarAulas();
const mapas = carregarMapas();
const exercicios = carregarExercicios();
const oficiais = carregarClassificacoes(matriz);
const redacao = carregarRedacao();
const incid = (() => {
  const conta = new Map();
  for (const c of oficiais) {
    conta.set(c.objeto, (conta.get(c.objeto) ?? 0) + 1);
    if (c.topico) conta.set(c.topico, (conta.get(c.topico) ?? 0) + 1);
    conta.set(`${c.area}-${c.habilidade}`, (conta.get(`${c.area}-${c.habilidade}`) ?? 0) + 1);
  }
  return conta;
})();

// Aulas do percurso: trilhas enem-* com aula escrita, e o que o mapa curricular liga a cada uma.
const aulasDoPercurso = trilhas.filter((t) => t.slug.startsWith("enem-")).flatMap((t) => t.aulas.map((a) => ({ trilha: t.slug, ...a })));
const aulaPorHab = new Map();
const aulaPorObj = new Map();
const juntar = (mapa, chave, valor) => mapa.set(chave, new Set([...(mapa.get(chave) ?? []), valor]));
for (const [trilha, mapa] of mapas) {
  if (!trilha.startsWith("enem-")) continue;
  for (const [aula, m] of Object.entries(mapa.aulas)) {
    for (const h of m.enem) juntar(aulaPorHab, `${h.area}-${h.habilidade}`, `${trilha}/${aula}`);
    for (const id of m.objetos) {
      juntar(aulaPorObj, id, `${trilha}/${aula}`);
      const obj = todosOsObjetos(matriz).find((o) => id.startsWith(`${o.id}-`));
      if (obj) juntar(aulaPorObj, obj.id, `${trilha}/${aula}`);
    }
  }
}
const exPorHab = new Map();
const exPorObj = new Map();
for (const { ex } of exercicios) {
  if (!ex.enem) continue;
  exPorHab.set(`${ex.enem.area}-${ex.enem.habilidade}`, (exPorHab.get(`${ex.enem.area}-${ex.enem.habilidade}`) ?? 0) + 1);
  if (ex.enem.objeto) {
    exPorObj.set(ex.enem.objeto, (exPorObj.get(ex.enem.objeto) ?? 0) + 1);
    const obj = todosOsObjetos(matriz).find((o) => ex.enem.objeto.startsWith(`${o.id}-`));
    if (obj) exPorObj.set(obj.id, (exPorObj.get(obj.id) ?? 0) + 1);
  }
}
const oficPorHab = (k) => incid.get(k) ?? 0;

// ── Números gerais ──
const exEnem = exercicios.filter((e) => e.ex.enem);
const niveis = [1, 2, 3].map((n) => exEnem.filter((e) => e.ex.dificuldade === n).length);
const posicoes = [0, 0, 0, 0, 0, 0];
for (const { ex } of exercicios.filter((e) => e.trilha.startsWith("enem-")))
  if (ex.tipo === "escolha") posicoes[ex.alternativas.findIndex((a) => a.certa)]++;
const quizPos = [0, 0, 0, 0, 0, 0];
for (const a of aulasDoPercurso) for (const q of a.quiz) if (Number.isInteger(q.resposta)) quizPos[q.resposta]++;
const importadas = fs
  .readdirSync(path.join(raiz, "public/questoes"))
  .filter((n) => /^enem-\d{4}\.json$/.test(n))
  .reduce((s, n) => s + new Set(JSON.parse(fs.readFileSync(path.join(raiz, "public/questoes", n), "utf8")).questoes.map((q) => q.id)).size, 0);

const linhas = [];
const L = (s = "") => linhas.push(s);
L("# Cobertura do curso ENEM");
L();
L("Gerado por `npm run cobertura:enem` (não edite à mão). Método e metas: `docs/ENEM.md`.");
L();
L("## Números gerais");
L();
L(`- Aulas escritas no percurso (trilhas enem-*): **${aulasDoPercurso.length}** em ${trilhas.filter((t) => t.slug.startsWith("enem-")).length} trilhas`);
L(`- Exercícios do instituto com as etiquetas do ENEM: **${exEnem.length}** (meta: 2.000) · níveis 1/2/3: ${niveis.join(" / ")}`);
L(`- Exercícios nas trilhas enem-* (todos): ${exercicios.filter((e) => e.trilha.startsWith("enem-")).length} · posição da certa (A–E): ${posicoes.slice(0, 5).join(" / ")}`);
L(`- Testes das aulas do percurso: ${aulasDoPercurso.reduce((s, a) => s + a.quiz.length, 0)} perguntas · posição da certa (1ª a 5ª opção): ${quizPos.slice(0, 5).join(" / ")}`);
L(`- Questões oficiais classificadas e resolvidas: **${oficiais.length}** de ${importadas} importadas (${((100 * oficiais.length) / importadas).toFixed(1)}%) · anos: ${[...new Set(oficiais.map((c) => c.ano))].sort().join(", ") || "nenhum"}`);
L(`- Redação: ${redacao.temas.length} temas oficiais · ${redacao.propostas.length} propostas de treino · ${redacao.repertorio.length} itens de repertório (${redacao.repertorio.filter((r) => r.coringa).length} coringa)`);
L(`- Fatos da edição ${edicao.edicao}: ${Object.keys(edicao.fatos).length} (${Object.values(edicao.fatos).filter((f) => f.situacao === "confirmar-no-edital").length} a confirmar no edital)`);
L();
L("## Habilidades (meta: cada uma com 1 aula do percurso e 10 exercícios)");
L();
const resumo = [];
for (const area of AREAS_DO_ENEM) {
  const a = matriz.areas[area];
  let comAula = 0;
  let comEx = 0;
  L(`### ${a.nome}`);
  L();
  L("| C | H | Habilidade (resumo nosso) | Aulas | Exercícios | Questões oficiais |");
  L("| --- | --- | --- | --- | --- | --- |");
  for (const c of a.competencias)
    for (const h of c.habilidades) {
      const k = `${area}-${h.numero}`;
      const au = aulaPorHab.get(k)?.size ?? 0;
      const ex = exPorHab.get(k) ?? 0;
      if (au) comAula++;
      if (ex >= META_EX_HAB) comEx++;
      L(`| ${c.numero} | H${h.numero} | ${h.resumo} | ${au} | ${ex} | ${oficPorHab(k)} |`);
    }
  resumo.push({ area: a.nome, comAula, comEx });
  L();
}
L("### Resumo por área");
L();
L("| Área | Habilidades com aula | Com 10+ exercícios |");
L("| --- | --- | --- |");
for (const r of resumo) L(`| ${r.area} | ${r.comAula} de 30 | ${r.comEx} de 30 |`);
const total = resumo.reduce((s, r) => s + r.comAula, 0);
const totalEx = resumo.reduce((s, r) => s + r.comEx, 0);
L(`| **Total** | **${total} de 120 (${((100 * total) / 120).toFixed(0)}%)** | **${totalEx} de 120 (${((100 * totalEx) / 120).toFixed(0)}%)** |`);
L();
L("## Objetos de conhecimento e tópicos (meta: cada um com aula própria)");
L();
L("Ordem: do que mais caiu nas provas classificadas para o que menos caiu (a lacuna mais urgente primeiro).");
L();
let objComAula = 0;
let topComAula = 0;
let topTotal = 0;
const lacunas = [];
for (const area of AREAS_DO_ENEM) {
  L(`### ${matriz.areas[area].nome}`);
  L();
  L("| Objeto / tópico | Questões oficiais | Aulas | Exercícios |");
  L("| --- | --- | --- | --- |");
  const objs = [...matriz.areas[area].objetos].sort((x, y) => (incid.get(y.id) ?? 0) - (incid.get(x.id) ?? 0));
  for (const o of objs) {
    const au = aulaPorObj.get(o.id)?.size ?? 0;
    if (au) objComAula++;
    L(`| **${o.nome}** (\`${o.id}\`) | ${incid.get(o.id) ?? 0} | ${au} | ${exPorObj.get(o.id) ?? 0} |`);
    for (const t of [...o.topicos].sort((x, y) => (incid.get(y.id) ?? 0) - (incid.get(x.id) ?? 0))) {
      topTotal++;
      const at = aulaPorObj.get(t.id)?.size ?? 0;
      if (at) topComAula++;
      else lacunas.push({ id: t.id, nome: t.nome, area, n: incid.get(t.id) ?? 0 });
      L(`| ↳ ${t.nome} (\`${t.id}\`) | ${incid.get(t.id) ?? 0} | ${at} | ${exPorObj.get(t.id) ?? 0} |`);
    }
  }
  L();
}
L(`Objetos com aula: **${objComAula} de ${todosOsObjetos(matriz).length}** · tópicos com aula: **${topComAula} de ${topTotal}**.`);
L();
L("## As 40 lacunas mais urgentes (tópico sem aula, pela incidência)");
L();
for (const l of lacunas.sort((a, b) => b.n - a.n).slice(0, 40)) L(`- ${l.nome} (\`${l.id}\`, ${l.area}): ${l.n} questões oficiais classificadas`);
fs.mkdirSync(path.join(raiz, "docs/enem"), { recursive: true });
fs.writeFileSync(path.join(raiz, "docs/enem/COBERTURA.md"), `${linhas.join("\n")}\n`);

// ── Tabela de fatos ──
const ondeAparece = new Map();
for (const t of trilhas) for (const a of t.aulas) for (const id of fatosCitados(a.corpo + JSON.stringify(a.quiz))) juntar(ondeAparece, id, a.arquivo);
const codigo = [];
const varrer = (pasta) => {
  for (const e of fs.readdirSync(path.join(raiz, pasta), { withFileTypes: true })) {
    const rel = `${pasta}/${e.name}`;
    if (e.isDirectory()) varrer(rel);
    else if (/\.tsx?$/.test(e.name)) codigo.push([rel, fs.readFileSync(path.join(raiz, rel), "utf8")]);
  }
};
varrer("app/[lang]/enem");
varrer("components/enem");
for (const id of Object.keys(edicao.fatos)) for (const [rel, txt] of codigo) if (txt.includes(`"${id}"`)) juntar(ondeAparece, id, rel);
const F = [];
F.push("# Tabela de fatos do curso ENEM");
F.push("");
F.push(`Gerado por \`npm run cobertura:enem\` a partir de \`content/enem/edicao.yml\` (edição ${edicao.edicao}, conferida em ${edicao.conferido}). Não edite à mão: mude o arquivo de dados.`);
F.push("");
F.push("Regra: toda afirmação sobre o exame e os programas vem de fonte oficial, com trecho e data. O que não se confirmou aparece como **confirmar no edital**.");
F.push("");
F.push("| Fato | Valor | Fonte (item) | Trecho conferido | Conferido em | Onde aparece |");
F.push("| --- | --- | --- | --- | --- | --- |");
const cel = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
for (const f of Object.values(edicao.fatos)) {
  const fonte = edicao.fontes[f.fonte];
  F.push(`| ${cel(f.afirmacao)} (\`${f.id}\`) | ${cel(f.valor === undefined ? "**confirmar no edital**" : formatarFato(f))} | [${cel(fonte.titulo)}](${fonte.url})${f.item ? ` (${f.item})` : ""} | ${cel(f.trecho)} | ${f.conferido} | ${[...(ondeAparece.get(f.id) ?? [])].map((x) => `\`${x}\``).join(", ") || "—"} |`);
}
F.push("");
F.push("## Outros fatos conferidos");
F.push("");
F.push("- Matriz de Referência do Enem (competências, habilidades e objetos de conhecimento): " + matriz.fonte.url + ` (conferida em ${matriz.fonte.conferido}; citada no item 3.1 do Edital nº 64/2026).`);
F.push("- Cinco competências da redação: " + matriz.redacao.fonte.url + ` (conferida em ${matriz.redacao.fonte.conferido}).`);
F.push("- Mudança de 2017 (redação, Linguagens e Humanas no 1º domingo; Natureza e Matemática no 2º): https://portal.mec.gov.br/ultimas-noticias/418-enem-946573306/46041-enem-passa-a-ser-realizado-em-dois-domingos-seguidos (conferida em 2026-10-30). Base da área auditada pela numeração (`lib/enem.ts`, `areaPelaNumeracao`).");
F.push("");
fs.writeFileSync(path.join(raiz, "docs/enem/FATOS.md"), `${F.join("\n")}\n`);

console.log(`cobertura: ${total}/120 habilidades com aula, ${totalEx}/120 com 10+ exercícios, ${objComAula}/${todosOsObjetos(matriz).length} objetos e ${topComAula}/${topTotal} tópicos com aula, ${exEnem.length} exercícios com etiquetas, ${oficiais.length} questões oficiais classificadas`);
console.log("gravados docs/enem/COBERTURA.md e docs/enem/FATOS.md");

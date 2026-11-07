// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o mapa dos laboratórios (lib/mapa-dos-laboratorios.ts, NOVAS TAREFAS T21): nenhum laboratório fica de fora
// (toda página em app/[lang]/laboratorios, todo item do catálogo de fora e todo tipo de simulador de aula estão no mapa),
// toda aula citada existe, toda aula com bloco ```simulador aparece no simulador certo, cada um tem "serve para" e
// "para quem" em pt e en, as disciplinas existem, os textos da interface existem em todos os idiomas e não há palavra
// proibida. Uso: npm run testar:mapa-dos-laboratorios
import fs from "node:fs";
import path from "node:path";
import { areaSlugs, areaLabs, LABS } from "../lib/areas.ts";
import { FINALIDADES, MAPA_DOS_LABORATORIOS, TIPOS_DOS_SIMULADORES_DE_AULA, labsDaAula } from "../lib/mapa-dos-laboratorios.ts";
import { TIPOS_DE_SIMULADOR } from "../lib/simuladores-aula.ts";

const raiz = process.cwd();
let ok = 0;
const falhas = [];
const conferir = (nome, cond) => (cond ? ok++ : falhas.push(nome));

const catalogo = JSON.parse(fs.readFileSync(path.join(raiz, "content", "labs-externos", "catalogo.json"), "utf8"));
const ids = MAPA_DOS_LABORATORIOS.map((l) => l.id);
conferir("ids sem repetição", new Set(ids).size === ids.length);

// Toda página de laboratório do site (menos o endereço antigo da planilha, que redireciona) está no mapa.
const pastas = fs.readdirSync(path.join(raiz, "app", "[lang]", "laboratorios"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
for (const p of pastas) {
  if (p === "planilha" || p === "externos") continue;
  conferir(`página /laboratorios/${p} no mapa`, MAPA_DOS_LABORATORIOS.some((l) => l.morada === "site" && l.rota === `/laboratorios/${p}`));
}
// Os laboratórios que abrem na caixa das aulas (lib/areas.ts LABS) também.
for (const id of Object.keys(LABS)) conferir(`LABS.${id} no mapa`, ids.includes(id));
// E as disciplinas que já têm o laboratório na caixa estão entre as disciplinas dele no mapa.
for (const [area, labs] of Object.entries(areaLabs)) {
  for (const id of labs) conferir(`${id} ajuda em ${area} (areaLabs)`, MAPA_DOS_LABORATORIOS.find((l) => l.id === id)?.disciplinas.includes(area));
}

// Todo laboratório de fora do catálogo está no mapa (nenhum fica "sem destino").
for (const l of catalogo) conferir(`externo ${l.id} no mapa`, MAPA_DOS_LABORATORIOS.some((m) => m.id === l.id && m.morada === "fora"));
for (const m of MAPA_DOS_LABORATORIOS.filter((x) => x.morada === "fora")) {
  conferir(`${m.id}: existe no catálogo ou é o gráfico do OWID`, catalogo.some((l) => l.id === m.id) || m.id === "owid-expectativa-vida");
  conferir(`${m.id}: rota aponta para o cartão`, m.rota === `/laboratorios/externos#${m.id}`);
}

// Todo tipo de simulador de aula tem um item no mapa.
for (const tipo of TIPOS_DE_SIMULADOR) conferir(`simulador ${tipo} no mapa`, Object.values(TIPOS_DOS_SIMULADORES_DE_AULA).some((t) => t.includes(tipo)));

// Aulas: cada uma existe; e cada aula com bloco ```simulador está na lista do simulador do tipo dela.
const trilhas = path.join(raiz, "content", "trilhas");
const existe = (chave) => {
  const [t, a] = chave.split("/");
  return fs.existsSync(path.join(trilhas, t, `${a}.md`));
};
const areaDaTrilha = (t) => fs.readFileSync(path.join(trilhas, t, "_trilha.md"), "utf8").match(/^area:\s*(\S+)/m)?.[1];
for (const l of MAPA_DOS_LABORATORIOS) {
  for (const a of l.aulas) conferir(`${l.id}: aula ${a} existe`, existe(a));
  conferir(`${l.id}: aulas sem repetição`, new Set(l.aulas).size === l.aulas.length);
}
for (const t of fs.readdirSync(trilhas)) {
  const pasta = path.join(trilhas, t);
  if (!fs.statSync(pasta).isDirectory()) continue;
  for (const f of fs.readdirSync(pasta).filter((x) => x.endsWith(".md") && x !== "_trilha.md")) {
    const texto = fs.readFileSync(path.join(pasta, f), "utf8");
    for (const m of texto.matchAll(/```simulador\s*\n\s*([a-z-]+)/g)) {
      const tipo = { js: "execucao-js", python: "execucao-python" }[m[1]] ?? m[1];
      const id = Object.entries(TIPOS_DOS_SIMULADORES_DE_AULA).find(([, tipos]) => tipos.includes(tipo))?.[0];
      conferir(`${t}/${f}: simulador ${tipo} listado no mapa`, !!id && MAPA_DOS_LABORATORIOS.find((l) => l.id === id)?.aulas.includes(`${t}/${f.slice(0, -3)}`));
    }
  }
}
// O simulador de aula aponta para uma aula que o traz.
for (const l of MAPA_DOS_LABORATORIOS.filter((x) => x.morada === "aula")) conferir(`${l.id}: rota é uma das aulas`, l.aulas.map((a) => `/trilhas/${a}`).includes(l.rota));

// Campos de cada laboratório.
for (const l of MAPA_DOS_LABORATORIOS) {
  conferir(`${l.id}: finalidade`, FINALIDADES.includes(l.finalidade));
  conferir(`${l.id}: disciplinas`, l.disciplinas.length > 0 && l.disciplinas.every((a) => areaSlugs.includes(a)));
  for (const lang of ["pt", "en"]) {
    conferir(`${l.id}: serve para (${lang})`, l[lang].serve.length >= 20 && l[lang].quem.length >= 10);
  }
  if (l.morada === "aula" || l.id === "owid-expectativa-vida") conferir(`${l.id}: nome próprio`, !!l.nome?.pt && !!l.nome?.en);
  const texto = JSON.stringify(l).toLowerCase();
  conferir(`${l.id}: sem palavra proibida`, !texto.includes("universidade") && !texto.includes("diploma") && !texto.includes("university"));
}
for (const f of FINALIDADES) conferir(`finalidade ${f} tem laboratório`, MAPA_DOS_LABORATORIOS.some((l) => l.finalidade === f));

// Uma aula com simulador recebe o simulador como "nesta aula"; e a disciplina traz outros.
const daAula = labsDaAula("eletricidade-basica-e-seguranca", "a-lei-de-ohm-no-dia-a-dia", "eletricista");
conferir("aula de Ohm: simulador de circuito nesta aula", daAula.some((x) => x.lab.id === "aula:circuito" && x.nestaAula));
conferir("aula de Ohm: laboratório de elétrica da disciplina", daAula.some((x) => x.lab.id === "eletrica"));

// Textos da interface (labs.mapa) em todos os idiomas, com todas as finalidades.
const CHAVES = ["porFinalidade", "porDisciplina", "comoAchar", "serve", "quem", "onde", "ajudaEm", "aulas", "abrir", "ondeSite", "ondeFora", "ondeAula", "nenhumaAula", "daAula", "nestaAula", "daDisciplina", "todos", "maisAulas", "outrosLugares", "ferramentas", "ferramentasServe", "estudio", "estudioServe", "jogos", "jogosServe", "externosTodos"];
for (const lang of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const d = JSON.parse(fs.readFileSync(path.join(raiz, "i18n", `${lang}.json`), "utf8"));
  const m = d.labs?.mapa;
  conferir(`${lang}: labs.mapa`, !!m);
  if (!m) continue;
  for (const c of CHAVES) conferir(`${lang}: labs.mapa.${c}`, typeof m[c] === "string" && m[c].length > 0);
  for (const f of FINALIDADES) conferir(`${lang}: finalidade ${f}`, !!m.finalidades?.[f]?.titulo && !!m.finalidades?.[f]?.serve);
  const texto = JSON.stringify(m).toLowerCase();
  conferir(`${lang}: sem palavra proibida`, !/universidade|diploma|university/.test(texto));
}

if (falhas.length) {
  console.error(`mapa dos laboratórios: ${falhas.length} falha(s):\n - ${falhas.join("\n - ")}`);
  process.exit(1);
}
console.log(`mapa dos laboratórios: ${ok} verificações, ${MAPA_DOS_LABORATORIOS.length} laboratórios em ${FINALIDADES.length} finalidades, tudo certo.`);

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Mostra de onde continuar: para cada disciplina, quantas aulas do roteiro já existem e quais são as próximas.
// O roteiro de cada trilha fica em content/trilhas/<trilha>/plano.json; uma aula conta como pronta quando
// existe um arquivo com o mesmo slug, não importa se foi escrita pela equipe ou enviada por um voluntário.
//
//   npm run proximo                    resumo de todas as disciplinas
//   npm run proximo -- musica          as próximas aulas de uma disciplina
//   npm run proximo -- musica 10       quantas listar (padrão: 5)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lerCabecalho } from "./cabecalho.mjs";

const pasta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../content/trilhas");
const [filtro, quantas = "5"] = process.argv.slice(2);
const etapas = ["fundamental", "medio", "superior"];

const trilhas = fs
  .readdirSync(pasta, { withFileTypes: true })
  .filter((entrada) => entrada.isDirectory())
  .map((entrada) => {
    const dir = path.join(pasta, entrada.name);
    const { dados: data } = lerCabecalho(fs.readFileSync(path.join(dir, "_trilha.md"), "utf8"));
    const prontas = new Set(fs.readdirSync(dir).filter((nome) => /^[a-z0-9-]+\.md$/.test(nome) && nome !== "_trilha.md").map((nome) => nome.replace(/^\d+-/, "").replace(/\.md$/, "")));
    const arquivo = path.join(dir, "plano.json");
    const plano = fs.existsSync(arquivo) ? JSON.parse(fs.readFileSync(arquivo, "utf8")) : [];
    return { slug: entrada.name, titulo: data.titulo, area: data.area, etapa: data.etapa, ordem: data.ordem ?? 999, plano, prontas, faltam: plano.filter((item) => !prontas.has(item.slug)) };
  })
  .sort((a, b) => a.area.localeCompare(b.area) || etapas.indexOf(a.etapa) - etapas.indexOf(b.etapa) || a.ordem - b.ordem);

const areas = [...new Set(trilhas.map((trilha) => trilha.area))];

if (!filtro) {
  let prontas = 0;
  let total = 0;
  for (const area of areas) {
    const daArea = trilhas.filter((trilha) => trilha.area === area);
    const feitas = daArea.reduce((soma, trilha) => soma + trilha.prontas.size, 0);
    const previstas = daArea.reduce((soma, trilha) => soma + Math.max(trilha.plano.length, trilha.prontas.size), 0);
    const proxima = daArea.find((trilha) => trilha.faltam.length > 0);
    prontas += feitas;
    total += previstas;
    console.log(`${area.padEnd(26)} ${String(feitas).padStart(3)} de ${String(previstas).padStart(3)}   ${proxima ? `próxima: ${proxima.faltam[0].titulo} (${proxima.slug})` : "roteiro completo"}`);
  }
  console.log(`\nTotal: ${prontas} aulas prontas de ${total} previstas, em ${areas.length} disciplinas com trilha.`);
} else {
  const daArea = trilhas.filter((trilha) => trilha.area === filtro || trilha.slug === filtro);
  if (daArea.length === 0) {
    console.error(`Nenhuma trilha da disciplina "${filtro}". Disciplinas com trilha: ${areas.join(", ")}`);
    process.exit(1);
  }
  let restam = Number(quantas) || 5;
  for (const trilha of daArea) {
    console.log(`\n${trilha.titulo} (${trilha.etapa}) — ${trilha.prontas.size} de ${Math.max(trilha.plano.length, trilha.prontas.size)} prontas`);
    for (const item of trilha.faltam.slice(0, Math.max(restam, 0))) {
      console.log(`  falta: ${item.titulo}\n         content/trilhas/${trilha.slug}/${item.slug}.md`);
      restam--;
    }
  }
}

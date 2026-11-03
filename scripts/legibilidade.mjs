// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Linguagem simples verificada (Etapa 4, R1-88): mede o índice de leitura (lib/legibilidade.ts) de todas as aulas das
// trilhas de entrada (etapa "fundamental" e área "alfabetizacao"), grava docs/legibilidade.csv (aula, índice, palavras
// por frase) e lista as candidatas a ganhar uma versão fácil (índice abaixo de 50). As versões fáceis são escritas e
// revisadas por educadores ("<aula>.facil.md" ao lado da aula); este roteiro não escreve nenhuma.
//
// Uso: npm run legibilidade            (grava o CSV e mostra as candidatas)
//      npm run legibilidade -- --conferir   (só mostra; não grava)
import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import { medirLeitura, textoParaMedir } from "../lib/legibilidade.ts";

const RAIZ = path.resolve(import.meta.dirname, "..");
const TRILHAS = path.join(RAIZ, "content", "trilhas");
const SAIDA = path.join(RAIZ, "docs", "legibilidade.csv");
const LIMITE = 50;

/** O mesmo filtro de lib/content.ts (eOriginal): sem traduções nem versões fáceis. */
const eAula = (nome) => nome !== "_trilha.md" && /^(?:\d+-)?[a-z0-9-]+\.md$/.test(nome);

const linhas = [];
for (const pasta of fs.readdirSync(TRILHAS, { withFileTypes: true })) {
  if (!pasta.isDirectory()) continue;
  const base = path.join(TRILHAS, pasta.name);
  const arquivoDaTrilha = path.join(base, "_trilha.md");
  if (!fs.existsSync(arquivoDaTrilha)) continue;
  const trilha = parseFrontmatter(fs.readFileSync(arquivoDaTrilha, "utf8")).data;
  if (trilha.ativo === false) continue;
  if (trilha.etapa !== "fundamental" && trilha.area !== "alfabetizacao") continue;
  for (const nome of fs.readdirSync(base).filter(eAula).sort()) {
    const { data, content } = parseFrontmatter(fs.readFileSync(path.join(base, nome), "utf8"));
    if (data.ativo === false) continue;
    const medida = medirLeitura(textoParaMedir(content));
    if (!medida) continue;
    const slug = nome.replace(/\.md$/, "").replace(/^\d+-/, "");
    const facil = fs.existsSync(path.join(base, nome.replace(/\.md$/, ".facil.md")));
    linhas.push({ aula: `${pasta.name}/${slug}`, indice: medida.indice, palavrasPorFrase: medida.palavrasPorFrase, facil });
  }
}
linhas.sort((a, b) => a.aula.localeCompare(b.aula));

const csv = ["aula,indice,palavras_por_frase", ...linhas.map((l) => `${l.aula},${l.indice.toFixed(1)},${l.palavrasPorFrase.toFixed(1)}`)].join("\n") + "\n";
if (!process.argv.includes("--conferir")) {
  fs.writeFileSync(SAIDA, csv);
  console.log(`Gravado: ${path.relative(RAIZ, SAIDA)} (${linhas.length} aulas de entrada).`);
}

const candidatas = linhas.filter((l) => l.indice < LIMITE).sort((a, b) => a.indice - b.indice);
const semVersao = candidatas.filter((l) => !l.facil);
console.log(`\nCandidatas a versão fácil (índice abaixo de ${LIMITE}): ${candidatas.length}, ${semVersao.length} ainda sem "<aula>.facil.md".`);
for (const l of semVersao) console.log(`  ${l.indice.toFixed(1).padStart(5)}  ${l.aula}  (${l.palavrasPorFrase.toFixed(1)} palavras por frase)`);
console.log("\nA fórmula e a fonte estão em lib/legibilidade.ts. As versões fáceis são dos educadores (Etapa 3).");

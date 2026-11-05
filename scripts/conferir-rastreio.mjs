// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere, depois do build, quantos arquivos cada função do servidor leva junto (.next/server/**/*.nft.json). A Vercel
// empacota esses arquivos em cada função: quando um módulo que lê o disco com caminho dinâmico entra no layout raiz (ou
// noutro arquivo que quase toda página importa), o rastreio leva o projeto inteiro (public/, components/, app/, lib/,
// scripts/) em quase todas as funções, e o envio do deploy passou de 45 minutos (03/11/2026: 1,44 milhão de arquivos,
// contra 450 mil na onda 1 da Escola, que publicou em 17 min).
//
// Uma função leva "o projeto inteiro" quando traz arquivos de components/ (o código-fonte não precisa ir junto: o build
// já o compilou). Hoje (03/11/2026, depois do conserto) são 3: a aula, o cordel da aula e o guia de contribuição, com
// 589 mil arquivos no total. Os limites deixam folga pequena de propósito.
// Uso: npm run conferir:rastreio (depois de npm run build).
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const servidor = path.join(raiz, ".next", "server");
// 05/11/2026: 700 mil → 760 mil. O conteúdo novo (3.935 exercícios, 681 aulas no modelo de 9 partes) levou o total a
// 724 mil, só por mais arquivos em content/ (sem módulo novo lendo disco no layout). Deploys medidos: 680 mil em 25–29
// min. Acima de ~760 mil o envio fica perto dos 45 min da Vercel: aí é preciso tirar content/acervo e content/exercicios
// das funções que não os leem na hora (outputFileTracingExcludes), não subir este número de novo.
const LIMITE_TOTAL = 760_000;
const LIMITE_FUNCOES_COM_PROJETO = 6;

if (!fs.existsSync(servidor)) {
  console.error("Sem .next/server: rode npm run build antes.");
  process.exit(1);
}

const funcoes = [];
const andar = (pasta) => {
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name);
    if (e.isDirectory()) andar(p);
    else if (e.name.endsWith(".nft.json")) {
      const arquivos = JSON.parse(fs.readFileSync(p, "utf8")).files.map((f) => path.relative(raiz, path.resolve(path.dirname(p), f)).replaceAll("\\", "/"));
      funcoes.push({ nome: path.relative(servidor, p).replaceAll("\\", "/").replace(/\.nft\.json$/, ""), total: arquivos.length, projeto: arquivos.some((a) => a.startsWith("components/")) });
    }
  }
};
andar(servidor);

const total = funcoes.reduce((s, f) => s + f.total, 0);
const comProjeto = funcoes.filter((f) => f.projeto).sort((a, b) => b.total - a.total);
console.log(`Rastreio: ${funcoes.length} funções, ${total.toLocaleString("pt-BR")} arquivos no total (limite ${LIMITE_TOTAL.toLocaleString("pt-BR")}).`);
console.log(`Funções que levam o projeto inteiro: ${comProjeto.length} (limite ${LIMITE_FUNCOES_COM_PROJETO}).`);
for (const f of comProjeto.slice(0, 15)) console.log(`  ${String(f.total).padStart(6)}  ${f.nome}`);

const erros = [];
if (total > LIMITE_TOTAL) erros.push(`total de arquivos rastreados acima do limite (${total} > ${LIMITE_TOTAL})`);
if (comProjeto.length > LIMITE_FUNCOES_COM_PROJETO) erros.push(`${comProjeto.length} funções levam o projeto inteiro (limite ${LIMITE_FUNCOES_COM_PROJETO})`);
if (erros.length) {
  console.error(`\nFalhou: ${erros.join("; ")}.`);
  console.error("Procure o módulo que lê o disco (fs) com caminho dinâmico e entrou no layout raiz ou num componente global; mova o que o layout precisa para um módulo só de textos (exemplo: lib/escola/textos-da-presenca.ts).");
  process.exit(1);
}

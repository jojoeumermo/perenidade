// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: confere e importa os lotes de casos novos (content/vale-o-escrito/novos-casos/*.json, formato
// ArquivoDeEntradas, um arquivo por recorte). A lógica está em lib/vale-o-escrito/novos-casos.ts (a mesma do teste).
//
//   npm run vale-o-escrito:importar                       só confere e mostra o relatório (não grava nada)
//   npm run vale-o-escrito:importar -- --sql fila.sql     gera o SQL que põe os casos na FILA da curadoria
//                                                         (interno.vale_fila), o mesmo caminho da entrada manual do
//                                                         painel; rodar no SQL Editor do Supabase
//   npm run vale-o-escrito:importar -- --arquivos         junta os casos a content/vale-o-escrito/entradas/<dossiê>.json,
//                                                         do jeito que estão no lote (pendente-curadoria não vai ao ar:
//                                                         dados.ts os separa em `pendentes`)
//   ... -- --lote dinheiro-publico                        só um lote (nome do arquivo sem .json)
//
// Nunca duplica: id já presente nos arquivos de entradas é pulado (já importado); LINK de fonte já usado por outra entrada
// barra a entrada nova. Só aceita caso com fonte oficial
// e situação jurídica (decisão da coordenação). Nunca grava "aprovada" por conta própria: aprovar é da curadoria.
// Atenção: `npm run vale-o-escrito:exportar` reescreve os arquivos de entradas a partir do banco; o caminho que dura é a
// fila (--sql). O --arquivos serve para a curadoria ver os pendentes no site de teste antes de o banco ter os casos.
//
// Sai com código 1 se alguma entrada foi barrada.
import fs from "node:fs";
import path from "node:path";
import { SLUGS_DOS_DOSSIES } from "../../lib/vale-o-escrito/catalogo.ts";
import { conferirLote, documentoDaEntrada, indiceDeExistentes, juntarAoArquivo, sqlDaFila } from "../../lib/vale-o-escrito/novos-casos.ts";

const argumentos = process.argv.slice(2);
const valor = (nome) => {
  const i = argumentos.indexOf(nome);
  return i >= 0 ? argumentos[i + 1] : null;
};
const destinoSql = valor("--sql");
const gravarArquivos = argumentos.includes("--arquivos");
const soLote = valor("--lote");

const pastaVale = path.join(process.cwd(), "content", "vale-o-escrito");
const pastaLotes = path.join(process.cwd(), "content", "vale-o-escrito", "novos-casos");
const lerJson = (arquivo) => JSON.parse(fs.readFileSync(arquivo, "utf8"));

const existentes = {};
for (const slug of SLUGS_DOS_DOSSIES) {
  try {
    existentes[slug] = lerJson(path.join(pastaVale, "entradas", `${slug}.json`));
  } catch {
    existentes[slug] = { dossie: slug, pessoas: [], organizacoes: [], ligacoes: [], entradas: [] };
  }
}

let nomes = [];
try {
  nomes = fs.readdirSync(pastaLotes).filter((n) => n.endsWith(".json")).sort();
} catch {
  console.error("Não há a pasta content/vale-o-escrito/novos-casos.");
  process.exit(2);
}
if (soLote) nomes = nomes.filter((n) => n === `${soLote}.json`);

const vistos = indiceDeExistentes(Object.values(existentes));
const docs = [];
let barradasTotal = 0;
for (const nome of nomes) {
  const lote = lerJson(path.join(pastaLotes, nome));
  const { aceitas, barradas, jaImportadas } = conferirLote(lote, [], vistos);
  barradasTotal += barradas.length;
  console.log(`${nome}: ${aceitas.length} aceita(s), ${barradas.length} barrada(s), ${jaImportadas.length} já importada(s) antes`);
  for (const b of barradas) console.log(`  - ${b}`);
  for (const en of aceitas) docs.push(documentoDaEntrada(lote, en));
  if (gravarArquivos && aceitas.length) {
    const porDossie = Map.groupBy(aceitas, (en) => en.dossie);
    for (const [slug, lista] of porDossie) {
      const { arquivo, conflitos } = juntarAoArquivo(existentes[slug], lote, lista);
      for (const c of conflitos) console.log(`  - conflito: ${c}`);
      barradasTotal += conflitos.length;
      existentes[slug] = arquivo;
      fs.writeFileSync(path.join(pastaVale, "entradas", `${slug}.json`), `${JSON.stringify(arquivo, null, 2)}\n`, "utf8");
      console.log(`  gravou entradas/${slug}.json (${arquivo.entradas.length} entrada(s) no total)`);
    }
  }
}

if (destinoSql) {
  fs.writeFileSync(destinoSql, sqlDaFila(docs, nomes.join(", ")), "utf8");
  console.log(`\nSQL da fila com ${docs.length} caso(s) em ${destinoSql}. Rodar no SQL Editor do Supabase; a curadoria aprova no painel.`);
}
console.log(`\n${docs.length} caso(s) prontos para a curadoria; ${barradasTotal} barrado(s).`);
if (barradasTotal) process.exit(1);

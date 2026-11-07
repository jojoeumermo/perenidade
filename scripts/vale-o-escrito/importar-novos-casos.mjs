// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: junta os lotes de casos novos (content/vale-o-escrito/novos-casos/*.json) aos arquivos dos dossiês
// (content/vale-o-escrito/entradas/<dossie>.json), o mesmo lugar onde estão os 18 casos iniciais e onde o exportador
// (scripts/vale-o-escrito/exportar.mjs) grava o que a curadoria aprova. Os 18 iniciais não estão no banco: foram
// cadastrados direto em arquivo; por isso este script trabalha em arquivo e NÃO escreve no banco.
//
//   node --import ./scripts/carregar-ts.mjs scripts/vale-o-escrito/importar-novos-casos.mjs            mostra o que entraria (seco)
//   node --import ./scripts/carregar-ts.mjs scripts/vale-o-escrito/importar-novos-casos.mjs --gravar   grava
//   ... -- --lote violencia-policial-chacinas.json                                                     só um lote
//
// Regras:
//  - cada lote é conferido por lib/vale-o-escrito/dados.ts (conferirArquivo, as mesmas regras da publicação); entrada
//    que não passa fica de fora e o motivo sai no relatório;
//  - sem duplicar: entrada com id já existente ou com QUALQUER link de fonte já usado no dossiê é pulada;
//  - pessoas, organizações e ligações só entram junto com uma entrada importada (e sem repetir id);
//  - a entrada mantém o campo "revisao": "pendente-curadoria" continua fora do ar (dados.ts a separa em `pendentes`)
//    até a curadoria aprovar; nada aqui aprova caso (decisão da coordenação de 05/11/2026: só com fonte oficial e
//    situação jurídica preenchidas, e com revisão humana).
//
// Sai com 1 se algo do lote foi barrado pelas regras, 0 caso contrário.
import fs from "node:fs";
import path from "node:path";
import { SLUGS_DOS_DOSSIES } from "../../lib/vale-o-escrito/catalogo.ts";
import { conferirArquivo } from "../../lib/vale-o-escrito/dados.ts";

const argumentos = process.argv.slice(2);
const gravar = argumentos.includes("--gravar");
const iLote = argumentos.indexOf("--lote");
const soLote = iLote >= 0 ? argumentos[iLote + 1] : null;

const pastaNovos = path.join(process.cwd(), "content", "vale-o-escrito", "novos-casos");
const pastaEntradas = path.join(process.cwd(), "content", "vale-o-escrito", "entradas");

const lotes = (fs.existsSync(pastaNovos) ? fs.readdirSync(pastaNovos) : []).filter((n) => n.endsWith(".json") && (!soLote || n === soLote)).sort();
if (lotes.length === 0) {
  console.log("Nenhum lote em content/vale-o-escrito/novos-casos/.");
  process.exit(0);
}

let barrou = false;
const destinos = new Map(); // slug -> arquivo do dossiê (carregado uma vez, alterado na memória)
const lerDestino = (slug) => {
  if (!destinos.has(slug)) {
    const caminho = path.join(pastaEntradas, `${slug}.json`);
    const atual = fs.existsSync(caminho)
      ? JSON.parse(fs.readFileSync(caminho, "utf8"))
      : { dossie: slug, pessoas: [], organizacoes: [], ligacoes: [], entradas: [] };
    destinos.set(slug, { caminho, arquivo: atual, novas: 0 });
  }
  return destinos.get(slug);
};

for (const nome of lotes) {
  const bruto = JSON.parse(fs.readFileSync(path.join(pastaNovos, nome), "utf8"));
  console.log(`\n== ${nome} (${bruto.dossie}, ${bruto.entradas?.length ?? 0} entradas)`);
  if (!SLUGS_DOS_DOSSIES.includes(bruto.dossie)) {
    console.log(`  barrado: dossiê "${bruto.dossie}" fora da lista`);
    barrou = true;
    continue;
  }
  const conferido = conferirArquivo(bruto);
  for (const d of conferido.descartadas) {
    console.log(`  barrado pelas regras: ${d}`);
    barrou = true;
  }
  const validas = [...conferido.entradas, ...conferido.pendentes];
  const destino = lerDestino(bruto.dossie);
  const alvo = destino.arquivo;
  const idsExistentes = new Set(alvo.entradas.map((e) => e.id));
  const linksExistentes = new Set(alvo.entradas.flatMap((e) => e.fontes.map((f) => f.url)));

  for (const en of validas) {
    if (idsExistentes.has(en.id)) {
      console.log(`  pulado (id já existe): ${en.id}`);
      continue;
    }
    const repetido = en.fontes.find((f) => linksExistentes.has(f.url));
    if (repetido) {
      console.log(`  pulado (link já usado no dossiê): ${en.id} -> ${repetido.url}`);
      continue;
    }
    alvo.entradas.push(en);
    idsExistentes.add(en.id);
    for (const f of en.fontes) linksExistentes.add(f.url);
    destino.novas++;
    console.log(`  entra (${en.revisao ?? "aprovada"}): ${en.id}`);

    const idsPessoas = new Set(alvo.pessoas.map((p) => p.id));
    for (const ref of en.pessoas) {
      const p = bruto.pessoas.find((x) => x.id === ref.pessoaId);
      if (p && !idsPessoas.has(p.id)) alvo.pessoas.push(p);
    }
    const idsOrgs = new Set(alvo.organizacoes.map((o) => o.id));
    for (const oid of en.organizacoes) {
      const o = (bruto.organizacoes ?? []).find((x) => x.id === oid);
      if (o && !idsOrgs.has(o.id)) alvo.organizacoes.push(o);
    }
    const idsLig = new Set(alvo.ligacoes.map((l) => l.id));
    for (const l of bruto.ligacoes ?? []) if (l.entradaId === en.id && !idsLig.has(l.id)) alvo.ligacoes.push(l);
  }
}

console.log("");
for (const [slug, d] of destinos) {
  if (d.novas === 0) {
    console.log(`${slug}: nada novo.`);
    continue;
  }
  if (gravar) {
    fs.writeFileSync(d.caminho, JSON.stringify(d.arquivo, null, 2) + "\n");
    console.log(`${slug}: ${d.novas} entrada(s) gravada(s) em content/vale-o-escrito/entradas/${slug}.json`);
  } else console.log(`${slug}: ${d.novas} entrada(s) entrariam (seco; use --gravar).`);
}
process.exit(barrou ? 1 : 0);

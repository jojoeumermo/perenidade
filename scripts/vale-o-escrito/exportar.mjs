// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: exporta as entradas aprovadas (interno.vale_entradas, lida por public.vale_publicadas) para content/vale-o-escrito/entradas/<slug>.json,
// o cache em arquivo que as páginas do observatório leem (ESPEC, seções 2 e 4). Roda no GitHub Actions (depois do robô) ou
// na mão pela coordenação.
//
//   npm run vale-o-escrito:exportar                 lê do banco (leitura pública, só a chave anônima) e grava
//   npm run vale-o-escrito:exportar -- --seco       mostra o que mudaria, sem gravar
//   npm run vale-o-escrito:exportar -- --de linhas.json   lê as linhas de um arquivo (teste e uso offline)
//
// Variáveis: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. A leitura é a mesma que qualquer visitante faz
// (a política de leitura só entrega o que não foi retirado), então nada interno passa por aqui. Cada entrada é conferida
// por lib/vale-o-escrito/regras.ts; a que não passa fica de fora e o motivo vai para o relatório (uma ficha a menos é melhor
// que uma ficha sem fonte). Pasta sempre literal: path.join(process.cwd(), "content", "vale-o-escrito", ...).
//
// Sai com código 1 se alguma entrada foi barrada (para o fluxo avisar a curadoria) e com 2 se não conseguiu ler.
import fs from "node:fs";
import path from "node:path";
import { montarArquivos } from "../../lib/vale-o-escrito/curadoria.ts";

const argumentos = process.argv.slice(2);
const seco = argumentos.includes("--seco");
const iDe = argumentos.indexOf("--de");
const arquivoDeLinhas = iDe >= 0 ? argumentos[iDe + 1] : null;

async function lerLinhas() {
  if (arquivoDeLinhas) return JSON.parse(fs.readFileSync(arquivoDeLinhas, "utf8"));
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !chave) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  // A tabela mora no esquema interno; a leitura pública é a função public.vale_publicadas (só as não retiradas, até 2000).
  const r = await fetch(`${url}/rest/v1/rpc/vale_publicadas`, {
    method: "POST",
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`O banco respondeu ${r.status} ao ler vale_publicadas.`);
  const linhas = await r.json();
  return (Array.isArray(linhas) ? linhas : []).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

let linhas;
try {
  linhas = await lerLinhas();
} catch (erro) {
  console.error(`Não foi possível ler as entradas: ${erro.message}`);
  process.exit(2);
}

const { arquivos, barradas } = montarArquivos(linhas);
let mudou = 0;
let total = 0;
for (const [slug, arquivo] of Object.entries(arquivos)) {
  const destino = path.join(process.cwd(), "content", "vale-o-escrito", "entradas", `${slug}.json`);
  const texto = `${JSON.stringify(arquivo, null, 2)}\n`;
  total += arquivo.entradas.length;
  let atual = "";
  try {
    atual = fs.readFileSync(destino, "utf8");
  } catch {
    atual = "";
  }
  if (atual.replace(/\r\n/g, "\n") === texto) continue;
  mudou++;
  console.log(`${seco ? "mudaria" : "gravou"}  ${slug}.json (${arquivo.entradas.length} entrada(s))`);
  if (!seco) fs.writeFileSync(destino, texto, "utf8");
}
console.log(`${total} entrada(s) em ${Object.keys(arquivos).length} dossiê(s); ${mudou} arquivo(s) ${seco ? "mudariam" : "mudaram"}.`);
if (barradas.length) {
  console.error(`\n${barradas.length} entrada(s) barrada(s) pelas regras (ficam de fora do cache):`);
  for (const b of barradas) console.error(`  - ${b}`);
  process.exit(1);
}

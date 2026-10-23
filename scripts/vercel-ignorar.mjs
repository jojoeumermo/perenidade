// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O "Ignored Build Step" da Vercel (vercel.json › ignoreCommand): diz se o commit novo muda alguma coisa do site.
// Cada publicação nova esvazia o cache das bordas da Vercel e as próximas visitas (e os robôs de busca) leem as
// páginas de novo do armazenamento: são essas leituras que estouram a cota de "ISR Reads" e de "Fast Origin Transfer".
// Commit que só mexe em documentação, rotinas do GitHub, SQL do banco ou testes não precisa de publicação nova.
//
// Saída 0 = pular a publicação; saída 1 = publicar. Na dúvida (sem o commit anterior, histórico raso), publica.
import { execFileSync } from "node:child_process";

const anterior = process.env.VERCEL_GIT_PREVIOUS_SHA;
const atual = process.env.VERCEL_GIT_COMMIT_SHA || "HEAD";

// O que não entra no site montado. supabase/functions/_shared entra (o painel usa o desenho dos e-mails).
const ignorado = (arquivo) =>
  arquivo.startsWith("docs/") ||
  arquivo.startsWith(".github/") ||
  arquivo.startsWith(".claude/") ||
  /^supabase\/[^/]+\.sql$/.test(arquivo) ||
  (arquivo.startsWith("supabase/functions/") && !arquivo.startsWith("supabase/functions/_shared/")) ||
  /^scripts\/testar-[^/]+$/.test(arquivo) ||
  /^[^/]+\.md$/.test(arquivo);

if (!anterior) {
  console.log("Sem o commit anterior: publica.");
  process.exit(1);
}
let mudados;
try {
  mudados = execFileSync("git", ["diff", "--name-only", anterior, atual], { encoding: "utf8" }).split("\n").filter(Boolean);
} catch {
  console.log("Não deu para comparar com o commit anterior: publica.");
  process.exit(1);
}
const doSite = mudados.filter((arquivo) => !ignorado(arquivo));
if (mudados.length > 0 && doSite.length === 0) {
  console.log(`Só ${mudados.length} arquivo(s) fora do site (documentação, rotinas, SQL ou testes): publicação pulada.`);
  process.exit(0);
}
console.log(`${doSite.length} arquivo(s) do site mudaram: publica.`);
process.exit(1);

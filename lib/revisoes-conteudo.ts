// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter";
import { lerRevisoes, type Revisao } from "./modelo-de-aula";

// O histórico de revisões de uma aula (campo "revisoes" do cabeçalho), lido à parte, sem mexer em lib/content.ts:
// só é chamado com o recurso "revisoes" ligado. A conferência do formato também roda em `npm run pendencias` (CI).

const guardadas = new Map<string, Revisao[]>();

/** `arquivo` é o caminho do original dentro do projeto ("content/trilhas/<trilha>/<aula>.md"), como em Lesson.file. */
export function revisoesDaAula(arquivo: string): Revisao[] {
  if (process.env.NODE_ENV === "production" && guardadas.has(arquivo)) return guardadas.get(arquivo)!;
  if (!/^content\/trilhas\/[a-z0-9-]+\/[a-z0-9-]+\.md$/.test(arquivo)) return [];
  const { data } = parseFrontmatter(fs.readFileSync(path.join(process.cwd(), arquivo), "utf8"));
  const revisoes = lerRevisoes(data.revisoes, arquivo);
  guardadas.set(arquivo, revisoes);
  return revisoes;
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Lê as checagens do site (content/checagens/*.md) para o jogo "Fato ou boato?". Só o SERVIDOR importa este módulo
// (a página de Jogos), nunca o layout raiz nem componente de cliente: ele lê o disco, com a pasta escrita literal.
import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "../frontmatter";
import { classeDoVeredito, type ChecagemParaJogo } from "./regras";

export function lerChecagensParaJogo(): ChecagemParaJogo[] {
  const pasta = path.join(process.cwd(), "content", "checagens");
  let nomes: string[] = [];
  try {
    nomes = fs.readdirSync(pasta).filter((n) => n.endsWith(".md"));
  } catch {
    return [];
  }
  const itens: ChecagemParaJogo[] = [];
  for (const nome of nomes) {
    try {
      const { data } = parseFrontmatter(fs.readFileSync(path.join(pasta, nome), "utf8"));
      const alegacao = typeof data.alegacao === "string" ? data.alegacao : "";
      const veredito = typeof data.veredito === "string" ? data.veredito : "";
      const titulo = typeof data.titulo === "string" ? data.titulo : "";
      if (alegacao && titulo && classeDoVeredito(veredito)) itens.push({ slug: nome.replace(/\.md$/, ""), alegacao, veredito, titulo });
    } catch {
      /* arquivo com cabeçalho quebrado: fica fora do jogo */
    }
  }
  return itens;
}

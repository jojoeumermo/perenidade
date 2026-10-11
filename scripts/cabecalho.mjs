// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Leitura e escrita do cabeçalho dos arquivos de conteúdo, para os roteiros de apoio.
// (O site usa lib/frontmatter.ts, com a mesma regra.)
import yaml from "js-yaml";

export function lerCabecalho(texto) {
  const limpo = texto.replace(/^﻿/, "");
  const achado = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(limpo);
  if (!achado) return { dados: {}, corpo: limpo };
  const dados = yaml.load(achado[1]);
  return { dados: dados && typeof dados === "object" && !Array.isArray(dados) ? dados : {}, corpo: limpo.slice(achado[0].length) };
}

/** Monta o arquivo: cabeçalho em YAML (com as aspas e os escapes necessários) e, depois, o texto. */
export function montarArquivo(dados, corpo) {
  return `---\n${yaml.dump(dados, { lineWidth: -1 })}---\n${corpo ? `\n${corpo}\n` : ""}`;
}

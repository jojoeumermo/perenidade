// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: o conjunto de dados que as páginas do observatório entregam aos componentes. SÓ O SERVIDOR importa
// este módulo (ele chama dados.ts, que lê o disco com pasta literal): nunca o layout raiz nem componente de cliente.
// Sem "@/" (roda no Node nos testes).

import { lerDossies, lerTudo } from "./dados";
import type { TextoPorIdioma } from "./tipos";
import { juntarDossies, type DadosDoObservatorio } from "./visual";

const noIdioma = (t: TextoPorIdioma, lang: string): string => (t as Record<string, string | undefined>)[lang] ?? t.pt;

/** Tudo o que está publicado em arquivo, com os textos dos dossiês já no idioma pedido. */
export function dadosDoObservatorio(lang: string): DadosDoObservatorio {
  const dossies = lerDossies().map((d) => ({
    slug: d.slug,
    ordem: d.ordem,
    cor: d.cor,
    titulo: noIdioma(d.titulo, lang),
    descricao: noIdioma(d.descricao, lang),
  }));
  return juntarDossies(lerTudo(), dossies);
}

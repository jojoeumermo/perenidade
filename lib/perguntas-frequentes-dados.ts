// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Monta, no servidor, as perguntas frequentes de um idioma (content/perguntas-frequentes.json). O layout passa ao navegador
// só a lista do idioma da página, já sem os itens de recurso desligado: nada é buscado depois, nem em servidor nem em IA.

import dados from "@/content/perguntas-frequentes.json";
import type { Locale } from "@/i18n/config";
import { ligado, type Recurso, RECURSOS } from "@/lib/recursos";
import { site } from "@/lib/site";
import type { PerguntaFrequente } from "@/lib/perguntas-frequentes";

interface Texto {
  pergunta: string;
  resposta: string;
  palavras?: string;
}

type Item = { id: string; href?: string; recurso?: string; semRecurso?: string } & Partial<Record<Locale, Texto>>;

const ITENS = (dados as { itens: Item[] }).itens;

const eRecurso = (nome: string): nome is Recurso => Object.hasOwn(RECURSOS, nome);

/** Vale para agora? Item preso a um recurso só aparece com ele ligado; "semRecurso", só com ele desligado. */
function valeAgora(item: Item): boolean {
  if (item.recurso && !(eRecurso(item.recurso) && ligado(item.recurso))) return false;
  if (item.semRecurso && eRecurso(item.semRecurso) && ligado(item.semRecurso)) return false;
  return true;
}

/** As perguntas do idioma (português no que faltar), com o e-mail de contato no lugar de {email}. */
export function perguntasFrequentes(lang: Locale): PerguntaFrequente[] {
  return ITENS.filter(valeAgora).flatMap((item) => {
    const texto = item[lang] ?? item.pt;
    if (!texto) return [];
    return [
      {
        id: item.id,
        pergunta: texto.pergunta,
        resposta: texto.resposta.replaceAll("{email}", site.newsletter),
        palavras: texto.palavras ?? "",
        href: item.href ?? null,
      },
    ];
  });
}

/** O e-mail do "fale com a gente" quando nada casa com a busca. */
export const EMAIL_DE_CONTATO = site.newsletter;

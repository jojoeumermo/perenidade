// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { locales } from "@/i18n/config";
import { getArticles, getAuthors, getBooks, getDebates, getFactChecks, getGlossary, getQuestions, getTracks, getTributes } from "@/lib/content";
import type { SearchEntry } from "@/lib/search";
import { plainText } from "@/lib/text";

// Índice de busca gerado na publicação: um arquivo estático por idioma.
// Como traz o texto completo, também serve de cópia de segurança do acervo.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/indice.json">) {
  const { lang, t } = await loadLang(params);
  const entries: SearchEntry[] = [];
  for (const track of getTracks(lang)) {
    const area = t.areas[track.area][0];
    if (track.lessons.length === 0) continue;
    entries.push({ kind: "trilha", title: track.title, href: `/trilhas/${track.slug}`, area, context: t.stages[track.stage], text: `${track.summary} ${plainText(track.intro)}` });
    for (const lesson of track.lessons) {
      entries.push({ kind: "aula", title: lesson.title, href: `/trilhas/${track.slug}/${lesson.slug}`, area, context: track.title, text: `${lesson.summary} ${plainText(lesson.body)}` });
    }
  }
  for (const book of getBooks(lang)) {
    entries.push({ kind: "obra", title: book.title, href: `/acervo/${book.id}`, area: t.areas[book.area][0], context: book.author, text: book.synopsis });
  }
  for (const author of getAuthors(lang)) {
    entries.push({ kind: "autor", title: author.name, href: `/autores#${author.slug}`, area: "", context: author.years, text: author.bio });
  }
  for (const tribute of getTributes(lang)) {
    entries.push({ kind: "memorial", title: tribute.name, href: `/memorial#${tribute.slug}`, area: "", context: `${tribute.born} – ${tribute.died}`, text: tribute.body });
  }
  for (const term of getGlossary(lang)) {
    entries.push({ kind: "verbete", title: term.term, href: `/glossario#${term.slug}`, area: "", context: "", text: `${term.summary} ${plainText(term.body)}` });
  }
  for (const article of getArticles(lang)) {
    entries.push({ kind: "materia", title: article.title, href: `/jornal/${article.slug}`, area: "", context: article.author, text: `${article.subtitle} ${plainText(article.body)}` });
  }
  for (const check of getFactChecks(lang)) {
    entries.push({ kind: "checagem", title: check.claim, href: `/checagens#${check.slug}`, area: "", context: check.verdict, text: plainText(check.body) });
  }
  for (const card of getDebates(lang)) {
    entries.push({ kind: "debate", title: card.claim, href: `/debates#${card.slug}`, area: "", context: "", text: `${card.answer} ${plainText(card.body)}` });
  }
  getQuestions().forEach((question, i) => {
    entries.push({ kind: "pergunta", title: question.pergunta, href: `/perguntas#p${i + 1}`, area: "", context: "", text: question.resposta });
  });
  return Response.json(entries);
}

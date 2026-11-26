// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Como um arquivo de content/jornal vira uma matéria (Article) e um de content/glossario vira um verbete (Term): só a
// montagem, sem disco. lib/content.ts (getArticles, getGlossary) e lib/jornal/leitura-do-app.ts usam estas funções,
// para o site e o aplicativo nunca divergirem.
import { dateOf, fail, minutesOf, optional, parseSources, text, type Data } from "../conteudo-campos";
import type { Article, Term } from "../content";

interface Entrada {
  slug: string;
  file: string;
  data: Data;
  body: string;
  translated: boolean;
}

export function montarMateria({ slug, file, data, body, translated }: Entrada): Article {
  if (!body) fail(file, "o texto está vazio");
  return {
      slug,
      title: text(data, "titulo", file),
      subtitle: optional(data, "subtitulo") ?? "",
      author: text(data, "autor", file),
      date: dateOf(data, "data", file),
      section: optional(data, "editoria") ?? "",
      image: (() => {
        const imagem = optional(data, "imagem") ?? "";
        if (imagem && !/^\/[a-z0-9/_.-]+\.(webp|jpg|jpeg|png|avif)$/i.test(imagem)) fail(file, `"imagem" deve ser um arquivo do próprio site, como /imagens/jornal/foto.webp`);
        if (imagem && !optional(data, "credito_imagem")) fail(file, `com "imagem", diga de quem é em "credito_imagem"`);
        return imagem;
      })(),
      imageCredit: optional(data, "credito_imagem") ?? "",
      sources: parseSources(data.fontes, file, true),
      body,
      minutes: minutesOf(body),
      featured: data.destaque === true,
      time: (() => {
        const hora = optional(data, "hora") ?? "";
        if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) fail(file, `"hora" deve estar no formato HH:MM (hora de Brasília)`);
        return hora;
      })(),
      translated,
      file,
      };
}

/** A ordem do jornal: a mais nova primeiro; no mesmo dia, a hora mais tarde vem antes. */
export const compararMaterias = (a: Article, b: Article) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || a.slug.localeCompare(b.slug);

export function montarTermo({ slug, file, data, body, translated }: Entrada): Term {
  return {
    slug,
    term: text(data, "termo", file),
    summary: text(data, "resumo", file),
    body,
    translated,
    file,
  };
}

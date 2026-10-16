// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { locales } from "@/i18n/config";
import { getTracks } from "@/lib/content";

// Trilhas e aulas ainda em preparação, para os formulários de contribuição, e o roteiro inteiro de cada trilha
// (com o que já está escrito), para o guia de produção dizer onde cada aula se encaixa. Arquivo estático.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/roteiros.json">) {
  const { lang } = await loadLang(params);
  return Response.json(
    getTracks(lang).map((track) => ({
      slug: track.slug,
      title: track.title,
      area: track.area,
      stage: track.stage,
      summary: track.summary,
      planned: track.plan.filter((item) => !item.ready).map((item) => ({ slug: item.slug, title: item.title })),
      ready: track.plan.filter((item) => item.ready).length,
      plan: track.plan.map((item) => ({ slug: item.slug, title: item.title, ready: item.ready })),
      // As aulas já escritas, com o resumo: o guia mostra o que vem antes e depois.
      lessons: track.lessons.map((lesson) => ({ slug: lesson.slug, title: lesson.title, summary: lesson.summary, quiz: lesson.quiz.length })),
    })),
  );
}

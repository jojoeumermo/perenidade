// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import { getTracks } from "@/lib/content";

// O texto original (em Markdown) das aulas de uma trilha, para o editor de tradução do painel mostrar o original ao lado,
// parágrafo a parágrafo. Só em português (a língua original das aulas), um arquivo estático por trilha.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return getTracks(defaultLocale).map((track) => ({ lang: defaultLocale, track: track.slug }));
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/original/[track]">) {
  const { lang } = await loadLang(params);
  const { track: slug } = await params;
  const track = getTracks(lang).find((t) => t.slug === slug);
  if (!track) return Response.json({ erro: "nao_encontrado" }, { status: 404 });
  return Response.json({
    slug: track.slug,
    title: track.title,
    lessons: track.lessons.map((l) => ({ slug: l.slug, title: l.title, summary: l.summary, body: l.body })),
  });
}

// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import { loadLang } from "@/i18n";
import { locales } from "@/i18n/config";
import { getTracks } from "@/lib/content";

// Trilhas e aulas ainda em preparação, para os formulários de contribuição. Arquivo estático.
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
      planned: track.plan.filter((item) => !item.ready).map((item) => ({ slug: item.slug, title: item.title })),
    })),
  );
}

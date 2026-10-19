// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { locales } from "@/i18n/config";
import { getTracks } from "@/lib/content";
import { ligado } from "@/lib/recursos";

// Lista enxuta de trilhas e aulas (só nomes e endereços), um arquivo estático por idioma. É o que o "Meu estudo" e o
// modo turma usam, no aparelho, para pôr nome nas aulas guardadas no progresso; nenhum dado de quem estuda passa aqui.
// Formato: { trilhas: [[trilha, título, disciplina, nome da disciplina, etapa, [[aula, título], …]], …] }.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export type TrilhaDoIndice = [slug: string, titulo: string, area: string, nomeDaArea: string, etapa: string, aulas: [slug: string, titulo: string][]];

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/aulas.json">) {
  if (!ligado("meu-estudo") && !ligado("turma") && !ligado("nivelamento")) return new Response(null, { status: 404 });
  const { lang, t } = await loadLang(params);
  const trilhas: TrilhaDoIndice[] = getTracks(lang)
    .filter((track) => track.lessons.length > 0)
    .map((track) => [track.slug, track.title, track.area, t.areas[track.area][0], t.stages[track.stage], track.lessons.map((l): [string, string] => [l.slug, l.title])]);
  return Response.json({ trilhas }, { headers: { "Cache-Control": "public, max-age=3600" } });
}

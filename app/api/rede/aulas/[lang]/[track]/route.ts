// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As aulas de UMA trilha, para a tela "Discutir esta aula" da Alumia (components/rede/comunidades/TelaAula.tsx): só o slug e o
// título de cada aula, de um idioma. Gerada na construção do site (estática), como a lista das trilhas (app/api/rede/trilhas): o
// título de verdade, com acento, no lugar do fim do endereço. Com o recurso "rede-v2" desligado, não existe (404).
import { notFound } from "next/navigation";
import { getTracks } from "@/lib/content";
import { isLocale, locales } from "@/i18n/config";
import { ligado } from "@/lib/recursos";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.flatMap((lang) => getTracks(lang).map((t) => ({ lang, track: t.slug })));
}

export async function GET(_pedido: Request, { params }: { params: Promise<{ lang: string; track: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang, track } = await params;
  if (!isLocale(lang)) notFound();
  const trilha = getTracks(lang).find((t) => t.slug === track);
  if (!trilha) notFound();
  const aulas = trilha.lessons.map((l) => ({ slug: l.slug, titulo: l.title }));
  return Response.json({ trilha: trilha.title, aulas }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}

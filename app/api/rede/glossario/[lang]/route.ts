// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 103: o glossário do site (content/glossario) para o "glossário ao toque" da Alumia: só o slug, o termo e o resumo de
// cada verbete, de um idioma. Gerado na construção do site (estático): ninguém pede nada a serviço de fora, e o aparelho guarda a
// lista enquanto a página vive. Com "alumia-p4-descoberta-estudo" desligado, não existe (404).
import { notFound } from "next/navigation";
import { getGlossary } from "@/lib/content";
import { isLocale, locales } from "@/i18n/config";
import { ligado } from "@/lib/recursos";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_pedido: Request, { params }: { params: Promise<{ lang: string }> }) {
  if (!ligado("alumia-p4-descoberta-estudo")) notFound();
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const termos = getGlossary(lang).map((t) => ({ slug: t.slug, termo: t.term, resumo: t.summary.replace(/\s+/g, " ").trim() }));
  return Response.json({ termos }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}

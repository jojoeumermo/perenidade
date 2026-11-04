// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lista de trilhas de estudo para o passo "3 lutas + 3 trilhas" da primeira entrada na Rede (pacote descoberta): só o slug, o
// título e a área, de um idioma. Gerada na construção do site (estática): a leitura de disco acontece uma vez, aqui, e nunca
// no layout nem no componente da Rede. Com o recurso "rede-v2" desligado, não existe (404).
import { notFound } from "next/navigation";
import { getTracks } from "@/lib/content";
import { isLocale, locales } from "@/i18n/config";
import { ligado } from "@/lib/recursos";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_pedido: Request, { params }: { params: Promise<{ lang: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const trilhas = getTracks(lang)
    .map((t) => ({ slug: t.slug, titulo: t.title, area: t.area }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, lang));
  return Response.json({ trilhas }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}

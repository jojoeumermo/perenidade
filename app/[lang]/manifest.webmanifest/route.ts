// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O manifesto do aplicativo no idioma da pessoa: /pt/manifest.webmanifest, /en/..., etc. O start_url é a inicial do
// próprio idioma. O padrão (app/manifest.ts, /manifest.webmanifest) continua existindo para quem chega sem idioma.
// Estático: gerado no build, sem ler disco.
import { getDict } from "@/i18n";
import { isLocale, locales } from "@/i18n/config";
import { montarManifesto } from "@/lib/manifesto";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(montarManifesto(lang, getDict(lang))), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" },
  });
}

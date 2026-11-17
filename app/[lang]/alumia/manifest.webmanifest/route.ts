// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O manifesto da Alumia no idioma da pessoa: /pt/alumia/manifest.webmanifest, /en/alumia/..., ligado pelo layout da Alumia
// (lib/rede/marca-da-alumia.ts). Quem instala estando na Alumia ganha o lampião na tela inicial e abre direto na rede; o resto do
// site continua com o manifesto do Instituto (app/[lang]/manifest.webmanifest). Estático: gerado no build, sem ler disco.
import { isLocale, locales } from "@/i18n/config";
import { montarManifestoDaAlumia } from "@/lib/rede/marca-da-alumia";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(montarManifestoDaAlumia(lang)), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" },
  });
}

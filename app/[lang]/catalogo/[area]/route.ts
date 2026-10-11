// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { locales } from "@/i18n/config";
import { areaSlugs, isArea } from "@/lib/areas";
import { getCatalog } from "@/lib/content";

// Obras importadas dos catálogos abertos, por disciplina ("todos" junta tudo). Arquivo estático.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) => [...areaSlugs, "todos"].map((area) => ({ lang, area })));
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/catalogo/[area]">) {
  const { area } = await params;
  if (area === "todos") return Response.json(areaSlugs.flatMap((slug) => getCatalog(slug)));
  return Response.json(isArea(area) ? getCatalog(area) : []);
}

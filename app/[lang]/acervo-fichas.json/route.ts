// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import { fichasDoAcervo } from "@/lib/lacunas";

// "Acervo por dentro": cada obra com o selo da ficha (completa, parcial, vazia) e o que falta, para quem cuida do acervo
// escolher o que fazer. Também serve à conferência de links da rotina de publicação (o endereço de cada obra).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ lang: defaultLocale }];
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/acervo-fichas.json">) {
  await loadLang(params);
  return Response.json(fichasDoAcervo());
}

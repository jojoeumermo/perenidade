// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import { numerosDoSite } from "@/lib/apoio-numeros";

// As contagens do site (obras, aulas, traduções, idiomas) para o painel montar o texto da campanha com números reais.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ lang: defaultLocale }];
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/apoio-numeros.json">) {
  await loadLang(params);
  return Response.json(numerosDoSite());
}

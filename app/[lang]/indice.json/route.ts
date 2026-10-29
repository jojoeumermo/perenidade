// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { locales } from "@/i18n/config";
import { entradasDaBusca } from "@/lib/indice-de-busca";

// Índice de busca gerado na publicação: um arquivo estático por idioma.
// Como traz o texto completo, também serve de cópia de segurança do acervo.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/indice.json">) {
  const { lang, t } = await loadLang(params);
  return Response.json(entradasDaBusca(lang, t));
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { locales } from "@/i18n/config";
import { getBooks } from "@/lib/content";

// As obras do acervo em uma lista curta, para o painel citar no roteiro do podcast com título, autor, licença e fonte.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/obras.json">) {
  const { lang, t } = await loadLang(params);
  return Response.json(
    getBooks(lang).map((book) => ({ id: book.id, titulo: book.title, autor: book.author, ano: book.year ?? "", licenca: book.license, fonte: book.source, area: t.areas[book.area][0] })),
  );
}

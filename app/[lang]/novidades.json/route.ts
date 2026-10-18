// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { locales } from "@/i18n/config";
import { getArticles, getBooks } from "@/lib/content";
import { fileHistory } from "@/lib/history";

// As matérias mais recentes do jornal e as obras que entraram por último no acervo, para o editor do boletim montar as
// chamadas ("Leia no jornal", "Novidade do acervo") sem copiar e colar. Arquivo estático, refeito a cada publicação.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/novidades.json">) {
  const { lang } = await loadLang(params);
  const materias = [...getArticles(lang)]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)
    .map((a) => ({ titulo: a.title, resumo: a.subtitle, autor: a.author, data: a.date, url: `/${lang}/jornal/${a.slug}` }));
  const obras = getBooks(lang)
    .map((b) => ({ b, data: fileHistory(b.file).updated ?? "" }))
    .filter((x) => x.data)
    .sort((x, y) => y.data.localeCompare(x.data))
    .slice(0, 30)
    .map(({ b, data }) => ({ titulo: b.title, resumo: b.synopsis.slice(0, 280), autor: b.author, data, url: `/${lang}/acervo/${b.id}` }));
  return Response.json({ materias, obras });
}

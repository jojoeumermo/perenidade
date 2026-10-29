// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PrimeiraPagina } from "@/components/noticias/PrimeiraPagina";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { getNews } from "@/lib/news";

// A página é refeita sozinha a cada quinze minutos (o mesmo prazo de lib/news.ts).
export const revalidate = 900;

export async function generateMetadata({ params }: PageProps<"/[lang]/noticias">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/noticias", t.news.title, t.news.description);
}

// O giro de notícias na forma de primeira página de jornal (veja components/noticias/PrimeiraPagina.tsx).
export default async function Noticias({ params }: PageProps<"/[lang]/noticias">) {
  const { lang, t } = await loadLang(params);
  const { latest, outlets, at } = await getNews();
  return <PrimeiraPagina lang={lang} t={t} latest={latest} outlets={outlets} at={at} />;
}

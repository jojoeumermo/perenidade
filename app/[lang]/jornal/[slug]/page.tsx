// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MateriaCompleta } from "@/components/jornal/MateriaCompleta";
import { loadLang } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import { getArticles } from "@/lib/content";
import { withLangs } from "@/lib/params";
import { paginaMeta } from "@/lib/seo";

// O endereço de cada matéria é permanente: nenhuma expira (docs/jornal/EXPIRACAO.md).
export const dynamicParams = false;

export function generateStaticParams() {
  // Com o jornal ainda vazio, uma página de espera mantém a rota válida.
  const slugs = getArticles(defaultLocale).map((article) => ({ slug: article.slug }));
  return withLangs(slugs.length > 0 ? slugs : [{ slug: "em-breve" }]);
}

export async function generateMetadata({ params }: PageProps<"/[lang]/jornal/[slug]">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  const { slug } = await params;
  const article = getArticles(lang).find((item) => item.slug === slug);
  return article ? paginaMeta(lang, `/jornal/${article.slug}`, article.title, article.subtitle, { titulo: article.title, subtitulo: article.subtitle, kicker: article.section || t.journal.eyebrow }) : {};
}

export default async function Materia({ params }: PageProps<"/[lang]/jornal/[slug]">) {
  const { lang, t } = await loadLang(params);
  const { slug } = await params;
  const articles = getArticles(lang);
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();
  return <MateriaCompleta lang={lang} t={t} article={article} articles={articles} />;
}

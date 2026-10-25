// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { SourceList } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, fill, localePath } from "@/i18n/config";
import { getLooseMaterials, looseFormats } from "@/lib/content";
import { withLangs } from "@/lib/params";

type Props = PageProps<"/[lang]/avulsos/[slug]">;

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(getLooseMaterials(defaultLocale).map((material) => ({ slug: material.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { slug } = await params;
  const material = getLooseMaterials(lang).find((item) => item.slug === slug);
  return material ? { title: material.title, description: material.summary } : {};
}

/** Um material avulso: aula solta, lista de exercícios, resumo ou roteiro de estudo, com autoria e fontes. */
export default async function LooseMaterialPage({ params }: Props) {
  const { lang, t } = await loadLang(params);
  const { slug } = await params;
  const material = getLooseMaterials(lang).find((item) => item.slug === slug);
  if (!material) notFound();
  const to = (path: string) => localePath(lang, path);
  const format = t.loose.formats[looseFormats.indexOf(material.format)] ?? material.format;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 app:max-md:px-5 app:max-md:pt-4!">
      <Link href={`${to(`/estantes/${material.area}`)}#materiais-avulsos`} className="font-sans text-sm text-ink-soft hover:text-oxblood">
        ← {t.areas[material.area][0]} · {t.shelf.loose}
      </Link>
      <header className="mt-6">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">
          {t.loose.eyebrow} · {format}
        </p>
        <h1 className="mt-2 text-4xl font-semibold app:max-md:text-3xl sm:text-5xl" {...originalLang(material.translated)}>
          {material.title}
        </h1>
        <p className="mt-3 text-lg text-ink-soft" {...originalLang(material.translated)}>
          {material.summary}
        </p>
        <p className="mt-3 font-sans text-sm text-ink-soft">{fill(t.lesson.by, { names: material.authors.join(", ") })}</p>
      </header>
      <Untranslated lang={lang} t={t} show={!material.translated} />
      <div className="mt-8" {...originalLang(material.translated)}>
        <Markdown lang={lang} tryCode={t.lesson.tryCode}>
          {material.body}
        </Markdown>
      </div>
      <SourceList sources={material.sources} title={t.lesson.sources} />
      <p className="mt-6 font-sans text-sm text-ink-soft">{t.lesson.license}</p>
    </article>
  );
}

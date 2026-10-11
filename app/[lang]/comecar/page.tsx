// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, localePath } from "@/i18n/config";
import { getStartSteps } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/comecar">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.start.title, description: t.start.lead };
}

// Uma ordem de leitura para quem está chegando: do que se vive no trabalho até os textos mais longos.
export default async function Comecar({ params }: PageProps<"/[lang]/comecar">) {
  const { lang, t } = await loadLang(params);
  const steps = getStartSteps(lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={t.start.eyebrow} title={t.start.title}>
        {t.start.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={lang !== defaultLocale} />
      <ol className="mt-10 space-y-8">
        {steps.map((step) => (
          <li key={step.title} className="border-l-4 border-gold bg-parchment-deep p-6">
            <h2 className="text-2xl font-semibold" lang="pt-BR">{step.title}</h2>
            <p className="mt-2 text-lg text-ink-soft" lang="pt-BR">{step.text}</p>
            {step.lessons.length > 0 && (
              <>
                <h3 className="mt-5 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">{t.start.lessons}</h3>
                <ul className="mt-2 space-y-1">
                  {step.lessons.map((lesson) => (
                    <li key={lesson.href}>
                      <Link href={localePath(lang, lesson.href)} className="text-lg underline hover:text-oxblood">{lesson.title}</Link>
                      <span className="font-sans text-sm text-ink-soft"> · {lesson.track}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {step.books.length > 0 && (
              <>
                <h3 className="mt-5 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">{t.start.readings}</h3>
                <ul className="mt-2 space-y-1">
                  {step.books.map((book) => (
                    <li key={book.href}>
                      <Link href={localePath(lang, book.href)} className="text-lg underline hover:text-oxblood">{book.title}</Link>
                      <span className="font-sans text-sm text-ink-soft"> · {book.author}{book.reference ? ` · ${t.start.reference}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-10 border-t border-rule pt-6 text-lg text-ink-soft">
        {t.start.after}{" "}
        <Link href={localePath(lang, "/trilhas")} className="underline hover:text-oxblood">{t.nav.disciplines}</Link>
        {" · "}
        <Link href={localePath(lang, "/acervo")} className="underline hover:text-oxblood">{t.nav.library}</Link>
        {" · "}
        <Link href={localePath(lang, "/comunidade")} className="underline hover:text-oxblood">{t.nav.community}</Link>
      </p>
    </div>
  );
}

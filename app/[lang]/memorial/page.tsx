// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { htmlLang, localePath } from "@/i18n/config";
import { getTributes } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/memorial">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.memorial.title, description: t.memorial.lead };
}

export default async function Memorial({ params }: PageProps<"/[lang]/memorial">) {
  const { lang, t } = await loadLang(params);
  const tributes = getTributes(lang);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={t.memorial.eyebrow} title={t.memorial.title}>
        {t.memorial.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={tributes.some((tribute) => !tribute.translated)} />

      <nav aria-label={t.memorial.title} className="mt-8 flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm">
        {tributes.map((tribute) => (
          <a key={tribute.slug} href={`#${tribute.slug}`} className="underline hover:text-oxblood">{tribute.name}</a>
        ))}
      </nav>

      <div className="mt-10 space-y-6">
        {tributes.map((tribute) => (
          <article key={tribute.slug} id={tribute.slug} className="scroll-mt-6 flex items-center gap-5 border-l-4 border-oxblood bg-parchment-deep p-5 sm:gap-6 sm:p-6" {...originalLang(tribute.translated)}>
            {tribute.photo && (
              // O retrato fica entre a barra e o texto, centrado na altura do cartão.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tribute.photo} alt={tribute.name} width={360} height={450} loading="lazy" decoding="async" className="h-auto w-20 shrink-0 self-center border border-rule sm:w-32" />
            )}
            <div className="min-w-0">
              <p className="font-mono text-xs text-gold">
                {tribute.born} – {tribute.died} · {tribute.place}
              </p>
              <h2 className="mt-2 text-3xl font-semibold">{tribute.name}</h2>
              <p className="mt-3 text-lg leading-relaxed">{tribute.body}</p>
              <p className="mt-4 font-serif text-xl italic text-oxblood" lang={htmlLang[lang]}>{t.memorial.present}</p>
              {tribute.photoCredit && (
                <p className="mt-3 font-mono text-[0.7rem] leading-tight text-ink-soft" lang="pt-BR">
                  <a href={tribute.photoSource} target="_blank" rel="noopener noreferrer" className="hover:text-oxblood hover:underline">{tribute.photoCredit}</a>
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      <p className="no-print mt-10 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        {t.memorial.add}{" "}
        <Link href={localePath(lang, "/contribuir")} className="underline hover:text-oxblood">{t.memorial.addLink}</Link>.
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import { PageHeading } from "@/components/PageHeading";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { htmlLang } from "@/i18n/config";
import { getTributes } from "@/lib/content";
import { github } from "@/lib/site";

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

      <div className="mt-10 space-y-6">
        {tributes.map((tribute) => (
          <article key={tribute.slug} id={tribute.slug} className="scroll-mt-6 border-l-4 border-oxblood bg-parchment-deep p-6" {...originalLang(tribute.translated)}>
            <p className="font-mono text-xs text-gold">
              {tribute.born} – {tribute.died} · {tribute.place}
            </p>
            <h2 className="mt-2 text-3xl font-semibold">{tribute.name}</h2>
            <p className="mt-3 text-lg leading-relaxed">{tribute.body}</p>
            <p className="mt-4 font-serif text-xl italic text-oxblood" lang={htmlLang[lang]}>{t.memorial.present}</p>
          </article>
        ))}
      </div>

      <p className="no-print mt-10 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        {t.memorial.add}{" "}
        <a href={github.newIssue("sugestao.yml", {})} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
          {t.memorial.addLink}
        </a>
        .
      </p>
    </div>
  );
}

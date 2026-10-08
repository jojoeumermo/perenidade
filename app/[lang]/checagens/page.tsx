// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import { SourceList } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { PageHeading } from "@/components/PageHeading";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { getFactChecks } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/checagens">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.factCheck.title, description: t.factCheck.lead };
}

export default async function Checagens({ params }: PageProps<"/[lang]/checagens">) {
  const { lang, t } = await loadLang(params);
  const checks = getFactChecks(lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={t.factCheck.eyebrow} title={t.factCheck.title}>
        {t.factCheck.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={checks.some((check) => !check.translated)} />
      {checks.length === 0 && <p className="mt-10 text-xl text-ink-soft">{t.factCheck.empty}</p>}
      <div className="mt-10 space-y-8">
        {checks.map((check) => (
          <article key={check.slug} id={check.slug} className="scroll-mt-6 border border-rule bg-parchment-deep p-6" {...originalLang(check.translated)}>
            <p className="font-mono text-xs uppercase tracking-widest text-gold">{t.factCheck.claim}</p>
            <h2 className="mt-1 text-2xl font-semibold">“{check.claim}”</h2>
            <p className="mt-3 inline-block border-2 border-oxblood px-3 py-1 font-sans text-sm font-semibold text-oxblood">{check.verdict}</p>
            <div className="mt-4">
              <Markdown lang={lang}>{check.body}</Markdown>
            </div>
            <SourceList sources={check.sources} title={t.common.sources} />
          </article>
        ))}
      </div>
    </div>
  );
}

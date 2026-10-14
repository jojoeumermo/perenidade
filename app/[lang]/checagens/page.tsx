// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { SourceList } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { Cartaz } from "@/components/Cartaz";
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
      <Cartaz eyebrow={t.factCheck.eyebrow} title={t.factCheck.title} slogan={t.footer.slogan} tone="preto">
        {t.factCheck.lead}
      </Cartaz>
      <Untranslated lang={lang} t={t} show={checks.some((check) => !check.translated)} />
      {checks.length === 0 && <p className="mt-10 text-xl text-ink-soft">{t.factCheck.empty}</p>}
      <div className="mt-10 space-y-8">
        {checks.map((check) => (
          <article key={check.slug} id={check.slug} className="scroll-mt-6 border-t-8 border-ink bg-parchment-deep p-6" {...originalLang(check.translated)}>
            <p className="jornal-editoria">{t.factCheck.claim}</p>
            <h2 className="jornal-manchete mt-3 text-2xl sm:text-3xl">“{check.claim}”</h2>
            <p className="jornal-carimbo mt-4 text-xl">{check.verdict}</p>
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

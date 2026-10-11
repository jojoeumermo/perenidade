// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { SourceList } from "@/components/Cards";
import { CopyButton } from "@/components/CopyButton";
import { Markdown } from "@/components/Markdown";
import { PageHeading } from "@/components/PageHeading";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { getDebates } from "@/lib/content";
import { CardImage } from "@/components/CardImage";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/debates">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.debates.title, description: t.debates.lead };
}

export default async function Debates({ params }: PageProps<"/[lang]/debates">) {
  const { lang, t } = await loadLang(params);
  const cards = getDebates(lang);
  const host = site.url.replace(/^https?:\/\//, "");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={t.debates.eyebrow} title={t.debates.title}>
        {t.debates.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={cards.some((card) => !card.translated)} />
      <div className="mt-10 space-y-6">
        {cards.map((card) => (
          <article key={card.slug} id={card.slug} className="scroll-mt-6 border border-rule bg-parchment-deep p-6" {...originalLang(card.translated)}>
            <p className="font-mono text-xs uppercase tracking-widest text-gold">{t.debates.claim}</p>
            <h2 className="mt-1 text-2xl font-semibold">“{card.claim}”</h2>
            <p className="mt-4 font-mono text-xs uppercase tracking-widest text-gold">{t.debates.answer}</p>
            <p className="mt-1 text-xl leading-relaxed">{card.answer}</p>
            <p className="no-print mt-2 font-sans text-sm text-ink-soft">
              <CopyButton text={card.answer} label={t.common.copy} done={t.common.copied} />
              {" · "}
              <CardImage claim={card.claim} answer={card.answer} file={`cartao-${card.slug}`} labels={{ claim: t.debates.claim, answer: t.debates.answer, button: t.debates.download, kicker: t.debates.title, site: `${host}/debates` }} />
            </p>
            {card.body && (
              <details className="mt-4">
                <summary className="cursor-pointer font-sans text-sm font-semibold">{t.debates.more}</summary>
                <div className="mt-3">
                  <Markdown lang={lang}>{card.body}</Markdown>
                </div>
              </details>
            )}
            <SourceList sources={card.sources} title={t.common.sources} />
          </article>
        ))}
      </div>
    </div>
  );
}

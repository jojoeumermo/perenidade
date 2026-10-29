// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { SourceList } from "@/components/Cards";
import { CopyButton } from "@/components/CopyButton";
import { Markdown } from "@/components/Markdown";
import { Cartaz } from "@/components/Cartaz";
import { CartoesDeDebate } from "@/components/critica/CartoesDeDebate";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { localePath } from "@/i18n/config";
import { debateThemes, getDebates, getFallacies } from "@/lib/content";
import { CardImage } from "@/components/CardImage";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/debates">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/debates", t.debates.title, t.debates.lead);
}

export default async function Debates({ params }: PageProps<"/[lang]/debates">) {
  const { lang, t } = await loadLang(params);
  const cards = getDebates(lang);
  const fallacies = new Map(getFallacies(lang).map((item) => [item.slug, item.name]));
  const host = site.url.replace(/^https?:\/\//, "");
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Cartaz eyebrow={t.debates.eyebrow} title={t.debates.title} slogan={t.slogans.debates} tone="vermelho">
          {t.debates.lead}
        </Cartaz>
        <aside className="no-print mt-8 border-2 border-ink p-5 font-sans">
          <p className="font-serif text-xl font-semibold">{t.debates.beforeTitle}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.debates.beforeText}</p>
          <Link href={localePath(lang, "/falacias")} className="mt-3 inline-block bg-ink px-4 py-2 text-sm font-medium text-parchment hover:bg-oxblood">{t.debates.beforeLink}</Link>
        </aside>
        <Untranslated lang={lang} t={t} show={cards.some((card) => !card.translated)} />
      </div>
      <CartoesDeDebate
        s={t.debates}
        temas={debateThemes}
        itens={cards.map((card) => ({
          id: card.slug,
          tema: card.theme,
          chaves: `${card.claim} ${card.answer} ${card.body ?? ""}`,
          node: (
            <article key={card.slug} className="cartao flex h-full flex-col p-6 pt-12 sm:p-7 sm:pt-12" {...originalLang(card.translated)}>
              <p className="jornal-editoria self-start">{t.debates.claim}</p>
              <h3 className="jornal-manchete mt-3 text-[1.55rem] sm:text-[1.75rem]">“{card.claim}”</h3>
              <p className="mt-4 font-mono text-xs uppercase tracking-widest text-gold">{t.debates.answer}</p>
              <p className="mt-2 border-l-4 border-[#c21f16] pl-4 text-lg leading-relaxed">{card.answer}</p>
              <p className="no-print mt-3 font-sans text-sm text-ink-soft">
                <CopyButton text={card.answer} label={t.common.copy} done={t.common.copied} />
                {" · "}
                <CardImage claim={card.claim} answer={card.answer} file={`cartao-${card.slug}`} labels={{ claim: t.debates.claim, answer: t.debates.answer, button: t.debates.download, kicker: t.debates.title, site: `${host}/debates` }} />
              </p>
              {card.fallacies.length > 0 && (
                <p className="mt-3 font-sans text-sm">
                  <span className="text-ink-soft">{t.debates.fallacies}: </span>
                  {card.fallacies.map((slug, i) => (
                    <span key={slug}>
                      {i > 0 && " · "}
                      <Link href={`${localePath(lang, "/falacias")}#${slug}`} className="underline hover:text-oxblood">{fallacies.get(slug) ?? slug}</Link>
                    </span>
                  ))}
                </p>
              )}
              <details className="checagem-completa mt-5 border-t-2 border-ink pt-4">
                <summary className="checagem-abrir">{card.body ? t.debates.sourcesAndMore : t.common.sources}</summary>
                {card.body && (
                  <div className="mt-4">
                    <p className="font-sans text-sm font-semibold">{t.debates.more}</p>
                    <div className="mt-2">
                      <Markdown lang={lang}>{card.body}</Markdown>
                    </div>
                  </div>
                )}
                <SourceList sources={card.sources} title={t.common.sources} />
              </details>
            </article>
          ),
        }))}
      />
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { SourceList } from "@/components/Cards";
import { Cartaz } from "@/components/Cartaz";
import { FalaciasList } from "@/components/FalaciasList";
import { Markdown } from "@/components/Markdown";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getDebates, getFallacies } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/falacias">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.fallacies.title, description: t.fallacies.lead };
}

// Guia das falácias: os truques de argumento mais comuns, cada um com exemplo e com o jeito de responder.
export default async function Falacias({ params }: PageProps<"/[lang]/falacias">) {
  const { lang, t } = await loadLang(params);
  const s = t.fallacies;
  const fallacies = getFallacies(lang);
  const names = new Map(fallacies.map((item) => [item.slug, item.name]));
  const debates = getDebates(lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Cartaz eyebrow={s.eyebrow} title={s.title} slogan={t.footer.slogan} tone="preto">
        {s.lead}
      </Cartaz>
      <p className="mt-6 border-l-4 border-gold pl-4 font-sans text-sm text-ink-soft">{s.remember}</p>
      <Untranslated lang={lang} t={t} show={fallacies.some((item) => !item.translated)} />
      <FalaciasList
        s={s}
        items={fallacies.map((item) => ({
          slug: item.slug,
          name: item.name,
          original: item.original,
          summary: item.summary,
          family: item.family,
          what: item.what,
          everyday: item.everyday,
          publicDebate: item.publicDebate,
          reply: item.reply,
          related: item.related.map((slug) => ({ slug, name: names.get(slug) ?? slug })),
          debates: debates.filter((card) => card.fallacies.includes(item.slug)).map((card) => ({ slug: card.slug, claim: card.claim })),
          untranslated: !item.translated,
          extra: (
            <>
              {item.body && (
                <div className="mt-4">
                  <Markdown lang={lang}>{item.body}</Markdown>
                </div>
              )}
              <SourceList sources={item.sources} title={t.common.sources} />
            </>
          ),
        }))}
      />
      <p className="no-print mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-6 font-sans text-sm">
        <Link href={localePath(lang, "/debates")} className="underline hover:text-oxblood">{s.toDebates}</Link>
        <Link href={localePath(lang, "/checagens")} className="underline hover:text-oxblood">{s.toChecks}</Link>
      </p>
    </div>
  );
}

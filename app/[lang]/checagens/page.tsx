// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { SourceList } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { Cartaz } from "@/components/Cartaz";
import { ComoChecar } from "@/components/ComoChecar";
import { FactCheckSearch } from "@/components/FactCheckSearch";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getCheckTools, getFactChecks, verdicts } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/checagens">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.factCheck.title, description: t.factCheck.lead };
}

export default async function Checagens({ params }: PageProps<"/[lang]/checagens">) {
  const { lang, t } = await loadLang(params);
  const checks = getFactChecks(lang);
  const toolbox = t.factCheck.toolbox;
  const groups = toolbox.groups as Record<string, string[]>;
  const toolText = toolbox.tools as Record<string, string>;
  const seals = t.factCheck.verdicts.items as Record<string, string>;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Cartaz eyebrow={t.factCheck.eyebrow} title={t.factCheck.title} slogan={t.footer.slogan} tone="preto">
        {t.factCheck.lead}
      </Cartaz>
      <FactCheckSearch s={t.factCheck} />
      <ComoChecar s={t.factCheck.steps} />
      <section aria-labelledby="selos" className="mt-10 font-sans text-sm">
        <h2 id="selos" className="font-serif text-2xl font-semibold">{t.factCheck.verdicts.title}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {verdicts.map((verdict) => (
            <div key={verdict} className="border border-rule bg-parchment-deep p-4">
              <dt className="jornal-carimbo text-lg" lang="pt-BR">{verdict}</dt>
              <dd className="mt-2">{seals[verdict]}</dd>
            </div>
          ))}
        </dl>
      </section>
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
      <section aria-labelledby="ferramentas-de-checagem" className="mt-14 border-t-8 border-ink pt-6 font-sans text-sm">
        <h2 id="ferramentas-de-checagem" className="font-serif text-3xl font-semibold">{toolbox.title}</h2>
        <p className="mt-1 text-ink-soft">{toolbox.lead}</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {getCheckTools().map(({ group, tools }) => (
            <section key={group} aria-labelledby={`grupo-${group}`}>
              <h3 id={`grupo-${group}`} className="font-semibold">{groups[group]?.[0] ?? group}</h3>
              <p className="text-ink-soft">{groups[group]?.[1]}</p>
              <ul className="mt-2 space-y-1.5">
                {tools.map((tool) => (
                  <li key={tool.id}>
                    <a href={tool.url} target="_blank" rel="noopener noreferrer" className="font-medium underline hover:text-oxblood">{tool.name}</a>
                    {toolText[tool.id] && <span className="text-ink-soft"> · {toolText[tool.id]}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-8">
          <Link href={localePath(lang, "/falacias")} className="underline hover:text-oxblood">{t.factCheck.fallaciesLink}</Link>
        </p>
      </section>
    </div>
  );
}

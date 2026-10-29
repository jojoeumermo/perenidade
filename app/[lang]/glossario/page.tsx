// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Markdown } from "@/components/Markdown";
import { Capa, Corpo } from "@/components/pagina/Capa";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { localePath } from "@/i18n/config";
import { GlossaryList } from "@/components/GlossaryList";
import { Dicionario } from "@/components/glossario/Dicionario";
import { getGlossaryIndex } from "@/lib/content";
import { normalize } from "@/lib/text";

export async function generateMetadata({ params }: PageProps<"/[lang]/glossario">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/glossario", t.glossary.title, t.glossary.lead);
}

export default async function Glossario({ params }: PageProps<"/[lang]/glossario">) {
  const { lang, t } = await loadLang(params);
  const terms = getGlossaryIndex(lang);
  return (
    <>
      <Capa
        rotulo={t.glossary.eyebrow}
        titulo={t.glossary.title}
        lado={
          <div className="cartao-preto -rotate-1 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#e0837a]">{t.glossary.eyebrow}</p>
            <p className="mt-2 font-serif text-[3.2rem] font-semibold leading-none text-[#f4ecd8]">{new Intl.NumberFormat(lang).format(terms.length)}</p>
            <p className="mt-3 text-lg leading-snug text-[#e9dcbc]">{t.glossary.lead}</p>
          </div>
        }
      >
        {t.glossary.lead}
      </Capa>
      <Corpo largura="estreita">
      <Untranslated lang={lang} t={t} show={terms.some((term) => !term.translated)} />
      {/* O dicionário da língua: qualquer palavra, além dos termos do instituto (fontes livres; veja components/glossario/Dicionario.tsx). */}
      <Dicionario s={t.glossary.dict} termos={Object.fromEntries(terms.map((term) => [normalize(term.term), { slug: term.slug, term: term.term }]))} />
      <GlossaryList
        s={t.glossary}
        items={terms.map((term) => ({
          slug: term.slug,
          term: term.term,
          summary: term.summary,
          areas: term.areas,
          lessons: term.lessons,
          original: !term.translated,
          body: term.body ? <Markdown lang={lang}>{term.body}</Markdown> : null,
        }))}
      />
      <p className="no-print mt-10 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        {t.glossary.missing}{" "}
        <Link href={localePath(lang, "/contribuir")} className="underline hover:text-oxblood">{t.nav.contribute}</Link>.
      </p>
      </Corpo>
    </>
  );
}

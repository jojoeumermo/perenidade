// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "@/components/Link";
import { Cartaz } from "@/components/Cartaz";
import { LinhaDoTempo } from "@/components/linha/LinhaDoTempo";
import { Markdown } from "@/components/Markdown";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { localePath, type Locale } from "@/i18n/config";
import { getPage, getTimeline } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/linha-do-tempo">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("linha-do-tempo", lang);
  return paginaMeta(lang, "/linha-do-tempo", page.title, page.lead);
}

/** O texto de cada acontecimento só usa **negrito** e [links](/caminho): monta isso sem passar pelo Markdown inteiro. */
function marcas(texto: string, lang: Locale): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g).map((parte, i) => {
    const negrito = /^\*\*([^*]+)\*\*$/.exec(parte);
    if (negrito) return <strong key={i}>{negrito[1]}</strong>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(parte);
    if (link) {
      return link[2].startsWith("/") ? (
        <Link key={i} href={localePath(lang, link[2])} className="underline decoration-1 underline-offset-2 hover:text-oxblood">{link[1]}</Link>
      ) : (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2 hover:text-oxblood">{link[1]}</a>
      );
    }
    return parte;
  });
}

export default async function Page({ params }: PageProps<"/[lang]/linha-do-tempo">) {
  const { lang, t } = await loadLang(params);
  const page = getPage("linha-do-tempo", lang);
  // O texto da página traz a abertura e, depois do primeiro título, o fecho ("Lutas que continuam").
  const corte = page.body.indexOf("\n## ");
  const abertura = corte === -1 ? page.body : page.body.slice(0, corte);
  const fecho = corte === -1 ? "" : page.body.slice(corte + 1);
  // Os acontecimentos ainda só existem em português.
  const idioma = originalLang(lang === "pt");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mx-auto max-w-3xl" {...originalLang(page.translated)}>
        <Cartaz eyebrow={page.eyebrow} title={page.title} slogan={t.footer.slogan} tone="preto">
          {page.lead}
        </Cartaz>
      </div>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
      <div className="mx-auto mt-8 max-w-3xl" {...originalLang(page.translated)}>
        <Markdown lang={lang}>{abertura}</Markdown>
      </div>

      <LinhaDoTempo
        lang={lang}
        s={t.timeline}
        idioma={idioma}
        acontecimentos={getTimeline().map((a) => ({ ano: a.ano, onde: a.onde, temas: a.temas, texto: marcas(a.texto, lang) }))}
      />

      {fecho && (
        <div className="linha-fecho mx-auto mt-16 max-w-3xl" {...originalLang(page.translated)}>
          <Markdown lang={lang}>{fecho}</Markdown>
        </div>
      )}
      <div className="no-print mx-auto mt-10 flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule pt-6 font-sans text-sm">
        <Link href={`${localePath(lang, "/contribuir")}?tipo=sugestao`} className="inline-block border-2 border-ink px-4 py-2 font-medium hover:border-oxblood hover:text-oxblood">{t.lists.suggestFact} →</Link>
        <Link href={`${localePath(lang, "/contribuir")}?corrigir=${encodeURIComponent("/linha-do-tempo")}`} className="text-ink-soft underline hover:text-oxblood">
          {t.common.suggestFix}
        </Link>
      </div>
    </div>
  );
}

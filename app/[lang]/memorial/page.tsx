// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { Cartaz } from "@/components/Cartaz";
import { ListaComIndice } from "@/components/ListaComIndice";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { htmlLang, localePath } from "@/i18n/config";
import { getTributes } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/memorial">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/memorial", t.memorial.title, t.memorial.lead);
}

export default async function Memorial({ params }: PageProps<"/[lang]/memorial">) {
  const { lang, t } = await loadLang(params);
  const tributes = getTributes(lang);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Cartaz eyebrow={t.memorial.eyebrow} title={t.memorial.title} slogan={t.slogans.memorial} tone="luto">
        {t.memorial.lead}
      </Cartaz>
      <Untranslated lang={lang} t={t} show={tributes.some((tribute) => !tribute.translated)} />

      <ListaComIndice
        az
        rotulo={t.memorial.title}
        items={tributes.map((tribute) => ({
          id: tribute.slug,
          nome: tribute.name,
          chaves: `${tribute.name} ${tribute.place} ${tribute.born} ${tribute.died} ${tribute.body}`,
          node: (
          <article className="flex items-center gap-5 border-t-8 border-ink bg-parchment-deep p-5 sm:gap-6 sm:p-6" {...originalLang(tribute.translated)}>
            {tribute.photo && (
              // O retrato fica entre a barra e o texto, centrado na altura do cartão.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tribute.photo} alt={tribute.name} width={360} height={450} loading="lazy" decoding="async" className="h-auto w-20 shrink-0 self-center border-2 border-ink grayscale sm:w-32" />
            )}
            <div className="min-w-0">
              <p className="font-mono text-xs text-gold">
                {tribute.born} – {tribute.died} · {tribute.place}
              </p>
              <h2 className="mt-2 text-3xl font-semibold">{tribute.name}</h2>
              <p className="mt-3 text-lg leading-relaxed">{tribute.body}</p>
              <p className="mt-4 font-sans text-xl font-black uppercase italic tracking-tight text-oxblood" lang={htmlLang[lang]}>★ {t.memorial.present}</p>
              {tribute.photoCredit && (
                <p className="mt-3 font-mono text-[0.7rem] leading-tight text-ink-soft" lang="pt-BR">
                  <a href={tribute.photoSource} target="_blank" rel="noopener noreferrer" className="hover:text-oxblood hover:underline">{tribute.photoCredit}</a>
                </p>
              )}
            </div>
          </article>
          ),
        }))}
      />

      <p className="no-print mt-10 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        {t.memorial.add}{" "}
        <Link href={localePath(lang, "/contribuir")} className="underline hover:text-oxblood">{t.memorial.addLink}</Link>.
      </p>
    </div>
  );
}

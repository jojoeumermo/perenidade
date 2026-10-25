// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { ListaDeHabilidades } from "@/components/estudo/Habilidades";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { getTrack } from "@/lib/content";
import { todosOsMapas } from "@/lib/curriculo-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/professores/mapa">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/professores/mapa", s.mapa.titulo, s.mapa.lead);
}

/** O mapa curricular (recurso "mapa-curricular"): cada aula das trilhas mapeadas ligada à BNCC e ao Enem. */
export default async function Page({ params }: PageProps<"/[lang]/professores/mapa">) {
  if (!ligado("mapa-curricular")) notFound();
  const { lang, t } = await loadLang(params);
  const { s, traduzido } = textosDoEstudo(lang);
  const mapas = [...todosOsMapas().entries()];
  const total = mapas.flatMap(([, m]) => Object.values(m.aulas).flatMap((a) => [...a.bncc, ...a.enem]));
  const aConfirmar = total.filter((h) => h.situacao === "a-confirmar").length;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={s.professores.olho} title={s.mapa.titulo}>
        {s.mapa.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <p className="mt-6 border-l-2 border-gold pl-4 font-sans text-sm text-ink-soft">{fill(s.mapa.situacaoGeral, { n: total.length, a: aConfirmar })}</p>
      {mapas.map(([slug, mapa]) => {
        const trilha = getTrack(slug, lang);
        return (
          <section key={slug} aria-labelledby={`mapa-${slug}`} className="mt-10">
            <h2 id={`mapa-${slug}`} className="text-3xl font-semibold">
              <Link href={localePath(lang, `/trilhas/${slug}`)} className="hover:text-oxblood">
                {trilha?.title ?? slug}
              </Link>
            </h2>
            <ol className="mt-4 space-y-4">
              {(trilha?.lessons ?? []).filter((l) => mapa.aulas[l.slug]).map((l) => (
                <li key={l.slug} className="border border-rule bg-parchment-deep p-4">
                  <Link href={localePath(lang, `/trilhas/${slug}/${l.slug}`)} className="font-serif text-xl font-semibold underline hover:text-oxblood">
                    {l.title}
                  </Link>
                  <div className="mt-2">
                    <ListaDeHabilidades mapa={mapa.aulas[l.slug]} s={s.mapa} />
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 font-sans text-xs text-ink-soft">
              {s.mapa.fontes}: {mapa.fontes.join(" · ")}
            </p>
          </section>
        );
      })}
    </div>
  );
}

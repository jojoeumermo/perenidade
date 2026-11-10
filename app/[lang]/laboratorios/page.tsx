// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Cartaz } from "@/components/Cartaz";
import { ancoraDoLab, CartaoDoLab, nomeDoLab } from "@/components/labs/MapaDosLaboratorios";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { groups } from "@/lib/areas";
import { FINALIDADES, labsDaDisciplina, labsDaFinalidade } from "@/lib/mapa-dos-laboratorios";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios", t.labs.title, t.labs.lead);
}

/**
 * Todos os laboratórios do site num lugar só (NOVAS TAREFAS, T21): os do próprio site, os de fora e os simuladores que
 * vivem dentro das aulas, agrupados pela finalidade ("o que eu quero fazer?") e, mais abaixo, por disciplina ("estou
 * estudando X, o que me ajuda?"). Cada cartão diz para que serve, para quem, onde fica e as aulas em que ajuda.
 * Os dados ficam em lib/mapa-dos-laboratorios.ts; a página é toda de servidor (nada de JavaScript no navegador).
 */
export default async function Page({ params }: PageProps<"/[lang]/laboratorios">) {
  const { lang, t } = await loadLang(params);
  const s = t.labs;
  const m = s.mapa;
  const chip = "inline-block border-2 border-ink px-3 py-1 font-semibold hover:border-oxblood hover:text-oxblood";
  // As disciplinas que têm laboratório, na ordem dos grupos do site.
  const porGrupo = groups
    .map((g) => ({ id: g.id, areas: g.areas.filter((a) => labsDaDisciplina(a).length > 0) }))
    .filter((g) => g.areas.length > 0);
  return (
    <>
      <div className="mx-auto max-w-[78rem] px-4 py-12 sm:px-6 lg:px-8">
        <Cartaz eyebrow={s.eyebrow} title={s.title} tone="raios">
          {s.lead}
        </Cartaz>

        <p className="max-w-[48rem] font-sans text-base leading-relaxed text-ink-soft">{m.comoAchar}</p>
        <nav aria-label={m.porFinalidade} className="no-print mt-5 font-sans text-sm">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">{m.porFinalidade}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {FINALIDADES.map((f) => (
              <li key={f}>
                <a href={`#${f}`} className={chip}>{m.finalidades[f].titulo}</a>
              </li>
            ))}
            <li>
              <a href="#por-disciplina" className={`${chip} bg-ink text-parchment hover:bg-oxblood hover:text-parchment`}>{m.porDisciplina} ↓</a>
            </li>
          </ul>
        </nav>

        {FINALIDADES.map((f) => (
          <section key={f} id={f} aria-labelledby={`titulo-${f}`} className="mt-14 scroll-mt-24">
            <h2 id={`titulo-${f}`} className="border-b-2 border-ink pb-2 font-serif text-3xl font-semibold">{m.finalidades[f].titulo}</h2>
            <p className="mt-2 max-w-[48rem] font-sans text-ink-soft">{m.finalidades[f].serve}</p>
            <div className="mt-6 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {labsDaFinalidade(f).map((lab, i) => (
                <CartaoDoLab key={lab.id} lab={lab} t={t} lang={lang} i={i} />
              ))}
            </div>
          </section>
        ))}

        <section id="por-disciplina" aria-labelledby="titulo-por-disciplina" className="mt-16 scroll-mt-24">
          <h2 id="titulo-por-disciplina" className="border-b-2 border-ink pb-2 font-serif text-3xl font-semibold">{m.porDisciplina}</h2>
          <div className="mt-6 grid gap-x-10 gap-y-8 font-sans text-sm md:grid-cols-2 xl:grid-cols-3">
            {porGrupo.map((g) => (
              <div key={g.id}>
                <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">{t.groups[g.id]}</h3>
                <dl className="mt-2 divide-y divide-rule border-y border-rule">
                  {g.areas.map((area) => (
                    <div key={area} className="py-2">
                      <dt>
                        <Link href={localePath(lang, `/estantes/${area}`)} className="font-semibold hover:text-oxblood">{t.areas[area][0]}</Link>
                      </dt>
                      <dd className="mt-0.5 text-ink-soft">
                        {labsDaDisciplina(area).map((lab, k) => (
                          <span key={lab.id}>
                            {k > 0 && " · "}
                            <a href={`#${ancoraDoLab(lab.id)}`} className="underline decoration-rule underline-offset-2 hover:text-oxblood">{nomeDoLab(lab, t, lang)}</a>
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="outros-lugares" className="mt-16">
          <h2 id="outros-lugares" className="border-b-2 border-ink pb-2 font-serif text-3xl font-semibold">{m.outrosLugares}</h2>
          <ul className="mt-6 grid gap-5 font-sans text-sm sm:grid-cols-3">
            {(
              [
                [m.ferramentas, m.ferramentasServe, "/ferramentas"],
                [m.estudio, m.estudioServe, "/estudio-de-pratica"],
                [m.jogos, m.jogosServe, "/jogos"],
              ] as const
            ).map(([nome, serve, rota]) => (
              <li key={rota} className="border border-rule bg-parchment-deep p-4">
                <Link href={localePath(lang, rota)} className="font-serif text-lg font-semibold hover:text-oxblood">{nome} →</Link>
                <p className="mt-1 leading-snug text-ink-soft">{serve}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 font-sans text-sm">
            <Link href={localePath(lang, "/laboratorios/externos")} className="underline underline-offset-4 hover:text-oxblood">{m.externosTodos} →</Link>
          </p>
        </section>

        <p className="cartao-preto mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 p-5 font-sans text-sm">
          <Link href={localePath(lang, "/sala-livre")} className="botao botao-prelo botao-menor">
            {t.nav.freeRoom} →
          </Link>
          <span className="min-w-0 flex-1 text-[#e9dcbc]">{t.salaLivre.description}</span>
        </p>
        <p className="mt-10 border-t-2 border-ink pt-5 font-sans text-sm text-ink-soft">
          <Link href={localePath(lang, "/creditos")} className="underline hover:text-prelo-texto">{s.creditos}</Link>
        </p>
      </div>
    </>
  );
}

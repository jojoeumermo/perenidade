// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { Star } from "@/components/Masthead";
import { fill, htmlLang, localePath, plural, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import type { Headline, Outlet } from "@/lib/news";

const externo = { target: "_blank", rel: "noopener noreferrer nofollow" } as const;

/**
 * O giro de notícias como a primeira página de um jornal impresso: o nome no alto entre as duas orelhas, a linha da
 * data, a manchete do momento de ponta a ponta, as chamadas em colunas com fio entre elas, a coluna das últimas e, no
 * pé, um caderno por veículo. Só há título, data e link de cada matéria (é o que os veículos distribuem): a página se
 * faz com o tamanho e o peso das letras, como se faz uma capa.
 */
export function PrimeiraPagina({ lang, t, latest, outlets, at }: { lang: Locale; t: Dict; latest: Headline[]; outlets: Outlet[]; at: string }) {
  const s = t.news;
  // As manchetes estão em português e os horários são os de Brasília, em qualquer idioma da interface.
  const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const edicao = new Intl.DateTimeFormat(htmlLang[lang], { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const [manchete, ...resto] = latest;
  const chamadas = resto.slice(0, 6);
  const ultimas = resto.slice(6, 20);
  const ativos = outlets.filter((o) => o.headlines.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header>
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1.5 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-ink-soft">
          <span>{t.footer.slogan}</span>
          <span>{s.eyebrow}</span>
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 border-t-4 border-ink pt-4 pb-3 max-md:grid-cols-1">
          {ativos.length > 0 ? (
            <p className="pagina-orelha max-md:hidden">
              <strong className="block font-serif text-3xl leading-none">{plural(lang, ativos.length, s.earOutlets)}</strong>
              <span className="mt-1 block">{s.earOutletsText}</span>
            </p>
          ) : (
            <span aria-hidden className="max-md:hidden" />
          )}
          <h1 className="text-center font-serif text-[clamp(2.7rem,7.4vw,5.9rem)] font-bold leading-[0.92] tracking-[-0.02em] text-balance">
            <Star className="mr-[0.18em] inline-block h-[0.42em] w-[0.42em] -translate-y-[0.12em] text-prelo-texto" />
            {s.title}
            <Star className="ml-[0.18em] inline-block h-[0.42em] w-[0.42em] -translate-y-[0.12em] text-prelo-texto" />
          </h1>
          <p className="pagina-orelha text-right max-md:hidden">
            <strong className="block font-serif text-3xl leading-none">{hora.format(new Date(at))}</strong>
            <span className="mt-1 block">{s.earRefresh}</span>
          </p>
        </div>
        <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y-[5px] border-double border-ink px-1 py-1.5 font-sans text-[0.72rem] font-semibold uppercase tracking-wide">
          <span>{fill(s.edition, { date: edicao.format(new Date(at)) })}</span>
          <span className="md:hidden">{fill(s.updatedShort, { time: hora.format(new Date(at)) })}</span>
          <Link href={localePath(lang, "/jornal")} className="underline underline-offset-2 hover:text-oxblood">
            {s.ownPaper} {t.journal.title}
          </Link>
        </p>
        <p className="mt-3 max-w-3xl font-serif text-lg italic leading-snug text-ink-soft">{s.lead}</p>
      </header>

      {!manchete ? (
        <p className="mt-10 border-y-4 border-ink py-10 text-center font-sans text-2xl font-black uppercase italic">{s.empty}</p>
      ) : (
        <>
          <section aria-labelledby="manchete" className="mt-6 border-b-4 border-ink pb-7" lang="pt-BR">
            <p className="font-sans text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-oxblood">
              {manchete.source} <span className="font-mono font-normal tracking-normal text-ink-soft">· <time dateTime={manchete.date}>{quando.format(new Date(manchete.date))}</time></span>
            </p>
            <h2 id="manchete" className="mt-2">
              <a href={manchete.link} {...externo} className="jornal-manchete block font-serif text-[clamp(2.1rem,5.2vw,4.3rem)] hover:text-oxblood">
                {manchete.title}
              </a>
            </h2>
          </section>

          <div className="grid gap-x-8 border-b-4 border-ink lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {chamadas.length > 0 && (
              <ol className="grid gap-x-7 sm:grid-cols-2 sm:[&>li:nth-child(even)]:border-l sm:[&>li:nth-child(even)]:border-rule sm:[&>li:nth-child(even)]:pl-7" lang="pt-BR">
                {chamadas.map((item, i) => (
                  <li key={item.link} className={`border-b border-rule py-5 ${i >= chamadas.length - 2 ? "sm:border-b-0" : ""} max-sm:last:border-b-0`}>
                    <p className="font-sans text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-oxblood">{item.source}</p>
                    <a href={item.link} {...externo} className={`jornal-manchete mt-1.5 block font-serif hover:text-oxblood ${i < 2 ? "text-[1.7rem] sm:text-3xl" : "text-xl sm:text-2xl"}`}>
                      {item.title}
                    </a>
                    <p className="mt-2 font-mono text-xs text-ink-soft">
                      <time dateTime={item.date}>{quando.format(new Date(item.date))}</time>
                    </p>
                  </li>
                ))}
              </ol>
            )}
            {ultimas.length > 0 && (
              <aside aria-labelledby="ultimas" className="py-5 lg:border-l-2 lg:border-ink lg:pl-7 max-lg:border-t-2 max-lg:border-ink" lang="pt-BR">
                <h2 id="ultimas" className="jornal-secao">
                  <span className="jornal-editoria">{s.latest}</span>
                </h2>
                <ol className="mt-1">
                  {ultimas.map((item) => (
                    <li key={item.link} className="border-b border-dotted border-rule py-2.5 last:border-b-0">
                      <p className="font-mono text-[0.68rem] text-ink-soft">
                        <time dateTime={item.date}>{hora.format(new Date(item.date))}</time> · <span className="font-sans font-bold uppercase tracking-wide text-oxblood">{item.source}</span>
                      </p>
                      <a href={item.link} {...externo} className="mt-0.5 block font-serif text-[1.05rem] font-semibold leading-snug hover:text-oxblood">
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </aside>
            )}
          </div>

          {ativos.length > 0 && (
            <section aria-labelledby="por-veiculo" className="mt-10" lang="pt-BR">
              <h2 id="por-veiculo" className="jornal-secao">
                <span className="jornal-editoria">{s.byOutlet}</span>
              </h2>
              <div className="mt-5 gap-x-8 sm:columns-2 lg:columns-3 [column-rule:1px_solid_var(--rule)]">
                {ativos.map((outlet) => {
                  const [primeira, ...outras] = outlet.headlines.slice(0, 5);
                  return (
                    <section key={outlet.name} aria-label={outlet.name} className="mb-8 break-inside-avoid border-t-[6px] border-double border-ink pt-2.5">
                      <h3 className="font-serif text-xl font-bold uppercase tracking-[0.06em]">
                        <a href={outlet.site} {...externo} className="hover:text-oxblood">{outlet.name}</a>
                      </h3>
                      <a href={primeira.link} {...externo} className="jornal-manchete mt-2 block font-serif text-xl hover:text-oxblood">
                        {primeira.title}
                      </a>
                      <p className="mt-1 font-mono text-[0.68rem] text-ink-soft">
                        <time dateTime={primeira.date}>{quando.format(new Date(primeira.date))}</time>
                      </p>
                      {outras.length > 0 && (
                        <ul className="mt-2.5 space-y-2 border-t border-rule pt-2.5">
                          {outras.map((item) => (
                            <li key={item.link} className="leading-snug">
                              <a href={item.link} {...externo} className="hover:text-oxblood">{item.title}</a>
                              <span className="ml-1.5 whitespace-nowrap font-mono text-[0.68rem] text-ink-soft"><time dateTime={item.date}>{hora.format(new Date(item.date))}</time></span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
      <p className="mt-6 border-t-[5px] border-double border-ink pt-3 font-sans text-xs leading-relaxed text-ink-soft">{s.note}</p>
    </div>
  );
}

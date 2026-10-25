// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Star } from "@/components/Masthead";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { fill, localePath } from "@/i18n/config";
import { getNews } from "@/lib/news";

// A página é refeita sozinha a cada quinze minutos (o mesmo prazo de lib/news.ts).
export const revalidate = 900;

export async function generateMetadata({ params }: PageProps<"/[lang]/noticias">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/noticias", t.news.title, t.news.description);
}

// O giro de notícias como um mural de imprensa: faixa preta com a cunha vermelha, as três manchetes
// mais recentes em destaque, as demais em colunas e, embaixo, um quadro por veículo.
export default async function Noticias({ params }: PageProps<"/[lang]/noticias">) {
  const { lang, t } = await loadLang(params);
  const s = t.news;
  const { latest, outlets, at } = await getNews();
  // As manchetes estão em português e os horários são os de Brasília, em qualquer idioma da interface.
  const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const hour = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const external = { target: "_blank", rel: "noopener noreferrer nofollow" } as const;
  const top = latest.slice(0, 3);
  const more = latest.slice(3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header>
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1.5 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-ink-soft">
          <span>{t.footer.slogan}</span>
          <span>{s.eyebrow}</span>
        </p>
        <div className="jornal-preto jornal-cartaz">
          <h1 className="jornal-cartaz-nome font-sans font-black uppercase italic">
            <span className="jornal-cartaz-baixo jornal-cartaz-titulo">{s.title}</span>
          </h1>
          <span className="jornal-cunha jornal-cunha-vermelha" aria-hidden>
            <Star className="jornal-cunha-estrela" />
          </span>
        </div>
        <p className="jornal-fio flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-1.5 font-sans text-[0.7rem] font-semibold uppercase tracking-wide">
          <span>{fill(s.updated, { time: hour.format(new Date(at)) })}</span>
          <span aria-hidden className="text-oxblood">★</span>
          <Link href={localePath(lang, "/jornal")} className="underline underline-offset-2 hover:text-oxblood">{t.journal.title}</Link>
        </p>
        <p className="mt-4 max-w-3xl text-lg leading-snug text-ink-soft">{s.lead}</p>
      </header>

      {latest.length === 0 ? (
        <p className="mt-10 border-y-4 border-ink py-10 text-center font-sans text-2xl font-black uppercase italic">{s.empty}</p>
      ) : (
        <>
          <section aria-labelledby="ultimas" className="mt-8" lang="pt-BR">
            <h2 id="ultimas" className="jornal-secao">
              <span className="jornal-editoria">{s.latest}</span>
            </h2>
            <ol className="mt-2 grid border-b-4 border-ink md:grid-cols-3">
              {top.map((item, i) => (
                <li key={item.link} className={`border-b border-rule py-5 last:border-b-0 md:border-b-0 ${i > 0 ? "md:border-l-2 md:border-ink md:pl-6" : ""} ${i < top.length - 1 ? "md:pr-6" : ""}`}>
                  <p className="font-sans text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-oxblood">{item.source}</p>
                  <a href={item.link} {...external} className="jornal-manchete mt-2 block text-2xl hover:text-oxblood sm:text-3xl">
                    {item.title}
                  </a>
                  <p className="mt-3 font-mono text-xs text-ink-soft">
                    <time dateTime={item.date}>{when.format(new Date(item.date))}</time>
                  </p>
                </li>
              ))}
            </ol>
            {more.length > 0 && (
              <ol className="mt-2 gap-x-8 md:columns-2 lg:columns-3 [column-rule:1px_solid_var(--rule)]">
                {more.map((item) => (
                  <li key={item.link} className="break-inside-avoid border-b border-rule py-3">
                    <p className="font-sans text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-oxblood">
                      {item.source} <span className="font-mono font-normal tracking-normal text-ink-soft">· <time dateTime={item.date}>{when.format(new Date(item.date))}</time></span>
                    </p>
                    <a href={item.link} {...external} className="mt-1 block font-serif text-lg font-semibold leading-snug hover:text-oxblood">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="por-veiculo" className="mt-12" lang="pt-BR">
            <h2 id="por-veiculo" className="jornal-secao">
              <span className="jornal-editoria">{s.byOutlet}</span>
            </h2>
            <div className="mt-6 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {outlets.map((outlet) => (
                <div key={outlet.name} className="border-t-8 border-ink pt-3">
                  <h3 className="font-sans text-lg font-black uppercase italic leading-tight tracking-tight">
                    <a href={outlet.site} {...external} className="hover:text-oxblood">{outlet.name}</a>
                  </h3>
                  <ol className="mt-3 space-y-3">
                    {outlet.headlines.slice(0, 5).map((item, i) => (
                      <li key={item.link} className="flex gap-3">
                        <span aria-hidden className="pt-1 font-mono text-xs font-medium text-oxblood">{String(i + 1).padStart(2, "0")}</span>
                        <div>
                          <a href={item.link} {...external} className="text-lg leading-snug hover:text-oxblood">{item.title}</a>
                          <span className="ml-2 whitespace-nowrap font-mono text-xs text-ink-soft"><time dateTime={item.date}>{when.format(new Date(item.date))}</time></span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      <p className="mt-12 border-t-4 border-ink pt-4 font-sans text-sm text-ink-soft">{s.note}</p>
    </div>
  );
}

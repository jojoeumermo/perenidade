// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { getNews } from "@/lib/news";

// A página é refeita sozinha a cada quinze minutos (o mesmo prazo de lib/news.ts).
export const revalidate = 900;

export async function generateMetadata({ params }: PageProps<"/[lang]/noticias">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.news.title, description: t.news.description };
}

export default async function Noticias({ params }: PageProps<"/[lang]/noticias">) {
  const { lang, t } = await loadLang(params);
  const s = t.news;
  const { latest, outlets, at } = await getNews();
  // As manchetes estão em português e os horários são os de Brasília, em qualquer idioma da interface.
  const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const hour = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const external = { target: "_blank", rel: "noopener noreferrer nofollow" } as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={s.eyebrow} title={s.title}>
        {s.lead}
      </PageHeading>
      <p className="mt-4 font-mono text-xs text-ink-soft">
        {fill(s.updated, { time: hour.format(new Date(at)) })} · <Link href={localePath(lang, "/jornal")} className="underline hover:text-oxblood">{t.nav.journal}</Link>
      </p>

      {latest.length === 0 ? (
        <p className="mt-10 text-lg text-ink-soft">{s.empty}</p>
      ) : (
        <>
          <section className="mt-8" lang="pt-BR">
            <h2 className="border-b-4 border-ink pb-2 font-sans text-sm font-black uppercase tracking-wide">{s.latest}</h2>
            <ol className="divide-y divide-rule">
              {latest.map((item) => (
                <li key={item.link} className="py-3">
                  <a href={item.link} {...external} className="font-serif text-xl font-semibold leading-snug hover:text-oxblood">
                    {item.title}
                  </a>
                  <p className="mt-1 font-mono text-xs text-ink-soft">
                    {item.source} · <time dateTime={item.date}>{when.format(new Date(item.date))}</time>
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12" lang="pt-BR">
            <h2 className="border-b-4 border-ink pb-2 font-sans text-sm font-black uppercase tracking-wide">{s.byOutlet}</h2>
            <div className="mt-4 grid gap-x-8 gap-y-8 md:grid-cols-2">
              {outlets.map((outlet) => (
                <div key={outlet.name}>
                  <h3 className="font-serif text-2xl font-semibold">
                    <a href={outlet.site} {...external} className="hover:text-oxblood">{outlet.name}</a>
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {outlet.headlines.slice(0, 5).map((item) => (
                      <li key={item.link} className="border-l-2 border-gold pl-3">
                        <a href={item.link} {...external} className="text-lg leading-snug hover:text-oxblood">{item.title}</a>
                        <span className="ml-2 whitespace-nowrap font-mono text-xs text-ink-soft"><time dateTime={item.date}>{when.format(new Date(item.date))}</time></span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      <p className="mt-12 border-t border-rule pt-4 font-sans text-sm text-ink-soft">{s.note}</p>
    </div>
  );
}

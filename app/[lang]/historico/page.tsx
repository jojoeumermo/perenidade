// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { fill, htmlLang, localePath } from "@/i18n/config";
import { notFound } from "next/navigation";
import { describePart, publicHistory, TITLES } from "@/lib/history";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/historico">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.history.title, description: t.history.description };
}

export default async function Historico({ params }: PageProps<"/[lang]/historico">) {
  const { lang, t } = await loadLang(params);
  if (!site.historyFrom) notFound();
  const changes = publicHistory(site.historyFrom, lang);
  const date = new Intl.DateTimeFormat(htmlLang[lang], { timeZone: "UTC" });
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={t.history.eyebrow} title={t.history.title}>
        {t.history.lead}
      </PageHeading>

      {changes.length === 0 ? (
        <p className="mt-10 text-lg text-ink-soft">{t.history.unavailable}</p>
      ) : (
        <ol className="mt-10 border-l-2 border-gold">
          {changes.map((change) => (
            <li key={change.date} className="relative pb-8 pl-6">
              <span aria-hidden className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-gold" />
              <p className="font-mono text-xs text-gold">
                <time dateTime={change.date}>{date.format(new Date(change.date))}</time>
              </p>
              {/* O resumo é montado a partir dos arquivos; as aulas novas aparecem pelo título. */}
              <ul className="mt-1 space-y-2">
                {change.parts.map((part) => {
                  const links = part.links?.slice(0, TITLES) ?? [];
                  const rest = part.count - links.length;
                  return (
                    <li key={`${part.kind}-${part.action}-${part.area ?? ""}`}>
                      <p className="text-xl">{describePart(part, lang, t)}</p>
                      {links.length > 0 && (
                        <p className="mt-0.5 font-sans text-sm text-ink-soft">
                          {links.map((link, i) => (
                            <span key={link.href}>
                              {i > 0 && " · "}
                              <Link href={localePath(lang, link.href)} lang={link.translated ? undefined : "pt-BR"} className="underline decoration-rule underline-offset-2 hover:text-oxblood">
                                {link.title}
                              </Link>
                            </span>
                          ))}
                          {rest > 0 && ` · ${fill(t.history.more, { n: rest })}`}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { fill, htmlLang } from "@/i18n/config";
import { notFound } from "next/navigation";
import { publicHistory } from "@/lib/history";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/historico">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.history.title, description: t.history.description };
}

/** "content/trilhas/x/01-aula.md" vira "trilhas/x/aula": curto e igual em todos os idiomas. */
const describe = (file: string) => file.replace(/^content\//, "").replace(/\/\d+-/, "/").replace(/\.(md|json)$/, "");

export default async function Historico({ params }: PageProps<"/[lang]/historico">) {
  const { lang, t } = await loadLang(params);
  if (!site.historyFrom) notFound();
  const changes = publicHistory(site.historyFrom);
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
              <p className="font-mono text-xs text-gold">{date.format(new Date(change.date))}</p>
              <p className="mt-1 text-xl">{change.counts.map(([kind, n]) => `${t.history.kinds[kind]}: ${n}`).join(" · ")}</p>
              <p className="mt-1 font-mono text-xs text-ink-soft">
                {change.files.slice(0, 4).map(describe).join(" · ")}
                {change.files.length > 4 && ` · ${fill(t.history.more, { n: change.files.length - 4 })}`}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

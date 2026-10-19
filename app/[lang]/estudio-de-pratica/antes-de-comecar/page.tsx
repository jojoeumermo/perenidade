// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/estudio-de-pratica/antes-de-comecar">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/estudio-de-pratica/antes-de-comecar", t.practiceStudio.before.title, t.practiceStudio.before.lead);
}

/** Antes de começar: navegador, atalhos do Premiere no FilmCraft, como salvar e exportar, e a tabela de equivalências. */
export default async function AntesDeComecar({ params }: PageProps<"/[lang]/estudio-de-pratica/antes-de-comecar">) {
  const { lang, t } = await loadLang(params);
  const s = t.practiceStudio;
  const b = s.before;
  const secao = "mt-10 font-serif text-2xl font-semibold";
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href={localePath(lang, "/estudio-de-pratica")} className="font-sans text-sm text-ink-soft hover:text-oxblood">← {b.back}</Link>
      <div className="mt-6">
        <PageHeading eyebrow={s.title} title={b.title}>{b.lead}</PageHeading>
      </div>
      <ul className="mt-6 space-y-1 border-l-4 border-gold pl-3 font-sans text-sm">
        <li>{s.alpha}</li>
        <li>{s.local}</li>
      </ul>
      <h2 className={secao}>{b.browserTitle}</h2>
      <p className="mt-2 text-lg">{b.browser}</p>
      <h2 className={secao}>{b.shortcutsTitle}</h2>
      <p className="mt-2 text-lg">{b.shortcuts}</p>
      <h2 className={secao}>{b.saveTitle}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-lg">{b.save.map((x) => <li key={x}>{x}</li>)}</ul>
      <h2 className={secao}>{b.tableTitle}</h2>
      <p className="mt-1 font-sans text-sm text-ink-soft">{b.tableNote}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left font-sans text-sm">
          <thead className="text-xs text-ink-soft">
            <tr className="border-b border-rule"><th scope="col" className="py-2 font-normal">{b.colFrom}</th><th scope="col" className="font-normal">{b.colTo}</th></tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {b.rows.map(([de, para]) => <tr key={de}><td className="py-2 pr-4">{de}</td><td className="py-2">{para}</td></tr>)}
          </tbody>
        </table>
      </div>
      <h2 className={secao}>{s.limitsTitle}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6 font-sans text-sm text-ink-soft">{s.limits.map((x) => <li key={x}>{x}</li>)}</ul>
      <p className="mt-8 font-sans text-xs text-ink-soft"><span className="font-semibold">{s.creditsTitle}:</span> {s.credits}</p>
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Image from "next/image";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import bust from "@/public/lucia.png";

export async function generateMetadata({ params }: PageProps<"/[lang]/dedicatoria">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/dedicatoria", t.dedication.title, t.dedication.text[0]);
}

// A homenagem a quem dá nome ao instituto, no formato de um verbete de dicionário.
export default async function Dedicatoria({ params }: PageProps<"/[lang]/dedicatoria">) {
  const { t } = await loadLang(params);
  const d = t.dedication;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-center font-mono text-xs uppercase tracking-[0.3em] text-gold">{d.eyebrow}</p>
      <h1 className="mt-4 text-center text-5xl font-semibold italic text-oxblood sm:text-7xl">{d.title}</h1>
      <p aria-hidden className="mt-8 text-center text-2xl text-gold">◈</p>

      <article className="mt-10 border border-rule bg-parchment-deep p-8 sm:p-12">
        <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-rule pb-5" lang="pt-BR">
          <h2 className="text-5xl font-semibold">Lúcia</h2>
          <span className="font-mono text-sm text-ink-soft">Lú·ci·a</span>
        </header>
        <div>
          <p className="mt-5 font-sans text-sm italic text-ink-soft">{d.kind}</p>
          <ol className="mt-5 list-decimal space-y-3 pl-6 text-xl leading-relaxed marker:font-mono marker:text-base marker:text-gold">
            {d.senses.map((sense) => (
              <li key={sense}>{sense}</li>
            ))}
          </ol>
          <dl className="mt-8 border-t border-rule pt-5 font-sans text-sm">
            <dt className="font-mono text-xs uppercase tracking-widest text-gold">{d.etymLabel}</dt>
            <dd className="mt-1 text-ink-soft">{d.etym}</dd>
            <dd className="mt-2 text-ink-soft">{d.related}</dd>
          </dl>
        </div>
      </article>

      {/* O busto de Lúcia, logo antes do texto da dedicatória. */}
      <Image src={bust} alt={d.bustAlt} priority sizes="(max-width: 640px) 80vw, 360px" className="mx-auto mt-14 h-auto w-4/5 max-w-[360px]" />

      <div className="mx-auto mt-10 max-w-xl space-y-5 text-center text-2xl leading-relaxed">
        {d.text.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <p className="mt-12 text-center text-4xl font-semibold italic text-oxblood">{d.closing}</p>
      <p className="mt-4 text-center font-mono text-xs uppercase tracking-widest text-ink-soft">{d.sign}</p>
    </div>
  );
}

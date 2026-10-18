// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContributeForm } from "@/components/ContributeForm";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { localePath } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/contribuir">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/contribuir", t.contribute.title, t.contribute.description);
}

/**
 * Contribuir: o formulário logo depois do título; as regras e os quatro passos ficam ao lado (no computador) ou num
 * bloco recolhível (no celular). Depois de enviar, a pessoa recebe um código e acompanha a situação aqui mesmo.
 */
export default async function Contribuir({ params }: PageProps<"/[lang]/contribuir">) {
  const { lang, t } = await loadLang(params);
  const c = t.contribute;
  const regras = (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-soft">
      {c.rules.map((rule) => (
        <li key={rule}>{rule}</li>
      ))}
    </ul>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={c.eyebrow} title={c.title}>
        {c.lead}
      </PageHeading>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div>
          <details className="mb-6 border border-rule p-4 font-sans text-sm lg:hidden">
            <summary className="cursor-pointer">
              <span className="font-semibold">{c.rulesTitle}:</span> {c.rulesSummary}
            </summary>
            {regras}
          </details>
          <Suspense>
            <ContributeForm s={c} />
          </Suspense>
        </div>

        <aside className="space-y-8 font-sans text-sm lg:sticky lg:top-24 lg:self-start">
          <section className="hidden lg:block" aria-labelledby="regras-titulo">
            <h2 id="regras-titulo" className="font-serif text-xl font-semibold">{c.rulesTitle}</h2>
            {regras}
          </section>
          <section aria-labelledby="como-titulo">
            <h2 id="como-titulo" className="font-serif text-xl font-semibold">{c.howTitle}</h2>
            <ol className="mt-3 space-y-4">
              {c.steps.map(([title, description], i) => (
                <li key={title} className="border-l-2 border-gold pl-4">
                  <p className="font-mono text-xs text-gold">{String(i + 1).padStart(2, "0")}</p>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-ink-soft">{description}</p>
                </li>
              ))}
            </ol>
          </section>
          <p className="border-t border-rule pt-4 text-ink-soft">
            <Link href={localePath(lang, "/voluntarios")} className="underline hover:text-oxblood">{c.more}</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContributeForm } from "@/components/ContributeForm";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/contribuir">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.contribute.title, description: t.contribute.description };
}

export default async function Contribuir({ params }: PageProps<"/[lang]/contribuir">) {
  const { lang, t } = await loadLang(params);
  const c = t.contribute;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={c.eyebrow} title={c.title}>
        {c.lead}
      </PageHeading>

      <ul className="mt-8 list-disc space-y-1 pl-5 text-lg text-ink-soft">
        {c.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>

      <ol className="mt-10 grid gap-5 font-sans text-sm sm:grid-cols-2">
        {c.steps.map(([title, description], i) => (
          <li key={title} className="border-l-2 border-gold pl-4">
            <p className="font-mono text-xs text-gold">{String(i + 1).padStart(2, "0")}</p>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-ink-soft">{description}</p>
          </li>
        ))}
      </ol>

      <Suspense>
        <ContributeForm s={c} />
      </Suspense>

      <p className="mt-10 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        <Link href={localePath(lang, "/voluntarios")} className="underline hover:text-oxblood">{c.more}</Link>
      </p>
    </div>
  );
}

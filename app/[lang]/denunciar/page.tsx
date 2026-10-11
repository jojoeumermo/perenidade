// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeading } from "@/components/PageHeading";
import { ReportForm } from "@/components/ReportForm";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/denunciar">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.report.title, description: t.report.description };
}

export default async function Denunciar({ params }: PageProps<"/[lang]/denunciar">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={t.report.eyebrow} title={t.report.title}>
        {t.report.lead}
      </PageHeading>
      <ol className="mt-10 grid gap-5 font-sans text-sm sm:grid-cols-3">
        {t.report.stages.map(([title, description], i) => (
          <li key={title} className="border-l-2 border-gold pl-4">
            <p className="font-mono text-xs text-gold">{String(i + 1).padStart(2, "0")}</p>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-ink-soft">{description}</p>
          </li>
        ))}
      </ol>
      <Suspense>
        <ReportForm s={t.report} />
      </Suspense>
    </div>
  );
}

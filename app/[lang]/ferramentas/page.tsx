// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { areaTools, tools, type AreaSlug } from "@/lib/areas";

export async function generateMetadata({ params }: PageProps<"/[lang]/ferramentas">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.tools.title, description: t.tools.lead };
}

export default async function Ferramentas({ params }: PageProps<"/[lang]/ferramentas">) {
  const { lang, t } = await loadLang(params);
  const names = t.toolNames as Record<string, string[]>;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.tools.eyebrow} title={t.tools.title}>
        {t.tools.lead}
      </PageHeading>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => {
          const areas = (Object.keys(areaTools) as AreaSlug[]).filter((area) => areaTools[area]?.includes(tool));
          return (
            <Link key={tool} href={localePath(lang, `/ferramentas/${tool}`)} className="group border border-rule bg-parchment-deep p-5 hover:border-gold">
              <p className="font-mono text-xs uppercase tracking-widest text-gold">{areas.map((area) => t.areas[area][0]).join(" · ")}</p>
              <p className="mt-1 text-2xl font-semibold group-hover:text-oxblood">{names[tool][0]}</p>
              <p className="mt-1 text-ink-soft">{names[tool][1]}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

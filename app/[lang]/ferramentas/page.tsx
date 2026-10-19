// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { localePath } from "@/i18n/config";
import { areaTools, groups, tools, type AreaSlug } from "@/lib/areas";

/** As ferramentas que consultam um serviço (dicionário, frases, pronúncia) ou baixam um interpretador na primeira vez. */
const precisaDeInternet = new Set(["dicionario", "frases", "pronuncia", "python", "php"]);

export async function generateMetadata({ params }: PageProps<"/[lang]/ferramentas">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/ferramentas", t.tools.title, t.tools.lead);
}

export default async function Ferramentas({ params }: PageProps<"/[lang]/ferramentas">) {
  const { lang, t } = await loadLang(params);
  const names = t.toolNames as Record<string, string[]>;
  // Por matéria: cada ferramenta entra no grupo da primeira disciplina que a usa; as que servem a todas ficam juntas.
  const grupoDe = (tool: string): string => {
    for (const grupo of groups) if (grupo.areas.some((area) => areaTools[area]?.includes(tool))) return grupo.id;
    return "";
  };
  const grupos = [
    { titulo: t.lists.anySubject, lista: tools.filter((tool) => grupoDe(tool) === "") },
    ...groups.map((grupo) => ({ titulo: t.groups[grupo.id], lista: tools.filter((tool) => grupoDe(tool) === grupo.id) })),
  ].filter((g) => g.lista.length > 0);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.tools.eyebrow} title={t.tools.title}>
        {t.tools.lead}
      </PageHeading>
      <p className="mt-6 border-2 border-ink bg-parchment-deep p-4 font-sans">
        <Link href={localePath(lang, "/estudio-de-pratica")} className="font-serif text-xl font-semibold hover:text-oxblood">{t.practiceStudio.title} →</Link>
        <span className="mt-1 block text-sm text-ink-soft">{t.practiceStudio.lead}</span>
      </p>
      {grupos.map(({ titulo, lista }) => (
        <section key={titulo} className="mt-10">
          <h2 className="border-b border-rule pb-2 text-2xl font-semibold">{titulo}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {lista.map((tool) => {
              const areas = (Object.keys(areaTools) as AreaSlug[]).filter((area) => areaTools[area]?.includes(tool));
              return (
                <Link key={tool} href={localePath(lang, `/ferramentas/${tool}`)} className="group border border-rule bg-parchment-deep p-5 hover:border-gold">
                  <p className="font-mono text-xs uppercase tracking-widest text-gold">{areas.map((area) => t.areas[area][0]).join(" · ") || t.lists.anySubject}</p>
                  <p className="mt-1 text-2xl font-semibold group-hover:text-oxblood">{names[tool][0]}</p>
                  <p className="mt-1 text-ink-soft">{names[tool][1]}</p>
                  {!precisaDeInternet.has(tool) && <p className="mt-2 inline-block border border-rule px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-ink-soft">{t.lists.offline}</p>}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { localePath } from "@/i18n/config";
import { Vitrine } from "@/components/tools/Vitrine";
import { type ItemDaVitrine, textosDe } from "@/components/tools/vitrine-dados";
import { areaTools, groups, LABS, tools, type AreaSlug } from "@/lib/areas";

/** As ferramentas que consultam um serviço (dicionário, frases, pronúncia) ou baixam um interpretador na primeira vez. */
const precisaDeInternet = new Set(["dicionario", "frases", "pronuncia", "python", "php"]);

export async function generateMetadata({ params }: PageProps<"/[lang]/ferramentas">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/ferramentas", t.tools.title, t.tools.lead);
}

export default async function Ferramentas({ params }: PageProps<"/[lang]/ferramentas">) {
  const { lang, t } = await loadLang(params);
  const names = t.toolNames as Record<string, string[]>;
  const labs = t.labs as unknown as Record<string, string>;
  // Por matéria: cada ferramenta entra no grupo da primeira disciplina que a usa; as que servem a todas ficam juntas.
  const grupoDe = (tool: string): string => {
    for (const grupo of groups) if (grupo.areas.some((area) => areaTools[area]?.includes(tool))) return t.groups[grupo.id];
    return t.lists.anySubject;
  };
  const itens: ItemDaVitrine[] = tools.map((tool) => ({
    id: tool,
    nome: names[tool][0],
    descricao: names[tool][1],
    grupo: grupoDe(tool),
    materias: (Object.keys(areaTools) as AreaSlug[]).filter((area) => areaTools[area]?.includes(tool)).map((area) => t.areas[area][0]).slice(0, 3).join(" · "),
    offline: !precisaDeInternet.has(tool),
  }));
  const grupos = [t.lists.anySubject, ...groups.map((g) => t.groups[g.id])].filter((g, i, l) => l.indexOf(g) === i && itens.some((x) => x.grupo === g));
  const laboratorios = (Object.keys(LABS) as (keyof typeof LABS)[]).map((id) => ({ nome: labs[id] ?? id, href: localePath(lang, LABS[id]) }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.tools.eyebrow} title={t.tools.title}>
        {t.tools.lead}
      </PageHeading>
      <p className="mt-6 rounded-md border-2 border-ink bg-parchment-deep p-4 font-sans">
        <Link href={localePath(lang, "/estudio-de-pratica")} className="font-serif text-xl font-semibold hover:text-oxblood">{t.practiceStudio.title} →</Link>
        <span className="mt-1 block text-sm text-ink-soft">{t.practiceStudio.lead}</span>
      </p>
      <Vitrine itens={itens} grupos={grupos} laboratorios={laboratorios} s={textosDe(t)} />
    </div>
  );
}

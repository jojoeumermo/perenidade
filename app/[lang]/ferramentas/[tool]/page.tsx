// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeading } from "@/components/PageHeading";
import { CodeRunner } from "@/components/tools/CodeRunner";
import { Keyboard, Metronome, NoteReading, Tuner } from "@/components/tools/Music";
import { Pronounce } from "@/components/tools/Pronounce";
import { Calculator, CompoundInterest, NumberBases, PeriodicTable } from "@/components/tools/Science";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { areaTools, tools, type AreaSlug, type ToolId } from "@/lib/areas";
import { withLangs } from "@/lib/params";

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(tools.map((tool) => ({ tool })));
}

const isTool = (value: string): value is ToolId => (tools as readonly string[]).includes(value);

export async function generateMetadata({ params }: PageProps<"/[lang]/ferramentas/[tool]">): Promise<Metadata> {
  const { t } = await loadLang(params);
  const { tool } = await params;
  const names = t.toolNames as Record<string, string[]>;
  return isTool(tool) ? { title: names[tool][0], description: names[tool][1] } : {};
}

export default async function Ferramenta({ params }: PageProps<"/[lang]/ferramentas/[tool]">) {
  const { lang, t } = await loadLang(params);
  const { tool } = await params;
  if (!isTool(tool)) notFound();

  const s = t.tools;
  const [name, description] = (t.toolNames as Record<string, string[]>)[tool];
  const areas = (Object.keys(areaTools) as AreaSlug[]).filter((area) => areaTools[area]?.includes(tool));
  const body: Record<ToolId, React.ReactNode> = {
    // O editor lê o código vindo de uma aula pelo endereço, por isso espera o navegador para aparecer.
    python: <Suspense><CodeRunner language="python" s={s.code} /></Suspense>,
    php: <Suspense><CodeRunner language="php" s={s.code} /></Suspense>,
    afinador: <Tuner s={s.music} />,
    metronomo: <Metronome s={s.music} />,
    teclado: <Keyboard s={s.music} />,
    "leitura-de-notas": <NoteReading s={s.music} />,
    "tabela-periodica": <PeriodicTable s={s.table} lang={lang} />,
    calculadora: <Calculator s={s.calc} lang={lang} />,
    "juros-compostos": <CompoundInterest s={s.interest} lang={lang} />,
    "bases-numericas": <NumberBases s={s.bases} />,
    pronuncia: <Pronounce s={s.speak} initial={lang === "en" ? "es" : "en"} />,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href={localePath(lang, "/ferramentas")} className="font-sans text-sm text-ink-soft hover:text-oxblood">
        ← {s.title}
      </Link>
      <div className="mt-6">
        <PageHeading eyebrow={s.eyebrow} title={name}>
          {description}
        </PageHeading>
      </div>
      {body[tool]}
      {areas.length > 0 && (
        <p className="mt-10 border-t border-rule pt-5 font-sans text-sm text-ink-soft">
          {s.usedIn}{" "}
          {areas.map((area, i) => (
            <span key={area}>
              {i > 0 && " · "}
              <Link href={localePath(lang, `/estantes/${area}`)} className="underline decoration-gold underline-offset-4 hover:text-oxblood">
                {t.areas[area][0]}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

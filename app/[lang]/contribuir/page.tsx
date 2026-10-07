import type { Metadata } from "next";
import Link from "next/link";
import { ContributeForm } from "@/components/ContributeForm";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getTracks } from "@/lib/content";
import { github } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/contribuir">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.contribute.title, description: t.contribute.description };
}

export default async function Contribuir({ params }: PageProps<"/[lang]/contribuir">) {
  const { lang, t } = await loadLang(params);
  const c = t.contribute;
  const tracks = getTracks(lang).map((track) => ({
    slug: track.slug,
    title: track.title,
    nextOrder: Math.max(0, ...track.lessons.map((lesson) => lesson.order)) + 1,
  }));

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

      <ContributeForm tracks={tracks} />

      <div className="mt-10 space-y-3 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        <p>{c.account}</p>
        <p>
          {c.fixExisting}{" "}
          <a href={github.newIssue("sugestao.yml", {})} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
            {c.openSuggestion}
          </a>
          . {c.seeQueue}{" "}
          <Link href={localePath(lang, "/moderacao")} className="underline hover:text-oxblood">{t.nav.moderation}</Link>.
        </p>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { ModerationQueue } from "@/components/ModerationQueue";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { github } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/moderacao">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.moderation.title, description: t.moderation.description };
}

export default async function Moderacao({ params }: PageProps<"/[lang]/moderacao">) {
  const { t } = await loadLang(params);
  const m = t.moderation;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={m.eyebrow} title={m.title}>
        {m.lead}
      </PageHeading>

      <div className="mt-10 grid gap-5 font-sans text-sm sm:grid-cols-3">
        {m.facts.map(([title, description]) => (
          <div key={title} className="border-l-2 border-gold pl-4">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-ink-soft">{description}</p>
          </div>
        ))}
      </div>

      <ModerationQueue />

      <p className="mt-12 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        {m.guideBefore}{" "}
        <a href={github.file("docs/MODERACAO.md")} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
          {m.guide}
        </a>
        .
      </p>
    </div>
  );
}

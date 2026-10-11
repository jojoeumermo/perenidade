// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, localePath } from "@/i18n/config";
import { getQuestions } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/perguntas">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.questions.title, description: t.questions.lead };
}

// A teoria começa pela vida real: cada pergunta do dia a dia leva aos materiais que ajudam a respondê-la.
export default async function Perguntas({ params }: PageProps<"/[lang]/perguntas">) {
  const { lang, t } = await loadLang(params);
  const questions = getQuestions();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={t.questions.eyebrow} title={t.questions.title}>
        {t.questions.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={lang !== defaultLocale} />
      <div className="mt-10 space-y-6" lang="pt-BR">
        {questions.map((question, i) => (
          <article key={question.pergunta} id={`p${i + 1}`} className="scroll-mt-6 border-l-4 border-gold bg-parchment-deep p-6">
            <h2 className="text-2xl font-semibold">{question.pergunta}</h2>
            <p className="mt-2 text-lg text-ink-soft">{question.resposta}</p>
            <ul className="mt-4 space-y-1 font-sans text-sm">
              {question.links.map((link) => (
                <li key={link.href}>
                  <Link href={localePath(lang, link.href)} className="underline hover:text-oxblood">{link.titulo}</Link>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

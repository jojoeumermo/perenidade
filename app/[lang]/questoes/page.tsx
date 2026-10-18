// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { BancoDeQuestoes, type QuestaoDoBanco } from "@/components/BancoDeQuestoes";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getTracks } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/questoes">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/questoes", t.lists.bankTitle, t.lists.bankLead);
}

/** Todas as questões de todas as aulas, lidas do conteúdo no build: quando uma aula nova com teste entra, o banco cresce sozinho. */
export default async function Page({ params }: PageProps<"/[lang]/questoes">) {
  const { lang, t } = await loadLang(params);
  const questoes: QuestaoDoBanco[] = getTracks(lang).flatMap((track) =>
    track.lessons.flatMap((lesson) =>
      lesson.quiz.map((q, i) => ({ id: `${track.slug}/${lesson.slug}/${i}`, area: track.area, trilha: track.title, aula: lesson.title, href: `/trilhas/${track.slug}/${lesson.slug}`, pergunta: q.question, opcoes: q.options, resposta: q.answer, explicacao: q.explanation })),
    ),
  );
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={t.lists.bankEyebrow} title={t.lists.bankTitle}>
        {t.lists.bankLead}
      </PageHeading>
      <p className="mt-6 font-sans text-sm">
        <Link href={`${localePath(lang, "/contribuir")}?tipo=questao`} className="inline-block bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood">{t.lists.bankSend} →</Link>
      </p>
      <BancoDeQuestoes questoes={questoes} />
    </div>
  );
}

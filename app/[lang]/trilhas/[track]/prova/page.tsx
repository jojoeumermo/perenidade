// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { Exam } from "@/components/Exam";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, localePath } from "@/i18n/config";
import { getTrack, getTracks } from "@/lib/content";
import { withLangs } from "@/lib/params";
import { textosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { aulasDoCurso, trilhaDe } from "@/lib/escola/cursos";
import { carregarCursos } from "@/lib/escola/cursos-servidor";
import { ligado } from "@/lib/recursos";
import "@/styles/escola-avaliacao.css";

export const dynamicParams = false;

/** A prova só existe para trilhas com questões suficientes. */
const MINIMUM = 10;
const questionsOf = (track: NonNullable<ReturnType<typeof getTrack>>) =>
  track.lessons.flatMap((lesson) => lesson.quiz.map((question) => ({ ...question, href: `/trilhas/${track.slug}/${lesson.slug}`, explanation: [question.explanation, `(${lesson.title})`].filter(Boolean).join(" ") })));

export function generateStaticParams() {
  return withLangs(
    getTracks(defaultLocale)
      .filter((track) => questionsOf(track).length >= MINIMUM)
      .map((track) => ({ track: track.slug })),
  );
}

export async function generateMetadata({ params }: PageProps<"/[lang]/trilhas/[track]/prova">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  const track = getTrack((await params).track, lang);
  return track ? { title: `${t.tracks.exam}: ${track.title}`, robots: { index: false } } : {};
}

export default async function ExamPage({ params }: PageProps<"/[lang]/trilhas/[track]/prova">) {
  const { lang, t } = await loadLang(params);
  const track = getTrack((await params).track, lang);
  if (!track) notFound();
  const questions = questionsOf(track);
  if (questions.length < MINIMUM) notFound();
  // Com a Escola ligada (E4-13; docs/escola/avaliacao.md): os modos em dupla e de proficiência, a prova guardada no
  // aparelho e o retorno por competência. Desligada, a prova fica como sempre foi.
  const sa = ligado("escola") ? textosDaAvaliacao(lang) : null;
  const escola = sa
    ? {
        trilha: track.slug,
        titulos: Object.fromEntries(track.lessons.map((l) => [`${track.slug}/${l.slug}`, l.title])),
        disponiveis: Object.fromEntries(track.lessons.filter((l) => l.quiz.length > 0).map((l) => [`${track.slug}/${l.slug}`, l.quiz.length])),
        cursos: carregarCursos()
          .filter((c) => aulasDoCurso(c).some((a) => trilhaDe(a) === track.slug))
          .map((c) => ({ slug: c.slug, titulo: c.titulo })),
        s: { retorno: sa.retorno, prova: sa.prova, dupla: sa.dupla, proficiencia: sa.proficiencia },
      }
    : undefined;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href={localePath(lang, `/trilhas/${track.slug}`)} className="font-sans text-sm text-ink-soft hover:text-oxblood" {...originalLang(track.translated)}>
        ← {track.title}
      </Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-gold">{t.tracks.exam}</p>
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl" {...originalLang(track.translated)}>
        {track.title}
      </h1>
      <p className="mt-3 text-xl text-ink-soft">{t.tracks.examLead}</p>
      <Untranslated lang={lang} t={t} show={!track.translated} />
      <div {...originalLang(track.translated)}>
        <Exam questions={questions} s={t.tracks} escola={escola} />
      </div>
    </div>
  );
}

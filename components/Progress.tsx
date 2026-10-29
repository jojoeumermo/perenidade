// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import { rememberLesson, setCompleted, useCompleted, useLastLesson, type LastLesson } from "@/lib/progress";
import { L, useI18n } from "./I18n";

interface LessonLink {
  id: string;
  path: string;
  title: string;
  /** false para aulas do roteiro que ainda não foram escritas. */
  ready?: boolean;
}

/** Lista de aulas da trilha: as prontas com a marca de concluída, as do roteiro como "em preparação". */
export function LessonList({ lessons, currentId }: { lessons: LessonLink[]; currentId?: string }) {
  const done = useCompleted();
  const { t } = useI18n();
  return (
    <ol className="space-y-1 border-l border-rule font-sans text-sm">
      {lessons.map((lesson, i) => {
        const current = lesson.id === currentId;
        const number = (
          <span className={`w-5 shrink-0 font-mono ${done.has(lesson.id) ? "text-ok" : "text-gold"}`}>
            {done.has(lesson.id) ? "✓" : String(i + 1).padStart(2, "0")}
          </span>
        );
        if (lesson.ready === false) {
          return (
            <li key={lesson.id} className="-ml-px flex gap-3 border-l-2 border-transparent py-1.5 pl-3 text-ink-soft">
              {number}
              <span>
                {lesson.title} <span className="font-mono text-xs">· {t.tracks.planned}</span>
              </span>
            </li>
          );
        }
        return (
          <li key={lesson.id}>
            <L
              href={lesson.path}
              aria-current={current ? "page" : undefined}
              className={`-ml-px flex gap-3 border-l-2 py-1.5 pl-3 ${
                current ? "border-oxblood font-semibold text-oxblood" : "border-transparent hover:text-oxblood"
              }`}
            >
              {number}
              <span>
                {lesson.title}
                {done.has(lesson.id) && <span className="sr-only"> ({t.tracks.doneMark})</span>}
              </span>
            </L>
          </li>
        );
      })}
    </ol>
  );
}

export function TrackProgress({ ids }: { ids: string[] }) {
  const done = useCompleted();
  const { t } = useI18n();
  const count = ids.filter((id) => done.has(id)).length;
  const percent = ids.length ? Math.round((count / ids.length) * 100) : 0;
  return (
    <div className="font-mono text-xs uppercase tracking-[0.12em] text-ink-soft">
      <p>{fill(t.tracks.completed, { a: count, b: ids.length })}</p>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t.tracks.progress}
        className="mt-2 h-3.5 border-2 border-ink bg-parchment"
      >
        <div className="h-full bg-[#c21f16]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** O botão do cartão de progresso da trilha: começa pela primeira aula ou continua pela primeira ainda não feita. */
export function ContinuarTrilha({ lessons, comecar, continuar }: { lessons: LessonLink[]; comecar: string; continuar: string }) {
  const done = useCompleted();
  const { t } = useI18n();
  const prontas = lessons.filter((lesson) => lesson.ready !== false);
  const proxima = prontas.find((lesson) => !done.has(lesson.id)) ?? prontas[0];
  if (!proxima) return null;
  const comecou = prontas.some((lesson) => done.has(lesson.id));
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {comecou && (
        <p className="min-w-0 flex-1 text-lg">
          {t.lesson.next} <strong>{proxima.title}</strong>
        </p>
      )}
      <L href={proxima.path} className="botao botao-prelo">
        {comecou ? continuar : comecar} →
      </L>
    </div>
  );
}

/**
 * O sumário da trilha numa folha pautada: o número na margem vermelha, a caixinha que se marca quando a aula é feita,
 * o título em letra de livro e, nas aulas ainda não escritas, a etiqueta "em preparação". A próxima a fazer fica marcada.
 */
export function Sumario({ lessons }: { lessons: LessonLink[] }) {
  const done = useCompleted();
  const { t } = useI18n();
  const proxima = lessons.find((lesson) => lesson.ready !== false && !done.has(lesson.id));
  return (
    <ol className="sumario-pautado pauta border-2 border-ink shadow-[6px_6px_0_var(--sombra)]">
      {lessons.map((lesson, i) => {
        const feita = done.has(lesson.id);
        const aqui = lesson.id === proxima?.id;
        const numero = <span className={`absolute left-0 w-[70px] text-center font-mono text-[0.8rem] ${aqui ? "font-medium text-prelo-texto" : "text-ink-soft"}`}>{String(i + 1).padStart(2, "0")}</span>;
        const caixa = (
          <span aria-hidden className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center border-2 text-sm font-extrabold ${feita ? "border-ink bg-ok text-white" : aqui ? "border-[#c21f16] bg-folha" : lesson.ready === false ? "border-dashed border-ink-soft" : "border-ink"}`}>
            {feita ? "✓" : ""}
          </span>
        );
        const linha = "relative flex min-h-16 items-center gap-4 py-2 pr-5 pl-[90px] sm:pr-6";
        if (lesson.ready === false) {
          return (
            <li key={lesson.id} className={`${linha} text-ink-soft`}>
              {numero}
              {caixa}
              <span className="min-w-0 flex-1 text-[1.2rem] italic leading-snug">{lesson.title}</span>
              <span className="hidden shrink-0 font-mono text-[0.68rem] uppercase tracking-[0.1em] sm:inline">{t.tracks.planned}</span>
            </li>
          );
        }
        return (
          <li key={lesson.id}>
            <L href={lesson.path} className={`${linha} text-ink hover:bg-[rgb(194_31_22/0.06)] hover:text-ink ${aqui ? "bg-[rgb(194_31_22/0.09)]" : ""}`}>
              {numero}
              {caixa}
              <span className={`min-w-0 flex-1 text-[1.25rem] leading-snug ${aqui ? "font-semibold" : ""}`}>
                {lesson.title}
                {feita && <span className="sr-only"> ({t.tracks.doneMark})</span>}
              </span>
              {aqui && <span className="shrink-0 bg-[#c21f16] px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-white">{t.lesson.next.replace(/[:：]\s*$/, "")}</span>}
            </L>
          </li>
        );
      })}
    </ol>
  );
}

export function CompleteButton({ id, next }: { id: string; next?: { path: string; title: string } }) {
  const done = useCompleted().has(id);
  const { t } = useI18n();
  return (
    <div className="no-print mt-12 flex flex-wrap items-center gap-4 font-sans text-sm">
      <button
        type="button"
        aria-pressed={done}
        onClick={() => setCompleted(id, !done)}
        className={`cursor-pointer border-2 px-6 py-3 font-medium ${
          done ? "border-ok text-ok" : "border-ink bg-ink text-parchment hover:border-oxblood hover:bg-oxblood"
        }`}
      >
        {done ? `✓ ${t.lesson.done}` : t.lesson.markDone}
      </button>
      {done && next && (
        <L href={next.path} className="underline hover:text-oxblood">
          {t.lesson.next} {next.title} →
        </L>
      )}
    </div>
  );
}

/** Guarda a última aula aberta, para o "continue de onde parou" da página inicial. */
export function RememberLesson({ path, title, track, area }: LastLesson) {
  useEffect(() => {
    rememberLesson({ path, title, track, area });
  }, [path, title, track, area]);
  return null;
}

export function ContinueCard() {
  const last = useLastLesson();
  const { t } = useI18n();
  if (!last?.path) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-4">
      <L
        href={last.path}
        className="flex flex-wrap items-center justify-between gap-3 border-2 border-gold bg-parchment-deep px-6 py-4 hover:border-oxblood"
      >
        <span>
          <span className="block font-mono text-xs uppercase tracking-widest text-gold">{t.tracks.continue}</span>
          <span className="text-xl font-semibold">{last.title}</span>
          <span className="text-ink-soft"> · {last.track}</span>
        </span>
        <span aria-hidden className="font-sans text-sm">{t.tracks.resume} →</span>
      </L>
    </section>
  );
}

/** Copia uma citação pronta da aula (autor, título, site, endereço). */
export function CiteButton({ citation }: { citation: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="cursor-pointer underline hover:text-oxblood"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${citation} ${window.location.href}`);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      <span role="status">{copied ? t.lesson.cited : t.lesson.cite}</span>
    </button>
  );
}

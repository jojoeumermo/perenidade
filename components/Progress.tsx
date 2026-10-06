"use client";

import Link from "next/link";
import { useEffect } from "react";
import { rememberLesson, setCompleted, useCompleted, useLastLesson, type LastLesson } from "@/lib/progress";

interface LessonLink {
  id: string;
  href: string;
  title: string;
}

/** Lista de aulas da trilha, com a marca de concluída vinda do navegador. */
export function LessonList({ lessons, currentId }: { lessons: LessonLink[]; currentId?: string }) {
  const done = useCompleted();
  return (
    <ol className="space-y-1 border-l border-rule font-sans text-sm">
      {lessons.map((lesson, i) => {
        const current = lesson.id === currentId;
        return (
          <li key={lesson.id}>
            <Link
              href={lesson.href}
              aria-current={current ? "page" : undefined}
              className={`-ml-px flex gap-3 border-l-2 py-1.5 pl-3 ${
                current ? "border-oxblood font-semibold text-oxblood" : "border-transparent hover:text-oxblood"
              }`}
            >
              <span className={`w-5 shrink-0 font-mono ${done.has(lesson.id) ? "text-ok" : "text-gold"}`}>
                {done.has(lesson.id) ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <span>
                {lesson.title}
                {done.has(lesson.id) && <span className="sr-only"> (concluída)</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function TrackProgress({ ids }: { ids: string[] }) {
  const done = useCompleted();
  const count = ids.filter((id) => done.has(id)).length;
  const percent = ids.length ? Math.round((count / ids.length) * 100) : 0;
  return (
    <div className="font-mono text-xs text-ink-soft">
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso na trilha"
        className="h-1.5 bg-rule"
      >
        <div className="h-full bg-gold" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1.5">
        {count} de {ids.length} {ids.length === 1 ? "aula concluída" : "aulas concluídas"}
      </p>
    </div>
  );
}

export function CompleteButton({ id, next }: { id: string; next?: { href: string; title: string } }) {
  const done = useCompleted().has(id);
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
        {done ? "✓ Aula concluída" : "Marcar como concluída"}
      </button>
      {done && next && (
        <Link href={next.href} className="underline hover:text-oxblood">
          Próxima: {next.title} →
        </Link>
      )}
    </div>
  );
}

/** Guarda a última aula aberta, para o "continue de onde parou" da página inicial. */
export function RememberLesson(lesson: LastLesson) {
  const { href, title, track } = lesson;
  useEffect(() => {
    rememberLesson({ href, title, track });
  }, [href, title, track]);
  return null;
}

export function ContinueCard() {
  const last = useLastLesson();
  if (!last) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-4">
      <Link
        href={last.href}
        className="flex flex-wrap items-center justify-between gap-3 border-2 border-gold bg-parchment-deep px-6 py-4 hover:border-oxblood"
      >
        <span>
          <span className="block font-mono text-xs uppercase tracking-widest text-gold">Continue de onde parou</span>
          <span className="text-xl font-semibold">{last.title}</span>
          <span className="text-ink-soft"> · {last.track}</span>
        </span>
        <span aria-hidden className="font-sans text-sm">Retomar →</span>
      </Link>
    </section>
  );
}

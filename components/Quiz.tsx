"use client";

import { useState } from "react";
import { fill } from "@/i18n/config";
import type { QuizQuestion } from "@/lib/content";
import { useI18n } from "./I18n";

export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const right = questions.filter((q, i) => answers[i] === q.answer).length;
  const finished = Object.keys(answers).length === questions.length;

  return (
    <section aria-labelledby="quiz-titulo" className="no-print mt-12 border border-rule bg-parchment-deep p-6">
      <h2 id="quiz-titulo" className="text-2xl font-semibold">{t.lesson.quizTitle}</h2>
      <ol className="mt-6 space-y-8 font-sans">
        {questions.map((q, i) => {
          const chosen = answers[i];
          const answered = chosen !== undefined;
          return (
            <li key={i}>
              <p className="font-medium">
                {i + 1}. {q.question}
              </p>
              <div className="mt-3 grid gap-2">
                {q.options.map((option, j) => {
                  const isAnswer = j === q.answer;
                  const state = !answered
                    ? "border-rule hover:border-gold cursor-pointer"
                    : isAnswer
                      ? "border-ok text-ok"
                      : j === chosen
                        ? "border-oxblood text-oxblood"
                        : "border-rule opacity-60";
                  return (
                    <button
                      key={j}
                      type="button"
                      disabled={answered}
                      onClick={() => setAnswers((prev) => ({ ...prev, [i]: j }))}
                      className={`border-2 bg-parchment px-4 py-2 text-left text-sm ${state}`}
                    >
                      {answered && isAnswer && <span aria-hidden>✓ </span>}
                      {answered && j === chosen && !isAnswer && <span aria-hidden>✗ </span>}
                      {option}
                    </button>
                  );
                })}
              </div>
              {answered && (
                <p role="status" className="mt-3 text-sm text-ink-soft">
                  <strong className={chosen === q.answer ? "text-ok" : "text-oxblood"}>
                    {chosen === q.answer ? t.lesson.correct : t.lesson.notYet}
                  </strong>{" "}
                  {q.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {finished && (
        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-rule pt-5 font-sans text-sm">
          <p>{fill(t.lesson.score, { a: right, b: questions.length })}</p>
          <button type="button" onClick={() => setAnswers({})} className="cursor-pointer underline hover:text-oxblood">
            {t.lesson.tryAgain}
          </button>
        </div>
      )}
    </section>
  );
}

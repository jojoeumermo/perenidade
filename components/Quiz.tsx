// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { fill } from "@/i18n/config";
import type { QuizQuestion } from "@/lib/content";
import { idDaQuestao, lerErros, refazerErro, registrarErro } from "@/lib/estudo";
import { L, useI18n } from "./I18n";

/** `registro` (opcional): a aula ("trilha/aula") cujo resultado vai para o "Meu estudo" quando o teste termina. Sem ele, nada é guardado além do caderno de erros. */
export function Quiz({ questions, registro }: { questions: QuizQuestion[]; registro?: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  /** Errou: a questão vai para o caderno de erros. Acertou uma que estava lá: conta para ela sair. */
  const anotar = (q: QuizQuestion, escolhida: number) => {
    const id = idDaQuestao(q.question, q.options);
    if (escolhida !== q.answer) registrarErro({ id, pergunta: q.question, opcoes: q.options, resposta: q.answer, escolhida, explicacao: q.explanation, href: q.href ?? pathname.replace(/^\/[a-z]{2}(?=\/)/, ""), origem: "aula" });
    else if (lerErros().some((e) => e.id === id)) refazerErro(id, true, escolhida);
  };
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
                      onClick={() => {
                        const novas = { ...answers, [i]: j };
                        setAnswers(novas);
                        anotar(q, j);
                        // Com o "Meu estudo" ligado, o resultado do teste fica no aparelho (o código só é baixado nesse caso).
                        if (registro && Object.keys(novas).length === questions.length) {
                          const acertos = questions.filter((x, k) => novas[k] === x.answer).length;
                          void import("@/lib/meu-estudo").then((m) => m.registrarTeste(registro, acertos, questions.length)).catch(() => undefined);
                        }
                      }}
                      className={`border-2 bg-parchment px-4 py-2 text-left text-sm ${state}`}
                    >
                      {answered && isAnswer && <span aria-hidden>✓ </span>}
                      {answered && j === chosen && !isAnswer && <span aria-hidden>✗ </span>}
                      {option}
                      {/* O ✓ e o ✗ são só visuais: quem usa leitor de tela ouve o mesmo pelo texto. */}
                      {answered && isAnswer && <span className="sr-only"> ({t.lesson.correct})</span>}
                      {answered && j === chosen && !isAnswer && <span className="sr-only"> ({t.lesson.notYet})</span>}
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
          {right < questions.length && <L href="/caderno?ferramenta=erros" className="text-ink-soft underline hover:text-oxblood">{t.lesson.toMistakes}</L>}
          <button type="button" onClick={() => setAnswers({})} className="cursor-pointer underline hover:text-oxblood">
            {t.lesson.tryAgain}
          </button>
        </div>
      )}
    </section>
  );
}

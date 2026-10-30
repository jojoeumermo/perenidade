// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { fill } from "@/i18n/config";
import type { QuizQuestion } from "@/lib/content";
import { idDaQuestao, lerErros, refazerErro, registrarErro } from "@/lib/estudo";
import { L, useI18n } from "./I18n";

/**
 * `registro` (opcional): a aula ("trilha/aula"). Com ele, o fim do teste soma um às contagens anônimas da aula e, com
 * `guardarNoAparelho`, o resultado vai para o "Meu estudo". Sem ele, nada é guardado além do caderno de erros.
 */
export function Quiz({ questions, registro, guardarNoAparelho = false }: { questions: QuizQuestion[]; registro?: string; guardarNoAparelho?: boolean }) {
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
  // Uma pergunta de cada vez ("1 de 3"), como um teste de verdade; no fim, o resultado e o caminho para o caderno de erros.
  const [atual, setAtual] = useState(0);
  const q = questions[atual];
  const chosen = answers[atual];
  const answered = chosen !== undefined;
  const letras = "ABCDEFGH";

  function responder(j: number) {
    const novas = { ...answers, [atual]: j };
    setAnswers(novas);
    anotar(q, j);
    if (Object.keys(novas).length === questions.length) {
      const acertos = questions.filter((x, k) => novas[k] === x.answer).length;
      // Só os totais do dia por aula, sem identificar ninguém: quantos fizeram o teste e quantos acertaram a maior parte.
      if (registro) {
        void import("@/lib/backend").then(({ hasBackend, rpc }) => {
          if (!hasBackend) return;
          void rpc("contar", { p_tipo: "aula_teste", p_alvo: registro }).catch(() => {});
          if (acertos / questions.length >= 0.7) void rpc("contar", { p_tipo: "aula_acertou", p_alvo: registro }).catch(() => {});
        });
        // Com o "Meu estudo" ligado, o resultado do teste fica no aparelho (o código só é baixado nesse caso).
        if (guardarNoAparelho) void import("@/lib/meu-estudo").then((m) => m.registrarTeste(registro, acertos, questions.length)).catch(() => undefined);
      }
    }
  }

  if (!q) return null;
  return (
    <section aria-labelledby="quiz-titulo" className="teste-da-aula no-print mt-12 border-2 border-ink bg-parchment p-6 font-sans shadow-[4px_4px_0_var(--sombra)] sm:p-7">
      <h2 id="quiz-titulo" className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-prelo-texto">
        {fill(t.lesson.quizOf, { i: atual + 1, n: questions.length })}
      </h2>
      <p className="mt-2.5 font-serif text-[1.45rem] leading-snug text-ink">{q.question}</p>
      <div className="mt-5 flex flex-col gap-3">
        {q.options.map((option, j) => {
          const isAnswer = j === q.answer;
          const estado = !answered
            ? "bg-folha text-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--sombra)] cursor-pointer"
            : isAnswer
              ? "bg-[#2f5d34] text-white shadow-[4px_4px_0_var(--sombra)]"
              : j === chosen
                ? "bg-folha text-ink line-through decoration-[#c21f16] decoration-2"
                : "bg-folha text-ink-soft opacity-70";
          return (
            <button key={j} type="button" disabled={answered} onClick={() => responder(j)} className={`flex w-full items-center gap-3 border-2 border-ink px-4 py-3.5 text-left font-serif text-[1.1rem] transition-transform ${estado}`}>
              <span aria-hidden className="font-mono text-sm font-semibold">
                {letras[j]}
              </span>
              <span className="flex-1">{option}</span>
              {answered && isAnswer && <span className="sr-only"> ({t.lesson.correct})</span>}
              {answered && j === chosen && !isAnswer && <span className="sr-only"> ({t.lesson.notYet})</span>}
            </button>
          );
        })}
      </div>
      {answered && (
        <p role="status" className={`mt-4 font-serif text-[1.1rem] leading-snug ${chosen === q.answer ? "text-ok" : "text-ink"}`}>
          <strong className={chosen === q.answer ? "text-ok" : "text-prelo-texto"}>{chosen === q.answer ? t.lesson.correct : t.lesson.notYet}</strong> {q.explanation}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {answered && atual < questions.length - 1 && (
          <button type="button" onClick={() => setAtual(atual + 1)} className="botao botao-tinta botao-menor">
            {t.lesson.nextQuestion} →
          </button>
        )}
        {/* A régua: dá para voltar e rever as já respondidas, mas não pular para a frente. Com muitas questões (as
            provas), ela ocupa a linha inteira e os tracinhos encolhem, sem sair da caixa. */}
        <span aria-hidden className={`flex gap-1 ${questions.length > 8 ? "order-first w-full" : "ml-auto gap-1.5"}`}>
          {questions.map((x, i) => {
            const cor = answers[i] === undefined ? (i === atual ? "bg-ink" : "bg-transparent") : answers[i] === x.answer ? "bg-[#2f5d34]" : "bg-[#c21f16]";
            const tamanho = questions.length > 8 ? "min-w-0 flex-1" : "w-6";
            return answers[i] !== undefined && i !== atual ? (
              <button key={i} type="button" tabIndex={-1} onClick={() => setAtual(i)} className={`h-2.5 cursor-pointer border border-ink ${tamanho} ${cor}`} />
            ) : (
              <span key={i} className={`h-2.5 border border-ink ${tamanho} ${cor}`} />
            );
          })}
        </span>
      </div>
      {finished && (
        <div className="mt-6 flex flex-wrap items-center gap-4 border-t-2 border-ink pt-4 text-sm">
          <p className="font-semibold">{fill(t.lesson.score, { a: right, b: questions.length })}</p>
          {right < questions.length && (
            <L href="/caderno?ferramenta=erros" className="text-ink-soft underline hover:text-oxblood">
              {t.lesson.toMistakes}
            </L>
          )}
          <button
            type="button"
            onClick={() => {
              setAnswers({});
              setAtual(0);
            }}
            className="cursor-pointer underline hover:text-oxblood"
          >
            {t.lesson.tryAgain}
          </button>
        </div>
      )}
    </section>
  );
}

// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useState } from "react";
import type { Dict } from "@/i18n/types";
import type { QuizQuestion } from "@/lib/content";
import { Quiz } from "./Quiz";

const SIZE = 30;

/** Sorteia até trinta questões entre todas as aulas da trilha. Cada sorteio é uma prova diferente. */
export function Exam({ questions, s }: { questions: QuizQuestion[]; s: Dict["tracks"] }) {
  const [round, setRound] = useState<{ n: number; picked: QuizQuestion[] } | null>(null);

  function draw() {
    const pool = [...questions];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setRound({ n: (round?.n ?? 0) + 1, picked: pool.slice(0, SIZE) });
  }

  return (
    <div>
      <button type="button" onClick={draw} className="no-print mt-8 cursor-pointer bg-ink px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-oxblood">
        {round ? s.examAgain : s.examStart}
      </button>
      {round && <Quiz key={round.n} questions={round.picked} />}
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { Dict } from "@/i18n/types";
import type { TextosDaAvaliacao } from "@/i18n/escola/avaliacao";
import type { QuizQuestion } from "@/lib/content";
import { modoDoEndereco, retornoPorCompetencia } from "@/lib/escola/avaliacao";
import { ProvaEmDupla } from "./escola/avaliacao/ProvaEmDupla";
import { type CursoComATrilha, Proficiencia } from "./escola/avaliacao/Proficiencia";
import { type QuestaoDaProva, QuestoesDaProva } from "./escola/avaliacao/QuestoesDaProva";
import { RetornoPorCompetencia } from "./escola/avaliacao/RetornoPorCompetencia";
import { sortear, useProva } from "./escola/avaliacao/usar-prova";
import { L } from "./I18n";
import { Quiz } from "./Quiz";

const SIZE = 30;

/** O que a prova ganha com a Escola ligada (E4-13; docs/escola/avaliacao.md). Sem isto, a prova fica como sempre foi. */
export interface EscolaNaProva {
  trilha: string;
  /** O título de cada aula ("trilha/aula"), que é o tema do retorno. */
  titulos: Record<string, string>;
  /** Quantas questões cada aula tem (para a regra da dispensa). */
  disponiveis: Record<string, number>;
  /** Os cursos da Escola que contêm a trilha. */
  cursos: CursoComATrilha[];
  s: Pick<TextosDaAvaliacao, "retorno" | "prova" | "dupla" | "proficiencia">;
}

/** Sorteia até trinta questões entre todas as aulas da trilha. Cada sorteio é uma prova diferente. */
export function Exam({ questions, s, escola }: { questions: QuizQuestion[]; s: Dict["tracks"]; escola?: EscolaNaProva }) {
  // O modo vem do endereço (useSearchParams): a página é estática, então a parte que lê o endereço fica num Suspense.
  return escola ? (
    <Suspense fallback={null}>
      <ProvaDaEscola questions={questions} s={s} escola={escola} />
    </Suspense>
  ) : (
    <ProvaDeSempre questions={questions} s={s} />
  );
}

function ProvaDeSempre({ questions, s }: { questions: QuizQuestion[]; s: Dict["tracks"] }) {
  const [round, setRound] = useState<{ n: number; picked: QuizQuestion[] } | null>(null);

  function draw() {
    setRound({ n: (round?.n ?? 0) + 1, picked: sortear(questions, SIZE) });
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

/** A aula ("trilha/aula") de uma questão da prova, pelo endereço que a página põe nela (/trilhas/<trilha>/<aula>). */
const aulaDa = (q: QuizQuestion, trilha: string) => q.href?.replace(/^\/trilhas\//, "") || `${trilha}/`;

/**
 * Com a Escola ligada, a prova tem três modos pelo endereço (?modo=dupla, ?modo=proficiencia; sem ele, a prova de
 * sempre). Em todos, ao terminar, a prova fica guardada no aparelho e aparece o retorno por competência, sem número.
 * Na prova de sempre, o que ela mostrava continua igual (resposta na hora e "acertou X de Y").
 */
function ProvaDaEscola({ questions, s, escola }: { questions: QuizQuestion[]; s: Dict["tracks"]; escola: EscolaNaProva }) {
  const modo = modoDoEndereco(useSearchParams().toString());
  const questoes: QuestaoDaProva[] = questions.map((q) => ({ ...q, aula: aulaDa(q, escola.trilha) }));
  const [round, setRound] = useState<{ n: number; picked: QuestaoDaProva[] } | null>(null);
  const { registros, terminar, limpar } = useProva(escola.trilha, "normal");
  const sa = escola.s;

  if (modo === "dupla") return <ProvaEmDupla trilha={escola.trilha} questoes={questoes} titulos={escola.titulos} s={sa} />;
  if (modo === "proficiencia") return <Proficiencia trilha={escola.trilha} questoes={questoes} titulos={escola.titulos} disponiveis={escola.disponiveis} cursos={escola.cursos} s={sa} />;

  function draw() {
    limpar();
    setRound({ n: (round?.n ?? 0) + 1, picked: sortear(questoes, SIZE) });
  }

  return (
    <div>
      <button type="button" onClick={draw} className="no-print mt-8 cursor-pointer bg-ink px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-oxblood">
        {round ? s.examAgain : s.examStart}
      </button>
      {!round && (
        <nav className="modos-da-prova no-print" aria-label={sa.prova.outrosModos}>
          <p className="text-ink-soft">{sa.prova.outrosModos}</p>
          <ul>
            <li>
              <L href={`/trilhas/${escola.trilha}/prova?modo=dupla`} className="font-semibold underline hover:text-oxblood" data-modo-link="dupla">
                {sa.prova.emDupla}
              </L>
            </li>
            <li>
              <L href={`/trilhas/${escola.trilha}/prova?modo=proficiencia`} className="font-semibold underline hover:text-oxblood" data-modo-link="proficiencia">
                {sa.prova.proficiencia}
              </L>
            </li>
          </ul>
        </nav>
      )}
      {round && <QuestoesDaProva key={round.n} questoes={round.picked} modo="normal" s={sa} aoTerminar={terminar} />}
      {registros && <RetornoPorCompetencia itens={retornoPorCompetencia(registros)} titulos={escola.titulos} s={sa.retorno} />}
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { L, useI18n } from "@/components/I18n";
import { fill } from "@/i18n/config";
import type { TextosDaAvaliacao } from "@/i18n/escola/avaliacao";
import type { QuizQuestion } from "@/lib/content";
import { type ModoDeProva, ordemDasOpcoes } from "@/lib/escola/avaliacao";
import { idDaQuestao, lerErros, refazerErro, registrarErro } from "@/lib/estudo";

/** Uma questão da prova com a aula de onde veio ("trilha/aula"), que é o tema do retorno por competência. */
export type QuestaoDaProva = QuizQuestion & { aula: string };

const LETRAS = "ABCDEFGH";

/**
 * As questões da prova da trilha nos três modos (E4-13). "normal": igual ao teste de sempre (resposta na hora, régua
 * colorida e "acertou X de Y" no fim). "dupla": duas pessoas no mesmo celular se revezam; a explicação aparece, mas a
 * régua fica neutra e o fim não tem placar. "proficiencia": a resposta não aparece a cada questão; dá para mudar a
 * escolha até passar para a próxima. Ao terminar, `aoTerminar` recebe as respostas por aula (o tema).
 */
export function QuestoesDaProva({ questoes, modo, s, aoTerminar }: { questoes: QuestaoDaProva[]; modo: ModoDeProva; s: Pick<TextosDaAvaliacao, "prova" | "dupla">; aoTerminar: (respostas: { tema: string; certo: boolean }[]) => void }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [atual, setAtual] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const comRetorno = modo !== "proficiencia";
  const comPlacar = modo === "normal";
  const anotaErros = modo !== "dupla";
  const q = questoes[atual];
  const respondida = respostas[atual] !== undefined;
  const terminou = Object.keys(respostas).length === questoes.length;
  const ordem = q ? ordemDasOpcoes(q.options.length, q.question) : [];

  /** Errou: vai para o caderno de erros (como no teste da aula). Acertou uma que estava lá: conta para ela sair. */
  const anotar = (x: QuestaoDaProva, escolhida: number) => {
    const id = idDaQuestao(x.question, x.options);
    if (escolhida !== x.answer) registrarErro({ id, pergunta: x.question, opcoes: x.options, resposta: x.answer, escolhida, explicacao: x.explanation, href: x.href ?? pathname.replace(/^\/[a-z]{2}(?=\/)/, ""), origem: "aula" });
    else if (lerErros().some((e) => e.id === id)) refazerErro(id, true, escolhida);
  };

  function fechar(todas: Record<number, number>) {
    if (anotaErros && !comRetorno) questoes.forEach((x, i) => anotar(x, todas[i]));
    aoTerminar(questoes.map((x, i) => ({ tema: x.aula, certo: todas[i] === x.answer })));
  }

  function responder(j: number) {
    if (!comRetorno) return setEscolha(j);
    const novas = { ...respostas, [atual]: j };
    setRespostas(novas);
    if (anotaErros) anotar(q, j);
    if (Object.keys(novas).length === questoes.length) fechar(novas);
  }

  function seguir() {
    if (escolha === null) return;
    const novas = { ...respostas, [atual]: escolha };
    setRespostas(novas);
    setEscolha(null);
    if (atual < questoes.length - 1) setAtual(atual + 1);
    else fechar(novas);
  }

  if (!q) return null;
  const certos = questoes.filter((x, i) => respostas[i] === x.answer).length;
  const pessoa = atual % 2 === 0 ? s.dupla.pessoaA : s.dupla.pessoaB;
  const fimSemRetorno = !comRetorno && terminou;
  return (
    <section aria-labelledby="prova-titulo" className="teste-da-aula no-print mt-12 border-2 border-ink bg-parchment p-6 font-sans shadow-[4px_4px_0_var(--sombra)] sm:p-7" data-modo-da-prova={modo}>
      <h2 id="prova-titulo" className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-prelo-texto">
        {comPlacar ? fill(t.lesson.quizOf, { i: atual + 1, n: questoes.length }) : fill(s.prova.questao, { i: atual + 1, n: questoes.length })}
      </h2>
      {modo === "dupla" && !respondida && (
        <p className="vez-da-dupla" data-vez-da-dupla={atual % 2 === 0 ? "a" : "b"}>
          <strong>{fill(s.dupla.vez, { p: pessoa })}</strong>
          {s.dupla.combinem}
        </p>
      )}
      {!fimSemRetorno && (
        <>
          <p className="mt-2.5 font-serif text-[1.45rem] leading-snug text-ink">{q.question}</p>
          <div className="mt-5 flex flex-col gap-3">
            {ordem.map((j, posicao) => {
              const opcao = q.options[j];
              const certa = j === q.answer;
              const marcada = comRetorno ? respostas[atual] : escolha;
              const estado = !comRetorno
                ? marcada === j
                  ? "opcao-escolhida cursor-pointer"
                  : "bg-folha text-ink cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--sombra)]"
                : !respondida
                  ? "bg-folha text-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--sombra)] cursor-pointer"
                  : certa
                    ? "bg-[#2f5d34] text-white shadow-[4px_4px_0_var(--sombra)]"
                    : j === marcada
                      ? "bg-folha text-ink line-through decoration-[#c21f16] decoration-2"
                      : "bg-folha text-ink-soft opacity-70";
              return (
                <button key={j} type="button" disabled={comRetorno && respondida} aria-pressed={!comRetorno ? escolha === j : undefined} onClick={() => responder(j)} className={`flex w-full items-center gap-3 border-2 border-ink px-4 py-3.5 text-left font-serif text-[1.1rem] transition-transform ${estado}`}>
                  <span aria-hidden className="font-mono text-sm font-semibold">
                    {LETRAS[posicao]}
                  </span>
                  <span className="flex-1">{opcao}</span>
                  {!comRetorno && escolha === j && <span className="sr-only"> ({s.prova.escolhida})</span>}
                  {comRetorno && respondida && certa && <span className="sr-only"> ({t.lesson.correct})</span>}
                  {comRetorno && respondida && j === marcada && !certa && <span className="sr-only"> ({t.lesson.notYet})</span>}
                </button>
              );
            })}
          </div>
          {comRetorno && respondida && (
            <p role="status" className={`mt-4 font-serif text-[1.1rem] leading-snug ${respostas[atual] === q.answer ? "text-ok" : "text-ink"}`}>
              <strong className={respostas[atual] === q.answer ? "text-ok" : "text-prelo-texto"}>{respostas[atual] === q.answer ? t.lesson.correct : t.lesson.notYet}</strong> {q.explanation}
            </p>
          )}
        </>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {comRetorno && respondida && atual < questoes.length - 1 && (
          <button type="button" onClick={() => setAtual(atual + 1)} className="botao botao-tinta botao-menor">
            {t.lesson.nextQuestion} →
          </button>
        )}
        {!comRetorno && !terminou && (
          <button type="button" disabled={escolha === null} onClick={seguir} className="botao botao-tinta botao-menor disabled:cursor-not-allowed disabled:opacity-50">
            {atual < questoes.length - 1 ? `${s.prova.proxima} →` : s.prova.terminar}
          </button>
        )}
        {/* A régua: na prova normal, verde e vermelha como no teste da aula; em dupla e na proficiência, só mostra até onde foi. */}
        <span aria-hidden className={`flex gap-1 ${questoes.length > 8 ? "order-first w-full" : "ml-auto gap-1.5"}`}>
          {questoes.map((x, i) => {
            const feita = respostas[i] !== undefined;
            const cor = !feita ? (i === atual ? "bg-ink" : "bg-transparent") : comPlacar ? (respostas[i] === x.answer ? "bg-[#2f5d34]" : "bg-[#c21f16]") : "bg-ink-soft";
            const tamanho = questoes.length > 8 ? "min-w-0 flex-1" : "w-6";
            return comRetorno && feita && i !== atual ? (
              <button key={i} type="button" tabIndex={-1} onClick={() => setAtual(i)} className={`h-2.5 cursor-pointer border border-ink ${tamanho} ${cor}`} />
            ) : (
              <span key={i} className={`h-2.5 border border-ink ${tamanho} ${cor}`} />
            );
          })}
        </span>
      </div>
      {terminou && comPlacar && (
        <div className="mt-6 flex flex-wrap items-center gap-4 border-t-2 border-ink pt-4 text-sm">
          <p className="font-semibold">{fill(t.lesson.score, { a: certos, b: questoes.length })}</p>
          {certos < questoes.length && (
            <L href="/caderno?ferramenta=erros" className="text-ink-soft underline hover:text-oxblood">
              {t.lesson.toMistakes}
            </L>
          )}
          <button
            type="button"
            onClick={() => {
              setRespostas({});
              setAtual(0);
            }}
            className="cursor-pointer underline hover:text-oxblood"
          >
            {t.lesson.tryAgain}
          </button>
        </div>
      )}
      {terminou && modo === "dupla" && <p className="mt-6 border-t-2 border-ink pt-4 text-sm">{s.prova.fimDupla}</p>}
    </section>
  );
}

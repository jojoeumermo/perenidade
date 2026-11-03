// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/escola-avaliacao.css";
import { useEffect, useState } from "react";
import { L } from "@/components/I18n";
import { fill } from "@/i18n/config";
import type { TextosDaAvaliacao } from "@/i18n/escola/avaliacao";
import type { QuizQuestion } from "@/lib/content";
import { aulaParaLembrar, lerAvaliacoes, marcarLembrado, ordemDasOpcoes, questoesDoDia, registrarRecuperacao } from "@/lib/escola/avaliacao";
import { diaEmBrasilia, lerInscricoes } from "@/lib/escola/estudante";
import { idDaQuestao, registrarErro } from "@/lib/estudo";
import { lerDatas } from "@/lib/meu-estudo";

/** Uma aula anterior candidata (a da trilha, ou a do curso, com o curso) e as questões do teste dela. */
export interface AnteriorComQuestoes {
  aula: string;
  titulo: string;
  curso?: string;
  /** As questões estão em português (a aula do curso é lida no original), e não no idioma da página. */
  emPortugues?: boolean;
  questoes: QuizQuestion[];
}

interface Escolha {
  aula: string;
  titulo: string;
  emPortugues?: boolean;
  questoes: QuizQuestion[];
}

/** Lê o aparelho e decide se o cartão aparece hoje (só no navegador: o componente é carregado sem servidor). */
function escolher(atual: string, candidatas: AnteriorComQuestoes[]): Escolha | null {
  const agora = new Date();
  const aula = aulaParaLembrar(
    atual,
    candidatas.map((c) => ({ aula: c.aula, questoes: c.questoes.length, curso: c.curso })),
    { concluidasEm: lerDatas(), cursosInscritos: lerInscricoes().filter((i) => !i.trancadoEm).map((i) => i.curso), lembrados: lerAvaliacoes().lembrados, agora },
  );
  const achada = aula ? candidatas.find((c) => c.aula === aula) : undefined;
  if (!achada) return null;
  const indices = questoesDoDia(achada.questoes.length, achada.aula, diaEmBrasilia(agora));
  return { aula: achada.aula, titulo: achada.titulo, emPortugues: achada.emPortugues, questoes: indices.map((i) => achada.questoes[i]) };
}

const LETRAS = "ABCDEFGH";

/**
 * "Antes de começar: lembra?" (E4-13, R1-33): no começo da aula, se a aula anterior (da trilha ou do curso em que a
 * pessoa está inscrita) foi concluída há mais de 1 dia e tem teste, duas questões dela escolhidas pelo dia, num cartão
 * que se fecha. "Pular" sempre visível; não aparece duas vezes no mesmo dia para a mesma aula. As respostas ficam no
 * aparelho com a origem "recuperacao" (lucia:escola:avaliacoes) e o erro vai para o caderno de erros.
 */
export function LembraDaAnterior({ aula, candidatas, s }: { aula: string; candidatas: AnteriorComQuestoes[]; s: TextosDaAvaliacao["lembra"] }) {
  const [escolha] = useState<Escolha | null>(() => escolher(aula, candidatas));
  const [aberto, setAberto] = useState(true);
  const [respostas, setRespostas] = useState<Record<number, number>>({});

  // Apareceu: marca o dia, para não voltar hoje nesta aula (nem depois de recarregar).
  useEffect(() => {
    if (escolha) marcarLembrado(aula);
  }, [aula, escolha]);

  if (!escolha || !aberto) return null;
  const terminou = Object.keys(respostas).length === escolha.questoes.length;

  function responder(i: number, j: number) {
    if (!escolha || respostas[i] !== undefined) return;
    const novas = { ...respostas, [i]: j };
    setRespostas(novas);
    const q = escolha.questoes[i];
    if (j !== q.answer) registrarErro({ id: idDaQuestao(q.question, q.options), pergunta: q.question, opcoes: q.options, resposta: q.answer, escolhida: j, explicacao: q.explanation, href: `/trilhas/${escolha.aula}`, origem: "recuperacao" });
    if (Object.keys(novas).length === escolha.questoes.length)
      registrarRecuperacao(
        escolha.aula,
        escolha.questoes.filter((x, k) => novas[k] === x.answer).length,
        escolha.questoes.length,
      );
  }

  return (
    <aside className="cartao-lembra no-print" aria-labelledby="lembra-titulo" data-lembra-da-anterior={escolha.aula}>
      <div className="cartao-lembra-topo">
        <h2 id="lembra-titulo">{s.titulo}</h2>
        <button type="button" className="cursor-pointer text-sm underline hover:text-oxblood" onClick={() => setAberto(false)} data-lembra-pular="">
          {terminou ? s.fechar : s.pular}
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {fill(s.texto, { aula: escolha.titulo })}{" "}
        <L href={`/trilhas/${escolha.aula}`} className="underline hover:text-oxblood">
          {s.reverAula}
        </L>
      </p>
      {escolha.questoes.map((q, i) => {
        const marcada = respostas[i];
        const respondida = marcada !== undefined;
        return (
          <div key={q.question} lang={escolha.emPortugues ? "pt" : undefined}>
            <p className="pergunta-lembra">{q.question}</p>
            <div className="opcoes-lembra">
              {ordemDasOpcoes(q.options.length, q.question).map((j, posicao) => (
                <button key={j} type="button" disabled={respondida} onClick={() => responder(i, j)} data-certa={respondida && j === q.answer ? "" : undefined} data-errada={respondida && j === marcada && j !== q.answer ? "" : undefined}>
                  <span aria-hidden className="mr-2 font-mono text-sm font-semibold">
                    {LETRAS[posicao]}
                  </span>
                  {q.options[j]}
                </button>
              ))}
            </div>
            {respondida && (
              <p role="status" className="mt-1 text-sm">
                <strong className={marcada === q.answer ? "text-ok" : "text-prelo-texto"}>{marcada === q.answer ? s.certo : s.ainda}</strong> {q.explanation}
              </p>
            )}
          </div>
        );
      })}
      {terminou && <p className="mt-3 font-semibold">{s.feito}</p>}
    </aside>
  );
}

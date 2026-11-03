// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { TextosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { retornoPorCompetencia } from "@/lib/escola/avaliacao";
import { QuestoesDaProva, type QuestaoDaProva } from "./QuestoesDaProva";
import { RetornoPorCompetencia } from "./RetornoPorCompetencia";
import { sortear, useProva } from "./usar-prova";

const TAMANHO = 30;

/**
 * A prova em dupla da semana de provas solidária (E4-13, D1-8): duas pessoas no mesmo celular se revezam a cada
 * questão e combinam a resposta antes de tocar. Sem placar, sem comparação e sem nota no fim: só o retorno por
 * competência. Fica guardada no aparelho no modo "dupla" (e não entra no "Meu estudo", que é de uma pessoa só).
 */
export function ProvaEmDupla({ trilha, questoes, titulos, s }: { trilha: string; questoes: QuestaoDaProva[]; titulos: Record<string, string>; s: Pick<TextosDaAvaliacao, "retorno" | "prova" | "dupla"> }) {
  const [rodada, setRodada] = useState<{ n: number; sorteadas: QuestaoDaProva[] } | null>(null);
  const { registros, terminar, limpar } = useProva(trilha, "dupla");
  const comecar = () => {
    limpar();
    setRodada({ n: (rodada?.n ?? 0) + 1, sorteadas: sortear(questoes, TAMANHO) });
  };
  return (
    <div data-prova-em-dupla="">
      {!rodada && (
        <section className="aviso-do-modo" aria-labelledby="dupla-titulo">
          <h2 id="dupla-titulo">{s.dupla.titulo}</h2>
          <p className="mt-2">{s.dupla.texto}</p>
          <p>{s.dupla.semPlacar}</p>
        </section>
      )}
      <button type="button" onClick={comecar} className="no-print mt-8 cursor-pointer bg-ink px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-oxblood">
        {rodada ? s.prova.deNovo : s.dupla.comecar}
      </button>
      {rodada && <QuestoesDaProva key={rodada.n} questoes={rodada.sorteadas} modo="dupla" s={s} aoTerminar={terminar} />}
      {registros && <RetornoPorCompetencia itens={retornoPorCompetencia(registros)} titulos={titulos} s={s.retorno} />}
    </div>
  );
}

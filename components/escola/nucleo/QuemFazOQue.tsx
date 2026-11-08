// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { TextosDaTelaDoNucleo } from "@/i18n/escola/nucleo";
import type { TarefaNoNucleo } from "@/lib/escola/nucleo";

type T = TextosDaTelaDoNucleo["pauta"];

/**
 * Uma linha de "Quem faz o quê" (prancha Cel-Núcleo): a tarefa e, à direita, o codinome de quem leva (ouro) ou o botão
 * "Eu levo". Rodízio: quem fez a mesma tarefa na roda passada vê o aviso no lugar do botão. A pessoa aparece SÓ pelo
 * codinome da Alumia; sem codinome confirmado, "alguém do núcleo".
 */
export function LinhaDaTarefa({ tarefa, t, ocupado, pegar, soltavel = false }: { tarefa: TarefaNoNucleo; t: T; ocupado: boolean; pegar: (id: string, pegar: boolean) => void; soltavel?: boolean }) {
  const quem = tarefa.quem ? (tarefa.quem.codinome ?? (tarefa.minha ? t.voce : t.alguem)) : null;
  return (
    <li className="en-tarefa" data-feito={tarefa.feito || undefined}>
      <span className="en-tarefa-item">
        {tarefa.item}
        {tarefa.feito && <span className="en-tarefa-feito"> · {t.feito}</span>}
      </span>
      {quem ? (
        <span className="en-tarefa-quem">
          <strong>{quem}</strong>
          {tarefa.minha && soltavel && (
            <button type="button" className="en-botao-pequeno" disabled={ocupado} onClick={() => pegar(tarefa.id, false)}>
              {t.soltar}
            </button>
          )}
        </span>
      ) : tarefa.repete ? (
        <span className="en-tarefa-repete">{t.repete}</span>
      ) : (
        <button type="button" className="en-botao-levo" disabled={ocupado} onClick={() => pegar(tarefa.id, true)} aria-label={`${t.euLevo}: ${tarefa.item}`}>
          {t.euLevo}
        </button>
      )}
    </li>
  );
}

/** A lista inteira, na ordem do encontro. */
export function QuemFazOQue({ tarefas, t, ocupado, pegar, soltavel }: { tarefas: TarefaNoNucleo[]; t: T; ocupado: boolean; pegar: (id: string, pegar: boolean) => void; soltavel?: boolean }) {
  if (tarefas.length === 0) return <p className="en-vazio">{t.semTarefas}</p>;
  return (
    <ul className="en-tarefas">
      {tarefas.map((x) => (
        <LinhaDaTarefa key={x.id} tarefa={x} t={t} ocupado={ocupado} pegar={pegar} soltavel={soltavel} />
      ))}
    </ul>
  );
}

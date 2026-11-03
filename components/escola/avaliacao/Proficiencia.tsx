// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { L } from "@/components/I18n";
import { useInscricoes } from "@/components/escola/guardado-escola";
import { fill } from "@/i18n/config";
import type { TextosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { podeDispensar, type RegistroDeCompetencia, retornoPorCompetencia } from "@/lib/escola/avaliacao";
import { marcarDispensa } from "@/lib/escola/estudante";
import { QuestoesDaProva, type QuestaoDaProva } from "./QuestoesDaProva";
import { RetornoPorCompetencia } from "./RetornoPorCompetencia";
import { sortear, useProva } from "./usar-prova";

export interface CursoComATrilha {
  slug: string;
  titulo: string;
}

/**
 * A oferta de dispensa no fim da prova de proficiência: para cada curso em que a pessoa está inscrita (e não trancou)
 * que contém a trilha, se deu "já sabe" em todos os temas, o botão "Marcar esta trilha como dispensada no curso". A
 * dispensa só conta a trilha como feita (lib/escola/cursos.ts); nenhuma aula some.
 */
export function OfertaDeDispensa({ trilha, registros, disponiveis, cursos, s }: { trilha: string; registros: RegistroDeCompetencia[]; disponiveis: Record<string, number>; cursos: CursoComATrilha[]; s: TextosDaAvaliacao["proficiencia"]["dispensa"] }) {
  const inscricoes = useInscricoes();
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const pode = podeDispensar(registros, disponiveis);
  const meus = cursos.filter((c) => inscricoes.some((i) => i.curso === c.slug && !i.trancadoEm));
  return (
    <section className="oferta-de-dispensa" aria-labelledby="dispensa-titulo" data-oferta-de-dispensa={pode ? "pode" : "ainda-nao"}>
      <h2 id="dispensa-titulo" className="font-serif text-2xl font-semibold">
        {s.titulo}
      </h2>
      <p className="mt-1">{pode ? s.pode : s.naoAinda}</p>
      {pode &&
        (meus.length === 0 ? (
          <p className="mt-2 text-sm">
            {s.semCurso}{" "}
            <L href="/escola/cursos" className="font-semibold underline hover:text-oxblood">
              {s.verCursos} →
            </L>
          </p>
        ) : (
          <ul>
            {meus.map((c) => {
              const ja = marcadas.includes(c.slug) || inscricoes.find((i) => i.curso === c.slug)?.dispensas.includes(trilha);
              return (
                <li key={c.slug}>
                  {ja ? (
                    <p role="status" data-dispensada={c.slug}>
                      {fill(s.marcada, { curso: c.titulo })}
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="botao botao-tinta botao-menor"
                      onClick={() => {
                        if (marcarDispensa(c.slug, trilha)) setMarcadas((m) => [...m, c.slug]);
                      }}
                    >
                      {fill(s.marcar, { curso: c.titulo })}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}

/**
 * A prova de proficiência (E4-13, R1-31): a mesma prova da trilha, com TODAS as questões e sem mostrar a resposta a
 * cada questão. Antes, explica que é para quem já sabe e que dá para refazer; no fim, o retorno por competência e a
 * oferta de dispensa. O endereço é /trilhas/[trilha]/prova?modo=proficiencia (o parâmetro não identifica ninguém).
 */
export function Proficiencia({ trilha, questoes, titulos, disponiveis, cursos, s }: { trilha: string; questoes: QuestaoDaProva[]; titulos: Record<string, string>; disponiveis: Record<string, number>; cursos: CursoComATrilha[]; s: Pick<TextosDaAvaliacao, "retorno" | "prova" | "dupla" | "proficiencia"> }) {
  const [rodada, setRodada] = useState<{ n: number; sorteadas: QuestaoDaProva[] } | null>(null);
  const { registros, terminar, limpar } = useProva(trilha, "proficiencia");
  const comecar = () => {
    limpar();
    setRodada({ n: (rodada?.n ?? 0) + 1, sorteadas: sortear(questoes) });
  };
  return (
    <div data-proficiencia="">
      {!rodada && (
        <section className="aviso-do-modo" aria-labelledby="proficiencia-titulo">
          <h2 id="proficiencia-titulo">{s.proficiencia.titulo}</h2>
          <p className="mt-2">{fill(s.proficiencia.texto, { n: questoes.length })}</p>
          <p>{s.proficiencia.refazer}</p>
          <p>{s.proficiencia.naoEsconde}</p>
        </section>
      )}
      <button type="button" onClick={comecar} className="no-print mt-8 cursor-pointer bg-ink px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-oxblood">
        {rodada ? s.prova.deNovo : s.proficiencia.comecar}
      </button>
      {rodada && <QuestoesDaProva key={rodada.n} questoes={rodada.sorteadas} modo="proficiencia" s={s} aoTerminar={terminar} />}
      {registros && (
        <>
          <RetornoPorCompetencia itens={retornoPorCompetencia(registros)} titulos={titulos} s={s.retorno} />
          <OfertaDeDispensa trilha={trilha} registros={registros} disponiveis={disponiveis} cursos={cursos} s={s.proficiencia.dispensa} />
        </>
      )}
    </div>
  );
}

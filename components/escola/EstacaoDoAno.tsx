// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef } from "react";
import { useHojeNaEscola } from "@/components/escola/calendario/FeriadoDoCampus";
import { fill } from "@/i18n/config";
import { estacaoDe, type Feriado, feriadoDoDia } from "@/lib/escola/calendario";
import type { TextosDoCampus } from "@/lib/escola/campus-servidor";
import { semestreDe } from "@/lib/escola/tempo";
import "@/styles/escola-campus.css";

/**
 * A estação do ano letivo (E4-09, R1-67): só um enfeite pequeno no topo da Escola, no padrão do enfeite da festa — a
 * marca do semestre ("1º semestre de 2027") ou das férias e, no feriado do campus, o nome da data. Não troca cor, fonte
 * nem fundo. Some no leitor de tinta, no modo leve e no leitor (styles/escola-campus.css). Também acerta data-semestre e
 * data-feriado no invólucro da Escola: o servidor escreve os do dia em que a página foi feita, e o navegador, os de hoje.
 */
export function EstacaoDoAno({ feriados, s, sCal }: { feriados: Feriado[]; s: TextosDoCampus["estacao"]; sCal: TextosDoCampus["calendario"] }) {
  const hoje = useHojeNaEscola();
  const raiz = useRef<HTMLParagraphElement>(null);
  const estacao = hoje ? estacaoDe(hoje) : null;
  const feriado = hoje ? feriadoDoDia(hoje, feriados) : null;

  useEffect(() => {
    const escola = raiz.current?.closest<HTMLElement>("[data-escola]") ?? document.querySelector<HTMLElement>("[data-escola]");
    if (!escola || !estacao) return;
    escola.setAttribute("data-semestre", estacao);
    if (feriado) escola.setAttribute("data-feriado", feriado.dia);
    else escola.removeAttribute("data-feriado");
  }, [estacao, feriado]);

  if (!hoje || !estacao) return <p ref={raiz} hidden />;
  const semestre = semestreDe(hoje);
  const nome = (id: string) => fill(id.endsWith(".2") ? sCal.semestre2 : sCal.semestre1, { ano: id.slice(0, 4) });
  const marca = estacao === "ferias" ? fill(s.ferias, { semestre: nome(hoje > semestre.fim ? semestre.proximo.id : semestre.id) }) : nome(semestre.id);
  return (
    <p ref={raiz} className="estacao-do-ano no-print mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-soft" title={s.rotulo} data-estacao={estacao}>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-oxblood" />
        {marca}
      </span>
      {/* O nome do feriado já vem na faixa (FeriadoDoCampus): aqui é só o enfeite. */}
      {feriado && <span aria-hidden className="text-prelo-texto">★ {fill(s.feriado, { nome: feriado.nome })}</span>}
    </p>
  );
}

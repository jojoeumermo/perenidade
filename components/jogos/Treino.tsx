// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { Verbete } from "@/lib/jogos/base";
import type { TextosDosJogos } from "@/i18n/jogos";
import { Botao, type PropsDoJogo } from "./comum";

// Cada jogo só é baixado quando a pessoa o escolhe (e só roda no navegador: o sorteio nasce depois do clique).
const carregando = () => <p className="p-4 font-mono text-sm">…</p>;
const JOGOS = {
  cruzadas: dynamic(() => import("./Cruzadas").then((m) => m.Cruzadas), { ssr: false, loading: carregando }),
  caca: dynamic(() => import("./CacaPalavras").then((m) => m.CacaPalavras), { ssr: false, loading: carregando }),
  sudoku: dynamic(() => import("./SudokuJogo").then((m) => m.SudokuJogo), { ssr: false, loading: carregando }),
  forca: dynamic(() => import("./Forca").then((m) => m.Forca), { ssr: false, loading: carregando }),
  memoria: dynamic(() => import("./Memoria").then((m) => m.Memoria), { ssr: false, loading: carregando }),
  quebra: dynamic(() => import("./QuebraPalavras").then((m) => m.QuebraPalavras), { ssr: false, loading: carregando }),
  velha: dynamic(() => import("./JogoDaVelha").then((m) => m.JogoDaVelha), { ssr: false, loading: carregando }),
  ditado: dynamic(() => import("./Ditado").then((m) => m.Ditado), { ssr: false, loading: carregando }),
} satisfies Record<string, React.ComponentType<PropsDoJogo>>;

export type IdDeTreino = keyof typeof JOGOS;
export const IDS_DE_TREINO = Object.keys(JOGOS) as IdDeTreino[];
const ICONES: Record<IdDeTreino, string> = { cruzadas: "✚", caca: "🔎", sudoku: "9", forca: "🌼", memoria: "🃏", quebra: "🧩", velha: "#", ditado: "🎧" };

/** Os jogos clássicos de treino: escolha um e jogue. Os verbetes do glossário chegam prontos do servidor. */
export function Treino({ verbetes, s, lang }: { verbetes: Verbete[]; s: TextosDosJogos; lang: string }) {
  const [id, setId] = useState<IdDeTreino | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const escolher = (novo: IdDeTreino | null) => {
    setId(novo);
    window.setTimeout(() => titulo.current?.focus(), 0);
  };
  const Jogo = id ? JOGOS[id] : null;
  return (
    <div>
      {id === null || !Jogo ? (
        <>
          <h3 ref={titulo} tabIndex={-1} className="font-mono text-xs uppercase tracking-[0.14em] text-ink-soft focus:outline-none">{s.treino.escolha}</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {IDS_DE_TREINO.map((j) => (
              <li key={j}>
                <button type="button" onClick={() => escolher(j)} className="guia-opcao flex h-full w-full cursor-pointer flex-col items-start text-left">
                  <span aria-hidden className="font-serif text-2xl leading-none">{ICONES[j]}</span>
                  <span className="mt-1 font-bold">{s.treino.jogos[j].nome}</span>
                  <span className="text-sm text-ink-soft">{s.treino.jogos[j].texto}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Botao onClick={() => escolher(null)}>← {s.treino.voltar}</Botao>
            <h3 ref={titulo} tabIndex={-1} className="font-serif text-2xl font-semibold focus:outline-none">{s.treino.jogos[id].nome}</h3>
          </div>
          <p className="mt-2 text-sm text-ink-soft">{s.comum.semPontos}</p>
          <div className="mt-4">
            <Jogo verbetes={verbetes} s={s} lang={lang} />
          </div>
        </>
      )}
    </div>
  );
}

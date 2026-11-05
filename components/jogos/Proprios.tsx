// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, useState } from "react";
import { JogoProprio } from "@/components/jogos/proprios/Catalogo";
import { JogoProprio2 } from "@/components/jogos/proprios2/Catalogo";
import type { ChecagemParaJogo } from "@/lib/jogos-proprios/regras";
import type { TextosDosJogos } from "@/i18n/jogos";
import { Botao } from "./comum";

/** O que o cartão de um jogo próprio precisa (só dados: o servidor monta a lista a partir dos dois registros). */
export interface CartaoProprio {
  /** "a" = components/jogos/proprios (slug); "b" = components/jogos/proprios2 (id). */
  grupo: "a" | "b";
  id: string;
  titulo: string;
  resumo: string;
  publico: "todos" | "adultos" | "jovens" | "criancas";
  minutos: number;
  tema: string;
}

/**
 * Os jogos próprios do Instituto: uma grade de cartões; a pessoa abre um (e só então o jogo é baixado) e volta quando quiser.
 * Os textos dos jogos estão só em português; nos outros idiomas a página avisa e os cartões levam lang="pt".
 */
export function JogosProprios({ cartoes, checagens, s, lang }: { cartoes: CartaoProprio[]; checagens: ChecagemParaJogo[]; s: TextosDosJogos; lang: string }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const escolher = (id: string | null) => {
    setAberto(id);
    window.setTimeout(() => titulo.current?.focus(), 0);
  };
  const atual = aberto ? cartoes.find((c) => c.id === aberto) : undefined;
  const p = s.proprios;
  const idioma = lang === "pt" ? undefined : "pt";
  if (atual) {
    return (
      <div lang={idioma}>
        <div className="flex flex-wrap items-center gap-3">
          <Botao onClick={() => escolher(null)}>← {p.voltar}</Botao>
          <h3 ref={titulo} tabIndex={-1} className="font-serif text-2xl font-semibold focus:outline-none">{atual.titulo}</h3>
        </div>
        <p className="mt-2 text-sm text-ink-soft">{s.comum.semPontos}</p>
        <div className="mt-4">
          {atual.grupo === "a" ? <JogoProprio slug={atual.id} checagens={checagens} /> : <JogoProprio2 id={atual.id} />}
        </div>
      </div>
    );
  }
  return (
    <div>
      <h3 ref={titulo} tabIndex={-1} className="font-mono text-xs uppercase tracking-[0.14em] text-ink-soft focus:outline-none">{p.escolha}</h3>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cartoes.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => escolher(c.id)} lang={idioma} className="guia-opcao flex h-full w-full cursor-pointer flex-col items-start text-left">
              <span className="font-bold">{c.titulo}</span>
              <span className="text-sm text-ink-soft">{c.resumo}</span>
              <span className="mt-1 font-mono text-xs text-ink-soft">
                {p.minutos.replace("{n}", String(c.minutos))} · {p.publico[c.publico]} · {c.tema}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

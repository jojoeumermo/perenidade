// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { assinarSom, definirSom, retomarNoPrimeiroGesto, somLigado, tocar } from "./som";

export interface TextosDoSom {
  ligar: string;
  desligar: string;
  rotulo: string;
  explica: string;
}

/** O que, dentro da moldura do Vale, faz o "tic" de passar o mouse e o clique. */
const INTERATIVO = "a[href], button, [role='button'], [role='tab'], summary";

/**
 * O botão de som do Vale o Escrito (na barra de cima): desligado até a pessoa ligar; o estado fica no aparelho (som.ts).
 * Também liga os efeitos de passar o mouse e de clicar em qualquer controle da moldura, por delegação (um ouvinte só).
 */
export function BotaoDeSom({ s }: { s: TextosDoSom }) {
  const ligado = useSyncExternalStore(assinarSom, somLigado, () => false);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => retomarNoPrimeiroGesto(), []);

  useEffect(() => {
    const raiz = botao.current?.closest(".ve-moldura");
    if (!raiz) return;
    let ultimo: Element | null = null;
    const passar = (e: Event) => {
      const alvo = (e.target as Element | null)?.closest?.(INTERATIVO) ?? null;
      if (alvo && alvo !== ultimo) tocar("hover");
      ultimo = alvo;
    };
    const clicar = (e: Event) => {
      const alvo = (e.target as Element | null)?.closest?.(INTERATIVO);
      // O próprio botão de som toca o seu (definirSom); o resto faz o clique curto.
      if (alvo && alvo !== botao.current) tocar("clique");
    };
    raiz.addEventListener("pointerover", passar);
    raiz.addEventListener("click", clicar);
    return () => {
      raiz.removeEventListener("pointerover", passar);
      raiz.removeEventListener("click", clicar);
    };
  }, []);

  return (
    <button
      ref={botao}
      type="button"
      className="ve-som"
      aria-pressed={ligado}
      // Nome fixo ("Som") e o estado no aria-pressed: o nome contém o texto visível (WCAG 2.5.3) e o leitor de tela não
      // ouve "Ligar som, pressionado" (nome que muda junto com o estado contradiz o aria-pressed). "Ligar/desligar" fica no title.
      title={`${ligado ? s.desligar : s.ligar}. ${s.explica}`}
      data-ligado={ligado}
      onClick={() => definirSom(!ligado)}
    >
      <span className="ve-som-barras" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="ve-som-texto">
        {s.rotulo} <b aria-hidden="true">{ligado ? "ON" : "OFF"}</b>
      </span>
    </button>
  );
}

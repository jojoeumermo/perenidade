"use client";
// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { useState } from "react";

interface Props {
  temas: string[];
  /** O nome da faixa para o leitor de tela ("Temas do território"). */
  rotulo: string;
  pausar: string;
  retomar: string;
  /** Cores e bordas da faixa (o padrão é a faixa vermelha do Na Atividade). */
  estilo?: string;
  /** Cor do separador entre os temas. */
  separador?: string;
}

/**
 * O letreiro: os temas do território passando como faixa de evento (marquee acessível).
 *  - O leitor de tela lê a lista uma vez só (a lista escondida); as cópias que giram ficam aria-hidden.
 *  - Continua andando com o mouse por cima e com o foco no botão; para só no botão de pausa (WCAG 2.2.2, "Pausar,
 *    parar, ocultar"), que fica sempre à vista enquanto a faixa anda.
 *  - Para quem pede menos movimento (prefers-reduced-motion) ou está no modo leve, a faixa não anda e os temas quebram
 *    de linha (globals.css, .letreiro); o botão some, porque não há o que pausar.
 */
export function Letreiro({ temas, rotulo, pausar, retomar, estilo = "border-y-2 border-[#1f1a14] bg-[#e01b22] text-white", separador = "text-[#1f1a14]" }: Props) {
  const [parado, setParado] = useState(false);
  const volta = (eco: boolean) => (
    <p className={`flex shrink-0 items-center ${eco ? "letreiro-eco" : ""}`}>
      {Array.from({ length: 3 }, () => temas)
        .flat()
        .map((tema, i) => (
          <span key={i} className={`flex items-center ${i >= temas.length ? "letreiro-eco" : ""}`}>
            <span className="px-5">{tema}</span>
            <span aria-hidden className={separador}>✦</span>
          </span>
        ))}
    </p>
  );
  return (
    <section aria-label={rotulo} data-parado={parado || undefined} className={`letreiro relative overflow-hidden py-3 ${estilo}`}>
      <ul className="sr-only">
        {temas.map((tema) => (
          <li key={tema}>{tema}</li>
        ))}
      </ul>
      <div aria-hidden className="letreiro-trilho territorio-play flex w-max text-[1.375rem] font-black uppercase tracking-[0.06em] whitespace-nowrap">
        {volta(false)}
        {volta(true)}
      </div>
      <button
        type="button"
        aria-pressed={parado}
        onClick={() => setParado((v) => !v)}
        className="letreiro-botao absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-current bg-black/55 text-white"
      >
        <span className="sr-only">{parado ? retomar : pausar}</span>
        <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 fill-current">
          {parado ? <path d="M2 1l9 5-9 5z" /> : <path d="M2 1h3v10H2zM7 1h3v10H7z" />}
        </svg>
      </button>
    </section>
  );
}

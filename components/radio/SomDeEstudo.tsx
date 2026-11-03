// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId } from "react";
import type { TextosDoSom } from "@/i18n/escola/som";
import { radio } from "@/lib/radio";
import { somDeEstudo, TIPOS_DE_SOM, useSomDeEstudo, type TipoDeSom } from "@/lib/som-de-estudo";
import "@/styles/escola-som.css";

/** O desenho de cada som: a onda grave, a onda mais fina e a chuva. */
function Icone({ tipo }: { tipo: TipoDeSom }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {tipo === "marrom" && <path d="M2 14 Q6 8 10 14 T18 14 T22 14" />}
      {tipo === "rosa" && <path d="M2 12 Q4 8 6 12 T10 12 T14 12 T18 12 T22 12" />}
      {tipo === "chuva" && <path d="M7 4 l-2 5 M12 4 l-2 5 M17 4 l-2 5 M9 13 l-2 5 M14 13 l-2 5 M19 13 l-2 5" />}
    </svg>
  );
}

/**
 * O canal "Para estudar (sem fala)" da rádio: três sons gerados no aparelho (lib/som-de-estudo.ts), com volume.
 * Nada toca sozinho; tocar um som tira a rádio do tocador (e tocar a rádio desliga o som). O controle também fica no tocador do
 * rodapé (components/RadioPlayer.tsx) enquanto o som estiver ligado, em qualquer página.
 */
export function SomDeEstudo({ s }: { s: TextosDoSom["som"] }) {
  const { tipo, volume, comVoz, semAudio } = useSomDeEstudo();
  const idVolume = useId();

  // O volume guardado, depois da hidratação (o servidor desenha o padrão).
  useEffect(() => somDeEstudo.carregarVolume(), []);

  const tocar = (t: TipoDeSom) => {
    if (tipo === t) {
      somDeEstudo.desligar();
      return;
    }
    // Troca de canal: a rádio para e sai do tocador (o "Continuar" da próxima visita fica guardado).
    radio.pause();
    radio.soltar();
    somDeEstudo.ligar(t);
  };

  return (
    <section className="som-de-estudo border-2 border-ink bg-folha p-5 shadow-[6px_6px_0_var(--sombra)] sm:p-7" aria-labelledby="som-de-estudo-titulo" data-som-de-estudo={tipo ?? ""}>
      <p className="rotulo">{s.rotulo}</p>
      <h2 id="som-de-estudo-titulo" className="mt-2 font-serif text-3xl font-semibold leading-tight">
        {s.titulo}
      </h2>
      <p className="mt-2 max-w-[62ch] font-sans text-ink-soft">{s.lead}</p>
      <ul className="som-tipos mt-5 grid gap-3 sm:grid-cols-3">
        {TIPOS_DE_SOM.map((t) => {
          const ligado = tipo === t;
          const nome = s.tipos[t].nome;
          return (
            <li key={t}>
              <button
                type="button"
                onClick={() => tocar(t)}
                aria-pressed={ligado}
                aria-label={ligado ? `${s.parar}: ${nome}` : s.tocar.replace("{nome}", nome)}
                data-som={t}
                className={`som-tipo flex min-h-11 w-full cursor-pointer items-start gap-3 border-2 border-ink px-4 py-3 text-left font-sans ${ligado ? "bg-[#c21f16] text-white" : "bg-parchment-deep hover:bg-folha"}`}
              >
                <span className="mt-0.5 shrink-0">
                  <Icone tipo={t} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <strong className="text-base">{nome}</strong>
                  <span className={`text-sm ${ligado ? "text-white/90" : "text-ink-soft"}`}>{s.tipos[t].descricao}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 font-sans">
        <label htmlFor={idVolume} className="flex items-center gap-3 text-sm font-medium">
          {s.volume}
          <input
            id={idVolume}
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(volume * 100)}
            onChange={(e) => somDeEstudo.definirVolume(Number(e.target.value) / 100)}
            aria-valuetext={`${Math.round(volume * 100)}%`}
            className="som-volume h-11 w-40 cursor-pointer accent-[#c21f16]"
          />
        </label>
        <p className="text-sm" aria-live="polite">
          {tipo ? s.tocando.replace("{nome}", s.tipos[tipo].nome) : s.parado}
          {tipo && comVoz && <span className="ml-2 font-mono text-xs uppercase tracking-[0.1em] text-ink-soft">30%</span>}
        </p>
        {tipo && (
          <button type="button" onClick={() => somDeEstudo.desligar()} className="min-h-11 cursor-pointer px-2 font-semibold underline hover:text-oxblood">
            {s.parar}
          </button>
        )}
      </div>
      {semAudio && (
        <p role="alert" className="mt-3 font-sans text-sm text-oxblood">
          {s.semAudio}
        </p>
      )}
      <p className="mt-4 font-sans text-sm text-ink-soft">{s.voz}</p>
      <p className="mt-1 font-sans text-sm font-medium">{s.honesto}</p>
    </section>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { enderecoDoAudio, type Episodio } from "@/lib/podcast";
import { radio, type Track, usePlayer } from "@/lib/radio";

/** O episódio no formato do tocador do site. */
export function faixaDoEpisodio(e: Episodio, programa: string): Track {
  return {
    id: `podcast:${e.id}`,
    titulo: e.titulo,
    artista: e.serie?.titulo ?? programa,
    url: enderecoDoAudio(e),
    podcast: { episodio: e.id, capa: e.capa_mini || e.capa, href: `/podcasts/${e.slug}`, duracao: e.duracao, picos: e.picos ?? [], capitulos: e.capitulos ?? [] },
  };
}

/**
 * Botão de ouvir. Com "fila", o tocador segue para o próximo episódio da lista quando este acabar.
 * Se o episódio já está tocando, o mesmo botão pausa.
 */
export function Ouvir({ episodio, fila, programa, rotulo, pausar, grande = false, className = "" }: { episodio: Episodio; fila?: Episodio[]; programa: string; rotulo: string; pausar: string; grande?: boolean; className?: string }) {
  const { queue, index, playing } = usePlayer();
  const atual = queue[index]?.id === `podcast:${episodio.id}`;
  const tocando = atual && playing;
  const tocar = () => {
    if (atual) return radio.toggle();
    const lista = fila && fila.some((e) => e.id === episodio.id) ? fila : [episodio];
    radio.play(
      lista.map((e) => faixaDoEpisodio(e, programa)),
      lista.findIndex((e) => e.id === episodio.id),
    );
  };
  return (
    <button
      type="button"
      onClick={tocar}
      aria-pressed={tocando}
      aria-label={`${tocando ? pausar : rotulo}: ${episodio.titulo}`}
      title={tocando ? pausar : rotulo}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-oxblood font-sans text-[#f4ecd8] shadow-[0_2px_0_var(--ink)] transition-transform hover:scale-105 hover:bg-ink active:scale-95 ${grande ? "h-16 w-16 text-2xl" : "h-11 w-11 text-base"} ${className}`}
    >
      {tocando ? (
        <svg aria-hidden viewBox="0 0 24 24" className={grande ? "h-7 w-7" : "h-[18px] w-[18px]"} fill="currentColor">
          <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className={`${grande ? "h-7 w-7" : "h-[18px] w-[18px]"} translate-x-[1px]`} fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}

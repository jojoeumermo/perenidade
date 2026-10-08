// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useEffect } from "react";
import { loadRadio, positions, radio, usePlayer, type Track } from "@/lib/radio";
import { useI18n } from "./I18n";

/** Página da rádio. Fora do ar, mostra "Em breve" para o público e a pré-escuta para a coordenação. */
export function RadioPage() {
  const { t } = useI18n();
  const { radio: state, queue, index, playing } = usePlayer();
  const current = queue[index]?.id;

  useEffect(() => {
    void loadRadio(true);
    void positions.sync();
  }, []);

  if (!state) return <p className="mt-10 font-mono text-xs text-ink-soft">{t.common.loading}</p>;
  if (!state.canais) {
    return (
      <div className="mt-10 border border-rule bg-parchment-deep p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">{t.radio.soon}</p>
        <p className="mx-auto mt-3 max-w-xl text-xl text-ink-soft">{t.radio.soonText}</p>
      </div>
    );
  }

  const live: Track | null = state.ao_vivo ? { id: "ao-vivo", titulo: t.radio.liveTitle, artista: "", url: state.ao_vivo, live: true } : null;
  const play = (list: Track[], at: number) => (list[at].id === current ? radio.toggle() : radio.play(list, at));

  return (
    <div className="mt-10 space-y-8">
      {!state.no_ar && <p className="border-l-2 border-gold pl-4 font-sans text-sm text-ink-soft">{t.radio.preview}</p>}
      {live && (
        <button type="button" onClick={() => play([live], 0)} className="flex w-full cursor-pointer items-center gap-4 border-2 border-oxblood p-5 text-left hover:bg-parchment-deep">
          <span aria-hidden className="text-2xl">{current === "ao-vivo" && playing ? "⏸" : "▶"}</span>
          <span>
            <span className="block font-mono text-xs uppercase tracking-widest text-oxblood">{t.radio.live}</span>
            <span className="text-2xl font-semibold">{t.radio.liveTitle}</span>
          </span>
        </button>
      )}
      {state.canais.length === 0 && <p className="text-lg text-ink-soft">{t.radio.empty}</p>}
      {state.canais.map((channel) => (
        <section key={channel.id} className="border border-rule bg-parchment-deep p-6">
          <h2 className="text-2xl font-semibold">{channel.nome}</h2>
          {channel.descricao && <p className="mt-1 text-ink-soft">{channel.descricao}</p>}
          <ol className="mt-4 divide-y divide-rule font-sans text-sm">
            {channel.faixas.map((track, i) => (
              <li key={track.id}>
                <button type="button" onClick={() => play(channel.faixas, i)} className={`flex w-full cursor-pointer items-baseline gap-3 py-2.5 text-left hover:text-oxblood ${track.id === current ? "font-semibold text-oxblood" : ""}`}>
                  <span aria-hidden className="w-5 font-mono">{track.id === current && playing ? "⏸" : "▶"}</span>
                  <span>
                    {track.titulo}
                    {track.artista && <span className="text-ink-soft"> · {track.artista}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

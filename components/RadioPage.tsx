// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useEffect } from "react";
import { loadRadio, positions, radio, usePlayer, type Track } from "@/lib/radio";
import { useI18n } from "./I18n";

export interface Station {
  frente: "brasil" | "latina" | "mundo";
  id: string;
  nome: string;
  lugar: string;
  descricao: string;
  site: string;
  /** Endereço https da transmissão. Sem ele, a emissora aparece só com o link para o próprio site. */
  transmissao?: string;
}

const fronts = ["brasil", "latina", "mundo"] as const;

/**
 * Rádios populares, comunitárias e de trabalhadores de vários países. O som vem direto de cada emissora;
 * o instituto só aponta para elas. Tocam no tocador que acompanha a navegação pelo site.
 */
function Stations({ stations }: { stations: Station[] }) {
  const { t } = useI18n();
  const { queue, index, playing } = usePlayer();
  const current = queue[index]?.id;
  const s = t.radio;
  const play = (station: Station) => {
    const id = `emissora-${station.id}`;
    if (id === current) radio.toggle();
    else radio.play([{ id, titulo: station.nome, artista: station.lugar, url: station.transmissao ?? "", live: true }], 0);
  };
  return (
    <section aria-labelledby="emissoras" className="mt-12">
      <h2 id="emissoras" className="border-b border-rule pb-3 text-3xl font-semibold">{s.stations}</h2>
      <p className="mt-3 text-ink-soft">{s.stationsLead}</p>
      {fronts.map((front) => (
        <div key={front} className="mt-8">
          <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-gold">{s.fronts[front]}</h3>
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {stations
              .filter((station) => station.frente === front)
              .map((station) => {
                const on = current === `emissora-${station.id}` && playing;
                return (
                  <li key={station.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    {station.transmissao ? (
                      <button type="button" onClick={() => play(station)} aria-pressed={on} aria-label={`${on ? t.radio.pause : s.listen}: ${station.nome}`} className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border-2 font-sans text-lg ${on ? "border-oxblood bg-oxblood text-parchment" : "border-ink hover:border-oxblood hover:text-oxblood"}`}>
                        <span aria-hidden>{on ? "⏸" : "▶"}</span>
                      </button>
                    ) : (
                      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-rule font-sans text-lg text-ink-soft">↗</span>
                    )}
                    <div className="min-w-0 flex-1" lang="pt-BR">
                      <p className="text-xl font-semibold">{station.nome}</p>
                      <p className="text-ink-soft">
                        {station.lugar} · {station.descricao}
                      </p>
                    </div>
                    <a href={station.site} target="_blank" rel="noopener noreferrer" className="font-sans text-sm underline hover:text-oxblood">
                      {station.transmissao ? s.site : s.siteOnly} ↗
                    </a>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      <p className="mt-6 font-sans text-sm text-ink-soft">{s.stationsNote}</p>
    </section>
  );
}

/** Página da rádio. Fora do ar, mostra "Em breve" para o público e a pré-escuta para a coordenação. */
export function RadioPage({ stations }: { stations: Station[] }) {
  return (
    <>
      <OwnRadio />
      <Stations stations={stations} />
    </>
  );
}

function OwnRadio() {
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

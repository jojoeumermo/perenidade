// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { radio, usePlayer } from "@/lib/radio";
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
    <section aria-labelledby="emissoras" className="mt-10">
      <h2 id="emissoras" className="sr-only">{s.stations}</h2>
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

/** A página da rádio é o diretório de emissoras do povo. A rádio própria do instituto é projeto futuro (veja docs). */
export function RadioPage({ stations }: { stations: Station[] }) {
  return <Stations stations={stations} />;
}

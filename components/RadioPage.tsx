// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, type KeyboardEvent } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { radio, usePlayer } from "@/lib/radio";
import { L, useI18n } from "./I18n";

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

type Aba = "todas" | Station["frente"];
const abas: Aba[] = ["todas", "brasil", "latina", "mundo"];
const idDaEmissora = (station: Station) => `emissora-${station.id}`;

function Tocar() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4">
      <path d="M5 3 L17 10 L5 17 Z" fill="currentColor" />
    </svg>
  );
}

function Pausar() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4">
      <rect x="4" y="3" width="4" height="14" fill="currentColor" />
      <rect x="12" y="3" width="4" height="14" fill="currentColor" />
    </svg>
  );
}

/**
 * Rádios populares, comunitárias e de trabalhadores de vários países. O som vem direto de cada emissora;
 * o instituto só aponta para elas. Tocam no tocador que acompanha a navegação pelo site.
 * Em cima, o que está tocando (ou uma sugestão para começar); embaixo, as abas por frente e a lista.
 */
export function RadioPage({ stations, s }: { stations: Station[]; s: Dict["radioPagina"] }) {
  const { t, lang } = useI18n();
  const { queue, index, playing } = usePlayer();
  const [aba, setAba] = useState<Aba>("todas");
  const [soAqui, setSoAqui] = useState(false);
  const atual = queue[index];
  const tocar = (station: Station) => {
    const id = idDaEmissora(station);
    if (atual?.id === id) radio.toggle();
    else radio.play([{ id, titulo: station.nome, artista: station.lugar, url: station.transmissao ?? "", live: true }], 0);
  };
  const daAba = stations.filter((station) => aba === "todas" || station.frente === aba);
  const lista = soAqui ? daAba.filter((station) => station.transmissao) : daAba;
  const sugestao = lista.find((station) => station.transmissao) ?? stations.find((station) => station.transmissao);
  const mover = (evento: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    const proxima = abas[(destino + abas.length) % abas.length];
    setAba(proxima);
    document.getElementById(`aba-${proxima}`)?.focus();
  };

  return (
    <>
      {/* ── O que está tocando, ou a primeira emissora da lista para começar ── */}
      <section aria-label={atual ? s.nowPlaying : s.startWith} className="flex flex-wrap items-center gap-x-6 gap-y-4 border-2 border-ink bg-folha px-5 py-[1.1rem] shadow-[6px_6px_0_var(--sombra)]">
        {atual ? (
          <button type="button" onClick={() => radio.toggle()} aria-label={playing ? t.radio.pause : s.resume} className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-[#c21f16] text-white hover:bg-[#a51810]">
            {playing ? <Pausar /> : <Tocar />}
          </button>
        ) : sugestao ? (
          <button type="button" onClick={() => tocar(sugestao)} aria-label={`${t.radio.play}: ${sugestao.nome}`} className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-[#c21f16] text-white hover:bg-[#a51810]">
            <Tocar />
          </button>
        ) : null}
        <div className="flex min-w-0 flex-[1_1_11rem] flex-col gap-1">
          <span className="flex items-center gap-2.5 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-prelo-texto">
            {atual && playing && (
              <span aria-hidden className="radio-eq inline-flex h-3.5 items-end gap-0.5">
                <span />
                <span />
                <span />
              </span>
            )}
            {atual ? (playing ? s.nowPlaying : s.paused) : s.startWith}
          </span>
          <strong className="font-serif text-[1.6rem] font-semibold leading-tight" lang="pt-BR">
            {atual ? atual.titulo : sugestao?.nome}
          </strong>
          <span className="font-sans text-sm text-ink-soft">
            <span lang="pt-BR">{atual ? atual.artista : sugestao?.lugar}</span> · {s.keepsPlaying}
          </span>
        </div>
      </section>

      {/* ── As frentes em abas e o filtro do que toca aqui mesmo ── */}
      <section aria-labelledby="emissoras">
        <h2 id="emissoras" className="sr-only">
          {t.radio.stations}
        </h2>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink">
          <div role="tablist" aria-label={s.tabsLabel} className="-mb-0.5 flex gap-1.5 overflow-x-auto whitespace-nowrap max-sm:-mx-4 max-sm:px-4">
            {abas.map((id, i) => {
              const ativa = aba === id;
              const n = id === "todas" ? stations.length : stations.filter((station) => station.frente === id).length;
              return (
                <button
                  key={id}
                  id={`aba-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  aria-controls="lista-de-emissoras"
                  tabIndex={ativa ? 0 : -1}
                  onClick={() => setAba(id)}
                  onKeyDown={(evento) => mover(evento, i)}
                  className={`cursor-pointer border-2 border-b-0 border-ink px-4 pt-2.5 pb-2 font-sans text-sm font-bold ${ativa ? "bg-[#c21f16] text-white" : "bg-parchment-deep text-ink hover:bg-folha"}`}
                >
                  {s.tabs[id]} <span className="font-mono text-[0.7rem] tracking-[0.1em] opacity-80">{n}</span>
                </button>
              );
            })}
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 pb-2.5 font-sans text-sm font-medium">
            <input type="checkbox" checked={soAqui} onChange={(evento) => setSoAqui(evento.target.checked)} className="h-5 w-5 accent-[#c21f16]" />
            {fill(s.onlyHere, { n: daAba.filter((station) => station.transmissao).length })}
          </label>
        </div>

        <div id="lista-de-emissoras" role="tabpanel" aria-labelledby={`aba-${aba}`}>
          {lista.length === 0 ? (
            <p className="py-6 font-sans text-ink-soft">{s.emptyFilter}</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,32.5rem),1fr))] gap-x-10">
              {lista.map((station) => {
                const eAtual = atual?.id === idDaEmissora(station);
                const on = eAtual && playing;
                return (
                  <li key={station.id} className={`flex items-start gap-4 border-b border-rule px-3 py-4 max-sm:gap-3 max-sm:px-2.5 ${eAtual ? "relative z-[1] bg-folha outline-2 outline-ink shadow-[4px_4px_0_var(--prelo)]" : ""}`}>
                    {station.transmissao ? (
                      <button type="button" onClick={() => tocar(station)} aria-pressed={on} aria-label={`${on ? t.radio.pause : t.radio.listen}: ${station.nome}`} className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-ink ${on ? "bg-[#c21f16] text-white" : "bg-folha text-ink hover:bg-parchment-deep"}`}>
                        {on ? <Pausar /> : <Tocar />}
                      </button>
                    ) : (
                      <a href={station.site} target="_blank" rel="noopener noreferrer" aria-label={fill(s.listenAtSite, { nome: station.nome })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-ink-soft text-ink-soft hover:border-ink hover:text-ink">
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden className="h-4 w-4">
                          <path d="M8 4 H4 V16 H16 V12 M11 3 H17 V9 M17 3 L9 11" />
                        </svg>
                      </a>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1" lang="pt-BR">
                      <strong className="font-serif text-[1.3rem] font-semibold leading-tight max-sm:text-[1.2rem]">{station.nome}</strong>
                      <span className={`font-mono text-[0.66rem] uppercase tracking-[0.14em] ${eAtual ? "text-prelo-texto" : "text-ink-soft"}`}>
                        {station.lugar} · <span lang={lang}>{eAtual ? (playing ? s.nowPlaying : s.paused) : station.transmissao ? s.playsHere : s.opensSite}</span>
                      </span>
                      <span className="font-serif text-base leading-snug text-ink-soft">{station.descricao}</span>
                    </div>
                    {station.transmissao && (
                      <a href={station.site} target="_blank" rel="noopener noreferrer" aria-label={`${t.radio.site}: ${station.nome}`} className="shrink-0 self-center font-sans text-[0.8rem] font-semibold text-ink-soft underline hover:text-oxblood">
                        {s.siteShort} ↗
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── Indicar a rádio que falta, e o aviso de que o som é de cada emissora ── */}
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-center gap-3">
          <span className="font-serif text-[1.2rem]">{s.missing}</span>
          <L href="/contribuir" className="botao botao-papel">
            {s.suggest}
          </L>
        </p>
        <p className="max-w-[70ch] font-sans text-sm text-ink-soft">{t.radio.stationsNote}</p>
      </div>
    </>
  );
}

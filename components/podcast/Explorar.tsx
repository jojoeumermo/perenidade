// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useMemo, useState } from "react";
import { htmlLang, localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { type Episodio, minutos, type Serie, TEMAS } from "@/lib/podcast";
import { Capa } from "./Capa";
import { megas } from "./Destaque";
import { Ouvir } from "./Ouvir";

type Filtro = { tipo: "tudo" } | { tipo: "serie"; slug: string } | { tipo: "tema"; tema: string } | { tipo: "disciplina"; slug: string };

/** Um cartão da estante: capa com o botão de ouvir por cima, título e série. */
function Cartao({ e, fila, s, lang, programa }: { e: Episodio; fila: Episodio[]; s: Dict["podcast"]; lang: Locale; programa: string }) {
  return (
    <li className="group w-40 shrink-0 snap-start sm:w-48">
      <div className="relative">
        <Link href={localePath(lang, `/podcasts/${e.slug}`)} tabIndex={-1} aria-hidden>
          <Capa caminho={e.capa_mini || e.capa} titulo={e.titulo} numero={e.numero} className="border-2 border-ink" />
        </Link>
        <Ouvir episodio={e} fila={fila} programa={programa} rotulo={s.listen} pausar={s.pause} className="absolute bottom-2 right-2 opacity-100 sm:translate-y-1 sm:opacity-0 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100 sm:group-hover:translate-y-0 sm:group-hover:opacity-100" />
      </div>
      <Link href={localePath(lang, `/podcasts/${e.slug}`)} className="mt-2 line-clamp-2 block font-serif text-lg font-semibold leading-snug hover:text-oxblood" lang="pt-BR">
        {e.titulo}
      </Link>
      <p className="mt-0.5 truncate font-sans text-xs text-ink-soft">
        {e.serie?.titulo ?? programa} · {minutos(e.duracao)}
      </p>
    </li>
  );
}

function Estante({ titulo, children, id }: { titulo: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="jornal-secao">
        <span className="jornal-editoria">{titulo}</span>
      </h2>
      <ul className="-mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:thin]">{children}</ul>
    </section>
  );
}

/** A lista completa, como a de episódios de um programa: número, play, título, série e data, duração e tamanho. */
export function ListaDeEpisodios({ episodios, s, lang, programa }: { episodios: Episodio[]; s: Dict["podcast"]; lang: Locale; programa: string }) {
  const data = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
  return (
    <ol className="mt-5 border-2 border-b-0 border-ink bg-folha shadow-[6px_6px_0_var(--sombra)]">
      {episodios.map((e, i) => {
        const mb = megas(e.audio_bytes);
        return (
          <li key={e.id} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-4 border-b-2 border-ink px-4 py-3.5 hover:bg-parchment sm:grid-cols-[3.5rem_3rem_minmax(0,1fr)_auto] sm:gap-5">
            <span aria-hidden className={`hidden font-serif text-[2rem] font-semibold leading-none sm:block ${i === 0 ? "text-prelo-texto" : "text-ink-soft"}`}>
              {e.numero ?? episodios.length - i}
            </span>
            <Ouvir episodio={e} fila={episodios} programa={programa} rotulo={s.listen} pausar={s.pause} className="h-12! w-12! bg-ink! hover:bg-[#c21f16]!" />
            <div className="min-w-0" lang="pt-BR">
              <Link href={localePath(lang, `/podcasts/${e.slug}`)} className="line-clamp-2 font-serif text-xl font-semibold leading-snug text-ink hover:text-ink hover:underline hover:decoration-[#c21f16] hover:decoration-2">
                {e.titulo}
              </Link>
              <p className="truncate font-sans text-[0.82rem] text-ink-soft">
                {[e.serie?.titulo ?? programa, data.format(new Date(e.publicado_em))].filter(Boolean).join(" · ")}
                <span className="sm:hidden"> · {minutos(e.duracao)}</span>
              </p>
            </div>
            <span className="hidden whitespace-nowrap font-mono text-xs uppercase text-ink-soft sm:block">
              {minutos(e.duracao)}
              {mb > 0 && ` · ↓ ${s.size.replace("{n}", String(mb))}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const CORES_DAS_SERIES = [
  "bg-[#c21f16] text-white shadow-[6px_6px_0_var(--sombra)]",
  "bg-[#1f1a14] text-[#f4ecd8] shadow-[6px_6px_0_var(--prelo)]",
  "bg-[#2f5d34] text-[#f4ecd8] shadow-[6px_6px_0_var(--sombra)]",
  "bg-[#6e1f1a] text-[#f4ecd8] shadow-[6px_6px_0_var(--prelo)]",
  "bg-[#8a5f1c] text-[#f4ecd8] shadow-[6px_6px_0_var(--sombra)]",
];

/**
 * A estante do podcast, no jeito dos aplicativos de áudio: botões de filtro no alto (séries, temas, disciplinas) e,
 * sem filtro, prateleiras que rolam de lado com os mais novos, as séries, cada tema e o que acompanha as disciplinas.
 */
export function Explorar({ episodios, series, s, lang, programa, areas }: { episodios: Episodio[]; series: Serie[]; s: Dict["podcast"]; lang: Locale; programa: string; areas: Record<string, string> }) {
  const [filtro, setFiltro] = useState<Filtro>({ tipo: "tudo" });
  const [ordem, setOrdem] = useState<"novos" | "curtos">("novos");
  const temas = useMemo(() => TEMAS.filter((tema) => episodios.some((e) => e.temas.includes(tema))), [episodios]);
  const disciplinas = useMemo(() => [...new Set(episodios.map((e) => e.disciplina).filter((d): d is string => Boolean(d)))], [episodios]);
  const nomeTema = (tema: string) => s.themes[tema as keyof typeof s.themes] ?? tema;

  const filtrados =
    filtro.tipo === "serie"
      ? episodios.filter((e) => e.serie?.slug === filtro.slug)
      : filtro.tipo === "tema"
        ? episodios.filter((e) => e.temas.includes(filtro.tema as (typeof TEMAS)[number]))
        : filtro.tipo === "disciplina"
          ? episodios.filter((e) => e.disciplina === filtro.slug)
          : episodios;
  const titulo =
    filtro.tipo === "serie"
      ? (series.find((x) => x.slug === filtro.slug)?.titulo ?? "")
      : filtro.tipo === "tema"
        ? nomeTema(filtro.tema)
        : filtro.tipo === "disciplina"
          ? (areas[filtro.slug] ?? filtro.slug)
          : s.all;

  const chip = (ativo: boolean) =>
    `shrink-0 cursor-pointer border-2 border-ink px-3.5 py-1.5 font-sans text-sm font-semibold ${ativo ? "bg-ink text-parchment" : "bg-folha hover:bg-parchment-deep"}`;
  const igual = (outro: Filtro) => JSON.stringify(outro) === JSON.stringify(filtro);

  return (
    <div className="mt-8">
      <div role="toolbar" aria-label={s.filters} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        <button type="button" className={chip(filtro.tipo === "tudo")} aria-pressed={filtro.tipo === "tudo"} onClick={() => setFiltro({ tipo: "tudo" })}>
          {s.all}
        </button>
        {series.map((serie) => (
          <button key={serie.slug} type="button" className={chip(igual({ tipo: "serie", slug: serie.slug }))} aria-pressed={igual({ tipo: "serie", slug: serie.slug })} onClick={() => setFiltro({ tipo: "serie", slug: serie.slug })} lang="pt-BR">
            {serie.titulo}
          </button>
        ))}
        {temas.map((tema) => (
          <button key={tema} type="button" className={chip(igual({ tipo: "tema", tema }))} aria-pressed={igual({ tipo: "tema", tema })} onClick={() => setFiltro({ tipo: "tema", tema })}>
            {nomeTema(tema)}
          </button>
        ))}
        {disciplinas.map((slug) => (
          <button key={slug} type="button" className={chip(igual({ tipo: "disciplina", slug }))} aria-pressed={igual({ tipo: "disciplina", slug })} onClick={() => setFiltro({ tipo: "disciplina", slug })}>
            {areas[slug] ?? slug}
          </button>
        ))}
      </div>

      {filtro.tipo === "tudo" ? (
        <>
          <section aria-labelledby="series" className="mt-10">
            <h2 id="series" className="font-serif text-[2.3rem] font-medium">{s.series}</h2>
            <ul className="mt-5 grid grid-cols-2 gap-6 lg:grid-cols-4">
              {series.map((serie, i) => (
                <li key={serie.slug}>
                  <button
                    type="button"
                    onClick={() => setFiltro({ tipo: "serie", slug: serie.slug })}
                    className={`flex aspect-square w-full cursor-pointer flex-col border-2 border-ink p-4 text-left transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 sm:p-5 ${CORES_DAS_SERIES[i % CORES_DAS_SERIES.length]}`}
                  >
                    <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em]">
                      {episodios.filter((e) => e.serie?.slug === serie.slug).length} {s.episodes}
                    </span>
                    <span className="mt-auto line-clamp-3 font-sans text-[1.35rem] font-black uppercase italic leading-[0.95] sm:text-[1.8rem]" lang="pt-BR">
                      {serie.titulo}
                    </span>
                    {serie.descricao && (
                      <span className="mt-1.5 line-clamp-2 font-serif text-sm opacity-90" lang="pt-BR">
                        {serie.descricao}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              <li>
                <Link
                  href={localePath(lang, "/podcasts/microfone")}
                  className="flex aspect-square w-full flex-col border-2 border-dashed border-ink bg-parchment-deep p-4 text-ink shadow-[6px_6px_0_var(--prelo)] hover:text-ink sm:p-5"
                >
                  <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em]">{s.openToAll}</span>
                  <span className="mt-auto font-sans text-[1.35rem] font-black uppercase italic leading-[0.95] sm:text-[1.8rem]">{s.recordWithUs}</span>
                  <span className="mt-1.5 font-serif text-sm text-ink-soft">{s.recordWithUsText}</span>
                </Link>
              </li>
            </ul>
          </section>
          {temas.map((tema) => {
            const lista = episodios.filter((e) => e.temas.includes(tema));
            return (
              <Estante key={tema} id={`tema-${tema}`} titulo={nomeTema(tema)}>
                {lista.slice(0, 12).map((e) => (
                  <Cartao key={e.id} e={e} fila={lista} s={s} lang={lang} programa={programa} />
                ))}
              </Estante>
            );
          })}
          <section aria-labelledby="todos" className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="todos" className="font-serif text-[2.3rem] font-medium">{s.allEpisodes}</h2>
              <div role="group" aria-label={s.sortBy} className="flex gap-1.5 font-mono text-xs uppercase">
                {(["novos", "curtos"] as const).map((o) => (
                  <button key={o} type="button" aria-pressed={ordem === o} onClick={() => setOrdem(o)} className={`cursor-pointer border-2 border-ink px-3 py-1.5 ${ordem === o ? "bg-ink text-parchment" : "bg-folha hover:bg-parchment-deep"}`}>
                    {o === "novos" ? s.sortNewest : s.sortShortest}
                  </button>
                ))}
              </div>
            </div>
            <ListaDeEpisodios episodios={ordem === "curtos" ? [...episodios].sort((x, y) => x.duracao - y.duracao) : episodios} s={s} lang={lang} programa={programa} />
          </section>
        </>
      ) : (
        <section aria-labelledby="filtrados" className="mt-8">
          <h2 id="filtrados" className="jornal-secao">
            <span className="jornal-editoria">{titulo}</span>
          </h2>
          {filtro.tipo === "serie" && (
            <p className="mt-3 max-w-3xl text-lg text-ink-soft" lang="pt-BR">
              {series.find((x) => x.slug === filtro.slug)?.descricao}
            </p>
          )}
          {filtro.tipo === "disciplina" && (
            <p className="mt-3 font-sans text-sm">
              <Link href={localePath(lang, `/estantes/${filtro.slug}`)} className="underline hover:text-oxblood">
                {s.openDiscipline} {areas[filtro.slug] ?? filtro.slug} →
              </Link>
            </p>
          )}
          <ListaDeEpisodios episodios={filtrados} s={s} lang={lang} programa={programa} />
        </section>
      )}
    </div>
  );
}

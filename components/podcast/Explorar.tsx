// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { htmlLang, localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { type Episodio, minutos, type Serie, TEMAS } from "@/lib/podcast";
import { Capa } from "./Capa";
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

/** A lista completa, como a de episódios de um programa: número, capa, título, data, duração e o play. */
export function ListaDeEpisodios({ episodios, s, lang, programa }: { episodios: Episodio[]; s: Dict["podcast"]; lang: Locale; programa: string }) {
  const data = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
  return (
    <ol className="mt-4 border-t-4 border-ink">
      {episodios.map((e, i) => (
        <li key={e.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-rule py-3 sm:grid-cols-[2rem_4rem_minmax(0,1fr)_8rem_5rem_auto]">
          <span className="hidden text-right font-mono text-sm text-ink-soft sm:block">{e.numero ?? episodios.length - i}</span>
          <Link href={localePath(lang, `/podcasts/${e.slug}`)} tabIndex={-1} aria-hidden>
            <Capa caminho={e.capa_mini || e.capa} titulo={e.titulo} className="border border-ink" />
          </Link>
          <div className="min-w-0" lang="pt-BR">
            <Link href={localePath(lang, `/podcasts/${e.slug}`)} className="line-clamp-2 font-serif text-lg font-semibold leading-snug hover:text-oxblood">
              {e.titulo}
            </Link>
            <p className="truncate font-sans text-xs text-ink-soft">
              {[e.serie?.titulo, e.temporada ? `${s.season} ${e.temporada}` : "", ...e.temas.map((tema) => s.themes[tema as keyof typeof s.themes] ?? tema)].filter(Boolean).join(" · ")}
            </p>
            <p className="font-mono text-[0.68rem] text-ink-soft sm:hidden">
              {data.format(new Date(e.publicado_em))} · {minutos(e.duracao)}
            </p>
          </div>
          <span className="hidden font-mono text-xs text-ink-soft sm:block">{data.format(new Date(e.publicado_em))}</span>
          <span className="hidden font-mono text-xs text-ink-soft sm:block">{minutos(e.duracao)}</span>
          <Ouvir episodio={e} fila={episodios} programa={programa} rotulo={s.listen} pausar={s.pause} />
        </li>
      ))}
    </ol>
  );
}

/**
 * A estante do podcast, no jeito dos aplicativos de áudio: botões de filtro no alto (séries, temas, disciplinas) e,
 * sem filtro, prateleiras que rolam de lado com os mais novos, as séries, cada tema e o que acompanha as disciplinas.
 */
export function Explorar({ episodios, series, s, lang, programa, areas }: { episodios: Episodio[]; series: Serie[]; s: Dict["podcast"]; lang: Locale; programa: string; areas: Record<string, string> }) {
  const [filtro, setFiltro] = useState<Filtro>({ tipo: "tudo" });
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
    `shrink-0 cursor-pointer rounded-full border-2 px-4 py-1.5 font-sans text-sm font-semibold ${ativo ? "border-ink bg-ink text-parchment" : "border-ink/30 hover:border-ink"}`;
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
          <Estante id="recentes" titulo={s.recent}>
            {episodios.slice(0, 12).map((e) => (
              <Cartao key={e.id} e={e} fila={episodios} s={s} lang={lang} programa={programa} />
            ))}
          </Estante>
          {series.length > 0 && (
            <section aria-labelledby="series" className="mt-10">
              <h2 id="series" className="jornal-secao">
                <span className="jornal-editoria">{s.series}</span>
              </h2>
              <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {series.map((serie) => (
                  <li key={serie.slug}>
                    <button type="button" onClick={() => setFiltro({ tipo: "serie", slug: serie.slug })} className="group block w-full cursor-pointer text-left">
                      <Capa caminho={serie.capa_mini || serie.capa} titulo={serie.titulo} className="border-2 border-ink transition-transform group-hover:-translate-y-0.5" />
                      <span className="mt-2 block font-serif text-lg font-semibold leading-snug group-hover:text-oxblood" lang="pt-BR">{serie.titulo}</span>
                      <span className="block font-sans text-xs text-ink-soft">
                        {episodios.filter((e) => e.serie?.slug === serie.slug).length} {s.episodes}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
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
          <section aria-labelledby="todos" className="mt-12">
            <h2 id="todos" className="jornal-secao">
              <span className="jornal-editoria">{s.allEpisodes}</span>
            </h2>
            <ListaDeEpisodios episodios={episodios} s={s} lang={lang} programa={programa} />
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

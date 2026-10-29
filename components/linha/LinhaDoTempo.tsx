// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, type ReactNode } from "react";
import { plural } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { lugaresDaLinha, seculoDe, temasDaLinha, type LugarDaLinha, type TemaDaLinha } from "@/lib/linha-do-tempo";

export interface AcontecimentoNaLinha {
  ano: number;
  onde: LugarDaLinha;
  temas: TemaDaLinha[];
  /** O texto já montado no servidor (negrito e links). */
  texto: ReactNode;
}

const seculos = ["18", "19", "20", "21"] as const;
const romanos: Record<(typeof seculos)[number], string> = { "18": "XVII–XVIII", "19": "XIX", "20": "XX", "21": "XXI" };

/**
 * A linha do tempo das lutas em dois lados: o Brasil à esquerda e a América Latina e o mundo à direita, alinhados pelo
 * ano no trilho do meio (1917: a greve geral de São Paulo de um lado, a Revolução Russa do outro). No celular, um lado
 * só, com o trilho à esquerda. Filtros por lugar e por tema; os séculos têm atalho.
 */
export function LinhaDoTempo({ acontecimentos, s, idioma, lang }: { acontecimentos: AcontecimentoNaLinha[]; s: Dict["timeline"]; idioma: { lang?: string; "data-content-lang"?: string }; lang: string }) {
  const [onde, setOnde] = useState<LugarDaLinha | "">("");
  const [tema, setTema] = useState<TemaDaLinha | "">("");
  const vistos = acontecimentos.filter((a) => (!onde || a.onde === onde) && (!tema || a.temas.includes(tema)));
  const temasUsados = temasDaLinha.filter((t) => acontecimentos.some((a) => a.temas.includes(t)));

  const cartao = (a: AcontecimentoNaLinha, i: number) => (
    <article key={i} className={`linha-cartao linha-${a.onde}`}>
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink-soft">
        <span className="linha-lugar">{s.lanes[a.onde]}</span>
        {a.temas.length > 0 && <span> · {a.temas.map((t) => s.themes[t]).join(" · ")}</span>}
      </p>
      <p className="mt-1.5 font-serif text-[1.04rem] leading-relaxed" {...idioma}>{a.texto}</p>
    </article>
  );

  return (
    <>
      <div className="no-print mx-auto mt-10 grid max-w-3xl gap-5 font-sans text-sm">
        <div className="min-w-0">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft">{s.where}</p>
          <div role="group" aria-label={s.where} className="mt-2 flex flex-wrap items-end gap-1.5 border-b-2 border-ink">
            <button type="button" aria-pressed={onde === ""} onClick={() => setOnde("")} className="aba-pasta">{s.allPlaces}</button>
            {lugaresDaLinha.map((l) => (
              <button key={l} type="button" aria-pressed={onde === l} onClick={() => setOnde(l === onde ? "" : l)} className={`aba-pasta linha-aba-${l}`}>{s.lanes[l]}</button>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft">{s.theme}</p>
          <div role="group" aria-label={s.theme} className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={tema === ""} onClick={() => setTema("")} className="linha-tema">{s.allThemes}</button>
            {temasUsados.map((t) => (
              <button key={t} type="button" aria-pressed={tema === t} onClick={() => setTema(t === tema ? "" : t)} className="linha-tema">{s.themes[t]}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="font-mono text-xs text-ink-soft" role="status">{plural(lang, vistos.length, s.count)}</p>
          <nav aria-label={s.jump} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs">
            <span className="text-ink-soft">{s.jump}:</span>
            {seculos
              .filter((sec) => vistos.some((a) => seculoDe(a.ano) === sec))
              .map((sec) => (
                <a key={sec} href={`#seculo-${sec}`} className="underline hover:text-oxblood">{romanos[sec]}</a>
              ))}
            <a href="#lutas-que-continuam" className="underline hover:text-oxblood">{s.today}</a>
          </nav>
        </div>
      </div>

      {vistos.length === 0 && <p className="mt-10 text-lg text-ink-soft">{s.none}</p>}

      {seculos.map((sec) => {
        const doSeculo = vistos.filter((a) => seculoDe(a.ano) === sec);
        if (doSeculo.length === 0) return null;
        const anos = [...new Set(doSeculo.map((a) => a.ano))];
        return (
          <section key={sec} id={`seculo-${sec}`} aria-labelledby={`seculo-${sec}-titulo`} className="linha-seculo scroll-mt-24">
            <header className="linha-seculo-titulo">
              <span aria-hidden className="linha-romano">{romanos[sec]}</span>
              <h2 id={`seculo-${sec}-titulo`} className="font-mono text-xs uppercase tracking-[0.2em]">
                {s.centuries[sec]} · {plural(lang, doSeculo.length, s.count)}
              </h2>
            </header>
            <div className="linha-colunas" aria-hidden>
              <span>{s.brasil}</span>
              <span>{s.fora}</span>
            </div>
            <ol className="linha-anos">
              {anos.map((ano) => {
                const aqui = doSeculo.filter((a) => a.ano === ano && a.onde === "brasil");
                const fora = doSeculo.filter((a) => a.ano === ano && a.onde !== "brasil");
                return (
                  <li key={ano} className="linha-ano">
                    <p className="linha-marco"><span>{ano}</span></p>
                    {aqui.length > 0 && <div className="linha-br">{aqui.map(cartao)}</div>}
                    {fora.length > 0 && <div className="linha-fora">{fora.map(cartao)}</div>}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </>
  );
}

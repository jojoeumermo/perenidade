// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { localePath, plural } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import type { Stage } from "@/lib/areas";
import { DO_GUIA, OBJETIVOS, type Objetivo, type PassoDoGuia } from "@/lib/guia-disciplinas";
import { KEYS, setItem, useHydrated, useStored } from "@/lib/storage";
import { useI18n } from "./I18n";

/** Onde fica, neste navegador, se o guia está aberto ("1") ou recolhido (sem nada: o começo é recolhido). */
const ABERTO = "lucia:guia-aberto";

function lerAberto(): boolean {
  try {
    return localStorage.getItem(ABERTO) === "1";
  } catch {
    return false; // sem armazenamento (aba anônima, bloqueio): começa recolhido
  }
}

function guardarAberto(aberto: boolean) {
  try {
    if (aberto) localStorage.setItem(ABERTO, "1");
    else localStorage.removeItem(ABERTO);
  } catch {
    // sem armazenamento, sem lembrança
  }
}

/**
 * O guia do alto da página das disciplinas: duas perguntas (o que a pessoa quer e de onde parte) e, no fim, três
 * disciplinas em ordem, cada uma com a primeira aula, ou três caminhos para escolher um. A resposta fica guardada
 * neste navegador ("objetivo:etapa"), para o caminho continuar ali na próxima visita; "Refazer" apaga.
 * Desde 05/11/2026 é recolhível (pedido da coordenação: ocupava muito espaço no alto): começa recolhido, com o título e
 * um resumo de uma linha (o caminho escolhido ou a apresentação), e lembra neste navegador se a pessoa o deixou aberto.
 */
export function GuiaDasDisciplinas({ caminhos, s, etapas, cursoEnem }: { caminhos: Record<Objetivo, Record<Stage, PassoDoGuia[]>>; s: Dict["tracks"]["guide"]; etapas: readonly Stage[]; /** Com o curso ENEM ligado (recurso "enem-curso"), o texto do link para /enem. */ cursoEnem?: string }) {
  const { lang, t } = useI18n();
  const hydrated = useHydrated();
  const guardado = useStored(KEYS.guia);
  const [objetivoGuardado, etapaGuardada] = hydrated ? guardado.split(":") : [];
  const objetivo = (OBJETIVOS as readonly string[]).includes(objetivoGuardado) ? (objetivoGuardado as Objetivo) : null;
  const etapa = objetivo && (etapas as readonly string[]).includes(etapaGuardada) ? (etapaGuardada as Stage) : null;
  const escolher = (o: Objetivo | null, e: Stage | null) => setItem(KEYS.guia, o ? `${o}:${e ?? ""}` : null);
  const passos = objetivo && etapa ? caminhos[objetivo][etapa] : [];
  const modo = objetivo ? DO_GUIA[objetivo].modo : "passos";
  const extra = objetivo ? DO_GUIA[objetivo].extra : undefined;
  // Recolhido de início (ocupava muito espaço no alto da página); aberto ou fechado, a escolha fica neste navegador.
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a escolha só existe no navegador (localStorage)
    setAberto(lerAberto());
  }, []);
  const alternar = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const agora = e.currentTarget.open;
    setAberto(agora);
    guardarAberto(agora);
  };
  // O resumo de uma linha: o caminho escolhido ("Passar no ENEM · Do zero") ou, sem escolha, a apresentação.
  const resumo = objetivo ? [s.goals[objetivo], etapa ? s.starts[etapa] : null].filter(Boolean).join(" · ") : s.lead;

  return (
    <details open={aberto} onToggle={alternar} className="guia-disciplinas no-print group mt-8 border-2 border-ink bg-folha shadow-[6px_6px_0_var(--sombra)]">
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 p-6 max-sm:p-4 [&::-webkit-details-marker]:hidden">
        <span className="block font-mono text-[0.68rem] uppercase tracking-[0.2em] text-prelo-texto">{s.kicker}</span>
        <svg aria-hidden viewBox="0 0 24 24" className="row-span-3 h-6 w-6 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
        <h2 id="guia-titulo" className="mt-1 font-serif text-3xl font-semibold leading-tight max-sm:text-2xl">{s.title}</h2>
        <span className="mt-1 block truncate text-ink-soft group-open:hidden">{resumo}</span>
      </summary>
      <section aria-labelledby="guia-titulo" className="px-6 pb-6 max-sm:px-4 max-sm:pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="max-w-2xl text-ink-soft">{s.lead}</p>
        {objetivo && (
          <button type="button" onClick={() => escolher(null, null)} className="cursor-pointer font-sans text-sm underline underline-offset-4 hover:text-prelo-texto">
            {s.redo}
          </button>
        )}
      </div>

      <fieldset className="mt-5">
        <legend className="font-sans text-sm font-bold uppercase tracking-[0.08em]">
          <span className="mr-2 font-mono text-prelo-texto">1</span>
          {s.q1}
        </legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {OBJETIVOS.map((o) => (
            <button key={o} type="button" aria-pressed={objetivo === o} onClick={() => escolher(o, etapa)} className="guia-opcao">
              {s.goals[o]}
            </button>
          ))}
        </div>
      </fieldset>

      {objetivo && (
        <fieldset className="mt-5">
          <legend className="font-sans text-sm font-bold uppercase tracking-[0.08em]">
            <span className="mr-2 font-mono text-prelo-texto">2</span>
            {s.q2}
          </legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {etapas.map((e) => (
              <button key={e} type="button" aria-pressed={etapa === e} onClick={() => escolher(objetivo, e)} className="guia-opcao">
                {s.starts[e]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div aria-live="polite">
        {objetivo && etapa && (
          <div className="mt-6 border-t-2 border-ink pt-5">
            <h3 className="font-sans text-sm font-bold uppercase tracking-[0.08em]">{modo === "passos" ? s.resultSteps : s.resultOptions}</h3>
            <ol className="mt-3 grid gap-4 md:grid-cols-3">
              {passos.slice(0, modo === "passos" ? 3 : 4).map((passo, i) => (
                <li key={passo.trilha} className="flex flex-col border-2 border-ink bg-parchment p-4">
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-prelo-texto">
                    {(modo === "passos" ? s.step : s.option).replace("{n}", String(i + 1))} · {t.areas[passo.area][0]}
                  </p>
                  <p className="mt-1.5 font-serif text-xl font-semibold leading-snug">{passo.trilhaTitulo}</p>
                  <p className="mt-1 font-sans text-xs text-ink-soft">{plural(lang, passo.prontas, s.lessons)}</p>
                  {passo.aula && (
                    <p className="mt-3 text-sm leading-snug">
                      <span className="text-ink-soft">{s.first}: </span>
                      {passo.aula.titulo}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
                    {passo.aula && (
                      <Link href={localePath(lang, `/trilhas/${passo.trilha}/${passo.aula.slug}`)} className="botao">
                        {s.open}
                      </Link>
                    )}
                    <Link href={localePath(lang, `/trilhas/${passo.trilha}`)} className="font-sans text-sm underline underline-offset-4 hover:text-prelo-texto">
                      {s.whole}
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
            {extra && (
              <p className="mt-4 font-sans text-sm">
                <Link href={localePath(lang, extra === "despertar" ? "/despertar" : "/nivelamento")} className="underline underline-offset-4 hover:text-prelo-texto">
                  {extra === "despertar" ? s.extraDespertar : s.extraNivelamento}
                </Link>
              </p>
            )}
            {objetivo === "enem" && cursoEnem && (
              <p className="mt-4 font-sans text-sm">
                <Link href={localePath(lang, "/enem")} className="font-semibold underline underline-offset-4 hover:text-prelo-texto">{cursoEnem} →</Link>
              </p>
            )}
            <p className="mt-3 font-sans text-sm text-ink-soft">{s.also}</p>
          </div>
        )}
      </div>
      </section>
    </details>
  );
}

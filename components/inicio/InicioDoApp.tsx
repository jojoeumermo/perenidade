// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCompleted, useLastLesson } from "@/lib/progress";
import { useHydrated } from "@/lib/storage";
import { L } from "../I18n";

export interface EstanteDoApp {
  slug: string;
  nome: string;
  etapa: string;
  aulas: string;
}

// As capas das estantes revezam as quatro cores do instituto, como cadernos de capa diferente na mesma prateleira.
const CAPAS = [
  "bg-[#6e1f1a] text-[#f4ecd8]",
  "bg-[#c21f16] text-white",
  "bg-[#1f1a14] text-[#f4ecd8]",
  "bg-[#e9dcbc] text-[#1f1a14] border-[1.5px] border-[#cdbb91]",
];

/**
 * O começo da inicial no aplicativo: a busca, o "continue de onde parou" e as estantes numa fileira que corre de lado,
 * como a tela inicial de um aplicativo. Só aparece no aplicativo de celular; no navegador fica o lambe-lambe de sempre.
 */
export function InicioDoApp({
  textos,
  estantes,
  busca,
}: {
  textos: { busca: string; buscaRotulo: string; buscar: string; continuar: string; retomar: string; comecar: string; comecarTexto: string; estantes: string; verTodas: string };
  estantes: EstanteDoApp[];
  /** O endereço da página de busca, já com o idioma. */
  busca: string;
}) {
  const hydrated = useHydrated();
  const ultima = useLastLesson();
  const feitas = useCompleted();
  const tem = hydrated && ultima?.path;
  // A data de hoje vem do aparelho: a página é feita uma vez e servida pronta, então não pode trazer a data de quando foi feita.
  const data = hydrated ? new Intl.DateTimeFormat(document.documentElement.lang || undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date()) : " ";
  return (
    <section className="inicio-do-app hidden app:max-md:block">
      <div className="px-4 pt-5 pb-2">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-prelo-texto">{data}</p>
        <form action={busca} role="search" className="mt-3 flex items-center gap-2.5 rounded-[0.9rem] border-2 border-ink bg-folha pr-1.5 pl-4 shadow-[3px_3px_0_var(--sombra)]">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 20 20" />
          </svg>
          <input name="q" type="search" aria-label={textos.buscaRotulo} placeholder={textos.busca} className="min-w-0 flex-1 bg-transparent py-3 font-sans text-base text-ink outline-none placeholder:text-ink-soft" />
          <button className="rounded-[0.7rem] bg-[#c21f16] px-4 py-2 font-sans text-sm font-extrabold text-white">{textos.buscar}</button>
        </form>
      </div>

      <div className="px-4 pt-3">
        {tem ? (
          <L href={ultima.path} className="block rounded-2xl bg-[#1f1a14] p-4 text-[#f4ecd8] shadow-[4px_4px_0_#c21f16] hover:text-[#f4ecd8]">
            <span className="block font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#e0837a]">{textos.continuar}</span>
            <span className="mt-1.5 block font-serif text-[1.45rem] font-semibold leading-tight">{ultima.title}</span>
            <span className="mt-0.5 block text-[0.95rem] text-[#d9ccac]">{ultima.track}</span>
            <span className="mt-3.5 flex items-center justify-between gap-3">
              {/* Um ponto por aula feita neste aparelho, como no cartão de continuar do site. */}
              <span aria-hidden className="flex flex-wrap gap-1">
                {Array.from({ length: Math.min(feitas.size, 12) }, (_, i) => (
                  <span key={i} className="h-2 w-2 rounded-full bg-[#c21f16]" />
                ))}
              </span>
              <span className="shrink-0 rounded-full bg-[#c21f16] px-4 py-2 font-sans text-sm font-extrabold text-white">{textos.retomar} →</span>
            </span>
          </L>
        ) : (
          <L href="/comecar" className="block rounded-2xl bg-[#1f1a14] p-4 text-[#f4ecd8] shadow-[4px_4px_0_#c21f16] hover:text-[#f4ecd8]">
            <span className="block font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#e0837a]">{textos.comecar}</span>
            <span className="mt-1.5 block font-serif text-[1.3rem] leading-snug">{textos.comecarTexto}</span>
            <span className="mt-3.5 inline-block rounded-full bg-[#c21f16] px-4 py-2 font-sans text-sm font-extrabold text-white">{textos.comecar} →</span>
          </L>
        )}
      </div>

      <div className="flex items-baseline justify-between px-4 pt-7 pb-3">
        <h2 className="font-serif text-[1.55rem] font-semibold leading-none">{textos.estantes}</h2>
        <L href="/trilhas" className="font-sans text-sm font-bold">
          {textos.verTodas}
        </L>
      </div>
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {estantes.map((estante, i) => (
          <li key={estante.slug} className="shrink-0 snap-start">
            <L href={`/estantes/${estante.slug}`} className={`flex h-44 w-[9.25rem] flex-col rounded-2xl p-3.5 hover:opacity-95 ${CAPAS[i % CAPAS.length]}`}>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] opacity-85">{estante.etapa}</span>
              <span className="mt-auto font-serif text-[1.25rem] font-semibold leading-[1.05]">{estante.nome}</span>
              <span className="mt-1.5 font-sans text-xs opacity-80">{estante.aulas}</span>
            </L>
          </li>
        ))}
      </ul>
    </section>
  );
}

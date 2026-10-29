// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCompleted, useLastLesson } from "@/lib/progress";
import { KEYS, useHydrated, useStored } from "@/lib/storage";
import { L, useI18n } from "../I18n";
import { Ladrilhos } from "./Atalhos";

export interface EstanteDoCelular {
  slug: string;
  nome: string;
  etapa: string;
  aulas: string;
  cor: string;
}

/**
 * O começo da inicial no celular (no navegador e no aplicativo): a data e o cumprimento, a busca, o "continue de onde
 * parou", os atalhos coloridos, o lambe-lambe do dia, a aula da semana e as estantes numa fileira que corre de lado.
 * A inicial do computador continua igual; esta parte só aparece no celular e fica de fora do leitor de tinta.
 */
export function InicioDoCelular({
  textos,
  estantes,
  busca,
  lambe,
  aulaDaSemana,
  extras,
}: {
  textos: { busca: string; buscaRotulo: string; buscar: string; continuar: string; retomar: string; comecar: string; comecarTexto: string; estantes: string; verTodas: string; muro: string };
  estantes: EstanteDoCelular[];
  /** O endereço da página de busca, já com o idioma. */
  busca: string;
  /** O lambe-lambe do dia, montado pela página (o mesmo do computador). */
  lambe: React.ReactNode;
  /** A aula da semana, montada pela página. */
  aulaDaSemana: React.ReactNode;
  /** O que vem no fim (jornal, formação militante, mural de saúde). */
  extras: React.ReactNode;
}) {
  const { t } = useI18n();
  const c = t.celular;
  const hydrated = useHydrated();
  const ultima = useLastLesson();
  const feitas = useCompleted();
  const nome = useStored(KEYS.name);
  const tem = hydrated && ultima?.path;
  // A data e o cumprimento vêm do aparelho: a página é feita uma vez e servida pronta, então não pode trazer a hora.
  const agora = hydrated ? new Date() : null;
  const data = agora ? new Intl.DateTimeFormat(document.documentElement.lang || undefined, { weekday: "long", day: "numeric", month: "long" }).format(agora) : " ";
  const hora = agora?.getHours() ?? 12;
  const cumprimento = hora < 12 ? c.bomDia : hora < 18 ? c.boaTarde : c.boaNoite;

  return (
    <section className="inicio-do-celular no-leitor no-print">
      <div className="px-4 pt-5">
        <p className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.16em] text-prelo-texto">{data}</p>
        <p className="mt-1.5 font-serif text-[2rem] font-medium leading-[1.05]">
          {cumprimento}
          {hydrated && nome ? (
            <>
              , <em className="text-oxblood">{nome}</em>
            </>
          ) : null}
          .
        </p>
        <form action={busca} role="search" className="mt-4 flex items-center gap-2.5 rounded-[1rem] border-[1.5px] border-ink bg-folha pr-1.5 pl-4">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 20 20" />
          </svg>
          <input name="q" type="search" aria-label={textos.buscaRotulo} placeholder={textos.busca} className="min-w-0 flex-1 bg-transparent py-3 font-sans text-base text-ink outline-none placeholder:text-ink-soft" />
          <button className="rounded-[0.75rem] bg-[#c21f16] px-4 py-2 font-sans text-sm font-extrabold text-white">{textos.buscar}</button>
        </form>
      </div>

      <div className="px-4 pt-5">
        {tem ? (
          <L href={ultima.path} className="block rounded-[1.25rem] border-[1.5px] border-[#1f1a14] bg-[#1f1a14] p-4 text-[#f4ecd8] shadow-[4px_4px_0_#c21f16] hover:text-[#f4ecd8]">
            <span className="block font-mono text-[0.68rem] font-medium uppercase tracking-[0.16em] text-[#e0837a]">{textos.continuar}</span>
            <span className="mt-1.5 block font-serif text-[1.55rem] font-semibold leading-tight">{ultima.title}</span>
            <span className="mt-0.5 block text-[0.92rem] text-[#d9ccac]">{ultima.track}</span>
            <span className="mt-3.5 flex items-center justify-between gap-3">
              {/* Um ponto por aula feita neste aparelho, como no cartão de continuar do site. */}
              <span aria-hidden className="flex flex-wrap gap-1">
                {Array.from({ length: Math.min(feitas.size, 12) }, (_, i) => (
                  <span key={i} className="h-2 w-2 rounded-full bg-[#c21f16]" />
                ))}
              </span>
              <span className="shrink-0 rounded-full bg-[#c21f16] px-4 py-2 font-sans text-sm font-extrabold text-white">{textos.retomar}</span>
            </span>
          </L>
        ) : (
          <L href="/comecar" className="block rounded-[1.25rem] border-[1.5px] border-[#1f1a14] bg-[#1f1a14] p-4 text-[#f4ecd8] shadow-[4px_4px_0_#c21f16] hover:text-[#f4ecd8]">
            <span className="block font-mono text-[0.68rem] font-medium uppercase tracking-[0.16em] text-[#e0837a]">{textos.comecar}</span>
            <span className="mt-1.5 block font-serif text-[1.3rem] leading-snug">{textos.comecarTexto}</span>
            <span className="mt-3.5 inline-block rounded-full bg-[#c21f16] px-4 py-2 font-sans text-sm font-extrabold text-white">{textos.comecar} →</span>
          </L>
        )}
      </div>

      <div className="px-4 pt-6">
        <Ladrilhos chaves={["radio", "podcasts", "journal", "news", "glossary", "labs", "questionBank", "live"]} rotulo={c.atalhos} />
      </div>

      <div className="px-4 pt-7">
        <h2 className="font-serif text-[1.55rem] font-semibold leading-none">{textos.muro}</h2>
        <div className="lambe-do-celular mt-3 rounded-[1.25rem] border-[1.5px] border-[#1f1a14] bg-[#1f1a14] px-5 pt-5 pb-4 shadow-[4px_4px_0_#c21f16]">{lambe}</div>
      </div>

      <div className="px-4 pt-7">{aulaDaSemana}</div>

      <div className="flex items-baseline justify-between px-4 pt-8 pb-3">
        <h2 className="font-serif text-[1.55rem] font-semibold leading-none">{textos.estantes}</h2>
        <L href="/trilhas" className="font-sans text-sm font-bold text-oxblood">
          {textos.verTodas}
        </L>
      </div>
      <ul className="fileira-de-lado mx-0! pb-3">
        {estantes.map((estante) => (
          <li key={estante.slug}>
            <L href={`/estantes/${estante.slug}`} className="caderno h-44 w-[8.75rem]" style={{ background: estante.cor }}>
              <span className="pt-3 pr-2.5 pl-7 font-mono text-[0.56rem] uppercase tracking-[0.14em] line-clamp-2">{estante.etapa}</span>
              <span className="etiqueta mt-2.5 mr-2.5 ml-7 block px-2 py-1.5 font-serif text-[1.05rem] font-semibold leading-[1.05]">{estante.nome}</span>
              <span className="mt-auto pr-2.5 pb-3 pl-7 font-mono text-[0.6rem] uppercase tracking-[0.1em]">{estante.aulas} →</span>
            </L>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-4 px-4 pt-6 pb-2">{extras}</div>
    </section>
  );
}

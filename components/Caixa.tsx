// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/i18n/types";
import type { ToolId } from "@/lib/areas";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { ToolView } from "./tools/ToolView";

type Tools = Dict["tools"];

/**
 * A caixa de ferramentas das aulas: a calculadora, o resolvedor, a tabela periódica… sem sair da página. Não é uma
 * janela que tranca a tela: no computador ela abre ao lado e a aula se afasta para a esquerda; no celular, sobe de
 * baixo, acima da barra de navegação, e a aula continua rolando por trás. A ferramenta só é baixada quando se abre, e o
 * que se digitou nela continua lá ao fechar e abrir de novo.
 */
export function Caixa({ ferramentas, sugeridas, area, nomes, s, lang }: { ferramentas: ToolId[]; sugeridas: ToolId[]; area: string; nomes: Record<string, string[]>; s: Partial<Tools> & { box: Tools["box"] }; lang: string }) {
  const b = s.box;
  const [aberta, setAberta] = useState(false);
  const [atual, setAtual] = useState<ToolId>(ferramentas[0]);
  const [montadas, setMontadas] = useState<ToolId[]>([]);
  const [alta, setAlta] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  // Na primeira vez que a caixa abre nesta página, volta à última ferramenta usada nesta disciplina.
  function ultimaUsada(): ToolId {
    if (montadas.length) return atual;
    try {
      const guardado = JSON.parse(getItem(KEYS.tools) || "{}") as Record<string, string>;
      const ultima = guardado[area] as ToolId | undefined;
      if (ultima && ferramentas.includes(ultima)) return ultima;
    } catch {
      // nada guardado ainda
    }
    return atual;
  }

  // A aula abre espaço no computador enquanto a caixa está aberta (a regra fica em app/globals.css).
  useEffect(() => {
    document.documentElement.classList.toggle("caixa-aberta", aberta);
    return () => document.documentElement.classList.remove("caixa-aberta");
  }, [aberta]);

  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta]);

  function abrir(id = atual) {
    setAtual(id);
    setMontadas((lista) => (lista.includes(id) ? lista : [...lista, id]));
    setAberta(true);
    try {
      const guardado = JSON.parse(getItem(KEYS.tools) || "{}") as Record<string, string>;
      setItem(KEYS.tools, JSON.stringify({ ...guardado, [area]: id }));
    } catch {
      setItem(KEYS.tools, JSON.stringify({ [area]: id }));
    }
    window.setTimeout(() => titulo.current?.focus(), 0);
  }
  function fechar() {
    setAberta(false);
    window.setTimeout(() => botao.current?.focus(), 0);
  }

  return (
    <div className="no-print font-sans text-sm">
      {!aberta && (
        <button
          ref={botao}
          type="button"
          onClick={() => abrir(ultimaUsada())}
          aria-label={b.openLabel}
          aria-expanded={false}
          aria-controls="caixa-de-ferramentas"
          className="fixed bottom-[calc(8.25rem+env(safe-area-inset-bottom,0px))] right-3 z-40 flex items-center gap-2 border-2 border-ink bg-parchment px-3 py-2.5 font-medium shadow-[3px_3px_0_var(--ink)] hover:border-oxblood hover:text-oxblood md:bottom-20 md:right-4"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h18v12H3zM8 8V5h8v3M3 13h18M10 13v2h4v-2" />
          </svg>
          {b.open}
        </button>
      )}
      <section
        id="caixa-de-ferramentas"
        aria-label={b.title}
        hidden={!aberta}
        className={`fixed inset-x-0 z-40 flex flex-col border-t-[3px] border-ink bg-parchment shadow-[0_-6px_24px_rgba(0,0,0,0.25)] bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[28rem] lg:border-l-[3px] lg:border-t-0 lg:shadow-none ${alta ? "h-[78dvh] max-h-[calc(100dvh-5rem-env(safe-area-inset-bottom,0px))]" : "h-[52dvh]"} lg:!h-auto`}
      >
        <header className="flex items-center gap-2 border-b-2 border-ink px-3 py-2">
          <h2 ref={titulo} tabIndex={-1} className="mr-auto font-serif text-lg font-semibold outline-none">{b.title}</h2>
          <button type="button" onClick={() => setAlta(!alta)} className="cursor-pointer border border-rule px-2 py-1 lg:hidden" aria-pressed={alta}>
            {alta ? b.smaller : b.bigger}
          </button>
          <button type="button" onClick={fechar} className="cursor-pointer border-2 border-ink px-3 py-1 font-medium hover:border-oxblood hover:text-oxblood">
            {b.close} <span aria-hidden>✕</span>
          </button>
        </header>
        <nav aria-label={b.choose} className="flex gap-1.5 overflow-x-auto border-b border-rule px-3 py-2 [scrollbar-width:thin]">
          {ferramentas.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => abrir(id)}
              aria-current={atual === id ? "true" : undefined}
              title={nomes[id]?.[1]}
              className={`shrink-0 cursor-pointer whitespace-nowrap border px-2.5 py-1 ${atual === id ? "border-ink bg-ink text-parchment" : "border-rule bg-parchment-deep hover:border-ink"}`}
            >
              {nomes[id]?.[0] ?? id}
              {sugeridas.includes(id) && <span className="sr-only"> · {b.suggested}</span>}
              {sugeridas.includes(id) && <span aria-hidden className="ml-1 text-gold">★</span>}
            </button>
          ))}
        </nav>
        <div className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {/* Toda ferramenta aberta continua montada: o que se digitou não se perde ao trocar de ferramenta ou fechar a caixa. */}
          {montadas.map((id) => (
            <div key={id} hidden={id !== atual} className="[&>div]:!mt-4">
              <ToolView id={id} s={s} lang={lang} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

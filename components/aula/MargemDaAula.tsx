// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { L, useI18n } from "../I18n";
import { ANOTAR } from "./BarraDaAula";

export const ABRIR_CAIXA = "lucia:abrir-caixa";

/**
 * A margem da aula, como a de um caderno: o post-it amarelo onde a pessoa anota (fica só no aparelho), a palavra do
 * glossário que a aula usa e o cartão preto do laboratório, que abre a caixa de ferramentas ao lado do texto.
 */
export function MargemDaAula({ aula, termo, laboratorio, children }: { aula: string; termo?: { slug: string; term: string; summary: string }; laboratorio?: { id: string; nome: string }; children?: React.ReactNode }) {
  const { t } = useI18n();
  const l = t.lesson;
  const chave = `lucia:anotacao:${aula}`;
  const [nota, setNota] = useState("");
  const [guardada, setGuardada] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a anotação só existe no navegador
      setNota(localStorage.getItem(chave) ?? "");
    } catch {
      // sem armazenamento
    }
  }, [chave]);

  useEffect(() => {
    const anotar = () => {
      campo.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      window.setTimeout(() => campo.current?.focus(), 250);
    };
    window.addEventListener(ANOTAR, anotar);
    return () => window.removeEventListener(ANOTAR, anotar);
  }, []);

  const mudar = (valor: string) => {
    setNota(valor);
    try {
      if (valor) localStorage.setItem(chave, valor);
      else localStorage.removeItem(chave);
      setGuardada(true);
    } catch {
      setGuardada(false);
    }
  };

  return (
    <aside aria-label={l.myNote} className="margem-da-aula no-print flex flex-col gap-6 font-sans">
      <label className="block rotate-[1.2deg] border-[1.5px] border-[#1f1a14] bg-[#f7e27c] p-3.5 text-[#1f1a14] shadow-[3px_3px_0_#1f1a14]">
        <span className="block font-mono text-[0.66rem] font-semibold uppercase tracking-[0.16em]">{l.myNote}</span>
        <textarea
          ref={campo}
          value={nota}
          onChange={(e) => mudar(e.target.value)}
          rows={5}
          maxLength={5000}
          placeholder={l.notePlaceholder}
          className="mt-1.5 block w-full resize-y bg-transparent font-serif text-[1.05rem] italic leading-snug text-[#1f1a14] outline-none placeholder:text-[#1f1a14]/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f1a14]"
        />
        <span aria-live="polite" className="block min-h-4 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-[#1f1a14]/70">
          {guardada && nota ? l.noteSaved : ""}
        </span>
      </label>

      {termo && (
        <div className="border-[1.5px] border-dashed border-ink bg-folha p-3.5">
          <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-prelo-texto">{l.glossaryWord}</p>
          <p className="mt-1.5 font-serif text-[1.05rem] leading-snug">
            <L href={`/glossario#${termo.slug}`} className="font-semibold text-ink hover:text-ink hover:underline">
              {termo.term}
            </L>
            : {termo.summary}
          </p>
        </div>
      )}

      {laboratorio && (
        <div className="border-[1.5px] border-[#1f1a14] bg-[#1f1a14] p-3.5 text-[#f4ecd8] shadow-[3px_3px_0_var(--prelo)]">
          <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#e0837a]">{l.lab}</p>
          <p className="mt-1.5 font-serif text-[1.15rem] font-semibold leading-snug">{laboratorio.nome}</p>
          <p className="mt-1 font-serif text-[1rem] leading-snug text-[#e9dcbc]">{l.labText}</p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(ABRIR_CAIXA, { detail: laboratorio.id }))}
            className="mt-2.5 cursor-pointer font-sans text-sm font-bold text-[#f4ecd8] underline underline-offset-4 hover:text-white"
          >
            {l.labOpen} →
          </button>
        </div>
      )}
      {children}
    </aside>
  );
}

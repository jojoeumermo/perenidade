// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { GUIAS } from "./guias";

const VISTAS = "lucia:guias-vistos";

function vistos(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(VISTAS) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function marcarVisto(id: string) {
  try {
    localStorage.setItem(VISTAS, JSON.stringify([...new Set([...vistos(), id])]));
  } catch {
    // sem armazenamento
  }
}

/**
 * O passo a passo de cada seção do painel (components/painel/guias.ts). Na primeira vez que a pessoa abre uma seção,
 * aparece uma faixa convidando para ver como ela funciona; o botão "Como funciona" do alto da seção reabre a qualquer
 * hora. Os passos vão um de cada vez, em linguagem simples, com voltar e avançar (setas do teclado também).
 */
export function GuiaDaSecao({ id, nome }: { id: string; nome: string }) {
  const guia = GUIAS[id];
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0);
  const [convite, setConvite] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o que já foi visto só existe no navegador
    setConvite(Boolean(guia) && !vistos().includes(id));
  }, [id, guia]);

  useEffect(() => {
    if (!aberto || !guia) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      else if (e.key === "ArrowRight") setPasso((p) => Math.min(p + 1, guia.passos.length - 1));
      else if (e.key === "ArrowLeft") setPasso((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  if (!guia) return null;
  const abrir = () => {
    setPasso(0);
    setAberto(true);
  };
  function fechar() {
    setAberto(false);
    setConvite(false);
    marcarVisto(id);
    window.setTimeout(() => botao.current?.focus(), 0);
  }
  const atual = guia.passos[passo];
  const ultimo = passo === guia.passos.length - 1;

  return (
    <>
      <button ref={botao} type="button" onClick={abrir} className="no-print inline-flex cursor-pointer items-center gap-2 border-2 border-ink bg-folha px-3 py-1.5 text-[0.82rem] font-bold shadow-[3px_3px_0_var(--sombra)] hover:-translate-x-px hover:-translate-y-px">
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-prelo-texto" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.2h.01" />
        </svg>
        Como funciona esta seção
      </button>

      {convite && !aberto && (
        <p role="status" className="no-print mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-2 border-ink bg-[#1f1a14] px-4 py-3 text-[#f4ecd8] shadow-[4px_4px_0_var(--prelo)]">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-[#e0837a]">Primeira vez aqui?</span>
          <span className="min-w-0 flex-1">{guia.paraQue} Veja como funciona em {guia.passos.length} passos.</span>
          <button type="button" onClick={abrir} className="cursor-pointer border-2 border-[#f4ecd8] bg-[#c21f16] px-3 py-1 font-bold text-white hover:bg-[#a51810]">
            Ver o passo a passo
          </button>
          <button
            type="button"
            onClick={() => {
              setConvite(false);
              marcarVisto(id);
            }}
            className="cursor-pointer underline hover:text-white"
          >
            Agora não
          </button>
        </p>
      )}

      {aberto && (
        <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-[#17130e]/60 px-4" onClick={fechar}>
          <div role="dialog" aria-modal="true" aria-labelledby="guia-titulo" className="w-full max-w-lg border-2 border-[#1f1a14] bg-[#fbf6e8] p-6 text-[#1f1a14] shadow-[8px_8px_0_#c21f16] sm:p-7" onClick={(e) => e.stopPropagation()}>
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-[#c21f16]">
              {nome} · passo {passo + 1} de {guia.passos.length}
            </p>
            {passo === 0 && <p className="mt-2 text-[0.95rem] leading-snug text-[#5a4e3c]">{guia.paraQue}</p>}
            <h2 id="guia-titulo" className="mt-3 flex items-start gap-3 font-serif text-[1.7rem] font-semibold leading-tight">
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-[#1f1a14] bg-[#c21f16] font-sans text-base font-black text-white">
                {passo + 1}
              </span>
              {atual.titulo}
            </h2>
            <p className="mt-3 text-[1.02rem] leading-relaxed">{atual.texto}</p>
            {ultimo && guia.dica && (
              <p className="mt-4 border-2 border-dashed border-[#1f1a14] px-3 py-2 text-[0.92rem] leading-snug">
                <strong>Dica:</strong> {guia.dica}
              </p>
            )}
            <div aria-hidden className="mt-5 flex gap-1.5">
              {guia.passos.map((_, i) => (
                <span key={i} className={`h-1.5 flex-1 ${i <= passo ? "bg-[#c21f16]" : "bg-[#e2d2ab]"}`} />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {passo > 0 && (
                <button type="button" onClick={() => setPasso(passo - 1)} className="cursor-pointer border-2 border-[#1f1a14] px-3.5 py-2 font-bold hover:bg-[#f4ecd8]">
                  ← Voltar
                </button>
              )}
              <button type="button" autoFocus onClick={() => (ultimo ? fechar() : setPasso(passo + 1))} className="cursor-pointer border-2 border-[#1f1a14] bg-[#c21f16] px-4 py-2 font-bold text-white shadow-[3px_3px_0_#1f1a14] hover:bg-[#a51810]">
                {ultimo ? "Entendi" : "Próximo →"}
              </button>
              <button type="button" onClick={fechar} className="ml-auto cursor-pointer underline hover:text-[#c21f16]">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

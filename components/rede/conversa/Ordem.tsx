// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { TextosDaConversa } from "@/lib/rede/textos-conversa";
import { ORDENS, type OrdemDasRespostas } from "@/lib/rede/tipos-conversa";

/**
 * Quem escolhe a ordem das respostas (mais úteis, mais antigas, mais novas) e "Por que esta ordem?", com a fórmula escrita por
 * extenso: nenhuma ordem é segredo. A ordem por "útil" só conta o que é público; apoio nunca entra (só o autor o vê).
 */
export function Ordem({ ordem, aoMudar, t, ocupado }: { ordem: OrdemDasRespostas; aoMudar: (o: OrdemDasRespostas) => void; t: TextosDaConversa; ocupado: boolean }) {
  const formula = ordem === "uteis" ? t.ordem.formulaUteis : ordem === "antigas" ? t.ordem.formulaAntigas : t.ordem.formulaNovas;
  return (
    <div className="border-b border-rule px-[18px] py-3 font-sans">
      <div role="group" aria-label={t.ordem.rotulo} className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{t.ordem.rotulo}:</span>
        {ORDENS.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={ordem === o}
            disabled={ocupado}
            onClick={() => ordem !== o && aoMudar(o)}
            className={`min-h-11 cursor-pointer rounded-full border px-4 text-sm font-bold disabled:cursor-wait ${ordem === o ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}
          >
            {t.ordem[o]}
          </button>
        ))}
      </div>
      <details className="mt-1">
        <summary className="min-h-11 cursor-pointer py-2 text-sm underline">{t.ordem.porQue}</summary>
        <p className="text-sm">{formula}</p>
        <p className="mt-1 text-sm text-ink-soft">{t.ordem.aoLado}</p>
      </details>
    </div>
  );
}

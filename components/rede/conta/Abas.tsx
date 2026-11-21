// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { KeyboardEvent } from "react";

/** Uma fileira de abas com setas, Home e End (o mesmo das outras telas do Prompt 4). */
export function Abas<K extends string>({ chaves, atual, rotulo, nomes, aoTrocar, prefixo, classe }: { chaves: readonly K[]; atual: K; rotulo: string; nomes: (k: K) => string; aoTrocar: (k: K) => void; prefixo: string; classe: string }) {
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = chaves.indexOf(atual);
    const j = e.key === "ArrowRight" ? (i + 1) % chaves.length : e.key === "ArrowLeft" ? (i + chaves.length - 1) % chaves.length : e.key === "Home" ? 0 : e.key === "End" ? chaves.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    aoTrocar(chaves[j]);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-aba="${chaves[j]}"]`)?.focus();
  };
  return (
    <div className={classe} role="tablist" aria-label={rotulo} onKeyDown={teclas}>
      {chaves.map((k) => (
        <button key={k} type="button" role="tab" id={`${prefixo}-aba-${k}`} data-aba={k} aria-selected={atual === k} aria-controls={`${prefixo}-painel-${k}`} tabIndex={atual === k ? 0 : -1} className="ct-aba" onClick={() => aoTrocar(k)}>
          {nomes(k)}
        </button>
      ))}
    </div>
  );
}

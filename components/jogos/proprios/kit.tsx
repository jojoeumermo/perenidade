// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ReactNode } from "react";
import type { Fonte } from "@/lib/jogos-proprios/regras";

/** Moldura comum dos jogos próprios: título, explicação curta, o jogo e as fontes. Sem pontuação, sem sequência, sem relógio. */
export function Moldura({ titulo, ajuda, fontes, children }: { titulo: string; ajuda: string; fontes?: Fonte[]; children: ReactNode }) {
  return (
    <section className="border-2 border-ink bg-folha p-4 shadow-[5px_5px_0_var(--sombra)]" aria-labelledby={`jp-${slug(titulo)}`} lang="pt">
      <h2 id={`jp-${slug(titulo)}`} className="font-serif text-2xl font-semibold leading-tight">{titulo}</h2>
      <p className="mt-1 text-sm text-ink-soft">{ajuda}</p>
      <div className="mt-4">{children}</div>
      {fontes && fontes.length > 0 && (
        <p className="mt-4 border-t border-ink/30 pt-2 text-xs text-ink-soft">
          Fontes:{" "}
          {fontes.map((f, i) => (
            <span key={f.titulo}>
              {i > 0 && "; "}
              {f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{f.titulo}</a> : f.titulo}
            </span>
          ))}
          .
        </p>
      )}
    </section>
  );
}

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function Btn({ children, onClick, ativo, desligado, tipo = "papel" }: { children: ReactNode; onClick: () => void; ativo?: boolean; desligado?: boolean; tipo?: "papel" | "tinta" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desligado}
      aria-pressed={ativo === undefined ? undefined : ativo}
      className={`min-h-11 cursor-pointer border-2 border-ink px-3 py-1.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${ativo || tipo === "tinta" ? "bg-ink text-parchment" : "bg-parchment hover:bg-folha"}`}
    >
      {children}
    </button>
  );
}

export function Barra({ rotulo, valor, total, cor = "#c21f16" }: { rotulo: string; valor: number; total: number; cor?: string }) {
  const p = total > 0 ? Math.max(0, Math.min(100, (valor / total) * 100)) : 0;
  return (
    <div className="text-sm">
      <div className="flex justify-between gap-2"><span>{rotulo}</span><span className="font-mono tabular-nums">{Math.round(valor * 100) / 100}</span></div>
      <div className="mt-0.5 h-3 border-2 border-ink bg-parchment" role="presentation"><div className="h-full" style={{ width: `${p}%`, background: cor }} /></div>
    </div>
  );
}

export function Campo({ rotulo, valor, min, max, passo = 1, mudar, formato }: { rotulo: string; valor: number; min: number; max: number; passo?: number; mudar: (v: number) => void; formato?: (v: number) => string }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between gap-2"><span className="font-semibold">{rotulo}</span><span className="font-mono tabular-nums text-oxblood">{formato ? formato(valor) : valor}</span></span>
      <input type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => mudar(Number(e.target.value))} className="mt-1 h-8 w-full accent-[#c21f16]" />
    </label>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";
import type { Fonte } from "./tipos";

/** Caixa de um jogo: mesma moldura dos outros jogos do site, com a nota "não vicia" no rodapé. */
export function Moldura({ titulo, intro, children }: { titulo: string; intro: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="border-2 border-ink bg-folha p-5 shadow-[5px_5px_0_var(--sombra)]">
      <h3 className="font-serif text-2xl font-semibold leading-tight">{titulo}</h3>
      <p className="mt-2 max-w-2xl leading-relaxed">{intro}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Lista de fontes do jogo, com link (abre em outra aba, sem enviar de onde a pessoa veio). */
export function Fontes({ fontes, nota }: { fontes: Fonte[]; nota?: string }) {
  return (
    <div className="mt-5 border-t border-ink/40 pt-3 font-sans text-xs text-ink-soft">
      <p className="font-bold uppercase tracking-[0.1em]">Fontes</p>
      <ul className="mt-1 space-y-1">
        {fontes.map((f) => (
          <li key={f.url}>
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              {f.nome}
            </a>
          </li>
        ))}
      </ul>
      {nota ? <p className="mt-2 leading-relaxed">{nota}</p> : null}
    </div>
  );
}

/** Aviso de leitor de tela: texto que muda sem o foco mudar de lugar. */
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="mt-3 border-l-4 border-prelo-texto pl-3 leading-relaxed">
      {children}
    </p>
  );
}

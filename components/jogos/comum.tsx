// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ReactNode } from "react";
import Link from "@/components/Link";
import type { Verbete } from "@/lib/jogos/base";
import type { TextosDosJogos } from "@/i18n/jogos";

/** O que todo jogo de treino recebe: os verbetes do glossário e os textos no idioma da página. */
export interface PropsDoJogo {
  verbetes: Verbete[];
  s: TextosDosJogos;
  lang: string;
}

/** Aviso lido pelo leitor de tela sem tirar o foco de onde a pessoa está. */
export function Aviso({ children }: { children?: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="min-h-6 font-sans text-sm font-bold text-prelo-texto">
      {children}
    </p>
  );
}

/** A faixa de botões de ação do jogo (novo jogo, conferir, dica...). */
export function Acoes({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>;
}

export function Botao({ children, ...resto }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...resto} className={`botao cursor-pointer ${resto.className ?? ""}`}>
      {children}
    </button>
  );
}

/** O link "Ver a aula" que aparece quando o verbete tem aula. */
export function LinkDaAula({ aula, lang, rotulo }: { aula?: { titulo: string; href: string }; lang: string; rotulo: string }) {
  if (!aula) return null;
  return (
    <Link href={`/${lang}${aula.href}`} className="underline hover:text-oxblood">
      {rotulo}: {aula.titulo}
    </Link>
  );
}

/** Seletor de opções pequeno (um grupo de botões com aria-pressed). */
export function Opcoes<T extends string | number>({ nome, valor, opcoes, aoEscolher }: { nome: string; valor: T; opcoes: [T, string][]; aoEscolher: (v: T) => void }) {
  return (
    <div role="group" aria-label={nome} className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink-soft">{nome}</span>
      {opcoes.map(([v, rotulo]) => (
        <button key={String(v)} type="button" aria-pressed={valor === v} onClick={() => aoEscolher(v)} className="aba-pasta cursor-pointer">
          {rotulo}
        </button>
      ))}
    </div>
  );
}

export const Quadro = ({ children }: { children: ReactNode }) => <div className="border-2 border-ink bg-folha p-4 shadow-[5px_5px_0_var(--sombra)] sm:p-5">{children}</div>;

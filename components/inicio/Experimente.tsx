// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import { L } from "../I18n";

export interface Sugestao {
  label: string;
  path: string;
}

// Um sorteio por visita: cada vez que a página abre, o "Experimente" mostra outras portas de entrada.
// No servidor não há sorteio (a página é montada uma vez só): lá saem as primeiras, e o navegador sorteia ao abrir.
const semente = typeof window === "undefined" ? 0 : Math.random();
const nunca = () => () => {};

function sortear<T>(lista: T[], quantos: number, s: number): T[] {
  const copia = [...lista];
  let x = Math.floor(s * 2 ** 31) || 1;
  for (let i = copia.length - 1; i > 0; i--) {
    x = (x * 48271) % 2147483647;
    const j = x % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, quantos);
}

/** As sugestões embaixo da busca da inicial: quatro, sorteadas entre trilhas com aula pronta e seções do site. */
export function Experimente({ rotulo, sugestoes, quantas = 4 }: { rotulo: string; sugestoes: Sugestao[]; quantas?: number }) {
  const s = useSyncExternalStore(nunca, () => semente, () => -1);
  const escolhidas = s < 0 ? sugestoes.slice(0, quantas) : sortear(sugestoes, quantas, s);
  if (escolhidas.length === 0) return null;
  return (
    <p className="mt-6 flex flex-wrap items-center gap-2.5 font-sans text-sm max-md:mt-4">
      <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft">{rotulo}</span>
      {escolhidas.map((item) => (
        <L key={item.path} href={item.path} className="chip">
          {item.label}
        </L>
      ))}
    </p>
  );
}

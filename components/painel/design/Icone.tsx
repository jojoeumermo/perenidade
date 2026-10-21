// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

import { ICONES, type NomeDoIcone } from "./icones";

/** Um ícone de traço do estúdio (24 × 24, traço 1,6). Decorativo: quem usa dá o nome acessível ao botão. */
export function Icone({ nome, className = "h-5 w-5", espessura = 1.6 }: { nome: NomeDoIcone; className?: string; espessura?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={espessura} strokeLinecap="round" strokeLinejoin="round">
      {ICONES[nome].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

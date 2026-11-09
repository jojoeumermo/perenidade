// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Ref } from "react";

/**
 * Os cartões da chama do lampião (desenhada como o mosaico: 3 colunas × 5 linhas, como na prancha celular-inicio).
 * "d" = dourado, "v" = vermelho, "e" = vermelho escuro, "." = vazio.
 */
const CHAMA = [".d.", ".ve", "vvv", "vdv", ".v."];

/**
 * O logo da Alumia: um lampião (alça, tampa, vidro e base em papel) com a chama feita de cartões vermelhos e dourados, a mesma
 * linguagem do mosaico do ato. 32 × 40, desenho próprio (sem imagem de fora). Decorativo por padrão (a marca escrita vem ao lado);
 * com `rotulo`, vira imagem com nome para o leitor de tela.
 */
export function Lampiao({ tamanho = 32, rotulo, ref, className = "" }: { tamanho?: number; rotulo?: string; ref?: Ref<SVGSVGElement>; className?: string }) {
  const cor = { d: "var(--al-dourado, #ffc21a)", v: "var(--al-vermelho, #e8321f)", e: "var(--al-vermelho-escuro-chama, #b8261a)" } as const;
  return (
    <svg
      ref={ref}
      viewBox="0 0 32 40"
      width={tamanho}
      height={(tamanho * 40) / 32}
      className={`al-lampiao ${className}`.trim()}
      {...(rotulo ? { role: "img", "aria-label": rotulo } : { "aria-hidden": true })}
    >
      {/* Alça. */}
      <path d="M10 10V7.5a6 6 0 0 1 12 0V10" fill="none" stroke="var(--al-texto, #f3efe6)" strokeWidth={2.6} strokeLinecap="round" />
      {/* Tampa. */}
      <path d="M8.2 10h15.6l1.6 3H6.6z" fill="var(--al-texto, #f3efe6)" />
      {/* Vidro. */}
      <rect x={6.8} y={13} width={18.4} height={19} rx={3.4} fill="var(--al-fundo, #0f0e0d)" stroke="var(--al-texto, #f3efe6)" strokeWidth={2.4} />
      {/* Chama de cartões. */}
      {CHAMA.flatMap((linha, y) =>
        [...linha].map((c, x) =>
          c === "." ? null : <rect key={`${x}-${y}`} x={11.5 + x * 3.2} y={15.6 + y * 3.2} width={2.9} height={2.9} rx={0.4} fill={cor[c as keyof typeof cor]} />,
        ),
      )}
      {/* Base. */}
      <rect x={8.6} y={33.6} width={14.8} height={4.6} rx={1.6} fill="var(--al-texto, #f3efe6)" />
    </svg>
  );
}

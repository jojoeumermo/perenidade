// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Ref } from "react";
import { celulasDoAvatar } from "@/lib/rede/mosaico";
import type { CorDaComunidade } from "./Pilula";

const CORES = ["transparent", "var(--al-cartao-aceso, #f3efe6)", "", "var(--al-vermelho, #e8321f)", "var(--al-superficie-2, #2a2622)"];

export interface PropsDoAvatar16 {
  /** O @nome (sem foto, sem dado da pessoa): o mesmo @nome dá sempre o mesmo rosto. */
  handle: string;
  /** A cor própria (a da comunidade principal, 1–5); sem ela, sai do @nome. */
  cor?: CorDaComunidade;
  tamanho?: number;
  /** Com rótulo vira imagem com nome ("Rosto de @rosavermelha"); sem ele é decorativo (o nome já está escrito ao lado). */
  rotulo?: string;
  ref?: Ref<SVGSVGElement>;
  className?: string;
}

/**
 * O rosto de 16 cartões (4 × 4) das pranchas: um desenho que identifica o perfil sem foto e sem nome civil (codinome sempre,
 * INVENTARIO.md §1). Cantos arredondados no conjunto, como nas pranchas.
 */
export function Avatar16({ handle, cor, tamanho = 40, rotulo, ref, className = "" }: PropsDoAvatar16) {
  const celulas = celulasDoAvatar(handle);
  const propria = `var(--al-com-${cor ?? ((celulas.reduce<number>((s, c, i) => s + c * (i + 1), 0) % 5) + 1)})`;
  const id = `al-av-${handle.replace(/[^a-z0-9_]/gi, "")}`;
  return (
    <svg
      ref={ref}
      viewBox="0 0 40 40"
      width={tamanho}
      height={tamanho}
      className={`al-avatar16 ${className}`.trim()}
      {...(rotulo ? { role: "img", "aria-label": rotulo } : { "aria-hidden": true })}
    >
      <defs>
        <clipPath id={id}>
          <rect width={40} height={40} rx={8} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {celulas.map((c, i) =>
          c === 0 ? null : <rect key={i} x={(i % 4) * 10} y={Math.floor(i / 4) * 10} width={10} height={10} fill={c === 2 ? propria : CORES[c]} />,
        )}
      </g>
    </svg>
  );
}

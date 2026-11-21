// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { Ref } from "react";
import { CORES_DO_ROSTO } from "@/lib/rede/aparencia";
import { caminhosDoDesenho, COR_PROPRIA, corDaTinta, desenhoDe, LADO_DO_DESENHO, NOITE_DO_DESENHO } from "@/lib/rede/desenhos";
import { useFotoPublica } from "@/lib/rede/fotos-publicas";
import { useRostoDe } from "@/lib/rede/rostos";
import type { CorDaComunidade } from "./Pilula";

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
  /** Sempre o desenho, mesmo de quem está com nome e foto (a amostra do modo codinome na escolha da identidade). */
  soMosaico?: boolean;
}

/**
 * O rosto de cada perfil, sem foto e sem nome civil (o padrão da rede, INVENTARIO.md §1), com cantos arredondados no conjunto.
 * Em ordem: quem ESCOLHEU aparecer com nome e foto (lib/rede/fotos-publicas.ts) aparece com a foto; quem pintou o próprio rosto de
 * pixels em "Editar perfil" (perfil livre, lib/rede/rostos.ts) aparece com ele; os outros, com o desenho automático do @nome (P5,
 * A2: um símbolo ou um rosto montado de peças, lib/rede/desenhos.ts, no lugar dos 16 cartões ao acaso). O nome do componente
 * continua o mesmo para não mexer nas telas que o usam.
 */
export function Avatar16({ handle, cor, tamanho = 40, rotulo, ref, className = "", soMosaico = false }: PropsDoAvatar16) {
  const id = `al-av-${handle.replace(/[^a-z0-9_]/gi, "")}`;
  const publica = useFotoPublica(handle);
  const foto = soMosaico ? null : publica;
  // O rosto de pixels que a pessoa pintou no perfil livre, quando a gente já o conhece: a identidade montada no editor aparece na
  // rede inteira, não só no perfil (voltou: tinha se perdido numa junção).
  const px = useRostoDe(handle);
  const atributos = { ref, width: tamanho, height: tamanho, ...(rotulo ? { role: "img", "aria-label": rotulo } : { "aria-hidden": true as const }) };
  if (foto) {
    return (
      <svg {...atributos} viewBox="0 0 40 40" className={`al-avatar16 al-avatar16-foto ${className}`.trim()}>
        <defs>
          <clipPath id={id}>
            <rect width={40} height={40} rx={8} />
          </clipPath>
        </defs>
        {/* Data URL WebP já conferida (sem EXIF): só os pixels que a própria pessoa recortou e enviou. */}
        <image href={foto} width={40} height={40} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />
      </svg>
    );
  }
  if (px) {
    return (
      <svg {...atributos} viewBox="0 0 8 8" shapeRendering="crispEdges" className={`al-avatar16 al-avatar16-rosto ${className}`.trim()}>
        <defs>
          <clipPath id={`${id}-px`}>
            <rect width={8} height={8} rx={1.6} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id}-px)`}>
          <rect width={8} height={8} fill="var(--al-superficie-2, #2a2622)" />
          {[...px].map((d, i) => (d === "0" ? null : <rect key={i} x={i % 8} y={Math.floor(i / 8)} width={1.02} height={1.02} fill={CORES_DO_ROSTO[Number(d)]} />))}
        </g>
      </svg>
    );
  }
  const desenho = desenhoDe(handle);
  const propria = COR_PROPRIA[(cor ?? desenho.cor) - 1];
  const lado = LADO_DO_DESENHO;
  return (
    <svg {...atributos} viewBox={`0 0 ${lado} ${lado}`} shapeRendering="crispEdges" className={`al-avatar16 ${className}`.trim()} data-desenho={desenho.nome}>
      <defs>
        <clipPath id={id}>
          <rect width={lado} height={lado} rx={lado / 5} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width={lado} height={lado} fill={desenho.invertido ? NOITE_DO_DESENHO : propria} />
        {caminhosDoDesenho(desenho.grade).map(({ tinta, d }) => (
          <path key={tinta} d={d} fill={corDaTinta(tinta, propria, desenho.invertido)} />
        ))}
      </g>
    </svg>
  );
}

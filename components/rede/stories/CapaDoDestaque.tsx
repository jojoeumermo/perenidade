// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { mosaicoDeFundo, PALETA_DO_STORY } from "@/lib/rede/stories/visual";
import type { DestaqueDeStories } from "@/lib/rede/tipos-stories";

/** A capa de um destaque: a primeira foto (endereço assinado) ou um mosaico pequeno na cor dele. */
export function CapaDoDestaque({ d }: { d: DestaqueDeStories }) {
  if (d.capa?.url) {
    // Endereço assinado de vida curta: sem otimização do Next (que guardaria a imagem).
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={d.capa.url} alt="" referrerPolicy="no-referrer" decoding="async" />;
  }
  const cartoes = mosaicoDeFundo(d.id, d.cor, 5, 5);
  return (
    <svg viewBox="0 0 50 50" aria-hidden>
      <rect width="50" height="50" fill={PALETA_DO_STORY[d.cor].listra} />
      {cartoes.map((c, i) => (
        <rect key={i} x={(i % 5) * 10 + 0.6} y={Math.floor(i / 5) * 10 + 0.6} width={8.8} height={8.8} rx={1} fill={c} />
      ))}
    </svg>
  );
}


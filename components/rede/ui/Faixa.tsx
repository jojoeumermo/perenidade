// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Ref } from "react";

/**
 * A faixa tecida (pranchas: 6 px no alto de toda tela; 11 listras nas proporções 5-2-3-1-4-2-3-1-3-2-4, as cores das lutas do
 * instituto). Marca que se está na Alumia, e nada mais: por isso é escondida do leitor de tela. A altura muda só por prop
 * (o padrão é a das pranchas) e, no e-ink, vira listras pretas e brancas.
 */
export function Faixa({ altura, ref, className = "" }: { altura?: number; ref?: Ref<HTMLDivElement>; className?: string }) {
  return <div ref={ref} aria-hidden className={`al-faixa ${className}`.trim()} style={altura ? { height: altura } : undefined} />;
}

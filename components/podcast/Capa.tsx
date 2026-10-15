// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { arquivoPublico } from "@/lib/podcast";
import { Star } from "../Masthead";

/**
 * Capa quadrada de episódio ou série. Sem imagem enviada, vira um cartaz: a faixa vermelha com a estrela e o título
 * em letra pesada, para a estante nunca ficar com buracos cinzentos.
 */
export function Capa({ caminho, titulo, numero, className = "", grande = false }: { caminho?: string; titulo: string; numero?: number | null; className?: string; grande?: boolean }) {
  if (caminho) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={arquivoPublico(caminho)} alt="" loading="lazy" decoding="async" width={grande ? 600 : 300} height={grande ? 600 : 300} className={`aspect-square w-full bg-ink object-cover ${className}`} />;
  }
  return (
    <div aria-hidden className={`podcast-capa-cartaz relative flex aspect-square w-full flex-col justify-between overflow-hidden p-[8%] ${className}`}>
      <Star className="h-[18%] w-[18%] text-parchment" />
      <span className={`line-clamp-4 font-sans font-black uppercase italic leading-[0.95] text-parchment ${grande ? "text-[clamp(1.5rem,5vw,2.75rem)]" : "text-[clamp(0.85rem,2.6vw,1.15rem)]"}`}>{titulo}</span>
      {numero != null && <span className="absolute right-[6%] top-[5%] font-mono text-[0.7rem] font-semibold text-parchment/80">#{numero}</span>}
    </div>
  );
}

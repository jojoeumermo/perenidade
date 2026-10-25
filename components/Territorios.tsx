// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Edicao } from "@/lib/territorios";

const CORES: Record<Edicao["cor"], string> = {
  preto: "bg-[#1f1a14] text-[#f4ecd8]",
  papel: "bg-[#fbf8f1] text-[#1f1a14]",
  vermelho: "bg-[#c21f16] text-[#fbf8f1]",
};

/**
 * Capa de revista de uma edição, só com tipografia: enquanto as fotos da equipe do território não chegam ao site, a capa
 * mostra o nome da série em letra grande, o chapéu e a assinatura do coletivo, como uma revista de banca.
 */
export function CapaDaEdicao({ edicao, perfil, assinatura, grande = false }: { edicao: Edicao; perfil: string; assinatura: string; grande?: boolean }) {
  return (
    <div className={`relative flex aspect-[4/5] max-w-full flex-col overflow-hidden border-2 border-[#1f1a14] p-4 shadow-[6px_6px_0_#1f1a14] ${CORES[edicao.cor]}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08] [background:repeating-linear-gradient(135deg,currentColor_0_1px,transparent_1px_12px)]" />
      <p className="relative flex justify-between gap-2 font-mono text-[0.6rem] uppercase tracking-[0.2em]">
        <span>{edicao.tipo}</span>
        {edicao.ano && <span>{edicao.ano}</span>}
      </p>
      <p className={`relative mt-auto font-serif font-semibold uppercase leading-[0.86] tracking-[-0.02em] text-balance ${grande ? "text-[3.6rem] sm:text-[4.6rem]" : "text-[2.3rem]"}`}>
        {edicao.titulo}
      </p>
      <p className="relative mt-3 border-t border-current pt-2 font-mono text-[0.58rem] uppercase tracking-[0.18em]">
        {assinatura} · @{perfil}
      </p>
    </div>
  );
}

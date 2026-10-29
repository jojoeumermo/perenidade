// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Image from "next/image";
import type { Edicao } from "@/lib/territorios";

const CORES: Record<Edicao["cor"], string> = {
  preto: "bg-[#1f1a14] text-[#f4ecd8]",
  papel: "bg-[#fbf8f1] text-[#1f1a14]",
  vermelho: "bg-[#c21f16] text-[#fbf8f1]",
};

/**
 * Capa de revista de uma edição. Com a capa de verdade do coletivo (a foto já traz a tipografia deles), mostra a foto na
 * moldura com sombra dura; sem ela, uma capa só de tipografia: o nome da série, o chapéu e a assinatura do coletivo.
 */
export function CapaDaEdicao({ edicao, perfil, assinatura, grande = false }: { edicao: Edicao; perfil: string; assinatura: string; grande?: boolean }) {
  if (edicao.imagem) {
    return (
      <figure className="relative max-w-full overflow-hidden border-[1.5px] border-[#1f1a14] bg-[#fbf8f1] shadow-[6px_6px_0_#1f1a14] transition-shadow hover:shadow-[6px_6px_0_#c21f16]">
        <Image src={edicao.imagem} alt={edicao.alt ?? edicao.titulo} width={640} height={800} sizes={grande ? "(min-width: 768px) 30rem, 90vw" : "(min-width: 1024px) 15rem, 45vw"} className="aspect-[4/5] h-auto w-full object-contain" />
        <figcaption className="sr-only">{edicao.titulo} · {edicao.tipo}</figcaption>
      </figure>
    );
  }
  return (
    <div className={`relative flex aspect-[4/5] max-w-full flex-col overflow-hidden border-[1.5px] border-[#1f1a14] p-4 shadow-[6px_6px_0_#1f1a14] ${CORES[edicao.cor]}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08] [background:repeating-linear-gradient(135deg,currentColor_0_1px,transparent_1px_12px)]" />
      <p className="relative flex justify-between gap-2 font-mono text-[0.6rem] uppercase tracking-[0.2em]">
        <span>{edicao.tipo}</span>
        {edicao.ano && <span>{edicao.ano}</span>}
      </p>
      <p className={`territorio-play relative mt-auto font-semibold uppercase leading-[0.86] tracking-[-0.02em] text-balance ${grande ? "text-[3.6rem] sm:text-[4.6rem]" : "text-[2.3rem]"}`}>
        {edicao.titulo}
      </p>
      <p className="relative mt-3 border-t border-current pt-2 font-mono text-[0.58rem] uppercase tracking-[0.18em]">
        {assinatura} · @{perfil}
      </p>
    </div>
  );
}

/** A marca do Na Atividade (o traço vermelho em dois degraus), redesenhada do arquivo do coletivo. */
export function MarcaNaAtividade({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 91 47" role="img" aria-label="Na Atividade" className={className}>
      <path d="M22 0H47L68 24H91L69 47H47L24 24H0Z" fill="#e01b22" />
    </svg>
  );
}

/**
 * O letreiro: os temas do território passando sem parar, como faixa de evento. O texto vai duas vezes seguidas para o
 * giro não ter emenda; a segunda cópia fica escondida do leitor de tela. Para quem pede menos movimento (ou está no
 * modo leve), a faixa fica parada (globals.css, .letreiro).
 */
export function Letreiro({ temas }: { temas: string[] }) {
  const volta = (escondida: boolean) => (
    <p aria-hidden={escondida || undefined} className="flex shrink-0 items-center">
      {Array.from({ length: 3 }, () => temas)
        .flat()
        .map((tema, i) => (
          <span key={i} className="flex items-center">
            <span className="px-5">{tema}</span>
            <span aria-hidden className="text-[#1f1a14]">✦</span>
          </span>
        ))}
    </p>
  );
  return (
    <div className="letreiro overflow-hidden border-y-2 border-[#1f1a14] bg-[#e01b22] py-3 text-white">
      <div className="letreiro-trilho territorio-play flex w-max text-[1.375rem] font-black uppercase tracking-[0.06em] whitespace-nowrap">
        {volta(false)}
        {volta(true)}
      </div>
    </div>
  );
}

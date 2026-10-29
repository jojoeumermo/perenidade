// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { plural, type Forms } from "@/i18n/config";
import type { Dict } from "@/i18n/types";

/** Só a palavra na forma certa de plural ("emissoras"), para o número ir grande em cima dela no carimbo. */
const palavra = (lang: string, n: number, forms: Forms) => plural(lang, n, forms).slice(String(n).length + 1);

/**
 * O alto da rádio como lambe-lambe colado na parede: cartaz preto meio torto, borda de baixo rasgada, duas fitas
 * segurando, a torre de rádio na cunha vermelha e o carimbo com as contas do diretório. Nos modos de contraste e de
 * leitura, vira um quadro simples (veja .lambe-colado no globals.css).
 */
export function FaixaDaRadio({ lang, s, slogan, emissoras, tocamAqui, frentes }: { lang: string; s: Dict["radioPagina"]; slogan: string; emissoras: number; tocamAqui: number; frentes: number }) {
  return (
    <div className="pb-9">
      <p className="flex flex-wrap justify-between gap-x-6 gap-y-1 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-soft">
        <span>{slogan}</span>
        <span>
          {s.directory} · {plural(lang, tocamAqui, s.playHere)}
        </span>
      </p>
      <div className="lambe-colado relative mt-4">
        <div className="lambe-rasgo relative flex min-h-[21.25rem] overflow-hidden bg-[#1f1a14] max-sm:min-h-0">
          <div aria-hidden className="lambe-reticula absolute inset-0" />
          <div className="relative flex min-w-0 flex-1 flex-col justify-between gap-5 px-10 pt-8 pb-11 text-[#f4ecd8] max-sm:px-5 max-sm:pt-6 max-sm:pb-10">
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-[#d4a24c]">{s.posterKicker}</span>
            <h1 className="lambe text-[clamp(2.75rem,9.2vw,7.4rem)] leading-[0.84]">
              {s.posterLines[0]}
              <br />
              {s.posterLines[1]}
            </h1>
            <p className="max-w-[34rem] font-serif text-[1.375rem] italic leading-snug text-[#e9dcbc] max-sm:text-lg">{s.posterSub}</p>
          </div>
          <div aria-hidden className="lambe-cunha relative flex w-[20.6rem] shrink-0 items-center justify-center bg-[#c21f16] max-lg:w-56 max-sm:w-[5.5rem]">
            <svg viewBox="0 0 120 120" fill="none" stroke="#f4ecd8" strokeWidth="5" strokeLinecap="square" className="ml-12 h-[11.9rem] w-[11.9rem] max-lg:ml-8 max-lg:h-32 max-lg:w-32 max-sm:ml-5 max-sm:h-12 max-sm:w-12">
              <path d="M60 52 L40 112 M60 52 L80 112 M47 92 H73" />
              <path d="M60 30 l4.7 9.6 10.6 1.5 -7.7 7.5 1.8 10.5 -9.4 -5 -9.4 5 1.8 -10.5 -7.7 -7.5 10.6 -1.5 z" fill="#f4ecd8" strokeWidth="0" />
              <path d="M34 22 a36 36 0 0 0 0 44 M86 22 a36 36 0 0 1 0 44" />
              <path d="M22 10 a54 54 0 0 0 0 68 M98 10 a54 54 0 0 1 0 68" />
            </svg>
          </div>
        </div>
        <span aria-hidden className="lambe-fita absolute -top-3.5 left-[4.4rem] h-[1.875rem] w-[7.5rem] -rotate-[4deg] max-sm:left-6 max-sm:w-20" />
        <span aria-hidden className="lambe-fita absolute -top-3 right-[5.6rem] h-[1.875rem] w-[6.9rem] rotate-[5deg] max-sm:right-4 max-sm:w-16" />
        {/* As contas também estão nas abas, com o nome de cada frente: o carimbo é enfeite. */}
        <div aria-hidden className="carimbo absolute right-[18.75rem] -bottom-9 h-[7.25rem] w-[7.25rem] -rotate-12 flex-col bg-parchment max-lg:right-48 max-sm:right-14 max-sm:-bottom-7 max-sm:h-[5.25rem] max-sm:w-[5.25rem]">
          <strong className="lambe text-[2.4rem] leading-none max-sm:text-[1.6rem]">{emissoras}</strong>
          <span className="text-[0.625rem] leading-snug tracking-[0.14em] max-sm:text-[0.5rem]">
            {palavra(lang, emissoras, s.stampStations)}
            <br />
            {plural(lang, frentes, s.stampFronts)}
          </span>
        </div>
      </div>
    </div>
  );
}

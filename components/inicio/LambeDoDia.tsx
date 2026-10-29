// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import { type LambeDoDia as Dia, diaDe } from "@/lib/lambe-do-dia";
import { xilogravura } from "@/lib/xilogravuras";

const nunca = () => () => {};

/**
 * O dia de hoje entre os que vieram com a página. A página vem pronta com o cartaz do dia em que foi montada; ao abrir, o
 * navegador confere a data e, se o dia já virou, troca pelo certo (sem erro de hidratação: o servidor e a primeira pintura
 * usam o mesmo).
 */
function useDiaDeHoje<T extends { dia: number }>(dias: T[]): T | undefined {
  const hoje = useSyncExternalStore(nunca, () => diaDe(new Date()), () => dias[0]?.dia ?? 0);
  return dias.find((d) => d.dia === hoje) ?? (hoje > (dias.at(-1)?.dia ?? 0) ? dias.at(-1) : dias[0]);
}

/**
 * O lambe-lambe do dia, o mesmo para todo mundo na mesma data, com a vinheta de xilogravura do tema no canto, do tamanho
 * de um selo, como o enfeite que fecha um folheto de cordel.
 */
export function LambeDoDia({ dias, rotulo }: { dias: Dia[]; rotulo: string }) {
  const escolhido = useDiaDeHoje(dias);
  if (!escolhido) return null;
  const { linhas, texto } = escolhido.lambe;
  return (
    <>
      <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#e0837a]">{rotulo.replace("{n}", String(escolhido.numero))}</p>
      <p className="lambe mt-4 text-[3.6rem] text-[#f4ecd8] xl:text-[3.7rem]">
        {linhas[0]}
        <br />
        {linhas[1]}
        <br />
        <span className="bg-[#f4ecd8] px-2.5 text-[#c21f16]">{linhas[2]}</span>
      </p>
      <p className="mt-6 text-[1.2rem] leading-snug text-[#e9dcbc]">{texto}</p>
      <svg aria-hidden viewBox="0 0 120 40" className="xilogravura mt-4 ml-auto block h-10 w-[7.5rem] text-[#f4ecd8]" fill="currentColor" dangerouslySetInnerHTML={{ __html: xilogravura(escolhido.xilo) }} />
    </>
  );
}

/** O carimbo do dia, colado no canto do lambe-lambe: as palavras seguem o tema do cartaz (a forma não muda). */
export function CarimboDoDia({ dias, reserva }: { dias: { dia: number; carimbo?: [string, string] }[]; reserva: string[] }) {
  const escolhido = useDiaDeHoje(dias);
  const [cima, baixo] = escolhido?.carimbo ?? [reserva.slice(0, 2).join(" "), reserva.slice(2).join(" ")];
  const longo = Math.max(cima.length, baixo.length) > 11;
  return (
    <span className={longo ? "text-[0.56rem]" : undefined}>
      {cima}
      <br />★<br />
      {baixo}
    </span>
  );
}

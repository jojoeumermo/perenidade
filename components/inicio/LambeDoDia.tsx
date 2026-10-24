// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import { type Lambe, diaDe } from "@/lib/lambe-do-dia";

const nunca = () => () => {};

/**
 * O lambe-lambe do dia, o mesmo para todo mundo na mesma data. A página vem pronta com o cartaz do dia em que foi
 * montada; ao abrir, o navegador confere a data e, se o dia já virou, troca pelo cartaz certo (sem erro de hidratação:
 * o servidor e a primeira pintura usam o mesmo).
 */
export function LambeDoDia({ dias, rotulo }: { dias: { dia: number; numero: number; lambe: Lambe }[]; rotulo: string }) {
  const hoje = useSyncExternalStore(nunca, () => diaDe(new Date()), () => dias[0]?.dia ?? 0);
  const escolhido = dias.find((d) => d.dia === hoje) ?? (hoje > (dias.at(-1)?.dia ?? 0) ? dias.at(-1) : dias[0]);
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
    </>
  );
}

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

/** As bandeirinhas do cartaz de festa, de ponta a ponta do alto do papel. */
function Bandeirinhas() {
  const cores = ["#c21f16", "#23408e", "#2e6b4f", "#f4ecd8"];
  return (
    <svg aria-hidden viewBox="0 0 240 18" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-4 w-full">
      <path d="M0 2 Q120 9 240 2" fill="none" stroke="#1f1a14" strokeWidth="1" />
      {Array.from({ length: 12 }, (_, i) => {
        const x = i * 20 + 2;
        const y = 2 + 7 * (1 - ((x + 8 - 120) / 120) ** 2);
        return <path key={i} d={`M${x} ${y - 1} H${x + 16} L${x + 8} ${y + 11} Z`} fill={cores[i % cores.length]} stroke="#1f1a14" strokeWidth="0.6" />;
      })}
    </svg>
  );
}

/** As tirinhas de destacar do classificado de poste: o recado repetido, e uma já levada por alguém. */
function Tirinhas({ texto }: { texto: string }) {
  return (
    <div aria-hidden className="-mx-[1.65rem] -mb-6 mt-1 flex h-[4.6rem] border-t-2 border-dashed border-[#1f1a14]/60">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className={`lambe-tirinha flex flex-1 items-center justify-center border-r border-dashed border-[#1f1a14]/50 font-mono text-[0.5rem] uppercase tracking-[0.08em] last:border-r-0 ${i === 2 ? "opacity-0" : ""}`}>
          {texto}
        </span>
      ))}
    </div>
  );
}

/**
 * O lambe-lambe do dia, o mesmo para todo mundo na mesma data: o papel colado torto, com a fita, a vinheta de xilogravura
 * do tema e o carimbo do território saindo do canto. A cor e o jeito mudam com o tom do texto (veja FORMATOS em
 * lib/lambe-do-dia.ts). Embaixo, como num cartaz de gráfica, a tiragem: os números do acervo.
 */
export function LambeDoDia({ dias, rotulo, tiragem, reserva }: { dias: Dia[]; rotulo: string; tiragem: string; reserva: string[] }) {
  const escolhido = useDiaDeHoje(dias);
  if (!escolhido) return null;
  const { linhas, texto } = escolhido.lambe;
  const [cima, baixo] = escolhido.lambe.carimbo ?? [reserva.slice(0, 2).join(" "), reserva.slice(2).join(" ")];
  const formato = escolhido.formato;
  const xilo = { __html: xilogravura(escolhido.xilo) };
  // A letra do grito cabe na largura do papel: a linha mais comprida decide o tamanho (até 3,4rem nas curtas). Abaixo de
  // 2,1rem o grito perde a força: aí a linha comprida quebra em duas, e a letra fica grande.
  const comprido = Math.max(...linhas.map((linha) => linha.length));
  const tamanho = Math.max(2.1, Math.min(3.4, 21.5 / (0.66 * comprido)));
  return (
    <figure className={`lambe-cartaz lambe-${formato} relative mx-auto w-full max-w-[25rem] rotate-[1.5deg]`}>
      <div className="lambe-papel relative flex flex-col gap-3.5 overflow-hidden border-2 border-[#1f1a14] px-[1.65rem] pt-7 pb-6 shadow-[8px_8px_0_#1f1a14]">
        {formato === "festa" && <Bandeirinhas />}
        {formato === "pergunta" && (
          <span aria-hidden className="lambe-interrogacao pointer-events-none absolute -top-6 -right-3 select-none font-sans text-[15rem] font-black italic leading-none">
            ?
          </span>
        )}
        {formato === "cordel" && <svg aria-hidden viewBox="0 0 120 40" fill="currentColor" className="lambe-xilo -mx-1 mb-1 h-24 w-[calc(100%+0.5rem)]" dangerouslySetInnerHTML={xilo} />}
        <span className="lambe-numero relative font-mono text-[0.66rem] uppercase tracking-[0.2em]">{rotulo.replace("{n}", String(escolhido.numero))}</span>
        <p className="lambe relative leading-[0.88]" style={{ fontSize: `${tamanho.toFixed(2)}rem` }}>
          {linhas[0]}
          <br />
          {linhas[1]}
          <br />
          {linhas[2]}
        </p>
        <p className="lambe-texto relative font-serif text-[1.06rem] leading-snug">{texto}</p>
        {formato !== "cordel" && <svg aria-hidden viewBox="0 0 120 40" fill="currentColor" className="lambe-xilo relative h-10 w-[7.5rem] self-end" dangerouslySetInnerHTML={xilo} />}
        {/* O recuo à direita é o lugar do carimbo, que sai do canto do papel. */}
        <p className="lambe-tiragem relative pr-[4.25rem] font-mono text-[0.58rem] uppercase leading-relaxed tracking-[0.14em]">{tiragem}</p>
        {formato === "classificado" && <Tirinhas texto={`${cima} · ${baixo}`} />}
      </div>
      <span aria-hidden className="lambe-fita absolute -top-2.5 left-[1.9rem] h-5 w-16 -rotate-6" />
      <div aria-hidden className="lambe-selo absolute -right-5 -bottom-6 flex h-[5.75rem] w-[5.75rem] -rotate-[14deg] flex-col items-center justify-center rounded-full border-[2.5px] border-[#6e1f1a] bg-[#f4ecd8] p-1.5 text-center font-mono uppercase leading-[1.3] tracking-[0.12em] text-[#6e1f1a]">
        <span className={Math.max(cima.length, baixo.length) > 11 ? "text-[0.5rem]" : "text-[0.56rem]"}>
          {cima}
          <br />★<br />
          {baixo}
        </span>
      </div>
    </figure>
  );
}

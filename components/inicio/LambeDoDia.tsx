// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import { type Formato, type LambeDoDia as Dia, diaDe } from "@/lib/lambe-do-dia";
import { useI18n } from "@/components/I18n";

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
 * O papel de cada dia, pelo tom do texto: o grito no vermelho, a pergunta no anil, a terra na mata, a festa no ipê e a
 * memória na tinta. Cordel e classificado entram nas mesmas cinco cores (mata e vermelho).
 */
const PAPEL: Record<Formato, "vermelho" | "anil" | "mata" | "ipe" | "tinta"> = {
  grito: "vermelho",
  pergunta: "anil",
  memoria: "tinta",
  festa: "ipe",
  terra: "mata",
  cordel: "mata",
  classificado: "vermelho",
};

/**
 * O lambe-lambe do dia, o mesmo para todo mundo na mesma data, no desenho do cartaz de gráfica popular: reto, sem fita,
 * sem carimbo e sem inclinação, a letra de madeira condensada (Anton) e duas cores por cartaz. O papel muda com o tom do
 * texto. No pé, como em cartaz de poste, o endereço e a tiragem (os números do acervo).
 */
export function LambeDoDia({ dias, rotulo, tiragem, reserva }: { dias: Dia[]; rotulo: string; tiragem: string; reserva: string[] }) {
  const { lang } = useI18n();
  const escolhido = useDiaDeHoje(dias);
  if (!escolhido) return null;
  const { linhas, texto } = escolhido.lambe;
  const tema = escolhido.lambe.carimbo?.[0] ?? reserva[0];
  // A data do cartaz: o número do dia já é o de Brasília, então basta lê-lo como data em UTC.
  const data = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(escolhido.dia * 86_400_000));
  // A letra do grito cabe na largura do papel: a linha mais comprida decide o tamanho (a Anton tem cerca de 0,47 em por
  // letra). Medido pela largura do próprio cartaz (cqw), vale igual no computador e no celular.
  const comprido = Math.max(...linhas.map((linha) => linha.length), 4);
  const largura = Math.min(19, 86 / (0.47 * comprido));
  return (
    <figure className={`lambe-cartaz lambe-${PAPEL[escolhido.formato]} relative mx-auto w-full max-w-[25rem]`}>
      <div className="lambe-papel flex flex-col gap-4 px-[1.75rem] pt-7 pb-5">
        <p className="lambe-numero flex items-baseline justify-between gap-3 font-mono text-[0.68rem] uppercase tracking-[0.16em]">
          <span>{rotulo.replace("{n}", String(escolhido.numero))}</span>
          {tema && <span className="lambe-sep"> · </span>}
          {tema && <span className="lambe-tema text-right">{tema}</span>}
        </p>
        <p className="lambe" style={{ fontSize: `min(${(largura * 0.24).toFixed(2)}rem, ${largura.toFixed(2)}cqw)` }}>
          {linhas[0]}
          <br />
          {linhas[1]}
          <br />
          <span className="lambe-destaque">{linhas[2]}</span>
        </p>
        <p className="lambe-texto font-serif text-[1.15rem] leading-snug">{texto}</p>
        <p className="lambe-tiragem mt-auto font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.12em]">
          <span className="flex flex-wrap justify-between gap-x-4">
            <span>institutolucia.org</span>
            <span className="lambe-sep"> · </span>
            <span suppressHydrationWarning>{data}</span>
          </span>
          <span className="mt-1 block">{tiragem}</span>
        </p>
      </div>
    </figure>
  );
}

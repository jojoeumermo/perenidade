// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { enderecoDoAudio, type Episodio, minutos, relogio } from "@/lib/podcast";
import { positions, usePlayer } from "@/lib/radio";
import { Ouvir } from "./Ouvir";

/** Barras de onda para o desenho: tiradas do próprio episódio (sempre as mesmas para ele), só decoração. */
function ondas(semente: string, quantas = 36): number[] {
  let x = [...semente].reduce((soma, c) => (soma * 31 + c.charCodeAt(0)) % 2147483647, 7) || 7;
  return Array.from({ length: quantas }, () => {
    x = (x * 48271) % 2147483647;
    return 28 + (x % 72);
  });
}

export const megas = (bytes: number) => (bytes > 0 ? Math.max(1, Math.round(bytes / 1_048_576)) : 0);

/**
 * O episódio em destaque no alto da página dos podcasts: a capa tipográfica vermelha, torta, como um cartaz colado,
 * o play grande com as ondas (que vão ficando claras conforme toca) e o botão de baixar para ouvir sem internet.
 */
export function Destaque({ e, fila, programa, s, lang, data }: { e: Episodio; fila: Episodio[]; programa: string; s: Dict["podcast"]; lang: Locale; data: string }) {
  const { queue, index } = usePlayer();
  const atual = queue[index]?.id === `podcast:${e.id}`;
  const lido = atual ? positions.get(`podcast:${e.id}`) : 0;
  const parte = e.duracao > 0 ? Math.min(1, lido / e.duracao) : 0;
  const barras = ondas(e.id);
  const mb = megas(e.audio_bytes);
  const audio = enderecoDoAudio(e);
  return (
    <section aria-labelledby="destaque" className="border-b-4 border-[#c21f16] bg-[#1f1a14] text-[#f4ecd8]">
      <div className="mx-auto grid max-w-[78rem] items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[18rem_minmax(0,1fr)] lg:gap-12 lg:px-8 lg:py-14">
        <Link
          href={localePath(lang, `/podcasts/${e.slug}`)}
          tabIndex={-1}
          aria-hidden
          className="relative mx-auto flex aspect-square w-full max-w-[13rem] md:max-w-[18rem] -rotate-2 flex-col justify-between border-[3px] border-[#f4ecd8] bg-[#c21f16] p-6 text-white shadow-[8px_8px_0_#f4ecd8] hover:text-white"
        >
          <span className="font-mono text-xs font-semibold tracking-[0.2em]">{e.numero != null ? `EP. ${e.numero}` : s.newEpisode.toUpperCase()}</span>
          <span className="line-clamp-5 font-sans text-[2.15rem] font-black uppercase italic leading-[0.92]" lang="pt-BR">
            {e.titulo}
          </span>
          <span className="truncate font-mono text-[0.68rem] tracking-[0.16em] uppercase">{[programa, e.serie?.titulo].filter(Boolean).join(" · ")}</span>
        </Link>
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[#e0837a]">● {s.newEpisode}</p>
          <h1 className="mt-2.5 font-serif text-[2.3rem] font-medium leading-[1.04] sm:text-[3.3rem]">{s.heroTitle}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-snug text-[#e9dcbc]" lang="pt-BR">
            <Link href={localePath(lang, `/podcasts/${e.slug}`)} className="font-semibold text-[#f4ecd8] underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-white">
              {e.titulo}
            </Link>
            {e.resumo ? ` — ${e.resumo}` : ""}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-5">
            <Ouvir episodio={e} fila={fila} programa={programa} rotulo={s.listen} pausar={s.pause} grande className="h-[4.5rem]! w-[4.5rem]! border-[3px] border-[#f4ecd8] bg-[#c21f16]! shadow-[4px_4px_0_#f4ecd8]!" />
            <div className="min-w-[14rem] flex-1">
              <div aria-hidden className="flex h-11 items-end gap-[3px]">
                {barras.map((h, i) => (
                  <span key={i} className="flex-1" style={{ height: `${h}%`, background: i / barras.length < parte ? "#e0837a" : "#5a4e3c" }} />
                ))}
              </div>
              <p className="mt-2 font-mono text-xs tracking-[0.08em] text-[#b3a584]">
                {relogio(lido)} / {relogio(e.duracao)} · {data}
                {mb > 0 && ` · ${s.size.replace("{n}", String(mb))}`}
              </p>
            </div>
            {audio && (
              <a href={audio} download className="border-2 border-[#f4ecd8] px-4 py-3 font-sans text-sm font-bold text-[#f4ecd8] hover:bg-[#f4ecd8] hover:text-[#1f1a14]">
                ↓ {s.download}
              </a>
            )}
          </div>
          <p className="mt-4 font-sans text-sm">
            <Link href={localePath(lang, `/podcasts/${e.slug}`)} className="font-semibold text-[#f4ecd8] underline underline-offset-4 hover:text-white">
              {s.openEpisode} ({minutos(e.duracao)}, {s.withTranscript}) →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

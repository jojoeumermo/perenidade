// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import type { Catalogo, Episodio } from "@/lib/podcast";
import { useCompleted, useLastLesson } from "@/lib/progress";
import { useHydrated } from "@/lib/storage";
import { L } from "../I18n";

/**
 * A primeira janela da inicial: a última aula aberta neste aparelho, com o botão de retomar. Quem ainda não abriu
 * nenhuma vê o convite para o guia de começo. Nada sai do aparelho: o progresso fica no navegador.
 */
export function JanelaContinue({ textos }: { textos: { continuar: string; retomar: string; comecar: string; comecarTexto: string } }) {
  const hydrated = useHydrated();
  const ultima = useLastLesson();
  const feitas = useCompleted();
  const tem = hydrated && ultima?.path;
  return (
    <article className="cartao-v flex flex-col p-6">
      <p className="rotulo">{tem ? textos.continuar : textos.comecar}</p>
      {tem ? (
        <>
          <h2 className="mt-3 text-[1.7rem] font-semibold leading-tight">{ultima.track}</h2>
          <p className="mt-1 text-lg text-ink-soft">{ultima.title}</p>
          {feitas.size > 0 && (
            <p className="mt-4 flex flex-wrap gap-1" aria-hidden>
              {Array.from({ length: Math.min(feitas.size, 24) }, (_, i) => (
                <span key={i} className="h-3 w-3 border-[1.5px] border-ink bg-[#c21f16]" />
              ))}
            </p>
          )}
          <L href={ultima.path} className="botao botao-tinta mt-auto self-start">
            {textos.retomar} →
          </L>
        </>
      ) : (
        <>
          <p className="mt-3 text-xl leading-snug">{textos.comecarTexto}</p>
          <L href="/comecar" className="botao botao-tinta mt-6 self-start">
            {textos.comecar} →
          </L>
        </>
      )}
    </article>
  );
}

const minutos = (segundos: number) => Math.max(1, Math.round(segundos / 60));

/**
 * A janela preta do "no ar": os dois episódios mais novos do podcast, lidos do serviço depois que a página abre
 * (a inicial é estática e não espera o banco). Sem serviço ou sem episódio, fica o convite para a rádio.
 */
export function JanelaNoAr({ textos }: { textos: { noAr: string; ouvir: string; todos: string; radio: string; radioTexto: string } }) {
  const [episodios, setEpisodios] = useState<Episodio[]>([]);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<Catalogo>("podcast_catalogo")
      .then((c) => {
        if (vivo && Array.isArray(c?.episodios)) setEpisodios(c.episodios.slice(0, 2));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  const [novo, anterior] = episodios;
  return (
    <article className="cartao-preto flex flex-col p-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#e0837a]">● {textos.noAr}</p>
      {novo ? (
        <>
          <p className="mt-3 text-2xl leading-tight">{novo.numero ? `Ep. ${novo.numero} · ` : ""}{novo.titulo}</p>
          <div className="mt-4 flex items-center gap-3.5">
            <L href={`/podcasts/${novo.slug}`} aria-label={`${textos.ouvir}: ${novo.titulo}`} className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border-2 border-[#f4ecd8] bg-[#c21f16] hover:bg-[#a51810]">
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
            </L>
            <span aria-hidden className="flex h-9 flex-1 items-end gap-[3px]">
              {[40, 70, 55, 90, 60, 30, 75, 50, 85, 45, 65, 35].map((h, i) => (
                <span key={i} className={`flex-1 ${i < 5 ? "bg-[#e0837a]" : "bg-[#5a4e3c]"}`} style={{ height: `${h}%` }} />
              ))}
            </span>
          </div>
          <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-[#b3a584]">{minutos(novo.duracao)} min</p>
          {anterior && (
            <L href={`/podcasts/${anterior.slug}`} className="mt-4 block border-t border-[#5a4e3c] pt-3 text-lg text-[#f4ecd8] hover:text-white hover:underline">
              {anterior.numero ? `Ep. ${anterior.numero} · ` : ""}{anterior.titulo}
            </L>
          )}
          <L href="/podcasts" className="mt-auto pt-4 font-sans font-bold text-[#f4ecd8] underline-offset-4 hover:text-white hover:underline">
            {textos.todos} →
          </L>
        </>
      ) : (
        <>
          <p className="mt-3 text-2xl leading-tight">{textos.radio}</p>
          <p className="mt-2 text-lg leading-snug text-[#e9dcbc]">{textos.radioTexto}</p>
          <div className="mt-auto flex flex-wrap items-center gap-4 pt-5">
            <L href="/radio" className="flex h-13 w-13 items-center justify-center rounded-full border-2 border-[#f4ecd8] bg-[#c21f16] hover:bg-[#a51810]" aria-label={`${textos.ouvir}: ${textos.radio}`}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
            </L>
            <L href="/podcasts" className="font-sans font-bold text-[#f4ecd8] underline-offset-4 hover:text-white hover:underline">
              {textos.todos} →
            </L>
          </div>
        </>
      )}
    </article>
  );
}

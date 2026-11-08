// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Podcast ao vivo (T17) na página /podcasts: só a parte de quem ouve e assiste, o aviso "no ar agora" com o vídeo para
// todo mundo. O estúdio (começar, transmitir e encerrar) é ferramenta da equipe e fica no painel, na aba Podcast → Ao vivo
// (components/painel/podcast/AoVivo.tsx). Regras: lib/podcast-ao-vivo.ts; banco:
// supabase/migracoes/20261106-t17-podcast-ao-vivo.sql; limites e escolhas: docs/PODCAST-AO-VIVO.md.
//
// Leve de propósito: aqui só a consulta do estado (uma chamada pequena, a cada 30 s com a aba visível). O WebRTC
// (components/podcast/AoVivoSala.tsx) só carrega quando a pessoa clica em assistir; o tocador do
// PeerTube ou do YouTube, só depois do clique. Nada é gravado e nada de quem assiste é guardado.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { PEERTUBE_DOMINIOS } from "@/lib/aula-sala";
import { hasBackend, rpc } from "@/lib/backend";
import { enderecoAberto, type EstadoAoVivo } from "@/lib/podcast-ao-vivo";
import { TocadorPeerTube } from "../aovivo/TocadorPeerTube";

/** Os textos do ao vivo (t.podcast.aoVivo): chegam da página, como os de toda seção que não é do núcleo (i18n/core.ts). */
export type TextosAoVivo = Dict["podcast"]["aoVivo"];
import { TocadorYoutube } from "../TocadorYoutube";

const Assistir = dynamic(() => import("./AoVivoSala").then((m) => m.Assistir), { ssr: false });

/** A transmissão aberta (PeerTube da lista ou YouTube, só depois do clique) ou, de outro endereço, só o link. */
export function Aberta({ endereco, titulo, s }: { endereco: string; titulo: string; s: TextosAoVivo }) {
  const e = enderecoAberto(endereco, PEERTUBE_DOMINIOS);
  if (!e) return null;
  if (e.tipo === "peertube") return <TocadorPeerTube url={e.url} titulo={titulo} aoVivo />;
  if (e.tipo === "youtube") return <TocadorYoutube id={e.id} titulo={titulo} aoVivo textos={{ assistir: s.assistirAberta, aviso: s.avisoYoutube }} />;
  return (
    <p className="font-sans text-sm">
      <a href={e.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="underline hover:text-[#d4a24c]">
        {s.abrirFora} ↗
      </a>
    </p>
  );
}

/**
 * O estado do ao vivo, lido do banco ao abrir e a cada 30 s com a aba visível (e de novo quando a aba volta). Usado pela
 * página pública e pelo estúdio do painel. `null` enquanto não chegou (ou sem banco configurado).
 */
export function useEstadoAoVivo() {
  const [estado, setEstado] = useState<EstadoAoVivo | null>(null);
  const ler = useCallback(async () => {
    if (!hasBackend) return;
    try {
      setEstado(await rpc<EstadoAoVivo>("podcast_ao_vivo_estado"));
    } catch {
      // sem conexão: a próxima rodada tenta de novo
    }
  }, []);

  useEffect(() => {
    const primeira = window.setTimeout(() => void ler(), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden) void ler();
    }, 30_000);
    const voltar = () => {
      if (!document.hidden) void ler();
    };
    document.addEventListener("visibilitychange", voltar);
    return () => {
      window.clearTimeout(primeira);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", voltar);
    };
  }, [ler]);
  return { estado, ler };
}

/**
 * O bloco do ao vivo na página pública: só aparece quando há uma transmissão no ar (fora do ar, nem ocupa espaço; sem
 * banco configurado, também não). Aqui só se assiste: começar e encerrar ficam no painel.
 */
export function PodcastAoVivo({ s, className = "mt-12" }: { s: TextosAoVivo; className?: string }) {
  const { estado } = useEstadoAoVivo();
  const [assistindo, setAssistindo] = useState(false);

  if (!estado?.no_ar) return null;
  const titulo = estado.titulo || s.titulo;
  const reserva = estado.endereco ? (
    <div className="space-y-2">
      <p className="font-sans text-sm font-semibold">{s.lotadoLink}</p>
      <Aberta endereco={estado.endereco} titulo={titulo} s={s} />
    </div>
  ) : null;

  return (
    <section aria-labelledby="podcast-ao-vivo" className={`${className} border-4 border-ink bg-[#1f1a14] p-5 text-[#f4ecd8] shadow-[6px_6px_0_#c21f16] sm:p-8`} data-podcast-ao-vivo="no-ar">
      <div className="space-y-4">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-[#d4a24c]">
          <span aria-hidden className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#c21f16]" /> {s.noAr}
        </p>
        <h2 id="podcast-ao-vivo" className="font-sans text-3xl font-black uppercase italic leading-none">{titulo}</h2>
        <p className="max-w-3xl font-sans text-xs text-[#d9ccac]">{s.aviso}</p>
        {estado.minha && <p className="font-sans text-sm">{s.noPainel}</p>}
        {estado.modo === "navegador" && estado.sala ? (
          assistindo ? (
            <Assistir s={s} sala={estado.sala} chaves={estado.chaves ?? []} reserva={reserva} aoSair={() => setAssistindo(false)} />
          ) : (
            <button type="button" onClick={() => setAssistindo(true)} className="min-h-11 cursor-pointer bg-[#c21f16] px-6 py-3 font-sans font-bold text-white hover:bg-[#a51810]">
              ▶ {s.assistir}
            </button>
          )
        ) : estado.endereco ? (
          <Aberta endereco={estado.endereco} titulo={titulo} s={s} />
        ) : null}
      </div>
    </section>
  );
}

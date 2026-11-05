// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { embedPeerTube, PEERTUBE_DOMINIOS, videoPeerTube } from "@/lib/aula-sala";

/**
 * Plano B da aula ao vivo e gravação depois: um vídeo (ou transmissão) num PeerTube da lista NEXT_PUBLIC_VIDEO_HOSTS.
 * Nada do PeerTube carrega até a pessoa clicar, e o tocador entra sem P2P (p2p=0), para o endereço de rede de quem assiste
 * não aparecer para as outras pessoas. Fora da lista de domínios, não embute nada (quem chama mostra só o link).
 */
export function TocadorPeerTube({ url, titulo, aoVivo = false }: { url: string; titulo: string; aoVivo?: boolean }) {
  const [carregado, setCarregado] = useState(false);
  const video = videoPeerTube(url, PEERTUBE_DOMINIOS);
  if (!video) return null;
  return (
    <div className="no-print">
      <div className="relative aspect-video max-w-full overflow-hidden border-2 border-ink bg-[#17130e]">
        {carregado ? (
          <iframe
            src={embedPeerTube(video)}
            title={titulo}
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button type="button" onClick={() => setCarregado(true)} className="group absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-4 p-6 text-center text-[#f4ecd8]">
            <span aria-hidden className={`flex h-16 w-16 items-center justify-center rounded-full ${aoVivo ? "bg-[#c21f16]" : "bg-[#f4ecd8] text-[#17130e]"} transition-transform group-hover:scale-110`}>
              <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <span className="font-sans text-lg font-bold">{aoVivo ? "Assistir à transmissão" : "Assistir à gravação"}</span>
            <span className="max-w-md font-sans text-xs text-[#b3a584]">Só ao clicar o vídeo é pedido ao servidor {video.host} (PeerTube, código aberto). Sem P2P e sem rastreamento do instituto.</span>
          </button>
        )}
      </div>
    </div>
  );
}

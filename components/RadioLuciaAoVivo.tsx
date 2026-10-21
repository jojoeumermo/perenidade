// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { radio } from "@/lib/radio";
import { lerYoutube, playerDoYoutube } from "@/lib/youtube";
import { Star } from "./Masthead";

interface Estado {
  no_ar: boolean;
  ao_vivo?: string;
}

/**
 * A Rádio Lúcia ao vivo, no alto da página da rádio. A transmissão pode ser um endereço de áudio (toca no tocador do
 * site) ou uma transmissão do YouTube (vídeo ou canal): o player do YouTube só carrega depois do clique, pelo domínio
 * sem cookies, e o aviso diz que ali os dados vão para o YouTube.
 */
export function RadioLuciaAoVivo() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [abrir, setAbrir] = useState(false);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<Estado>("radio_estado").then((e) => vivo && setEstado(e)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  if (!estado?.no_ar || !estado.ao_vivo) return null;
  const yt = lerYoutube(estado.ao_vivo);
  return (
    <section aria-label="Rádio Lúcia ao vivo" className="mt-8 border-4 border-ink bg-[#17130e] p-4 text-[#f4ecd8]">
      <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-[#d4a24c]">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#c21f16]" aria-hidden /> No ar agora
      </p>
      <h2 className="mt-1 flex items-center gap-2 font-sans text-3xl font-black uppercase italic"><Star className="h-6 w-6 text-[#d4a24c]" /> Rádio Lúcia</h2>
      {yt ? (
        abrir ? (
          <div className="mt-4 aspect-video w-full">
            <iframe src={playerDoYoutube(yt)} title="Rádio Lúcia ao vivo, no YouTube" className="h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
          </div>
        ) : (
          <div className="mt-4">
            <button type="button" onClick={() => setAbrir(true)} className="cursor-pointer bg-[#c21f16] px-6 py-3 font-sans font-bold text-white hover:bg-[#a51810]">▶ Ouvir e assistir ao vivo</button>
            <p className="mt-2 font-sans text-xs opacity-80">A transmissão é pelo YouTube: ao tocar no botão, o seu navegador carrega o player do YouTube (pelo endereço sem cookies de publicidade), que recebe o seu endereço de rede, como em qualquer site.</p>
          </div>
        )
      ) : (
        <button type="button" onClick={() => radio.play([{ id: "radio-lucia-ao-vivo", titulo: "Rádio Lúcia", artista: "ao vivo", url: estado.ao_vivo!, live: true }], 0)} className="mt-4 cursor-pointer bg-[#c21f16] px-6 py-3 font-sans font-bold text-white hover:bg-[#a51810]">▶ Ouvir ao vivo</button>
      )}
    </section>
  );
}

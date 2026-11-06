"use client";
// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { useState } from "react";

interface Textos {
  carregar: string;
  aviso: string;
  abrir: string;
  quadro: string;
  video: string;
}

/**
 * O vídeo do anúncio do coletivo.
 *  - Se o arquivo local existe (public/territorios/<slug>/anuncio.mp4), toca um <video> do próprio site, sem nada de fora
 *    (preload="none": só baixa quando a pessoa aperta o play; o quadro parado, `capa`, também é do próprio site).
 *  - Se não, mostra um cartão com o aviso e o botão "Carregar o vídeo do Instagram"; só depois do clique o quadro oficial
 *    de incorporação do Instagram é criado. Antes do clique, nada é pedido a servidores de terceiros.
 * O vídeo vertical (o reel do Instagram, 9:16) fica em pé, com largura de celular, em vez de espremido numa faixa 16:9.
 */
export function PlayerDoAnuncio({
  post,
  local,
  textos,
  titulo,
  tom,
  capa,
  vertical,
  acento,
}: {
  post: string;
  local: string | null;
  textos: Textos;
  titulo: string;
  tom: "claro" | "escuro";
  capa?: string;
  vertical?: boolean;
  /** A cor do botão de carregar (fundo e letra), na identidade do coletivo. */
  acento?: { fundo: string; texto: string };
}) {
  const [aberto, setAberto] = useState(false);
  const link = `https://www.instagram.com/p/${post}/`;
  const cor = acento ?? (tom === "escuro" ? { fundo: "#ff2e88", texto: "#0b0b10" } : { fundo: "#1f1a14", texto: "#f4ecd8" });
  return (
    <div className="w-full">
      {local ? (
        <video
          controls
          playsInline
          preload="none"
          poster={capa}
          className={vertical ? "mx-auto block aspect-[9/16] max-h-[78vh] w-full max-w-[24rem] bg-black object-contain" : "aspect-video w-full bg-black"}
          aria-label={textos.video}
        >
          <source src={local} type="video/mp4" />
        </video>
      ) : aberto ? (
        <iframe
          src={`${link}embed/`}
          title={textos.quadro}
          loading="lazy"
          allow="encrypted-media"
          referrerPolicy="no-referrer"
          className="mx-auto block h-[36rem] w-full max-w-[26rem] border-0 bg-white sm:h-[40rem]"
        />
      ) : (
        <div className={`mx-auto flex max-w-[34rem] flex-col items-start gap-4 border-2 p-6 ${tom === "escuro" ? "border-current bg-black/40" : "border-current bg-white/70"}`}>
          <p className="text-base leading-relaxed">{textos.aviso}</p>
          <button type="button" onClick={() => setAberto(true)} className="inline-flex min-h-11 items-center gap-2 border-2 px-5 py-3 font-sans font-extrabold" style={{ backgroundColor: cor.fundo, borderColor: cor.fundo, color: cor.texto }}>
            <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 fill-current">
              <path d="M2 1l9 5-9 5z" />
            </svg>
            {textos.carregar}
          </button>
        </div>
      )}
      <p className={`mt-3 font-sans text-sm ${vertical ? "text-center" : ""}`}>
        <a href={link} rel="noopener noreferrer" target="_blank" className="underline underline-offset-2">
          {textos.abrir}
        </a>
        <span className="sr-only"> ({titulo})</span>
      </p>
    </div>
  );
}

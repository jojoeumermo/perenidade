// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { radio, usePlayer } from "@/lib/radio";

/**
 * O botão de ouvir de uma emissora no aplicativo (/app/eu/radio). Usa o MESMO tocador do site (lib/radio, montado em
 * app/[lang]/layout.tsx): o som sai direto da emissora e segue tocando ao navegar pelo app. Mesmo id e mesma fila de
 * components/RadioPage.tsx (emissora-<id>), então tocar no site e no app é a mesma coisa.
 *
 * "Tocando" no estado do tocador é a intenção (o play foi pedido), não prova de som. Aqui, depois do toque, o botão só fica
 * como tocando enquanto o elemento <audio> não falhar: se vier um erro de transmissão (ou o play for recusado antes de o som
 * começar), o tocador é pausado e a emissora mostra o aviso `falhou`. O som de verdade só se prova num aparelho real.
 * A escuta é do app (captura de "error" e "playing" dos <audio> no documento); o tocador do site não foi mexido.
 */
export function TocarEmissora({ id, nome, lugar, url, ouvir, pausar, falhou }: { id: string; nome: string; lugar: string; url: string; ouvir: string; pausar: string; falhou: string }) {
  const { queue, index, playing } = usePlayer();
  const idDaFila = `emissora-${id}`;
  const eAtual = queue[index]?.id === idDaFila;
  const tocando = eAtual && playing;
  const [deuErro, setDeuErro] = useState(false);
  /** O play foi pedido por este botão e o som ainda não começou. */
  const aguardando = useRef(false);
  const eAtualRef = useRef(eAtual);
  useEffect(() => {
    eAtualRef.current = eAtual;
  }, [eAtual]);

  useEffect(() => {
    const aoErro = (evento: Event) => {
      if (!(evento.target instanceof HTMLAudioElement) || !eAtualRef.current || !aguardando.current) return;
      aguardando.current = false;
      radio.pause();
      setDeuErro(true);
    };
    const aoTocar = (evento: Event) => {
      if (evento.target instanceof HTMLAudioElement && eAtualRef.current) aguardando.current = false;
    };
    document.addEventListener("error", aoErro, true);
    document.addEventListener("playing", aoTocar, true);
    return () => {
      document.removeEventListener("error", aoErro, true);
      document.removeEventListener("playing", aoTocar, true);
    };
  }, []);

  // O play foi recusado antes de o som começar (o tocador pausa sozinho): conta como falha.
  useEffect(() => {
    if (eAtual && !playing && aguardando.current) {
      aguardando.current = false;
      setDeuErro(true);
    }
  }, [eAtual, playing]);

  const tocar = () => {
    const refazer = deuErro;
    setDeuErro(false);
    // Depois de uma falha, tentar de novo recarrega a transmissão (o <audio> com erro não se recupera só com "play").
    if (eAtual && !refazer) {
      aguardando.current = !playing;
      radio.toggle();
    } else {
      aguardando.current = true;
      radio.play([{ id: idDaFila, titulo: nome, artista: lugar, url, live: true }], 0);
    }
  };
  return (
    <>
      <button type="button" onClick={tocar} aria-pressed={tocando} aria-label={`${tocando ? pausar : ouvir}: ${nome}`} className="app-radio-tocar" data-tocar-emissora={id}>
        <svg viewBox="0 0 20 20" aria-hidden width="18" height="18">
          {tocando ? (
            <>
              <rect x="4" y="3" width="4" height="14" fill="currentColor" />
              <rect x="12" y="3" width="4" height="14" fill="currentColor" />
            </>
          ) : (
            <path d="M5 3 L17 10 L5 17 Z" fill="currentColor" />
          )}
        </svg>
      </button>
      {deuErro && (
        <p role="status" className="app-radio-erro" data-radio-falhou={id}>
          {falhou}
        </p>
      )}
    </>
  );
}

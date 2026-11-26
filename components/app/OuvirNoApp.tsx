// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { Ouvir } from "@/components/podcast/Ouvir";
import type { Episodio } from "@/lib/podcast";
import { radio, usePlayer } from "@/lib/radio";

/**
 * O botão de ouvir do site (components/podcast/Ouvir, mesmo tocador fixo, não alterado) com o aviso de falha do aplicativo.
 * Se o <audio> der erro depois do toque (ou o play for recusado antes de o som começar), o tocador é pausado e a linha do
 * episódio mostra `falhou`. A escuta é do app, igual à de TocarEmissora. "Tocando" é a intenção: o som de verdade só se
 * prova num aparelho real.
 */
export function OuvirNoApp({ episodio, fila, programa, rotulo, pausar, falhou }: { episodio: Episodio; fila: Episodio[]; programa: string; rotulo: string; pausar: string; falhou: string }) {
  const { queue, index, playing } = usePlayer();
  const eAtual = queue[index]?.id === `podcast:${episodio.id}`;
  const [deuErro, setDeuErro] = useState(false);
  const aguardando = useRef(false);
  const eAtualRef = useRef(eAtual);
  const tocandoRef = useRef(playing);
  useEffect(() => {
    eAtualRef.current = eAtual;
    tocandoRef.current = playing;
  }, [eAtual, playing]);

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

  useEffect(() => {
    if (eAtual && !playing && aguardando.current) {
      aguardando.current = false;
      setDeuErro(true);
    }
  }, [eAtual, playing]);

  // Outro episódio assumiu o tocador: o aviso deste some.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o aviso é deste episódio enquanto ele for o atual
    if (!eAtual) setDeuErro(false);
  }, [eAtual]);

  // O clique no botão (captura, antes do Ouvir): vai começar a tocar se este episódio não é o atual ou está pausado.
  const aoClicar = () => {
    setDeuErro(false);
    aguardando.current = !eAtualRef.current || !tocandoRef.current;
  };
  return (
    <>
      <span className="contents" onClickCapture={aoClicar}>
        <Ouvir episodio={episodio} fila={fila} programa={programa} rotulo={rotulo} pausar={pausar} />
      </span>
      {deuErro && (
        <p role="status" className="app-radio-erro" data-podcast-falhou={episodio.id}>
          {falhou}
        </p>
      )}
    </>
  );
}

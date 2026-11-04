// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { speechSupported, startReading, stopReading, useSpeaking } from "@/lib/speech";
import { IconeAltoFalante } from "./OuvirParagrafo";

const nada = () => () => {};

/**
 * Ouvir uma instrução (alfabetização com áudio primeiro, Etapa 3): lê um texto que não está solto na página (a pergunta
 * de um teste e as respostas, que ficam em botões e o leitor pula) com o mesmo leitor do "Ouvir a aula" (a voz do
 * aparelho ou a natural escolhida, lib/vozes/leitor.ts). O texto vai para um elemento escondido só enquanto dura a
 * leitura; nada sai do aparelho. Sem voz no aparelho, o botão nem aparece.
 */
export function OuvirTexto({ texto, rotulo, parar, className = "" }: { texto: string; rotulo: string; parar: string; className?: string }) {
  const pode = useSyncExternalStore(nada, speechSupported, () => false);
  const falando = useSpeaking();
  const [lendo, setLendo] = useState(false);
  const id = `ouvir-texto-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a leitura acabou (ou outra começou): o botão volta a "Ouvir"
    if (!falando) setLendo(false);
  }, [falando]);

  // O elemento de leitura sai quando a leitura acaba ou quando o botão some da tela.
  useEffect(() => {
    if (lendo) return;
    document.getElementById(id)?.remove();
  }, [lendo, id]);
  useEffect(
    () => () => {
      document.getElementById(id)?.remove();
    },
    [id],
  );

  if (!pode || !texto.trim()) return null;

  function alternar() {
    if (lendo) {
      stopReading();
      setLendo(false);
      return;
    }
    document.getElementById(id)?.remove();
    const el = document.createElement("div");
    el.id = id;
    el.className = "ouvir-texto-oculto";
    el.setAttribute("inert", "");
    el.textContent = texto;
    document.body.appendChild(el);
    window.getSelection()?.removeAllRanges();
    startReading([`#${id}`]);
    setLendo(true);
  }

  return (
    <button type="button" className={`ouvir-paragrafo-botao no-print ${className}`} aria-pressed={lendo} aria-label={lendo ? parar : rotulo} onClick={alternar} data-ouvir-texto="">
      <IconeAltoFalante falando={lendo} />
      <span>{lendo ? parar : rotulo}</span>
    </button>
  );
}

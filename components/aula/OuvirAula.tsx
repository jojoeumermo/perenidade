// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import { speechSupported, startReading, stopReading, useSpeaking } from "@/lib/speech";
import { useI18n } from "../I18n";
import { TRECHOS_DA_AULA } from "./BarraDaAula";

const nada = () => () => {};

/**
 * "Ouvir a aula" em destaque, logo abaixo do título: para quem lê pouco ou não lê, a leitura em voz alta não pode ficar
 * escondida na faixa de cima. Usa a voz do próprio aparelho (não baixa áudio). Some onde o navegador não sabe falar.
 */
export function OuvirAula({ minutos }: { minutos: string }) {
  const { t } = useI18n();
  const l = t.lesson;
  const falando = useSpeaking();
  const pode = useSyncExternalStore(nada, speechSupported, () => false);
  if (!pode) return null;
  return (
    <button
      type="button"
      aria-pressed={falando}
      onClick={() => (falando ? stopReading() : startReading(TRECHOS_DA_AULA))}
      className="no-print mt-5 inline-flex min-h-12 cursor-pointer items-center gap-3 border-2 border-ink bg-ink px-5 py-2 text-left font-sans text-parchment hover:bg-oxblood"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {falando ? (
          <rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" />
        ) : (
          <>
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
            <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
          </>
        )}
      </svg>
      <span>
        <span className="block font-semibold">{falando ? l.stopListening : `${l.listenLesson} · ${minutos}`}</span>
        {!falando && <span className="block text-xs text-[#d8cdb4]">{l.listenLessonHint}</span>}
      </span>
    </button>
  );
}

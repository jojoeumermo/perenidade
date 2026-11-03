// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { speechSupported, startReading, stopReading, useSpeaking } from "@/lib/speech";
import { usePathname } from "next/navigation";
import { aquecer, definirLexico, encerrarLeitura, useLeitor } from "@/lib/vozes/leitor";
import type { Lexico } from "@/lib/vozes/normalizar";
import { lerEscolha, VOZ_DO_APARELHO } from "@/lib/vozes/catalogo";
import { fill } from "@/i18n/config";
import { useI18n } from "../I18n";
import { TRECHOS_DA_AULA } from "./BarraDaAula";
import { SeletorDeVoz } from "./SeletorDeVoz";
import { TocadorDaVoz } from "./TocadorDaVoz";

const nada = () => () => {};

/**
 * "Ouvir a aula" em destaque, logo abaixo do título: para quem lê pouco ou não lê, a leitura em voz alta não pode ficar
 * escondida na faixa de cima. Ao lado, a escolha da voz: a do aparelho (leve, não baixa nada) ou uma voz natural, que
 * a pessoa baixa uma vez e roda no próprio aparelho. Some onde o navegador não sabe falar e no modo leitor (Kindle).
 */
export function OuvirAula({ minutos, lexico, avisoTelaApagada }: { minutos: string; lexico: Lexico; avisoTelaApagada?: string }) {
  const { t } = useI18n();
  const l = t.lesson;
  const falando = useSpeaking();
  const { erro } = useLeitor();
  const pode = useSyncExternalStore(nada, speechSupported, () => false);
  const [aberto, setAberto] = useState(false);
  const [nomeDaVoz, setNomeDaVoz] = useState(l.voz.aparelho);

  const caminho = usePathname();
  useEffect(() => definirLexico(lexico), [lexico]);
  // Trocou de aula (navegação no próprio site) ou o leitor saiu da tela: para o som, esvazia a fila e cancela no
  // Worker o que ainda era da aula anterior. Sem isto, frases da aula velha tocavam no meio da nova.
  useEffect(() => () => encerrarLeitura(), [caminho]);
  useEffect(() => {
    const e = lerEscolha();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a escolha só existe no aparelho
    setNomeDaVoz(e.voz === VOZ_DO_APARELHO ? l.voz.aparelho : fill(l.voz.natural, { n: e.numero ?? 1 }));
  }, [aberto, l]);

  if (!pode) return null;
  return (
    <div className="no-print no-leitor mt-5 flex flex-wrap items-stretch gap-2">
      <button
        type="button"
        aria-pressed={falando}
        onClick={() => (falando ? stopReading() : startReading(TRECHOS_DA_AULA))}
        onPointerEnter={() => void aquecer(TRECHOS_DA_AULA)}
        onFocus={() => void aquecer(TRECHOS_DA_AULA)}
        className="inline-flex min-h-12 cursor-pointer items-center gap-3 border-2 border-ink bg-ink px-5 py-2 text-left font-sans text-parchment hover:bg-oxblood"
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
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-12 cursor-pointer items-center gap-2 border-2 border-ink bg-parchment px-4 py-2 text-left font-sans text-ink hover:bg-parchment-deep"
      >
        <span className="text-xs uppercase tracking-[0.08em] text-ink-soft">{l.voz.escolher}</span>
        <span className="font-semibold">{nomeDaVoz}</span>
        <span aria-hidden>▾</span>
      </button>
      {erro === "sem-voz" && !falando && (
        <p role="alert" className="basis-full border-l-4 border-oxblood bg-parchment-deep px-3 py-2 font-sans text-sm text-ink">
          {l.leitor.semVoz}
        </p>
      )}
      {aberto && <SeletorDeVoz fechar={() => setAberto(false)} />}
      <TocadorDaVoz avisoTelaApagada={avisoTelaApagada} />
    </div>
  );
}

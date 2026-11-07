// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O palco dos jogos (T23, "deixe os jogos mais imersivos"): tudo o que é aberto em /jogos passa por aqui e ganha
//  - tela cheia (Fullscreen API do navegador; o botão só aparece onde ela existe);
//  - som opcional, DESLIGADO por padrão: notas sintetizadas no aparelho (components/jogos/audio.ts, baixado só quando o
//    som é ligado), nenhum arquivo de áudio, nada de terceiros. A escolha fica em lib/storage (lucia:jogos-som);
//  - retorno visual: um clarão na borda ao acertar ou errar e uma chuva curta de estrelas no fim. As animações só rodam com
//    prefers-reduced-motion: no-preference e fora dos modos leve e e-ink (app/globals.css, bloco "palco-dos-jogos"); com
//    movimento reduzido, fica só a cor da borda, sem deslocamento.
// O aviso escrito (role="status") continua sendo o retorno principal: som e animação só acompanham (WCAG 1.3.3, 2.3.3).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TextosDosJogos } from "@/i18n/jogos";
import { KEYS, setItem, useHydrated, useStored } from "@/lib/storage";

export type Tom = "certo" | "erro" | "fim" | "vez" | "tique";

interface Imersao {
  som: boolean;
  /** Toca o som (se ligado) e mostra o retorno visual de um acontecimento do jogo. */
  retorno: (tom: Tom) => void;
  /** Está em tela cheia (os jogos podem aumentar a letra). */
  cheia: boolean;
}

const Contexto = createContext<Imersao>({ som: false, retorno: () => undefined, cheia: false });
export const useImersao = () => useContext(Contexto);

async function tocar(tom: Tom) {
  const a = await import("./audio");
  if (!a.temAudio()) return;
  ({ certo: a.somDeAcerto, erro: a.somDeErro, fim: a.somDeFim, vez: a.somDeVez, tique: a.somDeTique })[tom]();
}

/** As estrelas da chuva do fim (posições fixas: nada de sorteio a cada quadro). */
const ESTRELAS = [8, 19, 31, 44, 56, 67, 78, 90, 13, 37, 61, 84];

export function Palco({ s, children }: { s: TextosDosJogos; children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const hidratado = useHydrated();
  const som = useStored(KEYS.jogosSom) === "1";
  const [cheia, setCheia] = useState(false);
  const [efeito, setEfeito] = useState<{ tom: Tom; n: number } | null>(null);
  const t = s.imersao;

  useEffect(() => {
    const mudou = () => setCheia(Boolean(document.fullscreenElement) && document.fullscreenElement === caixa.current);
    document.addEventListener("fullscreenchange", mudou);
    return () => document.removeEventListener("fullscreenchange", mudou);
  }, []);

  // O clarão some sozinho (a classe sai, a próxima jogada acende de novo).
  useEffect(() => {
    if (!efeito) return;
    const relogio = window.setTimeout(() => setEfeito(null), efeito.tom === "fim" ? 2600 : 700);
    return () => window.clearTimeout(relogio);
  }, [efeito]);

  const retorno = useCallback(
    (tom: Tom) => {
      if (som) void tocar(tom).catch(() => undefined);
      if (tom !== "tique") setEfeito((e) => ({ tom, n: (e?.n ?? 0) + 1 }));
    },
    [som],
  );

  const alternarTelaCheia = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await caixa.current?.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // O navegador recusou (iframe, iOS antigo): o jogo segue na página.
    }
  };
  const alternarSom = () => {
    const ligar = !som;
    setItem(KEYS.jogosSom, ligar ? "1" : null);
    // O primeiro toque também "acorda" o áudio do navegador (regra de reprodução automática).
    if (ligar) void tocar("vez").catch(() => undefined);
  };
  const podeTelaCheia = hidratado && typeof document !== "undefined" && document.fullscreenEnabled;
  const valor = useMemo(() => ({ som, retorno, cheia }), [som, retorno, cheia]);

  return (
    <Contexto.Provider value={valor}>
      <div ref={caixa} className={`palco-dos-jogos relative ${cheia ? "palco-cheio overflow-y-auto bg-parchment p-4 sm:p-8" : ""}`} data-retorno={efeito?.tom}>
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2" role="group" aria-label={t.rotulo}>
          <button type="button" aria-pressed={som} onClick={alternarSom} className="aba-pasta inline-flex cursor-pointer items-center gap-1.5" disabled={!hidratado}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9v6h4l5 4V5L8 9z" />
              {som ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
            </svg>
            {som ? t.somLigado : t.somDesligado}
          </button>
          {podeTelaCheia && (
            <button type="button" aria-pressed={cheia} onClick={() => void alternarTelaCheia()} className="aba-pasta inline-flex cursor-pointer items-center gap-1.5">
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {cheia ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
              </svg>
              {cheia ? t.sairDaTelaCheia : t.telaCheia}
            </button>
          )}
        </div>
        {children}
        {/* O retorno visual: só enfeite (o aviso escrito já disse o que aconteceu). */}
        {efeito && (
          <div key={efeito.n} aria-hidden className={`palco-retorno palco-retorno-${efeito.tom}`}>
            {efeito.tom === "fim" &&
              ESTRELAS.map((x, i) => (
                <span key={i} className="palco-estrela" style={{ left: `${x}%`, animationDelay: `${(i % 6) * 90}ms`, color: ["#c21f16", "#f0b323", "#2e6b4f", "#23408e"][i % 4] }}>
                  ★
                </span>
              ))}
          </div>
        )}
      </div>
    </Contexto.Provider>
  );
}

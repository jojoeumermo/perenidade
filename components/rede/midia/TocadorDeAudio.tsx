// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, useState } from "react";
import "./tocador.css";

/** Os textos do tocador (cada tela passa os do pacote dela). */
export interface TextosDoTocador {
  /** "Ouvir o áudio (45 s)": o botão parado. */
  tocar: string;
  /** "Pausar": o botão tocando. */
  pausar: string;
  /** "Posição no áudio": o nome da barra. */
  posicao: string;
}

const relogio = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * O tocador próprio do áudio da Alumia (o post, a resposta e o gravado no Escrever), no lugar dos controles do navegador, que
 * mudam de cara em cada navegador e no tema claro e escuro: um botão de 44 px que toca e pausa, a barra (um controle deslizante de
 * verdade: setas, Home e End andam no áudio, e o leitor de tela ouve "0:12 de 0:45") e o tempo. Sem script, fonte ou serviço de
 * fora: só o elemento de áudio do navegador, escondido, com o endereço que a tela já tinha (o blob do aparelho ou o arquivo do
 * depósito). `tocarJa`: começa a tocar ao montar (o áudio só baixa depois do toque em Ouvir).
 */
export function TocadorDeAudio({ src, duracao, t, tocarJa = false, className = "" }: { src: string; duracao: number; t: TextosDoTocador; tocarJa?: boolean; className?: string }) {
  const elemento = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [agora, setAgora] = useState(0);
  const [total, setTotal] = useState(Math.max(1, Math.round(duracao)));
  const ir = (s: number) => {
    const a = elemento.current;
    if (!a) return;
    const alvo = Math.max(0, Math.min(total, s));
    a.currentTime = alvo;
    setAgora(alvo);
  };
  return (
    <div className={`al-tocador ${className}`.trim()}>
      <audio
        ref={elemento}
        src={src}
        preload="metadata"
        autoPlay={tocarJa}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setTotal(Math.max(1, Math.round(d)));
        }}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => {
          setTocando(false);
          setAgora(0);
        }}
        onTimeUpdate={(e) => setAgora(e.currentTarget.currentTime)}
      />
      <button
        type="button"
        className="al-tocador-botao"
        aria-label={tocando ? t.pausar : t.tocar}
        title={tocando ? t.pausar : t.tocar}
        onClick={() => {
          const a = elemento.current;
          if (!a) return;
          if (a.paused) void a.play().catch(() => setTocando(false));
          else a.pause();
        }}
      >
        {tocando ? (
          <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1" /><rect x="13.5" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" /></svg>
        )}
      </button>
      <input
        type="range"
        className="al-tocador-barra"
        min={0}
        max={total}
        step={0.1}
        value={Math.min(total, agora)}
        aria-label={t.posicao}
        aria-valuetext={`${relogio(agora)} / ${relogio(total)}`}
        style={{ "--al-tocou": `${Math.min(100, (agora / total) * 100)}%` } as React.CSSProperties}
        onChange={(e) => ir(Number(e.target.value))}
        // A bolinha anda junto com o ouro (passo de 0,1 s); pelo teclado, as setas andam 5 s, como num tocador comum.
        onKeyDown={(e) => {
          const passo = e.key === "ArrowRight" || e.key === "ArrowUp" ? 5 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -5 : 0;
          if (!passo) return;
          e.preventDefault();
          ir(Math.max(0, Math.min(total, agora + passo)));
        }}
      />
      <span className="al-tocador-tempo" aria-hidden>{relogio(agora)} / {relogio(total)}</span>
    </div>
  );
}

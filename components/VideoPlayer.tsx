// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { relogio } from "@/lib/videoaula";

export interface PlayerLabels {
  play: string;
  pause: string;
  back: string;
  forward: string;
  speed: string;
  captions: string;
  noCaptions: string;
  mute: string;
  unmute: string;
  volume: string;
  fullscreen: string;
  pip: string;
  progress: string;
  of: string;
  transcript: string;
  hideTranscript: string;
  keys: string;
  error: string;
}

const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const CHAVE_VELOCIDADE = "lucia-velocidade-do-video";

function velocidadeGuardada() {
  try {
    const valor = Number(localStorage.getItem(CHAVE_VELOCIDADE));
    return VELOCIDADES.includes(valor) ? valor : 1;
  } catch {
    return 1;
  }
}

/**
 * Tocador de aula em vídeo com controles próprios, grandes e acessíveis: velocidade de 0,5x a 3x (lembrada neste
 * aparelho), legendas, transcrição, tela cheia, imagem sobre imagem e atalhos de teclado (espaço, setas, M, C, F, < e >).
 */
export function VideoPlayer({ src, legenda, transcricao, titulo, labels }: { src: string; legenda?: string; transcricao?: string; titulo: string; labels: PlayerLabels }) {
  const video = useRef<HTMLVideoElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [duracao, setDuracao] = useState(0);
  // A velocidade escolhida antes vale de novo (fica só neste aparelho). O tocador só aparece no navegador, depois de
  // pedir o endereço do vídeo, então ler o armazenamento local já na primeira vez não descasa do servidor.
  const [velocidade, setVelocidade] = useState(velocidadeGuardada);
  const [mudo, setMudo] = useState(false);
  const [volume, setVolume] = useState(1);
  const [legendas, setLegendas] = useState(Boolean(legenda));
  const [verTexto, setVerTexto] = useState(false);
  const [erro, setErro] = useState(false);
  const idTexto = useId();
  const faixa = useMemo(() => (legenda ? URL.createObjectURL(new Blob([legenda], { type: "text/vtt" })) : ""), [legenda]);
  useEffect(() => () => (faixa ? URL.revokeObjectURL(faixa) : undefined), [faixa]);

  const v = () => video.current;
  const alternarLegendas = () => {
    const ligar = !legendas;
    setLegendas(ligar);
    const trilha = v()?.textTracks[0];
    if (trilha) trilha.mode = ligar ? "showing" : "hidden";
  };
  const alternar = () => {
    const el = v();
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };
  const pular = (segundos: number) => {
    const el = v();
    if (el) el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + segundos));
  };
  const mudarVelocidade = (valor: number) => {
    setVelocidade(valor);
    if (v()) v()!.playbackRate = valor;
    try {
      localStorage.setItem(CHAVE_VELOCIDADE, String(valor));
    } catch {
      // Sem armazenamento local, a velocidade só vale até fechar a página.
    }
  };
  const passoDeVelocidade = (direcao: 1 | -1) => {
    const i = VELOCIDADES.indexOf(velocidade);
    mudarVelocidade(VELOCIDADES[Math.max(0, Math.min(VELOCIDADES.length - 1, i + direcao))]);
  };
  const telaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void caixa.current?.requestFullscreen?.();
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLSelectElement || (e.target instanceof HTMLInputElement && e.target.type !== "range")) return;
    const tecla = e.key.toLowerCase();
    const acoes: Record<string, () => void> = {
      " ": alternar,
      k: alternar,
      arrowleft: () => pular(-5),
      j: () => pular(-10),
      arrowright: () => pular(5),
      l: () => pular(10),
      m: () => setMudo((atual) => !atual),
      c: () => legenda && alternarLegendas(),
      f: telaCheia,
      "<": () => passoDeVelocidade(-1),
      ">": () => passoDeVelocidade(1),
    };
    // Nas setas do controle de progresso, quem age é o próprio controle.
    if ((tecla === "arrowleft" || tecla === "arrowright") && e.target instanceof HTMLInputElement) return;
    const acao = acoes[tecla];
    if (acao) {
      e.preventDefault();
      acao();
    }
  };

  const botao = "flex h-11 min-w-11 cursor-pointer items-center justify-center px-2 text-parchment hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f0cf8e]";

  return (
    <div className="no-print">
      <div ref={caixa} onKeyDown={teclas} className="overflow-hidden border-2 border-ink bg-[#17130e]">
        {erro ? (
          <p role="alert" className="p-6 text-parchment">{labels.error}</p>
        ) : (
          <video
            ref={video}
            src={src}
            playsInline
            preload="metadata"
            muted={mudo}
            aria-label={titulo}
            onClick={alternar}
            onPlay={() => setTocando(true)}
            onPause={() => setTocando(false)}
            onTimeUpdate={(e) => setTempo(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              setDuracao(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0);
              e.currentTarget.playbackRate = velocidade;
            }}
            onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuracao(e.currentTarget.duration)}
            onError={() => setErro(true)}
            className="block aspect-video w-full bg-black"
          >
            {faixa && <track kind="captions" src={faixa} srcLang="pt-BR" label="Português" default={legendas} />}
          </video>
        )}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-white/20 px-1 py-1 font-sans text-sm text-parchment">
          <button type="button" onClick={alternar} aria-label={tocando ? labels.pause : labels.play} className={botao}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">{tocando ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</svg>
          </button>
          <button type="button" onClick={() => pular(-10)} aria-label={labels.back} className={botao}>−10s</button>
          <button type="button" onClick={() => pular(10)} aria-label={labels.forward} className={botao}>+10s</button>
          <label className="flex min-w-40 flex-1 items-center gap-2 px-1">
            <span className="sr-only">{labels.progress}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(duracao))}
              step={1}
              value={Math.floor(tempo)}
              onChange={(e) => {
                if (v()) v()!.currentTime = Number(e.target.value);
              }}
              aria-valuetext={`${relogio(tempo)} ${labels.of} ${relogio(duracao)}`}
              className="h-2 w-full cursor-pointer accent-[#e0372b]"
            />
            <span className="whitespace-nowrap font-mono text-xs tabular-nums" aria-hidden>
              {relogio(tempo)} / {relogio(duracao)}
            </span>
          </label>
          <label className="flex items-center gap-1 px-1">
            <span className="sr-only">{labels.speed}</span>
            <select value={velocidade} onChange={(e) => mudarVelocidade(Number(e.target.value))} className="h-9 cursor-pointer border border-white/40 bg-[#17130e] px-1 text-parchment" title={labels.speed}>
              {VELOCIDADES.map((valor) => (
                <option key={valor} value={valor}>{String(valor).replace(".", ",")}x</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setMudo(!mudo)} aria-label={mudo ? labels.unmute : labels.mute} aria-pressed={mudo} className={botao}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9h4l5-4v14l-5-4H4z" />{mudo ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}</svg>
          </button>
          <label className="hidden items-center px-1 sm:flex">
            <span className="sr-only">{labels.volume}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={mudo ? 0 : volume}
              onChange={(e) => {
                const valor = Number(e.target.value);
                setVolume(valor);
                setMudo(valor === 0);
                if (v()) v()!.volume = valor;
              }}
              className="w-20 cursor-pointer accent-[#e0372b]"
            />
          </label>
          {legenda && (
            <button type="button" onClick={alternarLegendas} aria-pressed={legendas} aria-label={labels.captions} title={labels.captions} className={`${botao} font-bold`}>
              CC
            </button>
          )}
          {typeof document !== "undefined" && document.pictureInPictureEnabled && (
            <button type="button" onClick={() => void (document.pictureInPictureElement ? document.exitPictureInPicture() : v()?.requestPictureInPicture())} aria-label={labels.pip} title={labels.pip} className={botao}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18v14H3z" /><path d="M12 12h7v5h-7z" fill="currentColor" /></svg>
            </button>
          )}
          <button type="button" onClick={telaCheia} aria-label={labels.fullscreen} title={labels.fullscreen} className={botao}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          </button>
        </div>
      </div>
      <p className="mt-2 font-sans text-xs text-ink-soft">{legenda ? labels.keys : `${labels.keys} ${labels.noCaptions}`}</p>
      {transcricao && (
        <div className="mt-3">
          <button type="button" onClick={() => setVerTexto(!verTexto)} aria-expanded={verTexto} aria-controls={idTexto} className="cursor-pointer font-sans text-sm font-semibold underline hover:text-oxblood">
            {verTexto ? labels.hideTranscript : labels.transcript}
          </button>
          <div id={idTexto} hidden={!verTexto} className="mt-2 max-h-96 overflow-y-auto border-l-2 border-gold pl-4 whitespace-pre-line">
            {transcricao}
          </div>
        </div>
      )}
    </div>
  );
}

/** Os rótulos do tocador em português, para o painel. */
export const playerPt: PlayerLabels = {
  play: "Tocar",
  pause: "Pausar",
  back: "Voltar 10 segundos",
  forward: "Avançar 10 segundos",
  speed: "Velocidade",
  captions: "Legendas",
  noCaptions: "Esta aula ainda não tem legendas.",
  mute: "Tirar o som",
  unmute: "Ligar o som",
  volume: "Volume",
  fullscreen: "Tela cheia",
  pip: "Imagem sobre imagem",
  progress: "Posição no vídeo",
  of: "de",
  transcript: "Ler a transcrição",
  hideTranscript: "Esconder a transcrição",
  keys: "Atalhos: espaço toca e pausa, setas andam 5 segundos, < e > mudam a velocidade, M tira o som, C liga as legendas, F tela cheia.",
  error: "Não foi possível tocar este vídeo agora.",
};

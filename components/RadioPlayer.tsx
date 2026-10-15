// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef } from "react";
import { storageUrl } from "@/lib/backend";
import { positions, radio, usePlayer } from "@/lib/radio";
import { site } from "@/lib/site";
import { useI18n } from "./I18n";

/**
 * Tocador da rádio. Fica no layout do site, então o som continua enquanto a pessoa navega.
 * Só aparece depois que alguém dá o play na página da rádio; antes disso não ocupa espaço nem banda.
 */
export function RadioPlayer() {
  const { t } = useI18n();
  const { queue, index, playing } = usePlayer();
  const audio = useRef<HTMLAudioElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const graph = useRef<{ context: AudioContext; analyser: AnalyserNode } | null>(null);
  const track = queue[index];
  // O desenho das frequências só é possível para arquivos do nosso próprio depósito (que liberam a leitura do som).
  const own = Boolean(track && track.url.startsWith(storageUrl("")));

  // Troca de faixa: carrega e retoma de onde a pessoa parou.
  useEffect(() => {
    const el = audio.current;
    if (!el || !track) return;
    el.src = track.url;
    const resume = track.live ? 0 : positions.get(track.id);
    const onLoaded = () => {
      if (resume > 5 && resume < el.duration - 10) el.currentTime = resume;
    };
    el.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => el.removeEventListener("loadedmetadata", onLoaded);
  }, [track]);

  useEffect(() => {
    const el = audio.current;
    if (!el || !track) return;
    if (playing) {
      if (own && !graph.current) {
        try {
          const context = new AudioContext();
          const analyser = context.createAnalyser();
          analyser.fftSize = 64;
          context.createMediaElementSource(el).connect(analyser);
          analyser.connect(context.destination);
          graph.current = { context, analyser };
        } catch {
          graph.current = null;
        }
      }
      void graph.current?.context.resume();
      el.play().catch(() => radio.pause());
    } else {
      el.pause();
    }
  }, [playing, track, own]);

  // Guarda a posição a cada 10 segundos (e ao pausar), para retomar depois, até em outro aparelho.
  useEffect(() => {
    const el = audio.current;
    if (!el || !track || track.live || !playing) return;
    const save = () => positions.save(track.id, el.currentTime);
    const timer = setInterval(save, 10000);
    return () => {
      clearInterval(timer);
      save();
    };
  }, [track, playing]);

  // Controles na tela de bloqueio e nos fones do celular.
  useEffect(() => {
    if (!track || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.titulo, artist: track.artista || site.name, album: t.radio.title });
    navigator.mediaSession.setActionHandler("play", () => radio.toggle());
    navigator.mediaSession.setActionHandler("pause", () => radio.pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => radio.next());
    navigator.mediaSession.setActionHandler("previoustrack", () => radio.previous());
  }, [track, t.radio.title]);

  // Barras de frequência em uma cor só, no tom do texto.
  useEffect(() => {
    if (!playing || !own) return;
    let frame = 0;
    const draw = () => {
      const view = canvas.current;
      const analyser = graph.current?.analyser;
      if (view && analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const pen = view.getContext("2d");
        if (pen) {
          pen.clearRect(0, 0, view.width, view.height);
          pen.fillStyle = getComputedStyle(view).color;
          const width = view.width / data.length;
          data.forEach((value, i) => {
            const height = Math.max(1, (value / 255) * view.height);
            pen.fillRect(i * width, view.height - height, width - 1, height);
          });
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [playing, own]);

  const button = "cursor-pointer px-2 py-1 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <>
      <audio ref={audio} preload="none" crossOrigin={own ? "anonymous" : undefined} onEnded={() => radio.next()} onError={() => radio.pause()} />
      {track && (
        <div role="region" aria-label={t.radio.title} className="radio-player no-print sticky bottom-[calc(3.5rem+var(--recuo-baixo))] z-30 border-t-2 border-gold bg-ink font-sans text-sm text-parchment md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
            <button type="button" className={button} onClick={radio.previous} disabled={index === 0} aria-label={t.radio.previous} title={t.radio.previous}>⏮</button>
            <button type="button" className={`${button} text-lg`} onClick={radio.toggle} aria-label={playing ? t.radio.pause : t.radio.play} title={playing ? t.radio.pause : t.radio.play}>
              {playing ? "⏸" : "▶"}
            </button>
            <button type="button" className={button} onClick={radio.next} disabled={index >= queue.length - 1} aria-label={t.radio.next} title={t.radio.next}>⏭</button>
            <p className="min-w-0 flex-1 truncate">
              {track.live && <span className="mr-2 bg-oxblood px-1.5 py-0.5 font-mono text-xs uppercase text-parchment">{t.radio.live}</span>}
              <strong>{track.titulo}</strong>
              {track.artista && <span className="opacity-80"> · {track.artista}</span>}
            </p>
            <canvas ref={canvas} width="96" height="24" aria-hidden className="hidden text-parchment sm:block" />
            <button type="button" className={button} onClick={radio.close} aria-label={t.radio.close} title={t.radio.close}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}

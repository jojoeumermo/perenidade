// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useEffect, useRef } from "react";
import { localePath } from "@/i18n/config";
import { hasBackend, rpc, storageUrl } from "@/lib/backend";
import { arquivoPublico, relogio } from "@/lib/podcast";
import { positions, radio, usePlayer } from "@/lib/radio";
import { site } from "@/lib/site";
import { useI18n } from "./I18n";

const RATES = [1, 1.25, 1.5, 1.75, 2, 0.75];

/** Conta uma audição por episódio a cada visita (o banco não guarda quem ouviu). */
function countPlay(episodio: string) {
  const key = `lucia:ouvido:${episodio}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // sem armazenamento: conta assim mesmo
  }
  if (hasBackend) void rpc("podcast_ouvir", { p_id: episodio }).catch(() => {});
}

/** A barra de avanço do episódio: a forma da onda calculada no envio, pintada até onde já tocou. */
function Wave({ picos, time, duration, label }: { picos: number[]; time: number; duration: number; label: string }) {
  const done = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  const bars = picos.length > 0 ? picos : [];
  return (
    <div className="relative h-7 w-full">
      {bars.length > 0 ? (
        <svg aria-hidden viewBox={`0 0 ${bars.length} 100`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <clipPath id="tocado">
              <rect x="0" y="0" width={(done / 100) * bars.length} height="100" />
            </clipPath>
          </defs>
          {[false, true].map((played) => (
            <g key={String(played)} fill="currentColor" className={played ? "text-gold" : "text-parchment/35"} clipPath={played ? "url(#tocado)" : undefined}>
              {bars.map((value, i) => {
                const h = Math.max(6, value);
                return <rect key={i} x={i + 0.15} y={(100 - h) / 2} width={0.7} height={h} />;
              })}
            </g>
          ))}
        </svg>
      ) : (
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-parchment/25">
          <div className="h-full bg-gold" style={{ width: `${done}%` }} />
        </div>
      )}
      <input
        type="range"
        min={0}
        max={Math.max(1, duration)}
        step={1}
        value={Math.min(time, duration || time)}
        onChange={(e) => radio.seek(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={`${relogio(time)} / ${relogio(duration)}`}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

/**
 * Tocador da rádio e do podcast. Fica no layout do site, então o som continua enquanto a pessoa navega.
 * Só aparece depois que alguém dá o play; antes disso não ocupa espaço nem banda.
 */
export function RadioPlayer() {
  const { lang, t } = useI18n();
  const { queue, index, playing, time, duration, rate, seek } = usePlayer();
  const audio = useRef<HTMLAudioElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const graph = useRef<{ context: AudioContext; analyser: AnalyserNode } | null>(null);
  const track = queue[index];
  const episode = track?.podcast;
  // O desenho das frequências só é possível para arquivos do nosso próprio depósito (que liberam a leitura do som).
  const own = Boolean(track && track.url.startsWith(storageUrl("")) && !episode);

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
    if (track.podcast) countPlay(track.podcast.episodio);
    return () => el.removeEventListener("loadedmetadata", onLoaded);
  }, [track]);

  // Pedido de salto (capítulo, transcrição, comentário com tempo).
  useEffect(() => {
    const el = audio.current;
    if (!el || !seek) return;
    const go = () => {
      el.currentTime = seek.at;
    };
    if (el.readyState >= 1) go();
    else el.addEventListener("loadedmetadata", go, { once: true });
  }, [seek]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = episode ? rate : 1;
  }, [rate, episode, track]);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    // Fechou o tocador (✕): para o som e solta a conexão com a emissora.
    if (!track) {
      el.pause();
      el.removeAttribute("src");
      el.load();
      return;
    }
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
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.titulo,
      artist: track.artista || site.name,
      album: episode ? t.nav.podcasts : t.radio.title,
      artwork: episode?.capa ? [{ src: arquivoPublico(episode.capa), sizes: "600x600", type: "image/jpeg" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", () => radio.toggle());
    navigator.mediaSession.setActionHandler("pause", () => radio.pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => radio.next());
    navigator.mediaSession.setActionHandler("previoustrack", () => radio.previous());
    try {
      navigator.mediaSession.setActionHandler("seekbackward", episode ? () => radio.skip(-15) : null);
      navigator.mediaSession.setActionHandler("seekforward", episode ? () => radio.skip(30) : null);
      navigator.mediaSession.setActionHandler("seekto", episode ? (details) => radio.seek(details.seekTime ?? 0) : null);
    } catch {
      // navegador sem esses comandos
    }
  }, [track, episode, t.radio.title, t.nav.podcasts]);

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
  const chapter = episode?.capitulos.filter((c) => c.t <= time).at(-1);
  const total = duration || episode?.duracao || 0;
  return (
    <>
      <audio
        ref={audio}
        preload="none"
        crossOrigin={own ? "anonymous" : undefined}
        onEnded={() => radio.next()}
        onError={() => radio.pause()}
        onTimeUpdate={(e) => radio.tick(e.currentTarget.currentTime, e.currentTarget.duration)}
        onDurationChange={(e) => radio.tick(e.currentTarget.currentTime, e.currentTarget.duration)}
      />
      {track && episode && (
        <div role="region" aria-label={t.nav.podcasts} className="radio-player no-print sticky bottom-[calc(3.5rem+var(--recuo-baixo))] z-30 border-t-2 border-gold bg-ink font-sans text-sm text-parchment md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 pb-1 pt-2 sm:px-4">
            <Link href={localePath(lang, episode.href)} className="shrink-0" aria-label={t.radio.openEpisode}>
              {episode.capa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={arquivoPublico(episode.capa)} alt="" width={44} height={44} className="h-11 w-11 object-cover" />
              ) : (
                <span aria-hidden className="flex h-11 w-11 items-center justify-center bg-oxblood font-serif text-xl">★</span>
              )}
            </Link>
            <p className="min-w-0 flex-1 leading-tight">
              <Link href={localePath(lang, episode.href)} className="block truncate font-semibold hover:text-gold">{track.titulo}</Link>
              <span className="block truncate text-xs opacity-75">{chapter ? chapter.titulo : track.artista}</span>
            </p>
            <button type="button" className={`${button} hidden font-mono text-xs sm:block`} onClick={() => radio.skip(-15)} aria-label={t.radio.back15} title={t.radio.back15}>
              ↺15
            </button>
            <button type="button" className={`${button} text-xl`} onClick={radio.toggle} aria-label={playing ? t.radio.pause : t.radio.play} title={playing ? t.radio.pause : t.radio.play}>
              {playing ? "⏸" : "▶"}
            </button>
            <button type="button" className={`${button} font-mono text-xs`} onClick={() => radio.skip(30)} aria-label={t.radio.forward30} title={t.radio.forward30}>
              30↻
            </button>
            <button
              type="button"
              className={`${button} w-12 font-mono text-xs`}
              onClick={() => radio.setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1)}
              aria-label={`${t.radio.speed}: ${rate}×`}
              title={t.radio.speed}
            >
              {rate}×
            </button>
            <button type="button" className={button} onClick={radio.close} aria-label={t.radio.close} title={t.radio.close}>✕</button>
          </div>
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 pb-2 font-mono text-[0.65rem] tabular-nums sm:px-4">
            <span className="w-11 text-right opacity-75">{relogio(time)}</span>
            <Wave picos={episode.picos} time={time} duration={total} label={t.radio.position} />
            <span className="w-11 opacity-75">{relogio(total)}</span>
          </div>
        </div>
      )}
      {track && !episode && (
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

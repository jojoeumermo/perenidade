// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useEffect, useRef, useState } from "react";
import type { TextosDoSom } from "@/i18n/escola/som";
import { localePath } from "@/i18n/config";
import { hasBackend, rpc, storageUrl } from "@/lib/backend";
import { arquivoPublico, relogio } from "@/lib/podcast";
import { positions, radio, retomada, usePlayer } from "@/lib/radio";
import type { Retomada } from "@/lib/radio-retomar";
import { site } from "@/lib/site";
import { somDeEstudo, useSomDeEstudo } from "@/lib/som-de-estudo";
import { useI18n } from "./I18n";
import { carregarTextosDoSom } from "./radio/textos-do-som";

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
  // No aplicativo, tocar no tocador abre a tela cheia do episódio (capa grande, controles grandes).
  const [cheio, setCheio] = useState(false);
  // O desenho das frequências só é possível para arquivos do nosso próprio depósito (que liberam a leitura do som).
  const own = Boolean(track && track.url.startsWith(storageUrl("")) && !episode);
  // Som do campus (Etapa 4, E4-06; docs/escola/som.md), só com o recurso "escola": o "Continuar" da visita anterior e
  // o som para estudar. Os textos vêm sob demanda, só do idioma da página (components/radio/textos-do-som.ts).
  const [aRetomar, setARetomar] = useState<Retomada | null>(null);
  const [textosDoSom, setTextosDoSom] = useState<{ lang: string; textos: TextosDoSom } | null>(null);
  const estudo = useSomDeEstudo();
  const precisaDosTextos = Boolean((aRetomar && !track) || estudo.tipo);
  const tx = textosDoSom?.lang === lang ? textosDoSom.textos : null;

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

  // Ao abrir o site: a gravação da visita anterior (menos de 24 h) vira o aviso recolhido "Continuar". Nunca toca sozinho.
  useEffect(() => {
    if (!retomada.ligada) return;
    const id = window.setTimeout(() => setARetomar(retomada.ler()), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Começou outra faixa (ou a mesma, retomada): o aviso sai e não volta nesta visita.
  useEffect(() => {
    if (!track) return;
    const id = window.setTimeout(() => setARetomar(null), 0);
    return () => window.clearTimeout(id);
  }, [track]);

  // Os textos do Som do campus, só quando há o que mostrar, e de novo se o idioma da página mudar.
  useEffect(() => {
    if (!precisaDosTextos || tx) return;
    let vivo = true;
    carregarTextosDoSom(lang)
      .then((textos) => {
        if (vivo) setTextosDoSom({ lang, textos });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [precisaDosTextos, tx, lang]);

  // Grava o "Continuar" (lucia:radio-retomar): logo ao tocar, a cada 10 segundos tocando, ao pausar ou trocar de faixa
  // (a limpeza do efeito) e quando a página sai (pagehide). Com o tocador fechado, retomada.gravar não grava nada.
  useEffect(() => {
    const el = audio.current;
    if (!el || !track || !retomada.ligada) return;
    const gravar = () => retomada.gravar(track, el.currentTime);
    window.addEventListener("pagehide", gravar);
    let timer = 0;
    if (playing) {
      gravar();
      timer = window.setInterval(gravar, 10000);
    }
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", gravar);
      if (playing) gravar();
    };
  }, [track, playing]);

  // A rádio voltou a tocar: o som para estudar sai (um canal de cada vez).
  useEffect(() => {
    if (playing && somDeEstudo.atual().tipo) somDeEstudo.desligar();
  }, [playing]);

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
            <button type="button" className={`${button} hidden app:max-md:block`} onClick={() => setCheio(true)} aria-label={t.radio.openEpisode} title={t.radio.openEpisode} aria-expanded={cheio}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 15l7-7 7 7" />
              </svg>
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
      {track && episode && cheio && (
        <div role="dialog" aria-modal="true" aria-label={track.titulo} className="tocador-cheio no-print fixed inset-0 z-50 flex flex-col bg-[#1f1a14] px-6 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] font-sans text-[#f4ecd8]">
          <div className="-mx-3 flex items-center">
            <button type="button" onClick={() => setCheio(false)} aria-label={t.a11y.close} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full">
              <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 9l7 7 7-7" />
              </svg>
            </button>
            <span className="flex-1 text-center font-mono text-[0.68rem] uppercase tracking-[0.16em] text-[#d9ccac]">{t.nav.podcasts}</span>
            <span className="h-11 w-11" />
          </div>
          <div className="relative mx-auto mt-5 aspect-square w-full max-w-[22rem] overflow-hidden rounded-[1.4rem] bg-[#c21f16] shadow-[6px_6px_0_#6e1f1a]">
            {episode.capa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={arquivoPublico(episode.capa)} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-x-5 bottom-5 font-serif text-[2rem] font-semibold leading-none text-white">{track.titulo}</span>
            )}
          </div>
          <h2 className="mt-6 font-serif text-[1.6rem] font-semibold leading-tight">{track.titulo}</h2>
          <p className="mt-1 text-sm text-[#d9ccac]">{chapter ? chapter.titulo : track.artista}</p>
          <div className="mt-5">
            <Wave picos={episode.picos} time={time} duration={total} label={t.radio.position} />
            <p className="mt-1.5 flex justify-between font-mono text-xs tabular-nums text-[#b3a584]">
              <span>{relogio(time)}</span>
              <span>{relogio(total)}</span>
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" className="h-11 w-14 cursor-pointer font-mono text-sm font-bold" onClick={() => radio.setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1)} aria-label={`${t.radio.speed}: ${rate}×`}>
              {rate}×
            </button>
            <button type="button" className="h-14 w-14 cursor-pointer font-mono text-sm font-bold" onClick={() => radio.skip(-15)} aria-label={t.radio.back15}>↺15</button>
            <button type="button" onClick={radio.toggle} aria-label={playing ? t.radio.pause : t.radio.play} className="flex h-[4.75rem] w-[4.75rem] cursor-pointer items-center justify-center rounded-full bg-[#f4ecd8] text-3xl text-[#1f1a14]">
              {playing ? "⏸" : "▶"}
            </button>
            <button type="button" className="h-14 w-14 cursor-pointer font-mono text-sm font-bold" onClick={() => radio.skip(30)} aria-label={t.radio.forward30}>30↻</button>
            <Link href={localePath(lang, episode.href)} onClick={() => setCheio(false)} className="flex h-11 w-14 items-center justify-center text-[#f4ecd8]" aria-label={t.radio.openEpisode}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
              </svg>
            </Link>
          </div>
        </div>
      )}
      {!track && estudo.tipo && tx && (
        <div role="region" aria-label={tx.player.estudoRegiao} data-radio-estudo={estudo.tipo} className="radio-player radio-estudo no-print sticky bottom-[calc(3.5rem+var(--recuo-baixo))] z-30 border-t-2 border-gold bg-ink font-sans text-sm text-parchment md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1.5">
            <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 12 Q4 8 6 12 T10 12 T14 12 T18 12 T22 12" />
            </svg>
            <p className="min-w-0 flex-1 truncate">
              <strong>{tx.player.estudo}</strong> · {tx.som.tipos[estudo.tipo].nome}
              {estudo.comVoz && <span className="ml-2 font-mono text-xs opacity-80">30%</span>}
            </p>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(estudo.volume * 100)}
              onChange={(e) => somDeEstudo.definirVolume(Number(e.target.value) / 100)}
              aria-label={tx.player.volume}
              aria-valuetext={`${Math.round(estudo.volume * 100)}%`}
              className="hidden h-11 w-28 cursor-pointer accent-[#d4a24c] sm:block"
            />
            <button type="button" className={`${button} min-h-11 min-w-11`} onClick={() => somDeEstudo.desligar()} aria-label={tx.player.pararEstudo} title={tx.player.pararEstudo}>
              ✕
            </button>
          </div>
        </div>
      )}
      {!track && !estudo.tipo && aRetomar && tx && (
        <div role="region" aria-label={tx.player.regiao} data-radio-retomar="" className="radio-player radio-retomar no-print sticky bottom-[calc(3.5rem+var(--recuo-baixo))] z-30 border-t-2 border-gold bg-ink font-sans text-sm text-parchment md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-1 sm:px-4">
            <button
              type="button"
              className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left hover:text-gold"
              title={tx.player.continuarRotulo.replace("{titulo}", aRetomar.titulo)}
              onClick={() => {
                const r = aRetomar;
                setARetomar(null);
                retomada.retomar(r);
              }}
            >
              <span aria-hidden className="text-base">▶</span>
              <span className="truncate">
                <strong>{tx.player.continuar}:</strong> <span lang="pt-BR">{aRetomar.titulo}</span>
                {!aRetomar.aoVivo && aRetomar.posicao > 0 && <span className="font-mono text-xs opacity-80"> · {relogio(aRetomar.posicao)}</span>}
              </span>
            </button>
            <button
              type="button"
              className={`${button} min-h-11 min-w-11`}
              onClick={() => {
                retomada.descartar();
                setARetomar(null);
              }}
              aria-label={tx.player.descartar}
              title={tx.player.descartar}
            >
              ✕
            </button>
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

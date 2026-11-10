// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./editor.css";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as EventoDeTecla, type PointerEvent as EventoDePonteiro } from "react";
import { abrirCamera, fotoDoVideo, gravarCamera, relogio } from "@/lib/rede/stories/midia";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { LIMITES_DO_STORY } from "@/lib/rede/tipos-stories";
import { IconeFechar } from "../stories/icones";
import { preencherStory } from "../stories/usar";

type T = TextosDosStories["camera"];

/** Quanto tempo segurando o disparo vira vídeo (antes disso é foto). */
const SEGURAR_MS = 280;
const RAIO = 44;
const VOLTA = 2 * Math.PI * RAIO;

const IconeVirar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2" />
    <path d="M20 4v4h-4M4 20v-4h4" />
  </svg>
);
const IconeGaleria = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 16l-5-5-9 9" />
  </svg>
);

/**
 * A câmera do story, em tela cheia: o visor ao vivo, o disparo grande (toque = foto; segurar = vídeo, com o anel enchendo até
 * 60 s), "Foto | Vídeo" para quem usa teclado ou leitor de tela (no "Vídeo", Enter começa e para), virar a câmera e a galeria.
 * Nada sai do aparelho aqui: a foto e o vídeo vão para o editor e só saem refeitos, sem metadado, ao publicar.
 */
export function Camera({
  t,
  aoFoto,
  aoVideo,
  aoGaleria,
  aoFechar,
}: {
  t: T;
  aoFoto: (b: Blob) => void;
  aoVideo: (b: Blob) => void;
  aoGaleria: () => void;
  aoFechar: () => void;
}) {
  const [frente, setFrente] = useState(false);
  const [estado, setEstado] = useState<"abrindo" | "pronta" | "gravando" | "negada" | "sem_camera">("abrindo");
  const [modo, setModo] = useState<"foto" | "video">("foto");
  const [tempo, setTempo] = useState(0);
  const [flash, setFlash] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const gravacao = useRef<ReturnType<typeof gravarCamera> | null>(null);
  const segurando = useRef<{ desde: number; timer: number } | null>(null);
  const anel = useRef<SVGCircleElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();

  // Abre (e reabre ao virar) a câmera; solta tudo ao sair.
  useEffect(() => {
    let vivo = true;
    abrirCamera(frente, true)
      .then((f) => {
        if (!vivo) {
          f.getTracks().forEach((x) => x.stop());
          return;
        }
        fluxo.current = f;
        if (video.current) {
          video.current.srcObject = f;
          void video.current.play().catch(() => undefined);
        }
        setEstado("pronta");
      })
      .catch((e: Error) => vivo && setEstado(e.message === "negada" ? "negada" : "sem_camera"));
    return () => {
      vivo = false;
      gravacao.current?.cancelar();
      fluxo.current?.getTracks().forEach((x) => x.stop());
      fluxo.current = null;
    };
  }, [frente]);

  useEffect(() => {
    raiz.current?.focus();
  }, []);

  const tirarFoto = useCallback(async () => {
    if (!video.current || estado !== "pronta") return;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    try {
      aoFoto(await fotoDoVideo(video.current, frente));
    } catch {
      setEstado("sem_camera");
    }
  }, [aoFoto, estado, frente]);

  const pararGravacao = useCallback(async () => {
    const g = gravacao.current;
    if (!g) return;
    gravacao.current = null;
    const blob = await g.parar();
    setEstado("pronta");
    setTempo(0);
    if (blob.size > 0) aoVideo(blob);
  }, [aoVideo]);

  const comecarGravacao = useCallback(() => {
    if (!fluxo.current || gravacao.current) return;
    try {
      gravacao.current = gravarCamera(fluxo.current);
    } catch {
      setEstado("sem_camera");
      return;
    }
    setEstado("gravando");
    const inicio = performance.now();
    const passo = () => {
      if (!gravacao.current) return;
      const ms = performance.now() - inicio;
      setTempo(ms);
      if (anel.current) anel.current.style.strokeDashoffset = String(VOLTA * (1 - Math.min(1, ms / LIMITES_DO_STORY.videoMs)));
      if (ms >= LIMITES_DO_STORY.videoMs) void pararGravacao();
      else requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }, [pararGravacao]);

  // Toque e segurar no disparo.
  const baixo = (e: EventoDePonteiro<HTMLButtonElement>) => {
    if (estado !== "pronta" || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const timer = window.setTimeout(() => {
      if (segurando.current) comecarGravacao();
    }, SEGURAR_MS);
    segurando.current = { desde: performance.now(), timer };
  };
  const cima = () => {
    const s = segurando.current;
    segurando.current = null;
    if (!s) return;
    window.clearTimeout(s.timer);
    if (gravacao.current && modo === "foto") void pararGravacao();
    else if (performance.now() - s.desde < SEGURAR_MS) {
      if (modo === "foto") void tirarFoto();
      else if (gravacao.current) void pararGravacao();
      else comecarGravacao();
    }
  };
  // Teclado: Enter/Espaço no disparo (o clique do teclado não passa pelo ponteiro).
  const tecla = (e: EventoDeTecla<HTMLButtonElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (e.repeat) return;
    if (modo === "foto") void tirarFoto();
    else if (gravacao.current) void pararGravacao();
    else comecarGravacao();
  };

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (gravacao.current) {
        gravacao.current.cancelar();
        gravacao.current = null;
        setEstado("pronta");
      } else aoFechar();
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [aoFechar]);

  const gravando = estado === "gravando";
  const rotuloDoDisparo = modo === "foto" ? t.disparo : gravando ? t.parar : t.gravar;

  return (
    <div ref={raiz} className="al-ed-camera" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} tabIndex={-1} data-gravando={gravando ? "sim" : "nao"}>
      <h2 id={`${id}-t`} className="sr-only">
        {t.titulo}
      </h2>
      <video ref={video} className="al-ed-camera-visor" data-espelho={frente ? "sim" : "nao"} muted playsInline autoPlay aria-hidden />
      <span className="al-ed-flash" data-ligado={flash ? "sim" : "nao"} aria-hidden />

      <div className="al-ed-camera-topo">
        <button type="button" className="al-st-icone" aria-label={t.fechar} onClick={aoFechar}>
          <IconeFechar />
        </button>
        {gravando ? (
          <p className="al-ed-tempo" role="timer" aria-live="off">
            <span className="al-ed-ponto" aria-hidden />
            {relogio(tempo)}
            <span className="sr-only">{preencherStory(t.gravando, { tempo: relogio(tempo) })}</span>
          </p>
        ) : null}
      </div>

      {estado === "abrindo" ? (
        <p className="al-ed-camera-aviso" role="status">
          {t.abrindo}
        </p>
      ) : estado === "negada" || estado === "sem_camera" ? (
        <div className="al-ed-camera-aviso" role="alert">
          <p>{estado === "negada" ? t.negada : t.semCamera}</p>
          <button type="button" className="al-botao al-botao-claro al-botao-m" onClick={aoGaleria}>
            {t.galeria}
          </button>
        </div>
      ) : null}

      <div className="al-ed-camera-base">
        <div className="al-ed-camera-modos" role="radiogroup" aria-label={t.modos} hidden={gravando}>
          {(["foto", "video"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={modo === m} className="al-ed-camera-modo" onClick={() => setModo(m)}>
              {m === "foto" ? t.foto : t.video}
            </button>
          ))}
        </div>
        <div className="al-ed-camera-linha">
          <button type="button" className="al-ed-redondo" aria-label={t.galeria} onClick={aoGaleria} disabled={gravando}>
            <IconeGaleria />
          </button>
          <button
            type="button"
            className="al-ed-disparo"
            data-modo={modo}
            aria-label={rotuloDoDisparo}
            aria-pressed={modo === "video" ? gravando : undefined}
            disabled={estado !== "pronta" && !gravando}
            onPointerDown={baixo}
            onPointerUp={cima}
            onPointerCancel={cima}
            onKeyDown={tecla}
            onContextMenu={(e) => e.preventDefault()}
          >
            <svg viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r={RAIO} className="al-ed-disparo-trilho" />
              <circle ref={anel} cx="50" cy="50" r={RAIO} className="al-ed-disparo-anel" style={{ strokeDasharray: VOLTA, strokeDashoffset: VOLTA }} />
            </svg>
            <span className="al-ed-disparo-miolo" />
          </button>
          <button type="button" className="al-ed-redondo" aria-label={t.virar} onClick={() => setFrente((f) => !f)} disabled={gravando || estado === "negada"}>
            <IconeVirar />
          </button>
        </div>
        <p className="al-ed-camera-dica">{gravando ? t.privacidade : t.dica}</p>
      </div>
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O vídeo do post é REGRAVADO no aparelho antes de sair (LGPD art. 6º, III): o trecho escolhido toca escondido, cada quadro é
// desenhado num canvas de até 720p e o gravador do navegador (MediaRecorder) escreve um arquivo novo. Nada do arquivo original
// passa: nem GPS, nem modelo da câmera, nem data. Sem som, a faixa de áudio nem entra. Só roda no navegador.
// Sem "@/" de propósito.
import { escolherGravacao, LIMITES_DA_MIDIA, medidaDoVideoDoPost, taxaDoVideoDoPost, TAXA_DO_AUDIO_DO_VIDEO, trechoDoVideo } from "./regras";

export interface InfoDoVideoEscolhido {
  duracao: number;
  largura: number;
  altura: number;
}

export interface VideoRegravado {
  blob: Blob;
  tipo: string;
  duracao: number;
  largura: number;
  altura: number;
  som: boolean;
}

function esperar(alvo: EventTarget, nome: string, ms = 15_000): Promise<void> {
  return new Promise((pronto, falhou) => {
    const fim = () => {
      alvo.removeEventListener(nome, ok);
      alvo.removeEventListener("error", ruim);
      window.clearTimeout(relogio);
    };
    const ok = () => (fim(), pronto());
    const ruim = () => (fim(), falhou(new Error("invalida")));
    const relogio = window.setTimeout(ruim, ms);
    alvo.addEventListener(nome, ok, { once: true });
    alvo.addEventListener("error", ruim, { once: true });
  });
}

function videoEscondido(url: string): HTMLVideoElement {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  return v;
}

/** Lê duração e medida do vídeo escolhido (endereço local do aparelho). Erro "invalida" se o navegador não abre. */
export async function lerVideoEscolhido(url: string): Promise<InfoDoVideoEscolhido> {
  const v = videoEscondido(url);
  await esperar(v, "loadedmetadata");
  let duracao = v.duration;
  // O WEBM de gravador às vezes diz "Infinity" até ser percorrido.
  if (!Number.isFinite(duracao)) {
    v.currentTime = 1e7;
    await esperar(v, "timeupdate").catch(() => undefined);
    duracao = v.duration;
    v.currentTime = 0;
  }
  const info = { duracao: Math.round((Number.isFinite(duracao) ? duracao : 0) * 1000), largura: v.videoWidth, altura: v.videoHeight };
  v.removeAttribute("src");
  v.load();
  if (!(info.duracao > 0) || !(info.largura > 0)) throw new Error("invalida");
  return info;
}

/**
 * Regrava o trecho [inicio, inicio + 60 s] do vídeo, com ou sem som. Roda em tempo real (o vídeo toca escondido, sem sair pela
 * caixa de som). Erros: "sem_gravador", "invalida", "grande", "cancelado".
 */
export async function regravarVideoDoPost(p: { url: string; inicio: number; som: boolean; aoProgresso?: (fracao: number) => void; sinal?: AbortSignal }): Promise<VideoRegravado> {
  if (typeof MediaRecorder === "undefined") throw new Error("sem_gravador");
  const formato = escolherGravacao((t) => MediaRecorder.isTypeSupported(t));
  if (!formato) throw new Error("sem_gravador");
  const video = videoEscondido(p.url);
  await esperar(video, "loadeddata");
  const total = Math.round((Number.isFinite(video.duration) ? video.duration : 0) * 1000) || LIMITES_DA_MIDIA.videoMs;
  const trecho = trechoDoVideo(p.inicio, total);
  const duracao = trecho.fim - trecho.inicio;
  const { largura, altura } = medidaDoVideoDoPost(video.videoWidth, video.videoHeight);
  if (!largura || !altura) throw new Error("invalida");
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx || !("captureStream" in canvas)) throw new Error("sem_gravador");

  const fluxo = canvas.captureStream(30);
  let audio: AudioContext | null = null;
  if (p.som) {
    try {
      audio = new AudioContext();
      const destino = audio.createMediaStreamDestination();
      // Só para o gravador: nada toca na caixa de som.
      audio.createMediaElementSource(video).connect(destino);
      video.muted = false;
      for (const faixa of destino.stream.getAudioTracks()) fluxo.addTrack(faixa);
    } catch {
      audio = null;
      video.muted = true;
    }
  }
  const comSom = fluxo.getAudioTracks().length > 0;
  const gravador = new MediaRecorder(fluxo, {
    mimeType: formato,
    videoBitsPerSecond: taxaDoVideoDoPost(duracao, comSom),
    ...(comSom ? { audioBitsPerSecond: TAXA_DO_AUDIO_DO_VIDEO } : {}),
  });
  const partes: Blob[] = [];
  gravador.ondataavailable = (e) => {
    if (e.data.size) partes.push(e.data);
  };
  video.currentTime = trecho.inicio / 1000;
  await esperar(video, "seeked");
  const desenhar = () => ctx.drawImage(video, 0, 0, largura, altura);
  desenhar();

  let quadro = 0;
  let cancelado = false;
  const parou = new Promise<void>((pronto) => {
    gravador.onstop = () => pronto();
  });
  const terminar = () => {
    cancelAnimationFrame(quadro);
    video.pause();
    if (gravador.state !== "inactive") gravador.stop();
  };
  p.sinal?.addEventListener("abort", () => {
    cancelado = true;
    terminar();
  });
  gravador.start(1000);
  try {
    await video.play();
  } catch {
    video.muted = true;
    await video.play();
  }
  await new Promise<void>((pronto) => {
    const passo = () => {
      const t = video.currentTime * 1000;
      desenhar();
      p.aoProgresso?.(Math.min(1, Math.max(0, (t - trecho.inicio) / Math.max(1, duracao))));
      if (cancelado || video.ended || t >= trecho.fim) {
        terminar();
        pronto();
        return;
      }
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
  });
  await parou;
  fluxo.getTracks().forEach((f) => f.stop());
  await audio?.close().catch(() => undefined);
  video.removeAttribute("src");
  video.load();
  if (cancelado) throw new Error("cancelado");
  const blob = new Blob(partes, { type: formato.split(";")[0] });
  if (blob.size === 0) throw new Error("invalida");
  if (blob.size > LIMITES_DA_MIDIA.videoBytes) throw new Error("grande");
  p.aoProgresso?.(1);
  return { blob, tipo: blob.type, duracao: Math.max(LIMITES_DA_MIDIA.videoMinMs, Math.min(LIMITES_DA_MIDIA.videoMs, duracao)), largura, altura, som: comSom };
}

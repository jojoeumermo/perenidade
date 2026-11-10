// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A mídia do story (foto e vídeo), feita TODA no aparelho antes de sair (PLANO-ALUMIA §6; LGPD art. 6º, III, necessidade):
//   * o vídeo é REGRAVADO num canvas de 720 × 1280 (MediaRecorder, taxa limitada para caber em 20 MB): o arquivo que sai é só o
//     que o gravador do navegador escreve, sem GPS, sem modelo da câmera, sem data; o corte, o filtro, o giro/zoom e o desenho
//     vão "queimados" nos quadros; sem som, a faixa de áudio nem entra no arquivo;
//   * a foto é redesenhada num canvas de 1080 × 1920 em WEBP (o mesmo de lib/rede/stories/imagem.ts), com o filtro e o giro/zoom.
// As contas puras ficam no alto (os testes rodam no Node); o que precisa de navegador fica embaixo e só roda nele.
// Sem "@/" de propósito (roda no Node nos testes).
import { LIMITES_DO_STORY } from "../tipos-stories";

// ── Filtros (lista fechada; viram CSS conhecido, nunca texto livre) ──────────────────────────────────────────────────────
export const FILTROS_DO_STORY = ["nenhum", "vivo", "quente", "frio", "antigo", "pb", "lambe"] as const;
export type FiltroDoStory = (typeof FILTROS_DO_STORY)[number];

const CSS_DO_FILTRO: Record<FiltroDoStory, string> = {
  nenhum: "none",
  vivo: "saturate(1.55) contrast(1.08)",
  quente: "sepia(0.22) saturate(1.35) hue-rotate(-8deg) brightness(1.03)",
  frio: "saturate(0.92) hue-rotate(14deg) brightness(1.04) contrast(1.04)",
  antigo: "sepia(0.55) contrast(0.92) brightness(1.06) saturate(0.85)",
  pb: "grayscale(1) contrast(1.12)",
  // O lambe-lambe: preto e branco estourado, como cartaz colado no muro.
  lambe: "grayscale(1) contrast(2.1) brightness(1.06)",
};

/** O filtro em CSS (para o `filter` da prévia e o `ctx.filter` do canvas). Nome desconhecido = sem filtro. */
export function filtroEmCss(f: string): string {
  return (FILTROS_DO_STORY as readonly string[]).includes(f) ? CSS_DO_FILTRO[f as FiltroDoStory] : "none";
}

// ── Giro, zoom e posição (dois dedos, roda do mouse ou botões) ───────────────────────────────────────────────────────────
/** x e y em frações da tela (−1 a 1), escala (0,25 a 5) e giro em radianos (−π a π). */
export interface Transformacao {
  x: number;
  y: number;
  escala: number;
  giro: number;
}
export const SEM_TRANSFORMACAO: Transformacao = { x: 0, y: 0, escala: 1, giro: 0 };

const prender = (v: number, min: number, max: number, padrao: number) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);

/** Põe a transformação dentro dos limites (nada some da tela de vez nem fica do tamanho de um ponto). Pura. */
export function transformacaoValida(t: Partial<Transformacao>): Transformacao {
  let giro = Number.isFinite(t.giro) ? (t.giro as number) : 0;
  while (giro > Math.PI) giro -= 2 * Math.PI;
  while (giro <= -Math.PI) giro += 2 * Math.PI;
  return { x: prender(t.x as number, -1, 1, 0), y: prender(t.y as number, -1, 1, 0), escala: prender(t.escala as number, 0.25, 5, 1), giro };
}

/** A transformação em CSS (a mídia ocupa a tela inteira, com origem no centro): igual ao que o canvas desenha. */
export function transformacaoEmCss(t: Transformacao): string {
  return `translate(${(t.x * 100).toFixed(3)}%, ${(t.y * 100).toFixed(3)}%) rotate(${t.giro.toFixed(4)}rad) scale(${t.escala.toFixed(4)})`;
}

export const transformacaoNeutra = (t: Transformacao) => t.x === 0 && t.y === 0 && t.escala === 1 && t.giro === 0;

// ── Vídeo: medida, taxa, formato e corte ──────────────────────────────────────────────────────────────────────────────────
/** A medida em até 720p (o lado curto até 720, o longo até 1280), sem esticar, sempre par (o codificador pede). Pura. */
export function medidaDoVideo(largura: number, altura: number, curto = 720, longo = 1280): { largura: number; altura: number } {
  if (!(largura > 0 && altura > 0)) return { largura: 0, altura: 0 };
  const deitado = largura >= altura;
  const escala = Math.min(1, deitado ? longo / largura : curto / largura, deitado ? curto / altura : longo / altura);
  const par = (n: number) => Math.max(2, Math.round((n * escala) / 2) * 2);
  return { largura: par(largura), altura: par(altura) };
}

/** A tela do story em vídeo (9:16, 720p). */
export const TELA_DO_VIDEO = { largura: 720, altura: 1280 } as const;
const TETO_DO_VIDEO = 2_500_000;
const PISO_DO_VIDEO = 600_000;
export const TAXA_DO_AUDIO = 96_000;

/**
 * A taxa do vídeo (bits/s) para o arquivo caber em 20 MB com folga (80%), descontado o áudio; nunca acima de 2,5 Mb/s (720p não
 * precisa de mais) nem abaixo de 0,6 Mb/s. Pura.
 */
export function taxaDoVideo(duracaoMs: number, som: boolean): number {
  const s = Math.max(1, Math.min(LIMITES_DO_STORY.videoMs, duracaoMs) / 1000);
  const orcamento = Math.floor((LIMITES_DO_STORY.videoBytes * 8 * 0.8) / s) - (som ? TAXA_DO_AUDIO : 0);
  return Math.max(PISO_DO_VIDEO, Math.min(TETO_DO_VIDEO, orcamento));
}

/** O formato do gravador: MP4 (H.264, toca em todo aparelho) quando o navegador grava; senão WEBM. Nulo = sem gravador. */
export function escolherFormatoDeVideo(suporta: (tipo: string) => boolean): string | null {
  const opcoes = ["video/mp4;codecs=avc1.42E01F,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const o of opcoes) {
    try {
      if (suporta(o)) return o;
    } catch {
      /* navegador que joga erro em vez de dizer "não" */
    }
  }
  return null;
}

/** O trecho escolhido no corte, em ms: dentro do vídeo, com pelo menos 1 s e no máximo 60 s. Puro. */
export function cortarTrecho(inicio: number, fim: number, total: number): { inicio: number; fim: number } {
  const t = Math.max(0, Number.isFinite(total) ? total : 0);
  let i = Math.min(Math.max(0, Number.isFinite(inicio) ? inicio : 0), t);
  let f = Math.min(Math.max(i, Number.isFinite(fim) ? fim : t), t);
  if (f - i > LIMITES_DO_STORY.videoMs) f = i + LIMITES_DO_STORY.videoMs;
  if (f - i < 1000 && t >= 1000) {
    f = Math.min(t, i + 1000);
    i = Math.max(0, f - 1000);
  }
  return { inicio: Math.round(i), fim: Math.round(f) };
}

/** "0:07", "1:00". */
export function relogio(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Desenho comum (canvas) ───────────────────────────────────────────────────────────────────────────────────────────────
/** Um traço do "Desenhar": pontos de 0 a 1 (relativos à tela), cor e espessura (fração da largura). */
export interface TracoDoStory {
  cor: string;
  pontos: [number, number][];
  /** Espessura relativa à largura da tela (0,004 a 0,05). */
  largura?: number;
  /** Marca-texto: meio transparente e mais grosso. */
  marca?: boolean;
}

type Fonte = CanvasImageSource & { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number; width?: number | SVGAnimatedLength; height?: number | SVGAnimatedLength };

function medidaDaFonte(f: Fonte): [number, number] {
  const l = f.videoWidth || f.naturalWidth || (typeof f.width === "number" ? f.width : 0);
  const a = f.videoHeight || f.naturalHeight || (typeof f.height === "number" ? f.height : 0);
  return [l, a];
}

/** O filtro do canvas existe? (Safari antigo não tem ctx.filter: aí sai sem filtro, nunca quebra.) */
function temFiltro(ctx: CanvasRenderingContext2D): boolean {
  return "filter" in ctx;
}

/**
 * Desenha um quadro do story: o fundo de cor, a mídia "cobrindo" a tela com o giro/zoom e o filtro, e os traços por cima.
 * Mesmo desenho para a foto e para cada quadro do vídeo.
 */
export function desenharQuadro(
  ctx: CanvasRenderingContext2D,
  l: number,
  a: number,
  p: { fundo: string; fonte?: Fonte | null; filtro: FiltroDoStory; transformacao: Transformacao; tracos: readonly TracoDoStory[]; espelhar?: boolean },
): void {
  ctx.save();
  ctx.fillStyle = p.fundo;
  ctx.fillRect(0, 0, l, a);
  if (p.fonte) {
    const [fl, fa] = medidaDaFonte(p.fonte);
    if (fl > 0 && fa > 0) {
      const cobre = Math.max(l / fl, a / fa);
      const t = p.transformacao;
      ctx.translate(l / 2 + t.x * l, a / 2 + t.y * a);
      ctx.rotate(t.giro);
      ctx.scale(t.escala * (p.espelhar ? -1 : 1), t.escala);
      if (temFiltro(ctx)) ctx.filter = filtroEmCss(p.filtro);
      ctx.drawImage(p.fonte, (-fl * cobre) / 2, (-fa * cobre) / 2, fl * cobre, fa * cobre);
      if (temFiltro(ctx)) ctx.filter = "none";
    }
  }
  ctx.restore();
  desenharTracos(ctx, l, a, p.tracos);
}

export function desenharTracos(ctx: CanvasRenderingContext2D, l: number, a: number, tracos: readonly TracoDoStory[]): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const t of tracos) {
    if (t.pontos.length === 0) continue;
    ctx.globalAlpha = t.marca ? 0.45 : 1;
    ctx.strokeStyle = t.cor;
    ctx.lineWidth = Math.max(2, (t.largura ?? 0.014) * l * (t.marca ? 2.4 : 1));
    ctx.beginPath();
    ctx.moveTo(t.pontos[0][0] * l, t.pontos[0][1] * a);
    // Curvas suaves pelo meio dos pontos (o traço não fica "serrilhado" quando o dedo anda rápido).
    for (let k = 1; k < t.pontos.length - 1; k++) {
      const [x0, y0] = t.pontos[k];
      const [x1, y1] = t.pontos[k + 1];
      ctx.quadraticCurveTo(x0 * l, y0 * a, ((x0 + x1) / 2) * l, ((y0 + y1) / 2) * a);
    }
    const ultimo = t.pontos[t.pontos.length - 1];
    ctx.lineTo(ultimo[0] * l + (t.pontos.length === 1 ? 0.1 : 0), ultimo[1] * a);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Foto ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const TAMANHO_MAXIMO_DA_FOTO = 3 * 1024 * 1024;

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob | null> {
  return new Promise((pronto) => canvas.toBlob((b) => pronto(b), tipo, qualidade));
}

/** A foto final: 1080 × 1920, WEBP (JPEG onde o navegador não faz WEBP), até 3 MB. Erro "grande" se não couber. */
export async function comporFoto(p: { fundo: string; imagem?: Blob | null; filtro: FiltroDoStory; transformacao: Transformacao; tracos: readonly TracoDoStory[] }): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("invalida");
  let bitmap: ImageBitmap | null = null;
  if (p.imagem) {
    try {
      bitmap = await createImageBitmap(p.imagem, { imageOrientation: "from-image" });
    } catch {
      throw new Error("invalida");
    }
  }
  desenharQuadro(ctx, 1080, 1920, { fundo: p.fundo, fonte: bitmap, filtro: p.filtro, transformacao: p.transformacao, tracos: p.tracos });
  bitmap?.close();
  for (const q of [0.88, 0.78, 0.66, 0.52]) {
    const b = (await paraBlob(canvas, "image/webp", q)) ?? (await paraBlob(canvas, "image/jpeg", q));
    if (b && b.size <= TAMANHO_MAXIMO_DA_FOTO) return b;
  }
  throw new Error("grande");
}

/** Um quadro da câmera (o que está no visor agora) como imagem crua, para o editor (sai do aparelho só depois de recomposta). */
export async function fotoDoVideo(video: HTMLVideoElement, espelhar: boolean): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const [l, a] = [video.videoWidth || 720, video.videoHeight || 1280];
  canvas.width = l;
  canvas.height = a;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("invalida");
  if (espelhar) {
    ctx.translate(l, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, l, a);
  const b = (await paraBlob(canvas, "image/webp", 0.95)) ?? (await paraBlob(canvas, "image/jpeg", 0.95));
  if (!b) throw new Error("invalida");
  return b;
}

// ── Vídeo: ler, miniaturas e regravar ────────────────────────────────────────────────────────────────────────────────────
export const TIPOS_DE_VIDEO_ACEITOS = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/3gpp"] as const;
/** O arquivo original pode ser grande (a regravação encolhe): até 500 MB. */
export const VIDEO_ORIGINAL_MAXIMO = 500 * 1024 * 1024;

export interface InfoDoVideo {
  duracao: number;
  largura: number;
  altura: number;
}

function esperarEvento(alvo: EventTarget, nome: string, erro = "error", ms = 15_000): Promise<void> {
  return new Promise((pronto, falhou) => {
    const fim = () => {
      alvo.removeEventListener(nome, ok);
      alvo.removeEventListener(erro, ruim);
      window.clearTimeout(relogioId);
    };
    const ok = () => {
      fim();
      pronto();
    };
    const ruim = () => {
      fim();
      falhou(new Error("invalida"));
    };
    const relogioId = window.setTimeout(ruim, ms);
    alvo.addEventListener(nome, ok, { once: true });
    alvo.addEventListener(erro, ruim, { once: true });
  });
}

function videoEscondido(url: string): HTMLVideoElement {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.crossOrigin = "anonymous";
  v.src = url;
  return v;
}

/** Lê duração e medida de um vídeo (do aparelho). Erro "invalida" se o navegador não abre. */
export async function lerVideo(url: string): Promise<InfoDoVideo> {
  const v = videoEscondido(url);
  await esperarEvento(v, "loadedmetadata");
  let duracao = v.duration;
  // O WEBM do gravador às vezes diz "Infinity" até ser percorrido.
  if (!Number.isFinite(duracao)) {
    v.currentTime = 1e7;
    await esperarEvento(v, "timeupdate").catch(() => undefined);
    duracao = v.duration;
    v.currentTime = 0;
  }
  const info = { duracao: Math.round((Number.isFinite(duracao) ? duracao : 0) * 1000), largura: v.videoWidth, altura: v.videoHeight };
  v.removeAttribute("src");
  v.load();
  if (!(info.duracao > 0)) throw new Error("invalida");
  return info;
}

/** Miniaturas para a tira do corte (n quadros espalhados), como endereços locais de imagem. Melhor esforço: falha = lista vazia. */
export async function miniaturasDoVideo(url: string, duracaoMs: number, n = 8, altura = 64): Promise<string[]> {
  try {
    const v = videoEscondido(url);
    await esperarEvento(v, "loadeddata");
    const canvas = document.createElement("canvas");
    const l = Math.max(1, Math.round((altura * (v.videoWidth || 9)) / (v.videoHeight || 16)));
    canvas.width = l;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    const saida: string[] = [];
    for (let k = 0; k < n; k++) {
      v.currentTime = ((k + 0.5) / n) * (duracaoMs / 1000);
      await esperarEvento(v, "seeked", "error", 4000);
      ctx.drawImage(v, 0, 0, l, altura);
      const b = await paraBlob(canvas, "image/webp", 0.6);
      if (b) saida.push(URL.createObjectURL(b));
    }
    v.removeAttribute("src");
    v.load();
    return saida;
  } catch {
    return [];
  }
}

/** O vídeo pronto para enviar. */
export interface VideoPronto {
  blob: Blob;
  tipo: string;
  duracao: number;
  som: boolean;
}

/**
 * Regrava o vídeo no aparelho: o trecho [inicio, fim], na tela 720 × 1280, com o filtro, o giro/zoom e o desenho queimados; com
 * ou sem som; taxa limitada (taxaDoVideo). Roda em tempo real (o vídeo toca escondido, sem som na caixa de som). O arquivo que sai
 * é só o que o gravador escreve: nenhum metadado do original passa. Erros: "sem_gravador", "invalida", "grande", "cancelado".
 */
export async function regravarVideo(p: {
  url: string;
  inicio: number;
  fim: number;
  som: boolean;
  fundo: string;
  filtro: FiltroDoStory;
  transformacao: Transformacao;
  tracos: readonly TracoDoStory[];
  aoProgresso?: (fracao: number) => void;
  sinal?: AbortSignal;
}): Promise<VideoPronto> {
  if (typeof MediaRecorder === "undefined") throw new Error("sem_gravador");
  const tipo = escolherFormatoDeVideo((t) => MediaRecorder.isTypeSupported(t));
  if (!tipo) throw new Error("sem_gravador");
  const { largura: L, altura: A } = TELA_DO_VIDEO;
  const canvas = document.createElement("canvas");
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx || !("captureStream" in canvas)) throw new Error("sem_gravador");

  const video = videoEscondido(p.url);
  video.muted = !p.som;
  await esperarEvento(video, "loadeddata");
  const trecho = cortarTrecho(p.inicio, p.fim, Math.round(video.duration * 1000) || p.fim);
  const duracao = trecho.fim - trecho.inicio;

  const fluxo = canvas.captureStream(30);
  let audio: AudioContext | null = null;
  if (p.som) {
    try {
      audio = new AudioContext();
      const origem = audio.createMediaElementSource(video);
      const destino = audio.createMediaStreamDestination();
      origem.connect(destino); // só para o gravador: nada toca na caixa de som
      for (const faixa of destino.stream.getAudioTracks()) fluxo.addTrack(faixa);
      video.muted = false;
    } catch {
      audio = null;
      video.muted = true;
    }
  }
  const comSom = fluxo.getAudioTracks().length > 0;
  const gravador = new MediaRecorder(fluxo, {
    mimeType: tipo,
    videoBitsPerSecond: taxaDoVideo(duracao, comSom),
    ...(comSom ? { audioBitsPerSecond: TAXA_DO_AUDIO } : {}),
  });
  const partes: Blob[] = [];
  gravador.ondataavailable = (e) => {
    if (e.data.size) partes.push(e.data);
  };

  video.currentTime = trecho.inicio / 1000;
  await esperarEvento(video, "seeked");
  const desenhar = () => desenharQuadro(ctx, L, A, { fundo: p.fundo, fonte: video, filtro: p.filtro, transformacao: p.transformacao, tracos: p.tracos });
  desenhar();

  let quadro = 0;
  const parar = new Promise<void>((pronto) => {
    gravador.onstop = () => pronto();
  });
  let cancelado = false;
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
    // Sem permissão de tocar com som (raro, a pessoa tocou em "Publicar"): tenta mudo.
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
  await parar;
  fluxo.getTracks().forEach((f) => f.stop());
  await audio?.close().catch(() => undefined);
  video.removeAttribute("src");
  video.load();
  if (cancelado) throw new Error("cancelado");
  const blob = new Blob(partes, { type: tipo.split(";")[0] });
  if (blob.size === 0) throw new Error("invalida");
  if (blob.size > LIMITES_DO_STORY.videoBytes) throw new Error("grande");
  p.aoProgresso?.(1);
  return { blob, tipo: blob.type, duracao, som: comSom };
}

// ── Câmera ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Abre a câmera (frente ou trás) em até 720p, com o microfone se pedido. Erros: "sem_camera", "negada". */
export async function abrirCamera(frente: boolean, microfone: boolean): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error("sem_camera");
  const video: MediaTrackConstraints = { facingMode: frente ? "user" : "environment", width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 }, frameRate: { ideal: 30, max: 30 } };
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: microfone ? { echoCancellation: true, noiseSuppression: true } : false });
  } catch (e) {
    const nome = e instanceof DOMException ? e.name : "";
    if (nome === "NotAllowedError" || nome === "SecurityError") throw new Error("negada");
    // Sem microfone (ou ocupado): tenta só a imagem.
    if (microfone) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch {
        /* cai abaixo */
      }
    }
    throw new Error("sem_camera");
  }
}

/** Grava a câmera direto (o arquivo vai para o editor e é regravado de novo antes de sair). Para com `parar()`. */
export function gravarCamera(fluxo: MediaStream): { parar: () => Promise<Blob>; cancelar: () => void } {
  const tipo = escolherFormatoDeVideo((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const g = new MediaRecorder(fluxo, tipo ? { mimeType: tipo, videoBitsPerSecond: 4_000_000 } : undefined);
  const partes: Blob[] = [];
  g.ondataavailable = (e) => {
    if (e.data.size) partes.push(e.data);
  };
  g.start(500);
  const fim = new Promise<Blob>((pronto) => {
    g.onstop = () => pronto(new Blob(partes, { type: (tipo || g.mimeType || "video/webm").split(";")[0] }));
  });
  return {
    parar: () => {
      if (g.state !== "inactive") g.stop();
      return fim;
    },
    cancelar: () => {
      if (g.state !== "inactive") g.stop();
    },
  };
}

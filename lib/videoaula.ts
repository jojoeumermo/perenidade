// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { getClient, signedStorageUrl } from "./backend";

// Aulas em vídeo: até 10 minutos, até 480p e até 50 MB (o limite por arquivo do plano gratuito do serviço).
// Tudo é medido e, se preciso, convertido no próprio navegador de quem envia: o servidor só confere os números.
export const DEPOSITO = "videoaulas";
export const LIMITE_SEGUNDOS = 600;
export const LIMITE_BYTES = 50 * 1024 * 1024;
// 480p: o mesmo limite que o banco confere (854 × 480, em pé ou deitado). Com 1280 aqui, a câmera gravava 1280 × 480
// e o envio voltava sempre com "confira o campo: resolucao".
const LADO_MENOR = 480;
const LADO_MAIOR = 854;
/** Taxa pensada para caber em 50 MB com folga: dez minutos a ~620 kbit/s dão uns 47 MB. */
const TAXA_VIDEO = 560_000;
const TAXA_AUDIO = 64_000;

export interface Medidas {
  duracao: number;
  largura: number;
  altura: number;
}

export interface Formato {
  mime: string;
  tipo: "video/webm" | "video/mp4";
  extensao: "webm" | "mp4";
}

export class VideoErro extends Error {}

/** O primeiro formato que o navegador grava: WebM (Chrome, Firefox, Android) ou MP4 (Safari). */
export function formatoDeGravacao(): Formato | null {
  if (typeof MediaRecorder === "undefined") return null;
  const opcoes: Formato[] = [
    // VP8 antes do VP9: os celulares Android o codificam no próprio chip, e o VP9 do Chrome devolvia gravações vazias
    // em alguns tamanhos de imagem (conferido com a câmera de teste do navegador).
    { mime: "video/webm;codecs=vp8,opus", tipo: "video/webm", extensao: "webm" },
    { mime: "video/webm;codecs=vp9,opus", tipo: "video/webm", extensao: "webm" },
    { mime: "video/webm", tipo: "video/webm", extensao: "webm" },
    { mime: "video/mp4;codecs=avc1,mp4a", tipo: "video/mp4", extensao: "mp4" },
    { mime: "video/mp4", tipo: "video/mp4", extensao: "mp4" },
  ];
  return opcoes.find((opcao) => MediaRecorder.isTypeSupported(opcao.mime)) ?? null;
}

export const opcoesDoGravador = (formato: Formato): MediaRecorderOptions => ({ mimeType: formato.mime, videoBitsPerSecond: TAXA_VIDEO, audioBitsPerSecond: TAXA_AUDIO });

/** A câmera ou a tela já pedidas no limite de 480p, para a gravação nascer no tamanho certo. */
// 848 e não 854: o codificador VP9 do Chrome devolvia a gravação vazia com 854 de largura (conferido com a câmera de teste do
// navegador); 848 é múltiplo de 16 e grava normalmente.
export const restricoesDeVideo = { width: { ideal: 848, max: LADO_MAIOR }, height: { ideal: LADO_MENOR, max: LADO_MENOR }, frameRate: { ideal: 24, max: 30 } };

/**
 * Duração e tamanho da imagem de um vídeo. Gravações feitas no navegador costumam vir sem a duração no
 * cabeçalho ("Infinity"): pular para o fim obriga o navegador a calcular.
 */
export function medir(arquivo: Blob): Promise<Medidas> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const endereco = URL.createObjectURL(arquivo);
    const fim = (erro?: Error) => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(endereco);
      if (erro) reject(erro);
    };
    const pronto = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return false;
      resolve({ duracao: Math.ceil(video.duration), largura: video.videoWidth, altura: video.videoHeight });
      fim();
      return true;
    };
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      if (pronto()) return;
      video.ondurationchange = () => void pronto();
      video.currentTime = Number.MAX_SAFE_INTEGER;
    };
    video.onerror = () => fim(new VideoErro("formato"));
    video.src = endereco;
  });
}

/** Cabe nas regras do instituto? */
export const cabe = (m: Medidas) => m.duracao <= LIMITE_SEGUNDOS && Math.min(m.largura, m.altura) <= LADO_MENOR && Math.max(m.largura, m.altura) <= LADO_MAIOR;

/**
 * Converte um vídeo maior que 480p, no próprio navegador: toca o vídeo uma vez, redesenha cada quadro num tamanho
 * menor e grava de novo. Leva o mesmo tempo que o vídeo dura. O som vai só para a gravação, não para os alto-falantes.
 */
export async function converterPara720p(arquivo: Blob, aoAndar: (fracao: number) => void, sinal: AbortSignal): Promise<{ blob: Blob; formato: Formato }> {
  const formato = formatoDeGravacao();
  if (!formato) throw new VideoErro("sem_gravador");
  const medidas = await medir(arquivo);
  if (medidas.duracao > LIMITE_SEGUNDOS) throw new VideoErro("longo");
  const escala = Math.min(1, LADO_MENOR / Math.min(medidas.largura, medidas.altura), LADO_MAIOR / Math.max(medidas.largura, medidas.altura));
  // Múltiplos de 8, arredondados para baixo: o codificador grava normalmente e o resultado nunca passa do limite.
  const largura = Math.max(8, Math.floor((medidas.largura * escala) / 8) * 8);
  const altura = Math.max(8, Math.floor((medidas.altura * escala) / 8) * 8);

  const video = document.createElement("video");
  const endereco = URL.createObjectURL(arquivo);
  video.src = endereco;
  video.playsInline = true;
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const pincel = tela.getContext("2d");
  if (!pincel) throw new VideoErro("sem_gravador");

  const audio = new AudioContext();
  const origem = audio.createMediaElementSource(video);
  const destino = audio.createMediaStreamDestination();
  origem.connect(destino);
  const fluxo = new MediaStream([...tela.captureStream(24).getVideoTracks(), ...destino.stream.getAudioTracks()]);
  const gravador = new MediaRecorder(fluxo, opcoesDoGravador(formato));
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (evento) => {
    if (evento.data.size > 0) pedacos.push(evento.data);
  };

  const terminou = new Promise<void>((resolve, reject) => {
    gravador.onstop = () => resolve();
    video.onerror = () => reject(new VideoErro("formato"));
    sinal.addEventListener("abort", () => {
      video.pause();
      if (gravador.state !== "inactive") gravador.stop();
      reject(new VideoErro("cancelado"));
    });
  });
  const desenhar = () => {
    pincel.drawImage(video, 0, 0, largura, altura);
    aoAndar(Math.min(1, video.currentTime / medidas.duracao));
    if (!video.ended && !video.paused) requestAnimationFrame(desenhar);
  };
  video.onended = () => {
    if (gravador.state !== "inactive") gravador.stop();
  };
  try {
    await new Promise<void>((resolve) => {
      video.oncanplay = () => resolve();
      video.load();
    });
    gravador.start(1000);
    await video.play();
    requestAnimationFrame(desenhar);
    await terminou;
  } finally {
    URL.revokeObjectURL(endereco);
    fluxo.getTracks().forEach((faixa) => faixa.stop());
    void audio.close();
  }
  aoAndar(1);
  return { blob: new Blob(pedacos, { type: formato.tipo }), formato };
}

/** Sobe o arquivo para a pasta da própria pessoa no depósito e devolve o caminho. */
export async function enviarVideo(blob: Blob, formato: Formato): Promise<string> {
  if (blob.size > LIMITE_BYTES) throw new VideoErro("pesado");
  const supabase = await getClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new VideoErro("sessao");
  const caminho = `${data.user.id}/${crypto.randomUUID()}.${formato.extensao}`;
  const { error } = await supabase.storage.from(DEPOSITO).upload(caminho, blob, { contentType: formato.tipo, upsert: false });
  if (error) throw new VideoErro("envio");
  return caminho;
}

export async function apagarVideo(caminho: string): Promise<void> {
  const supabase = await getClient();
  await supabase.storage.from(DEPOSITO).remove([caminho]);
}

/** Endereço para tocar: assinado, vale seis horas. */
export const enderecoDoVideo = (caminho: string) => signedStorageUrl(DEPOSITO, caminho, 6 * 3600);

export const mensagensDeVideo: Record<string, string> = {
  formato: "Este arquivo não é um vídeo que o navegador consiga abrir. Use MP4 ou WebM.",
  longo: "O vídeo passa de 10 minutos. Corte antes de enviar ou divida em duas aulas.",
  pesado: "O vídeo passou de 50 MB. Grave de novo com menos movimento na imagem, ou divida em duas aulas.",
  sem_gravador: "Este navegador não grava vídeo. Use um navegador recente, como o Chrome ou o Firefox.",
  sessao: "Entre na sua conta de novo para enviar.",
  envio: "O envio não foi aceito. Só quem ensina pode enviar aulas em vídeo.",
  cancelado: "Conversão cancelada.",
};

/** "3:07" */
export const relogio = (segundos: number) => `${Math.floor(segundos / 60)}:${String(Math.floor(segundos % 60)).padStart(2, "0")}`;

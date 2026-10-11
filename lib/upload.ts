// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { getClient } from "./backend";

const BUCKET = "envios";
const MAX_SIDE = 1600;
const MAX_BYTES = 8 * 1024 * 1024;

export class UploadError extends Error {}

/**
 * Redesenha a imagem no navegador antes de enviar. Só os pontos da imagem passam: tudo o que a câmera
 * ou o programa de edição embutiu no arquivo (local da foto, modelo do aparelho, nome do autor, data)
 * fica para trás. De quebra, a imagem sai menor e mais leve para internet lenta.
 */
export async function cleanImage(file: File): Promise<{ blob: Blob; extension: "webp" | "jpg" }> {
  if (!/^image\/(jpeg|png|webp|gif|bmp)$/.test(file.type)) throw new UploadError("formato");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UploadError("formato");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const pen = canvas.getContext("2d");
  if (!pen) throw new UploadError("formato");
  // Fundo branco: imagem com transparência não vira um borrão preto ao ser convertida.
  pen.fillStyle = "#fff";
  pen.fillRect(0, 0, canvas.width, canvas.height);
  pen.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.82);
  if (webp && webp.type === "image/webp") return { blob: webp, extension: "webp" };
  // Navegador que não grava WebP: JPEG, que todos gravam.
  const jpeg = await encode("image/jpeg", 0.85);
  if (!jpeg) throw new UploadError("formato");
  return { blob: jpeg, extension: "jpg" };
}

/** Nome sorteado: o nome original do arquivo (que costuma dizer de quem é) não sai do aparelho. */
const randomName = () => `a-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

/** Envia para a pasta da própria pessoa no depósito fechado e devolve o caminho ("<id>/<nome>.<ext>"). */
export async function sendFile(blob: Blob, extension: "webp" | "jpg" | "pdf"): Promise<string> {
  if (blob.size > MAX_BYTES) throw new UploadError("tamanho");
  const supabase = await getClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new UploadError("sessao");
  const path = `${data.user.id}/${randomName()}.${extension}`;
  const contentType = extension === "pdf" ? "application/pdf" : extension === "jpg" ? "image/jpeg" : "image/webp";
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: false });
  if (error) throw new UploadError("envio");
  return path;
}

/** Para a equipe ver, no painel, uma imagem que ainda não foi publicada. Devolve um endereço local temporário. */
export async function previewFile(path: string): Promise<string> {
  const supabase = await getClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new UploadError("leitura");
  return URL.createObjectURL(data);
}

export const uploadMessages: Record<string, string> = {
  formato: "Este arquivo não é uma imagem que o navegador consiga abrir (use JPG, PNG ou WebP).",
  tamanho: "O arquivo passa de 8 MB.",
  sessao: "Entre na sua conta de novo para enviar.",
  envio: "O envio não foi aceito. Só a equipe que escreve ou diagrama pode enviar arquivos.",
  leitura: "Não foi possível abrir o arquivo.",
};

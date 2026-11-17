// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { fotoAceitavel, LADO_DA_FOTO, LIMITE_DA_FOTO, PESO_MAXIMO_DO_ARQUIVO, quadroDoRecorte, tipoDeFotoAceito, type Recorte } from "@/lib/rede/identidade";
import { limparImagem } from "@/lib/rede/publicar/midia";

export type ErroDaFoto = "tipo" | "peso" | "abrir" | "gravar";

/**
 * Abre o arquivo que a pessoa escolheu, SEM enviar nada: confere o tipo (JPG, PNG, WebP ou AVIF) e o peso (até 12 MB) e decodifica
 * os pixels aqui no aparelho, já na orientação certa (a rotação que a câmera anota é aplicada e a anotação fica para trás).
 */
export async function abrirFoto(arquivo: File): Promise<{ bitmap: ImageBitmap } | { erro: ErroDaFoto }> {
  if (!tipoDeFotoAceito(arquivo.type)) return { erro: "tipo" };
  if (arquivo.size > PESO_MAXIMO_DO_ARQUIVO) return { erro: "peso" };
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap || bitmap.width < 2 || bitmap.height < 2) {
    bitmap?.close();
    return { erro: "abrir" };
  }
  return { bitmap };
}

/** Desenha o recorte da foto num canvas quadrado (para ver na tela ou para gravar). */
export function desenharRecorte(canvas: HTMLCanvasElement, bitmap: ImageBitmap, recorte: Recorte, lado: number): boolean {
  canvas.width = lado;
  canvas.height = lado;
  const contexto = canvas.getContext("2d");
  if (!contexto) return false;
  const q = quadroDoRecorte(bitmap.width, bitmap.height, recorte);
  // Fundo opaco: PNG com transparência não vira buraco preto.
  contexto.fillStyle = "#f3efe6";
  contexto.fillRect(0, 0, lado, lado);
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(bitmap, q.sx, q.sy, q.lado, q.lado, 0, 0, lado, lado);
  return true;
}

/**
 * O WebP que o canvas grava, sem os blocos de metadado. Chrome e Edge põem o perfil de cor da tela (bloco ICCP) em todo WebP do
 * canvas; o banco recusa esse bloco (interno.rede3_perfil_webp_ok), então ele sai aqui com a mesma limpeza das mídias dos posts.
 */
function webpLimpo(dados: string): string | null {
  try {
    const binario = atob(dados.slice(23));
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    const limpo = limparImagem(bytes);
    if (!limpo) return null;
    let saida = "";
    for (let i = 0; i < limpo.length; i += 0x8000) saida += String.fromCharCode(...limpo.subarray(i, i + 0x8000));
    return `data:image/webp;base64,${btoa(saida)}`;
  } catch {
    return null;
  }
}

/**
 * Grava o recorte em WebP de 240 × 240, aqui no aparelho. O canvas só leva os pixels: EXIF, GPS, modelo da câmera e data ficam
 * para trás, e o perfil de cor que o navegador acrescenta é tirado (webpLimpo). A qualidade desce até caber no limite do banco, e
 * os bytes são conferidos (fotoAceitavel) antes de a tela aceitar: se o navegador não gravar WebP (Safari antigo grava PNG),
 * devolve nulo e nada é enviado.
 */
export function gravarFoto(bitmap: ImageBitmap, recorte: Recorte): string | null {
  const canvas = document.createElement("canvas");
  if (!desenharRecorte(canvas, bitmap, recorte, LADO_DA_FOTO)) return null;
  for (const qualidade of [0.86, 0.78, 0.68, 0.55, 0.42]) {
    const bruto = canvas.toDataURL("image/webp", qualidade);
    if (!bruto.startsWith("data:image/webp;base64,")) return null;
    const dados = webpLimpo(bruto);
    if (!dados) return null;
    if (dados.length <= LIMITE_DA_FOTO) return fotoAceitavel(dados) ? dados : null;
  }
  return null;
}

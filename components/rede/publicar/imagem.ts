// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Imagens no navegador (pacote publicar): reencoda no canvas (o que sai do canvas não leva EXIF, GPS, modelo do aparelho nem
// miniatura), reduz o tamanho e, se a pessoa quiser, borra rostos. Para achar rostos usa o FaceDetector do próprio navegador
// quando existe (Chrome/Android com o recurso ligado); onde não existe, a pessoa desenha à mão um retângulo sobre cada rosto.
// Não carregamos modelo de rosto nenhum: nenhum modelo aberto pequeno com licença livre que valha o peso no 3G (e um falso
// negativo, rosto que a máquina não achou, passaria como se estivesse protegido); o desenho à mão deixa a decisão com a pessoa.
// A trava de verdade está no servidor, que tira o metadado de novo (lib/rede/publicar/midia.ts).

/** Uma área a borrar, em fração da imagem (0 a 1). */
export interface AreaBorrada {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const LADO_MAXIMO = 1600;
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const ENTRADA_MAXIMA = 25 * 1024 * 1024;

export class ErroDeImagem extends Error {
  constructor(public codigo: "invalida" | "grande") {
    super(codigo);
  }
}

async function decodificar(origem: Blob): Promise<ImageBitmap> {
  try {
    // "from-image": respeita a rotação do EXIF antes de o EXIF sumir (senão a foto sairia deitada).
    return await createImageBitmap(origem, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(origem);
  }
}

function paraBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === "image/webp") return resolve(webp);
        canvas.toBlob((jpg) => (jpg ? resolve(jpg) : reject(new ErroDeImagem("invalida"))), "image/jpeg", 0.86);
      },
      "image/webp",
      0.86,
    );
  });
}

/** Lê a imagem escolhida, reduz para no máximo 1600 px e reencoda sem metadado. */
export async function prepararImagem(arquivo: File): Promise<{ blob: Blob; largura: number; altura: number }> {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) throw new ErroDeImagem("invalida");
  if (arquivo.size > ENTRADA_MAXIMA) throw new ErroDeImagem("grande");
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodificar(arquivo);
  } catch {
    throw new ErroDeImagem("invalida");
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ErroDeImagem("invalida");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close?.();
  const blob = await paraBlob(canvas);
  return { blob, largura, altura };
}

/** Borra (pixeliza forte) as áreas na imagem-base e devolve a imagem nova; a base não é alterada (dá para refazer). */
export async function aplicarBorrado(base: Blob, areas: AreaBorrada[]): Promise<Blob> {
  if (!areas.length) return base;
  const bitmap = await decodificar(base);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ErroDeImagem("invalida");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  for (const a of areas) {
    const x = Math.max(0, Math.floor(a.x * canvas.width));
    const y = Math.max(0, Math.floor(a.y * canvas.height));
    const w = Math.min(canvas.width - x, Math.ceil(a.w * canvas.width));
    const h = Math.min(canvas.height - y, Math.ceil(a.h * canvas.height));
    if (w < 2 || h < 2) continue;
    // Poucos blocos por rosto (cerca de 5): não dá para recuperar o rosto, nem com programa.
    const bloco = Math.max(6, Math.round(Math.max(w, h) / 5));
    const pequeno = document.createElement("canvas");
    pequeno.width = Math.max(1, Math.ceil(w / bloco));
    pequeno.height = Math.max(1, Math.ceil(h / bloco));
    const pctx = pequeno.getContext("2d");
    if (!pctx) continue;
    pctx.drawImage(canvas, x, y, w, h, 0, 0, pequeno.width, pequeno.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pequeno, 0, 0, pequeno.width, pequeno.height, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
  }
  return paraBlob(canvas);
}

interface DetectorDeRostos {
  detect(imagem: ImageBitmap): Promise<{ boundingBox: DOMRectReadOnly }[]>;
}

/** O navegador acha rostos sozinho? (Detecção de rosto do próprio sistema; não é universal.) */
export const temDetectorDeRostos = (): boolean => typeof window !== "undefined" && "FaceDetector" in window;

/** Acha rostos com o detector do navegador e devolve as áreas (com uma folga de 30%). Lista vazia se nada foi achado. */
export async function acharRostos(base: Blob): Promise<AreaBorrada[]> {
  if (!temDetectorDeRostos()) return [];
  const Detector = (window as unknown as { FaceDetector: new (o: { fastMode: boolean; maxDetectedFaces: number }) => DetectorDeRostos }).FaceDetector;
  const bitmap = await decodificar(base);
  try {
    const achados = await new Detector({ fastMode: true, maxDetectedFaces: 12 }).detect(bitmap);
    return achados.map(({ boundingBox: b }) => {
      const folgaX = b.width * 0.3;
      const folgaY = b.height * 0.3;
      const x = Math.max(0, b.x - folgaX);
      const y = Math.max(0, b.y - folgaY);
      return { x: x / bitmap.width, y: y / bitmap.height, w: Math.min(bitmap.width - x, b.width + 2 * folgaX) / bitmap.width, h: Math.min(bitmap.height - y, b.height + 2 * folgaY) / bitmap.height };
    });
  } catch {
    return [];
  } finally {
    bitmap.close?.();
  }
}

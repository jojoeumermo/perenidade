// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A imagem do story é REFEITA no aparelho antes de sair: lida pelo navegador e desenhada de novo num canvas, o que joga fora todo
// metadado do arquivo (EXIF com GPS, modelo da câmera, data). Só sai o desenho, em WEBP, até 1080 × 1920 e até 3 MB
// (PLANO-ALUMIA §5 F5 e §6: nada de GPS; LGPD art. 6º, III, necessidade). O banco confere o tamanho de novo.

export const TAMANHO_MAXIMO_DA_IMAGEM = 3 * 1024 * 1024;
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;

/** A medida que cabe em 1080 × 1920 sem esticar (nunca aumenta). Puro. */
export function medidaQueCabe(largura: number, altura: number, maxL = 1080, maxA = 1920): { largura: number; altura: number } {
  if (!(largura > 0 && altura > 0)) return { largura: 0, altura: 0 };
  const escala = Math.min(1, maxL / largura, maxA / altura);
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

function paraBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob | null> {
  return new Promise((pronto) => canvas.toBlob((b) => pronto(b), "image/webp", qualidade));
}

/** Tenta qualidades cada vez menores até caber em 3 MB. Erro "grande" se não couber. */
async function comprimir(canvas: HTMLCanvasElement): Promise<Blob> {
  for (const q of [0.86, 0.75, 0.62, 0.5]) {
    const b = await paraBlob(canvas, q);
    if (b && b.size <= TAMANHO_MAXIMO_DA_IMAGEM) return b;
  }
  throw new Error("grande");
}

/** Refaz uma imagem escolhida na galeria: sem metadado, no máximo 1080 × 1920, WEBP. Erro "invalida" ou "grande". */
export async function refazerImagem(arquivo: Blob): Promise<Blob> {
  if (!(TIPOS_ACEITOS as readonly string[]).includes(arquivo.type)) throw new Error("invalida");
  if (arquivo.size > 25 * 1024 * 1024) throw new Error("grande");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error("invalida");
  }
  const m = medidaQueCabe(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = m.largura;
  canvas.height = m.altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("invalida");
  ctx.drawImage(bitmap, 0, 0, m.largura, m.altura);
  bitmap.close();
  return comprimir(canvas);
}

/** Um traço do "Desenhar": pontos de 0 a 1 (relativos à tela), cor e espessura relativa. */
export interface Traco {
  cor: string;
  pontos: [number, number][];
}

/** Junta o fundo (cor lisa ou a imagem já refeita) e os traços numa imagem 1080 × 1920 em WEBP. */
export async function desenhoEmImagem(fundo: string, tracos: readonly Traco[], imagem?: Blob | null): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("invalida");
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, 1080, 1920);
  if (imagem) {
    const b = await createImageBitmap(imagem);
    const escala = Math.max(1080 / b.width, 1920 / b.height);
    const l = b.width * escala;
    const a = b.height * escala;
    ctx.drawImage(b, (1080 - l) / 2, (1920 - a) / 2, l, a);
    b.close();
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 16;
  for (const t of tracos) {
    if (t.pontos.length === 0) continue;
    ctx.strokeStyle = t.cor;
    ctx.beginPath();
    ctx.moveTo(t.pontos[0][0] * 1080, t.pontos[0][1] * 1920);
    for (const [x, y] of t.pontos.slice(1)) ctx.lineTo(x * 1080, y * 1920);
    if (t.pontos.length === 1) ctx.lineTo(t.pontos[0][0] * 1080 + 0.1, t.pontos[0][1] * 1920);
    ctx.stroke();
  }
  return comprimir(canvas);
}

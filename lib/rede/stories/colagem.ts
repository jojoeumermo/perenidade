// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// P5 (A16): a colagem de várias fotos num quadro do story. As fotos são lidas e REDESENHADAS aqui num canvas em pé (1440 × 2560),
// cada uma cobrindo a sua célula, com uma faixa de cor entre elas: sai uma imagem só, sem metadado nenhum das originais (GPS,
// câmera, data). Depois ela entra no "criar" como a foto do quadro (filtros, ajustes, desenho e figurinhas por cima). A parte das
// células é pura (roda no Node nos testes). Sem "@/".

export const MODELOS_DE_COLAGEM = ["dupla", "lado", "tres", "quatro"] as const;
export type ModeloDeColagem = (typeof MODELOS_DE_COLAGEM)[number];

/** Uma célula, em fração da tela (0 a 1). */
export interface Celula {
  x: number;
  y: number;
  l: number;
  a: number;
}

/** A faixa entre as fotos, em fração da largura. */
export const FAIXA_DA_COLAGEM = 0.012;

/** As células de cada modelo, já descontada a faixa (as bordas também ficam com a faixa). Puro. */
export function celulasDaColagem(modelo: ModeloDeColagem, faixa = FAIXA_DA_COLAGEM): Celula[] {
  const fx = faixa;
  const fy = faixa * (9 / 16);
  const grade = (colunas: number, linhas: number, juntarUltimaLinha = false): Celula[] => {
    const l = (1 - fx * (colunas + 1)) / colunas;
    const a = (1 - fy * (linhas + 1)) / linhas;
    const lista: Celula[] = [];
    for (let j = 0; j < linhas; j++) {
      if (juntarUltimaLinha && j === linhas - 1) {
        lista.push({ x: fx, y: fy + j * (a + fy), l: 1 - 2 * fx, a });
        continue;
      }
      for (let i = 0; i < colunas; i++) lista.push({ x: fx + i * (l + fx), y: fy + j * (a + fy), l, a });
    }
    return lista;
  };
  if (modelo === "dupla") return grade(1, 2);
  if (modelo === "lado") return grade(2, 1);
  if (modelo === "tres") return grade(2, 2, true);
  return grade(2, 2);
}

/** Quantas fotos o modelo pede. Puro. */
export const fotosDoModelo = (modelo: ModeloDeColagem): number => celulasDaColagem(modelo).length;

/** Onde desenhar a foto para cobrir a célula sem esticar (recorta o que sobra, centralizado). Puro. */
export function cobrir(foto: { l: number; a: number }, celula: { l: number; a: number }): { sx: number; sy: number; sl: number; sa: number } {
  const escala = Math.max(celula.l / foto.l, celula.a / foto.a);
  const sl = celula.l / escala;
  const sa = celula.a / escala;
  return { sx: (foto.l - sl) / 2, sy: (foto.a - sa) / 2, sl, sa };
}

/** Monta a colagem (no navegador): uma imagem WEBP de 1440 × 2560, sem metadado. Erro "invalida" se uma foto não abre. */
export async function montarColagem(fotos: readonly Blob[], modelo: ModeloDeColagem, corDaFaixa: string): Promise<Blob> {
  const L = 1440;
  const A = 2560;
  const celulas = celulasDaColagem(modelo);
  if (fotos.length !== celulas.length) throw new Error("invalida");
  const canvas = document.createElement("canvas");
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("invalida");
  ctx.fillStyle = corDaFaixa;
  ctx.fillRect(0, 0, L, A);
  for (let k = 0; k < celulas.length; k++) {
    let b: ImageBitmap;
    try {
      b = await createImageBitmap(fotos[k], { imageOrientation: "from-image" });
    } catch {
      throw new Error("invalida");
    }
    const c = celulas[k];
    const dx = Math.round(c.x * L);
    const dy = Math.round(c.y * A);
    const dl = Math.round(c.l * L);
    const da = Math.round(c.a * A);
    const r = cobrir({ l: b.width, a: b.height }, { l: dl, a: da });
    ctx.drawImage(b, r.sx, r.sy, r.sl, r.sa, dx, dy, dl, da);
    b.close();
  }
  const blob = await new Promise<Blob | null>((pronto) => canvas.toBlob((x) => pronto(x), "image/webp", 0.9));
  if (!blob) throw new Error("invalida");
  return blob;
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";

const W = 1080;
const H = 1350;
const MARGIN = 84;

/** Quebra o texto em linhas que cabem na largura dada. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Escreve o bloco com a maior letra (entre max e min) que caiba na altura disponível. */
function block(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, top: number, height: number, max: number, min: number, leading: number): number {
  for (let size = max; size >= min; size -= 2) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, W - MARGIN * 2);
    if (lines.length * size * leading <= height || size === min) {
      lines.forEach((line, i) => ctx.fillText(line, MARGIN, top + (i + 1) * size * leading - size * 0.25));
      return top + lines.length * size * leading;
    }
  }
  return top;
}

/**
 * Desenha o cartão de debate em uma imagem de 1080 × 1350 (o formato vertical das redes sociais) e entrega
 * o arquivo para baixar. Tudo é feito no aparelho: nada é enviado a lugar nenhum.
 */
export function CardImage({ claim, answer, labels, file }: { claim: string; answer: string; labels: { claim: string; answer: string; button: string; site: string; kicker: string }; file: string }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const serif = (size: number, weight = 600) => `${weight} ${size}px Georgia, "Times New Roman", serif`;
      const sans = (size: number, weight = 800) => `${weight} ${size}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = "#f4ecd8";
      ctx.fillRect(0, 0, W, H);
      // Faixa do alto, no vermelho da imprensa operária.
      ctx.fillStyle = "#c21f17";
      ctx.fillRect(0, 0, W, 150);
      ctx.fillStyle = "#fff";
      ctx.font = `italic ${sans(52, 900)}`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(labels.kicker.toUpperCase(), MARGIN, 98);
      // A frase feita.
      ctx.fillStyle = "#8a6d1c";
      ctx.font = sans(28);
      ctx.fillText(labels.claim.toUpperCase(), MARGIN, 232);
      ctx.fillStyle = "#1f1a14";
      let y = block(ctx, `“${claim}”`, (size) => serif(size, 700), 250, 300, 68, 44, 1.18);
      // A resposta.
      y += 56;
      ctx.fillStyle = "#1f1a14";
      ctx.fillRect(MARGIN, y - 30, 120, 8);
      ctx.fillStyle = "#8a6d1c";
      ctx.font = sans(28);
      ctx.fillText(labels.answer.toUpperCase(), MARGIN, y + 34);
      ctx.fillStyle = "#1f1a14";
      block(ctx, answer, (size) => serif(size, 400), y + 56, H - 190 - (y + 56), 46, 28, 1.32);
      // O rodapé: de onde veio.
      ctx.fillStyle = "#1f1a14";
      ctx.fillRect(0, H - 130, W, 130);
      ctx.fillStyle = "#f4ecd8";
      ctx.font = serif(40, 600);
      ctx.fillText("Instituto Lúcia", MARGIN, H - 52);
      ctx.font = `500 26px ui-monospace, Menlo, Consolas, monospace`;
      const width = ctx.measureText(labels.site).width;
      ctx.fillText(labels.site, W - MARGIN - width, H - 56);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${file}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={() => void download()} disabled={busy} className="cursor-pointer underline hover:text-oxblood disabled:opacity-50">
      {labels.button}
    </button>
  );
}

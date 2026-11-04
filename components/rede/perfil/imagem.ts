// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { LIMITE_AVATAR, LIMITE_CAPA } from "@/lib/rede/perfil";

/**
 * Prepara uma foto para o perfil, aqui no aparelho: lê o arquivo, desenha num canvas (o canvas só leva os pixels: EXIF, GPS, modelo
 * da câmera e data ficam para trás), recorta (quadrado no rosto, 3 por 1 na capa), reduz e grava em WebP. O banco confere os bytes
 * de novo (sem EXIF, XMP, perfil de cor nem animação). Devolve `null` se o navegador não sabe gravar WebP (Safari antigo grava PNG):
 * a tela então manda escolher da galeria. Nada é enviado antes de a pessoa confirmar.
 */
export async function prepararImagem(arquivo: File, tipo: "avatar" | "capa"): Promise<string | null> {
  if (!/^image\/(jpeg|png|webp|gif|avif)$/i.test(arquivo.type)) return null;
  if (arquivo.size > 12 * 1024 * 1024) return null;
  const bitmap = await createImageBitmap(arquivo).catch(() => null);
  if (!bitmap) return null;
  const [largura, altura] = tipo === "avatar" ? [160, 160] : [900, 300];
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) {
    bitmap.close();
    return null;
  }
  // Recorte "cobrir": preenche a caixa inteira sem esticar.
  const escala = Math.max(largura / bitmap.width, altura / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  contexto.fillStyle = "#f4ecd8";
  contexto.fillRect(0, 0, largura, altura);
  contexto.drawImage(bitmap, (largura - w) / 2, (altura - h) / 2, w, h);
  bitmap.close();
  const limite = tipo === "avatar" ? LIMITE_AVATAR : LIMITE_CAPA;
  // Qualidade desce até caber no que o banco aceita.
  for (const qualidade of [0.82, 0.7, 0.55, 0.4]) {
    const dados = canvas.toDataURL("image/webp", qualidade);
    if (!dados.startsWith("data:image/webp;base64,")) return null;
    if (dados.length <= limite) return dados;
  }
  return null;
}

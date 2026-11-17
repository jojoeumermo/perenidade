// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os dados de EXEMPLO do compositor da onda 12 (12A), só para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): o carrossel, a colagem, a
// figurinha e o cartão do link aparecem em posts de exemplo que já existem (os ids "exemplo-…" de ./exemplos-alumia2.ts), sem mudar
// quantos são. As "fotos" são desenhos feitos aqui (ladrilhos nas cores da faixa, em SVG): nenhuma imagem de fora, nenhum endereço
// de fora. Sem "@/" de propósito.
import type { MidiaDoPost } from "../tipos";
import type { PreviaDoPost } from "../tipos-publicar";
import type { EscolhasDoPost } from "./cliente-compositor";

const CORES = ["#c21f16", "#f0b323", "#23408e", "#2e6b4f", "#e4577f", "#ea7a24", "#1f8a85", "#f3efe6"];

/** Uma "foto" de exemplo: ladrilhos que lembram a arquibancada, diferentes para cada número. */
export function imagemDeExemplo(semente: number, largura = 800, altura = 600): string {
  const colunas = 8;
  const linhas = 6;
  const w = largura / colunas;
  const h = altura / linhas;
  let r = (semente * 9301 + 49297) % 233280;
  const sorte = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const casas: string[] = [];
  for (let y = 0; y < linhas; y++)
    for (let x = 0; x < colunas; x++) {
      const cor = CORES[Math.floor(sorte() * CORES.length)];
      casas.push(`<rect x="${(x * w).toFixed(1)}" y="${(y * h).toFixed(1)}" width="${(w - 4).toFixed(1)}" height="${(h - 4).toFixed(1)}" rx="6" fill="${cor}"/>`);
    }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}"><rect width="100%" height="100%" fill="#0f0e0d"/>${casas.join("")}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const midia = (prefixo: string, n: number, alts: string[], formato: [number, number] = [800, 600]): MidiaDoPost[] =>
  Array.from({ length: n }, (_, i) => ({ id: `exemplo-${prefixo}-${i + 1}`, alt: alts[i] ?? alts[0], largura: formato[0], altura: formato[1], blurhash: null }));

/** O número da "foto" de exemplo pelo id ("exemplo-ocupacao-3" → um desenho próprio). Nulo se não é de exemplo. */
export function sementeDoExemplo(id: string): number | null {
  if (!id.startsWith("exemplo-")) return null;
  let s = 0;
  for (const c of id) s = (s * 31 + c.charCodeAt(0)) % 100_000;
  return s;
}

export interface ExemploDoCompositor {
  midia?: MidiaDoPost[];
  escolhas?: EscolhasDoPost;
  previa?: PreviaDoPost;
}

/** O que cada post de exemplo ganha na prévia (os textos de exemplo ficam em português, como os das pranchas). */
export const EXEMPLOS_DO_COMPOSITOR: Record<string, ExemploDoCompositor> = {
  "exemplo-ocupacao": {
    midia: midia("ocupacao", 5, ["A porta da ocupação Esperança de manhã", "Famílias na assembleia do pátio", "A faixa da ocupação na janela", "A cozinha coletiva", "Crianças no mutirão de pintura"]),
    escolhas: {
      arranjo: "carrossel",
      legendas: {
        "exemplo-ocupacao-1": "Segunda, 6h: a porta precisa de gente.",
        "exemplo-ocupacao-2": "Assembleia de ontem: 140 famílias decidiram resistir.",
        "exemplo-ocupacao-3": "A faixa que a juventude pintou no sábado.",
        "exemplo-ocupacao-5": "O mutirão de pintura das crianças.",
      },
    },
  },
  "exemplo-mandata": {
    midia: midia("mandata", 5, ["Plenário da Câmara na votação", "Cartaz contra o reajuste", "Placar da votação, 31 a 18", "Plenária aberta da semana passada", "Panfleto da prestação de contas"]),
    escolhas: { arranjo: "colagem", legendas: { "exemplo-mandata-3": "O placar: 31 a 18." } },
  },
  "exemplo-rosa": { escolhas: { arranjo: "grade", figurinha: "punho" } },
  "exemplo-lia": {
    previa: {
      url: "https://example.org/entregadores-2026",
      dominio: "example.org",
      titulo: "Quanto fica com o aplicativo: o levantamento dos entregadores de 2026",
      descricao: "Planilha aberta com 1.200 corridas de 14 cidades: taxa, distância, tempo de espera e o que sobra para quem entrega.",
      imagem: imagemDeExemplo(77, 1200, 630),
    },
  },
};

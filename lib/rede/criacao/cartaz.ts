// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 36: o estúdio de cartaz e lambe-lambe. O cartaz é desenhado no próprio aparelho num <canvas>, com a identidade da
// organização (as três cores, a fonte e a assinatura gravadas em interno.rede_p4_cc_org_identidade) ou com as cores da Alumia; o
// banco não recebe imagem nenhuma e nada vai a serviço de fora. A medida e a quebra do texto são as da arte do post
// (lib/rede/alcance/arte.ts). O contraste é o do WCAG 2 (a mesma conta de interno.rede_p4_cc_contraste). Sem "@/" de propósito.
import { ajustarTitulo, FAIXA_TECIDA, quebrarEmLinhas } from "../alcance/arte";
import type { Fonte, Identidade } from "./cliente";

export type Modelo = "cartaz" | "lambe" | "quadrado";
export const MODELOS: readonly Modelo[] = ["cartaz", "lambe", "quadrado"];

/** Os tamanhos em pixels: A4 em pé a 150 ppp (cartaz e lambe) e o quadrado das redes. */
export const TAMANHOS_DO_CARTAZ: Record<Modelo, { largura: number; altura: number }> = {
  cartaz: { largura: 1240, altura: 1754 },
  lambe: { largura: 1240, altura: 1754 },
  quadrado: { largura: 1080, altura: 1080 },
};

export const FONTES: readonly Fonte[] = ["archivo", "garamond", "sistema", "mono"];

/** A família de letra de cada fonte da Alumia (o canvas não lê variável de CSS: a tela passa a família resolvida da Archivo). */
export function familiaDaFonte(fonte: Fonte, archivo = "Archivo, 'Archivo Narrow', system-ui, sans-serif"): string {
  switch (fonte) {
    case "garamond":
      return "'EB Garamond', Garamond, Georgia, serif";
    case "mono":
      return "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
    case "sistema":
      return "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    default:
      return archivo;
  }
}

/** A identidade da Alumia, para quem não fala por nenhuma organização (os tokens do tema escuro, styles/alumia-tokens.css). */
export const IDENTIDADE_DA_ALUMIA: Identidade = { fundo: "#0f0e0d", destaque: "#e8321f", texto: "#f3efe6", fonte: "archivo", assinatura: "" };

const COR = /^#[0-9a-f]{6}$/;

/** Luminância relativa de "#rrggbb" (WCAG 2). */
export function luminancia(cor: string): number {
  const c = cor.toLowerCase();
  if (!COR.test(c)) return 0;
  const canal = (i: number) => {
    const v = parseInt(c.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

/** O contraste entre duas cores (de 1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** O mínimo do WCAG AA para texto. */
export const CONTRASTE_MINIMO = 4.5;

/**
 * O que o banco recusaria nesta identidade (os mesmos códigos de rede_p4_cc_org_identidade_salvar), ou nulo. A tela confere antes de
 * mandar, e o banco confere de novo.
 */
export function erroDaIdentidade(i: Identidade): string | null {
  const [f, d, t] = [i.fundo, i.destaque, i.texto].map((c) => String(c ?? "").toLowerCase());
  if (!COR.test(f) || !COR.test(d) || !COR.test(t)) return "invalido:cor";
  if (!FONTES.includes(i.fonte)) return "invalido:fonte";
  if ((i.assinatura ?? "").length > 80) return "invalido:assinatura";
  if (/(https?:\/\/|www\.)/i.test(i.assinatura ?? "")) return "invalido:assinatura";
  if (contraste(t, f) < CONTRASTE_MINIMO) return "invalido:contraste";
  return null;
}

/** A cor (preta ou branca) que dá mais contraste sobre a cor dada: o texto em cima do destaque. */
export function sobre(cor: string): string {
  return contraste(cor, "#0f0e0d") >= contraste(cor, "#ffffff") ? "#0f0e0d" : "#ffffff";
}

/** O que o cartaz mostra. Tudo opcional, menos o título. */
export interface ConteudoDoCartaz {
  chamada: string;
  titulo: string;
  texto: string;
  quando: string;
  onde: string;
  /** A assinatura (a da organização, ou o nome escrito na hora). */
  assinatura: string;
}

type Contexto = CanvasRenderingContext2D & { letterSpacing?: string };

/**
 * Desenha o cartaz no contexto (o canvas já no tamanho do modelo). Cartaz: faixa tecida no alto, chamada, título grande, texto,
 * a tarja do quando e onde no destaque e a assinatura no pé. Lambe-lambe: o título ocupa a folha, em caixa alta, sobre o destaque.
 * Quadrado: o cartaz encolhido para as redes.
 */
export function desenharCartaz(ctx: Contexto, modelo: Modelo, id: Identidade, c: ConteudoDoCartaz, familia: string): void {
  const { largura: L, altura: A } = TAMANHOS_DO_CARTAZ[modelo];
  const M = Math.round(L * 0.075);
  const util = L - 2 * M;
  const letra = (peso: number, tamanho: number) => {
    ctx.font = `${peso} ${tamanho}px ${familia}`;
  };
  const medirEm = (peso: number) => (s: string, tamanho: number) => {
    letra(peso, tamanho);
    return ctx.measureText(s).width;
  };
  const lambe = modelo === "lambe";
  const fundo = lambe ? id.destaque : id.fundo;
  const tinta = lambe ? sobre(id.destaque) : id.texto;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, L, A);

  // A faixa tecida da Alumia no alto (no lambe, a faixa é a moldura de cima e de baixo).
  const faixa = Math.round(A * 0.012);
  const pintarFaixa = (y: number) => {
    const soma = FAIXA_TECIDA.reduce((s, f) => s + f.peso, 0);
    let x = 0;
    for (const f of FAIXA_TECIDA) {
      const w = (f.peso / soma) * L;
      ctx.fillStyle = f.cor;
      ctx.fillRect(Math.floor(x), y, Math.ceil(w) + 1, faixa);
      x += w;
    }
  };
  pintarFaixa(0);
  if (lambe) pintarFaixa(A - faixa);

  let y = faixa + Math.round(M * 0.9);
  // A chamada, pequena, em caixa alta, na cor do destaque.
  if (c.chamada.trim()) {
    const t = Math.round(L * 0.032);
    letra(800, t);
    ctx.fillStyle = lambe ? tinta : id.destaque;
    for (const linha of quebrarEmLinhas(c.chamada.trim().toUpperCase(), (s) => ctx.measureText(s).width, util, 2)) {
      y += t;
      ctx.fillText(linha, M, y);
      y += Math.round(t * 0.25);
    }
    y += Math.round(t * 0.8);
  }

  // O título: o maior tamanho que cabe.
  const maxLinhas = lambe ? 7 : modelo === "quadrado" ? 3 : 4;
  const maior = Math.round(L * (lambe ? 0.2 : 0.12));
  const menor = Math.round(L * 0.05);
  const tituloTexto = lambe ? c.titulo.trim().toUpperCase() : c.titulo.trim();
  const { tamanho, linhas } = ajustarTitulo(tituloTexto || "—", medirEm(900), util, maxLinhas, maior, menor);
  letra(900, tamanho);
  ctx.fillStyle = tinta;
  for (const linha of linhas) {
    y += Math.round(tamanho * 0.92);
    ctx.fillText(linha, M, y);
  }
  y += Math.round(tamanho * 0.35);

  // O texto.
  const pe = Math.round(A * (modelo === "quadrado" ? 0.2 : 0.16));
  if (c.texto.trim() && !lambe) {
    const t = Math.round(L * (modelo === "quadrado" ? 0.034 : 0.03));
    letra(500, t);
    ctx.fillStyle = id.texto;
    const cabem = Math.max(1, Math.floor((A - pe - y - t) / (t * 1.4)));
    for (const linha of quebrarEmLinhas(c.texto.trim(), (s) => ctx.measureText(s).width, util, cabem)) {
      y += Math.round(t * 1.4);
      ctx.fillText(linha, M, y);
    }
  }

  // A tarja do quando e onde, no destaque (no lambe, em tinta sobre o fundo).
  const tarja = [c.quando.trim(), c.onde.trim()].filter(Boolean);
  const baseDoPe = A - faixa - Math.round(M * 0.7);
  if (tarja.length) {
    const t = Math.round(L * (lambe ? 0.045 : 0.038));
    letra(800, t);
    const linhasDaTarja = tarja.flatMap((s) => quebrarEmLinhas(s, (x) => ctx.measureText(x).width, util - t, 2));
    const alt = linhasDaTarja.length * Math.round(t * 1.25) + Math.round(t * 0.9);
    const topo = baseDoPe - Math.round(L * 0.05) - alt;
    ctx.fillStyle = lambe ? tinta : id.destaque;
    ctx.fillRect(M - Math.round(t * 0.4), topo, util + Math.round(t * 0.8), alt);
    ctx.fillStyle = lambe ? fundo : sobre(id.destaque);
    let ty = topo + Math.round(t * 0.45);
    for (const linha of linhasDaTarja) {
      ty += Math.round(t * 1.05);
      ctx.fillText(linha, M, ty);
      ty += Math.round(t * 0.2);
    }
  }

  // A assinatura no pé.
  if (c.assinatura.trim()) {
    const t = Math.round(L * 0.026);
    letra(700, t);
    ctx.fillStyle = lambe ? tinta : id.texto;
    const [linha] = quebrarEmLinhas(c.assinatura.trim(), (s) => ctx.measureText(s).width, util, 1);
    ctx.fillText(linha ?? "", M, baseDoPe);
  }
}

/** O nome do arquivo baixado: só letras e hífen, a partir do título ("cartaz-ato-pela-moradia.png"). */
export function nomeDoArquivo(titulo: string, modelo: Modelo): string {
  const base = titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return `${modelo === "lambe" ? "lambe" : "cartaz"}-${base || "alumia"}.png`;
}

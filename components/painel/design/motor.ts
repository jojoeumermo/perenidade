// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O motor do estúdio de design: o documento (camadas de texto, formas, imagens e a marca), o desenho na tela,
// a medida dos textos, a busca de qual camada está sob o ponteiro e a exportação. Tudo roda no navegador.

import { fontes } from "../podcast/Arte";

export type Fonte = "serifa" | "sans" | "mono";
export type Alinhar = "left" | "center" | "right";

interface Base {
  id: string;
  nome?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotação em graus. */
  rot: number;
  /** De 0 a 1. */
  opacidade: number;
  travada?: boolean;
  oculta?: boolean;
}
export interface CamadaTexto extends Base {
  tipo: "texto";
  texto: string;
  fonte: Fonte;
  tamanho: number;
  peso: 400 | 500 | 600 | 700 | 800 | 900;
  italico: boolean;
  cor: string;
  alinhar: Alinhar;
  /** Entrelinha, em vezes o tamanho (1,0 a 1,8). */
  entrelinha: number;
  /** Espaço entre letras, em "em" (0 a 0,3). */
  espacamento: number;
  maiusculas: boolean;
  /** Tarja atrás do texto (vazio: nenhuma). */
  fundo: string;
  /** Recuo interno da tarja, em pontos. */
  recuo: number;
}
export interface CamadaForma extends Base {
  tipo: "retangulo" | "elipse" | "estrela" | "linha" | "cunha" | "raios";
  preenchimento: string;
  borda: string;
  espessura: number;
  raio: number;
}
export interface CamadaImagem extends Base {
  tipo: "imagem";
  src: string;
  credito: string;
  filtro: "nenhum" | "pb" | "duotom" | "sepia" | "contraste";
  ajuste: "cobrir" | "conter";
  borda: string;
  espessura: number;
}
export interface CamadaMarca extends Base {
  tipo: "marca";
  variante: "simbolo" | "circulo" | "nome";
  cor: string;
  fundo: string;
}
export type Camada = CamadaTexto | CamadaForma | CamadaImagem | CamadaMarca;

export interface Fundo {
  cor: string;
  /** A trama de pontinhos dos posts do instituto. */
  pontilhado: boolean;
  bordaCima: string;
  bordaBaixo: string;
  espessura: number;
}
export interface Documento {
  v: 1;
  w: number;
  h: number;
  fundo: Fundo;
  camadas: Camada[];
}

/** As cores da identidade (as mesmas do site e do Kit de Lançamento). */
export const PALETA: [string, string][] = [
  ["Pergaminho", "#f4ecd8"],
  ["Papel", "#e9dcbc"],
  ["Pergaminho claro", "#fbf7ec"],
  ["Tinta", "#1f1a14"],
  ["Preto de arquivo", "#17130e"],
  ["Bordô", "#6e1f1a"],
  ["Vermelho da gráfica", "#c21f16"],
  ["Vermelho vivo", "#d4372b"],
  ["Ouro", "#d4a24c"],
  ["Ouro claro", "#f0cf8e"],
  ["Ouro escuro", "#8a5f1c"],
  ["Tinta suave", "#5a4e3c"],
  ["Fio", "#cdbb91"],
  ["Verde", "#2f5d34"],
  ["Branco", "#ffffff"],
];
export const COR = Object.fromEntries(PALETA.map(([nome, cor]) => [nome, cor])) as Record<string, string>;

export const FORMATOS = [
  { id: "post", nome: "Post em pé (1080 × 1350)", w: 1080, h: 1350 },
  { id: "quadrado", nome: "Post quadrado (1080 × 1080)", w: 1080, h: 1080 },
  { id: "story", nome: "Story e Reels (1080 × 1920)", w: 1080, h: 1920 },
  { id: "carrossel", nome: "Carrossel (1080 × 1350)", w: 1080, h: 1350 },
  { id: "capa-podcast", nome: "Capa de podcast (3000 × 3000)", w: 3000, h: 3000 },
  { id: "cartaz-a4", nome: "Cartaz A4 (1240 × 1754)", w: 1240, h: 1754 },
  { id: "folheto-a5", nome: "Folheto A5 (874 × 1240)", w: 874, h: 1240 },
  { id: "banner", nome: "Cartão de link (1200 × 630)", w: 1200, h: 630 },
  { id: "capa-rede", nome: "Capa de perfil (1640 × 624)", w: 1640, h: 624 },
  { id: "video", nome: "Vídeo e YouTube (1280 × 720)", w: 1280, h: 720 },
  { id: "avatar", nome: "Avatar (1000 × 1000)", w: 1000, h: 1000 },
] as const;
export type FormatoId = (typeof FORMATOS)[number]["id"];

export const novoId = () => Math.random().toString(36).slice(2, 10);

export function documentoVazio(formato: FormatoId): Documento {
  const f = FORMATOS.find((x) => x.id === formato) ?? FORMATOS[0];
  return { v: 1, w: f.w, h: f.h, fundo: { cor: COR.Pergaminho, pontilhado: false, bordaCima: "", bordaBaixo: "", espessura: 0 }, camadas: [] };
}

export const texto = (c: Partial<CamadaTexto> & Pick<CamadaTexto, "x" | "y" | "w" | "texto">): CamadaTexto => ({
  id: novoId(),
  tipo: "texto",
  h: 100,
  rot: 0,
  opacidade: 1,
  fonte: "serifa",
  tamanho: 48,
  peso: 600,
  italico: false,
  cor: COR.Tinta,
  alinhar: "left",
  entrelinha: 1.05,
  espacamento: 0,
  maiusculas: false,
  fundo: "",
  recuo: 0,
  ...c,
});
export const forma = (tipo: CamadaForma["tipo"], c: Partial<CamadaForma> & Pick<CamadaForma, "x" | "y" | "w" | "h">): CamadaForma => ({ id: novoId(), tipo, rot: 0, opacidade: 1, preenchimento: COR["Vermelho da gráfica"], borda: "", espessura: 0, raio: 0, ...c });
export const imagem = (c: Partial<CamadaImagem> & Pick<CamadaImagem, "x" | "y" | "w" | "h" | "src">): CamadaImagem => ({ id: novoId(), tipo: "imagem", rot: 0, opacidade: 1, credito: "", filtro: "nenhum", ajuste: "cobrir", borda: "", espessura: 0, ...c });
export const marca = (c: Partial<CamadaMarca> & Pick<CamadaMarca, "x" | "y" | "w">): CamadaMarca => ({ id: novoId(), tipo: "marca", h: c.w, rot: 0, opacidade: 1, variante: "simbolo", cor: COR.Tinta, fundo: COR["Bordô"], ...c });

// ───── Fontes e medidas ─────

let familias: { serifa: string; sans: string; mono: string } | null = null;
export async function prepararFontes() {
  familias ??= await fontes();
  await Promise.all([
    document.fonts.load(`700 40px ${familias.serifa}`),
    document.fonts.load(`italic 500 40px ${familias.serifa}`),
    document.fonts.load(`400 40px ${familias.serifa}`),
    document.fonts.load(`800 40px ${familias.sans}`),
    document.fonts.load(`italic 900 40px ${familias.sans}`),
    document.fonts.load(`500 40px ${familias.mono}`),
  ]).catch(() => undefined);
  return familias;
}
const familia = (fonte: Fonte) => (familias ? familias[fonte] : fonte === "serifa" ? "Georgia, serif" : fonte === "mono" ? "monospace" : "system-ui, sans-serif");
export const fonteCss = (c: CamadaTexto) => `${c.italico ? "italic " : ""}${c.peso} ${c.tamanho}px ${familia(c.fonte)}`;

let medidor: CanvasRenderingContext2D | null = null;
function pena(): CanvasRenderingContext2D {
  medidor ??= document.createElement("canvas").getContext("2d");
  return medidor!;
}

/** Quebra o texto em linhas que cabem na largura (respeitando as quebras escritas). */
export function linhasDe(c: CamadaTexto, ctx: CanvasRenderingContext2D = pena()): string[] {
  ctx.font = fonteCss(c);
  ctx.letterSpacing = `${c.espacamento}em`;
  const largura = Math.max(10, c.w - 2 * c.recuo);
  const saida: string[] = [];
  for (const paragrafo of (c.maiusculas ? c.texto.toUpperCase() : c.texto).split("\n")) {
    const palavras = paragrafo.split(/(\s+)/).filter((p) => p !== "");
    let atual = "";
    for (const palavra of palavras) {
      const tentativa = atual + palavra;
      if (ctx.measureText(tentativa.trimEnd()).width <= largura || atual === "") atual = tentativa;
      else {
        saida.push(atual.trimEnd());
        atual = palavra.trim() === "" ? "" : palavra;
      }
    }
    saida.push(atual.trimEnd());
  }
  return saida;
}

/** A altura que o texto ocupa (a caixa acompanha o texto). */
export function alturaDoTexto(c: CamadaTexto): number {
  const linhas = linhasDe(c);
  return Math.max(c.tamanho * c.entrelinha, linhas.length * c.tamanho * c.entrelinha) + 2 * c.recuo;
}

// ───── Imagens ─────

const guardadas = new Map<string, Promise<HTMLImageElement>>();
export function carregarImagem(src: string): Promise<HTMLImageElement> {
  let p = guardadas.get(src);
  if (!p) {
    p = new Promise((resolver, recusar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => recusar(new Error("imagem"));
      img.src = src;
    });
    guardadas.set(src, p);
  }
  return p;
}
export const imagemPronta = (src: string): HTMLImageElement | null => {
  // Só o que já carregou; a tela é redesenhada quando a promessa termina.
  const p = guardadas.get(src) as (Promise<HTMLImageElement> & { pronta?: HTMLImageElement }) | undefined;
  if (!p) return null;
  if (p.pronta) return p.pronta;
  void p.then((img) => {
    p.pronta = img;
  });
  return null;
};

/** Reduz uma imagem do aparelho para caber no documento guardado (JPEG, lado maior 1400). */
export async function prepararImagem(arquivo: File): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(bitmap.width * escala));
  tela.height = Math.max(1, Math.round(bitmap.height * escala));
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("imagem");
  ctx.drawImage(bitmap, 0, 0, tela.width, tela.height);
  bitmap.close();
  const png = arquivo.type === "image/png" && arquivo.size < 400_000;
  return tela.toDataURL(png ? "image/png" : "image/jpeg", 0.85);
}

// ───── Desenho ─────

const ESTRELA = [60, 10, 66.29, 29.35, 86.63, 29.35, 70.17, 41.31, 76.46, 60.65, 60, 48.7, 43.54, 60.65, 49.83, 41.31, 33.37, 29.35, 53.71, 29.35];
const LIVRO_E = "M56 108V76C46 69 31 67 12 71V101C31 97 46 100 56 108Z";
const LIVRO_D = "M64 108V76C74 69 89 67 108 71V101C89 97 74 100 64 108Z";

/** O símbolo do instituto (estrela sobre o livro aberto), no quadrado de 120 × 120 do desenho original. */
function simbolo(ctx: CanvasRenderingContext2D, cor: string) {
  ctx.fillStyle = cor;
  ctx.beginPath();
  for (let i = 0; i < ESTRELA.length; i += 2) ctx[i === 0 ? "moveTo" : "lineTo"](ESTRELA[i], ESTRELA[i + 1]);
  ctx.closePath();
  ctx.fill();
  ctx.fill(new Path2D(LIVRO_E));
  ctx.fill(new Path2D(LIVRO_D));
}

function estrela(ctx: CanvasRenderingContext2D, cx: number, cy: number, raio: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? raio : raio * 0.382;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx[i === 0 ? "moveTo" : "lineTo"](cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

function retanguloArredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (r <= 0) ctx.rect(x, y, w, h);
  else ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function filtroCss(f: CamadaImagem["filtro"]) {
  return f === "pb" ? "grayscale(1) contrast(1.1)" : f === "sepia" ? "sepia(0.7) contrast(1.05)" : f === "contraste" ? "contrast(1.3) saturate(1.1)" : f === "duotom" ? "grayscale(1) contrast(1.2)" : "none";
}

function desenharCamada(ctx: CanvasRenderingContext2D, c: Camada, u: number) {
  ctx.save();
  ctx.globalAlpha = c.opacidade;
  ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
  ctx.rotate((c.rot * Math.PI) / 180);
  ctx.translate(-c.w / 2, -c.h / 2);
  if (c.tipo === "texto") {
    const linhas = linhasDe(c, ctx);
    const altura = linhas.length * c.tamanho * c.entrelinha;
    if (c.fundo) {
      ctx.fillStyle = c.fundo;
      ctx.fillRect(0, 0, c.w, altura + 2 * c.recuo);
    }
    ctx.font = fonteCss(c);
    ctx.letterSpacing = `${c.espacamento}em`;
    ctx.fillStyle = c.cor;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = c.alinhar;
    const x = c.alinhar === "left" ? c.recuo : c.alinhar === "right" ? c.w - c.recuo : c.w / 2;
    linhas.forEach((linha, i) => ctx.fillText(linha, x, c.recuo + (i + 0.78) * c.tamanho * c.entrelinha));
  } else if (c.tipo === "imagem") {
    const img = imagemPronta(c.src);
    retanguloArredondado(ctx, 0, 0, c.w, c.h, 0);
    ctx.save();
    ctx.clip();
    if (img) {
      ctx.filter = filtroCss(c.filtro);
      const escala = c.ajuste === "cobrir" ? Math.max(c.w / img.width, c.h / img.height) : Math.min(c.w / img.width, c.h / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      ctx.drawImage(img, (c.w - w) / 2, (c.h - h) / 2, w, h);
      ctx.filter = "none";
      if (c.filtro === "duotom") {
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "rgba(194, 31, 22, 0.55)";
        ctx.fillRect(0, 0, c.w, c.h);
        ctx.globalCompositeOperation = "source-over";
      }
    } else {
      ctx.fillStyle = "#cdbb91";
      ctx.fillRect(0, 0, c.w, c.h);
    }
    ctx.restore();
    if (c.borda && c.espessura > 0) {
      ctx.strokeStyle = c.borda;
      ctx.lineWidth = c.espessura;
      ctx.strokeRect(c.espessura / 2, c.espessura / 2, c.w - c.espessura, c.h - c.espessura);
    }
  } else if (c.tipo === "marca") {
    const lado = Math.min(c.w, c.h);
    if (c.variante === "circulo") {
      ctx.fillStyle = c.fundo;
      ctx.beginPath();
      ctx.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(lado / 2, lado * 0.508);
      ctx.scale((lado / 120) * 0.62, (lado / 120) * 0.62);
      ctx.translate(-60, -59);
      simbolo(ctx, c.cor);
      ctx.restore();
    } else if (c.variante === "nome") {
      const alturaS = c.h;
      ctx.save();
      ctx.scale(alturaS / 120, alturaS / 120);
      simbolo(ctx, c.cor);
      ctx.restore();
      ctx.fillStyle = c.cor;
      ctx.font = `700 ${alturaS * 0.55}px ${familia("serifa")}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("Instituto Lúcia", alturaS * 1.1, alturaS * 0.52);
    } else {
      ctx.save();
      ctx.scale(lado / 120, lado / 120);
      simbolo(ctx, c.cor);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = c.preenchimento;
    ctx.strokeStyle = c.borda;
    ctx.lineWidth = c.espessura;
    if (c.tipo === "retangulo") {
      retanguloArredondado(ctx, 0, 0, c.w, c.h, c.raio);
    } else if (c.tipo === "elipse") {
      ctx.beginPath();
      ctx.ellipse(c.w / 2, c.h / 2, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    } else if (c.tipo === "estrela") {
      estrela(ctx, c.w / 2, c.h / 2, Math.min(c.w, c.h) / 2);
    } else if (c.tipo === "linha") {
      ctx.beginPath();
      ctx.rect(0, c.h / 2 - Math.max(1, c.espessura) / 2, c.w, Math.max(1, c.espessura));
      ctx.fillStyle = c.preenchimento;
      ctx.fill();
      ctx.restore();
      return;
    } else if (c.tipo === "cunha") {
      // A cunha do jornal: um triângulo que entra pelo canto.
      ctx.beginPath();
      ctx.moveTo(c.w, 0);
      ctx.lineTo(c.w, c.h);
      ctx.lineTo(0, c.h);
      ctx.closePath();
    } else if (c.tipo === "raios") {
      const cx = c.w / 2;
      const cy = c.h / 2;
      const raio = Math.max(c.w, c.h);
      ctx.beginPath();
      for (let i = 0; i < 24; i += 2) {
        const a0 = (i * Math.PI * 2) / 24;
        const a1 = ((i + 1) * Math.PI * 2) / 24;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a0) * raio, cy + Math.sin(a0) * raio);
        ctx.lineTo(cx + Math.cos(a1) * raio, cy + Math.sin(a1) * raio);
        ctx.closePath();
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, c.w, c.h);
      ctx.clip();
      ctx.fill();
      ctx.restore();
      ctx.restore();
      return;
    }
    if (c.preenchimento && c.preenchimento !== "transparent") ctx.fill();
    if (c.borda && c.espessura > 0) ctx.stroke();
  }
  ctx.restore();
  void u;
}

/** Desenha o documento inteiro numa tela (na escala pedida; 1 = tamanho real). */
export function desenhar(tela: HTMLCanvasElement, doc: Documento, escala = 1) {
  tela.width = Math.round(doc.w * escala);
  tela.height = Math.round(doc.h * escala);
  const ctx = tela.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.fillStyle = doc.fundo.cor;
  ctx.fillRect(0, 0, doc.w, doc.h);
  if (doc.fundo.pontilhado) {
    const passo = Math.round(doc.w / 40);
    ctx.fillStyle = "rgba(31, 26, 20, 0.09)";
    for (let y = passo / 2; y < doc.h; y += passo) for (let x = passo / 2; x < doc.w; x += passo) ctx.fillRect(x, y, Math.max(1.5, passo * 0.06), Math.max(1.5, passo * 0.06));
  }
  for (const c of doc.camadas) if (!c.oculta) desenharCamada(ctx, c, doc.w / 100);
  if (doc.fundo.espessura > 0) {
    if (doc.fundo.bordaCima) {
      ctx.fillStyle = doc.fundo.bordaCima;
      ctx.fillRect(0, 0, doc.w, doc.fundo.espessura);
    }
    if (doc.fundo.bordaBaixo) {
      ctx.fillStyle = doc.fundo.bordaBaixo;
      ctx.fillRect(0, doc.h - doc.fundo.espessura, doc.w, doc.fundo.espessura);
    }
  }
}

// ───── Seleção e alças ─────

/** O ponto (coordenadas do documento) cai nesta camada? Leva a rotação em conta. */
export function dentro(c: Camada, px: number, py: number): boolean {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  const a = (-c.rot * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const lx = dx * Math.cos(a) - dy * Math.sin(a) + c.w / 2;
  const ly = dx * Math.sin(a) + dy * Math.cos(a) + c.h / 2;
  if (c.tipo === "elipse") return ((lx - c.w / 2) / (c.w / 2)) ** 2 + ((ly - c.h / 2) / (c.h / 2)) ** 2 <= 1;
  const folga = c.tipo === "linha" ? 8 : 0;
  return lx >= -folga && lx <= c.w + folga && ly >= -folga && ly <= c.h + folga;
}

export function camadaEm(doc: Documento, px: number, py: number): Camada | null {
  for (let i = doc.camadas.length - 1; i >= 0; i--) {
    const c = doc.camadas[i];
    if (!c.oculta && !c.travada && dentro(c, px, py)) return c;
  }
  return null;
}

export type Alca = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "rot";
/** As alças de redimensionar e girar, em coordenadas do documento (já giradas com a camada). */
export function alcas(c: Camada, escala: number): { id: Alca; x: number; y: number }[] {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  const a = (c.rot * Math.PI) / 180;
  const girar = (lx: number, ly: number) => ({ x: cx + (lx - c.w / 2) * Math.cos(a) - (ly - c.h / 2) * Math.sin(a), y: cy + (lx - c.w / 2) * Math.sin(a) + (ly - c.h / 2) * Math.cos(a) });
  const lista: { id: Alca; x: number; y: number }[] = [
    { id: "nw", ...girar(0, 0) },
    { id: "n", ...girar(c.w / 2, 0) },
    { id: "ne", ...girar(c.w, 0) },
    { id: "e", ...girar(c.w, c.h / 2) },
    { id: "se", ...girar(c.w, c.h) },
    { id: "s", ...girar(c.w / 2, c.h) },
    { id: "sw", ...girar(0, c.h) },
    { id: "w", ...girar(0, c.h / 2) },
    { id: "rot", ...girar(c.w / 2, -36 / escala) },
  ];
  return lista;
}

/** Desenha o contorno da seleção e as alças por cima da tela (em coordenadas de tela). */
export function desenharSelecao(ctx: CanvasRenderingContext2D, c: Camada, escala: number) {
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
  ctx.rotate((c.rot * Math.PI) / 180);
  ctx.strokeStyle = "#c21f16";
  ctx.lineWidth = 2 / escala;
  ctx.setLineDash([6 / escala, 4 / escala]);
  ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
  ctx.setLineDash([]);
  ctx.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const alca of alcas(c, escala)) {
    const x = alca.x * escala;
    const y = alca.y * escala;
    ctx.fillStyle = alca.id === "rot" ? "#c21f16" : "#f4ecd8";
    ctx.strokeStyle = "#1f1a14";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (alca.id === "rot") ctx.arc(x, y, 6, 0, Math.PI * 2);
    else ctx.rect(x - 5, y - 5, 10, 10);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ───── Exportar ─────

export async function exportar(doc: Documento, tipo: "png" | "jpeg", escala = 1): Promise<Blob> {
  await Promise.all(doc.camadas.filter((c): c is CamadaImagem => c.tipo === "imagem").map((c) => carregarImagem(c.src).catch(() => null)));
  const tela = document.createElement("canvas");
  desenhar(tela, doc, escala);
  return new Promise((resolver, recusar) => tela.toBlob((blob) => (blob ? resolver(blob) : recusar(new Error("exportar"))), `image/${tipo}`, 0.92));
}

/** Uma prévia pequena em JPEG (data:), para a lista de trabalhos. */
export async function miniatura(doc: Documento): Promise<string> {
  await Promise.all(doc.camadas.filter((c): c is CamadaImagem => c.tipo === "imagem").map((c) => carregarImagem(c.src).catch(() => null)));
  const tela = document.createElement("canvas");
  desenhar(tela, doc, 280 / Math.max(doc.w, doc.h));
  return tela.toDataURL("image/jpeg", 0.7);
}

export const nomeDeArquivo = (titulo: string) =>
  titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "arte";

// ───── Outros formatos e o editor avançado ─────

/**
 * A mesma arte noutro formato (post, story, quadrado). Para um formato mais baixo, posições e tamanhos encolhem juntos
 * (nada se sobrepõe); para um mais alto, as camadas mantêm o tamanho e se espalham na mesma altura relativa. O que
 * ocupa a página inteira acompanha a página. Os textos refazem as linhas.
 */
export function adaptar(doc: Documento, w: number, h: number): Documento {
  const s = w / doc.w;
  const ry = h / doc.h;
  const k = Math.min(s, ry);
  const camadas = doc.camadas.map((c) => {
    const cheiaV = c.h >= doc.h * 0.85;
    const cheiaH = c.w >= doc.w * 0.9;
    let nova: Camada;
    if (cheiaV) nova = { ...c, x: c.x * s, y: c.y * ry, w: c.w * s, h: c.h * ry } as Camada;
    else if (ry < s) {
      // Mais baixo: tudo encolhe na mesma proporção; a largura do texto continua a da coluna.
      const largura = c.tipo === "texto" || cheiaH ? c.w * s : c.w * k;
      const x = c.tipo === "texto" || cheiaH ? c.x * s : c.x * s + (c.w * s - largura) / 2;
      nova = { ...c, x, y: c.y * ry, w: largura, h: c.h * k } as Camada;
    } else {
      // Mais alto: mesmo tamanho, centro na mesma altura relativa.
      const altura = c.h * s;
      const y = Math.min(Math.max(0, (c.y + c.h / 2) * ry - altura / 2), Math.max(0, h - altura));
      nova = { ...c, x: c.x * s, y, w: c.w * s, h: altura } as Camada;
    }
    const escalaDoTexto = ry < s && !cheiaV ? k : s;
    if (nova.tipo === "texto") {
      nova.tamanho = nova.tamanho * escalaDoTexto;
      nova.recuo = nova.recuo * escalaDoTexto;
      nova.h = alturaDoTexto(nova);
    }
    if ("espessura" in nova) nova.espessura = nova.espessura * escalaDoTexto;
    return nova;
  });
  return { ...doc, w, h, fundo: { ...doc.fundo, espessura: doc.fundo.espessura * k }, camadas };
}

/** Uma camada sozinha, sobre fundo transparente, no tamanho real do documento (para virar camada do PSD). */
function telaDaCamada(doc: Documento, c: Camada): HTMLCanvasElement {
  const tela = document.createElement("canvas");
  tela.width = doc.w;
  tela.height = doc.h;
  const ctx = tela.getContext("2d");
  if (ctx) desenharCamada(ctx, c, doc.w / 100);
  return tela;
}

/** O fundo (cor e trama de pontinhos) e os fios de cima e de baixo, como camadas próprias. */
function telaDoFundo(doc: Documento, fios: boolean): HTMLCanvasElement {
  const tela = document.createElement("canvas");
  tela.width = doc.w;
  tela.height = doc.h;
  const ctx = tela.getContext("2d");
  if (!ctx) return tela;
  if (!fios) {
    desenhar(tela, { ...doc, camadas: [], fundo: { ...doc.fundo, espessura: 0 } }, 1);
    return tela;
  }
  if (doc.fundo.bordaCima) {
    ctx.fillStyle = doc.fundo.bordaCima;
    ctx.fillRect(0, 0, doc.w, doc.fundo.espessura);
  }
  if (doc.fundo.bordaBaixo) {
    ctx.fillStyle = doc.fundo.bordaBaixo;
    ctx.fillRect(0, doc.h - doc.fundo.espessura, doc.w, doc.fundo.espessura);
  }
  return tela;
}

const hex = (cor: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(cor);
  const n = m ? parseInt(m[1], 16) : 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

/** O nome PostScript das fontes livres do instituto (EB Garamond, Inter e IBM Plex Mono, todas com licença OFL). */
function nomePostScript(c: CamadaTexto): string {
  const nome = (familia: string, peso: string) => (peso === "Regular" ? `${familia}-${c.italico ? "Italic" : "Regular"}` : `${familia}-${peso}${c.italico ? "Italic" : ""}`);
  if (c.fonte === "mono") return nome("IBMPlexMono", c.peso >= 600 ? "SemiBold" : c.peso >= 500 ? "Medium" : "Regular");
  const pesos: Record<number, string> = { 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" };
  if (c.fonte === "sans") return nome("Inter", pesos[c.peso] ?? "Regular");
  return nome("EBGaramond", c.peso >= 800 ? "ExtraBold" : (pesos[c.peso] ?? "Regular"));
}

export const nomeDaCamada = (c: Camada) =>
  (c.nome || (c.tipo === "texto" ? c.texto.split("\n")[0].slice(0, 40) || "Texto" : c.tipo === "imagem" ? "Imagem" : c.tipo === "marca" ? "Marca" : c.tipo)).slice(0, 60);

/**
 * A arte como PSD, para abrir no editor avançado: uma camada por camada do estúdio, com nome, posição, opacidade e a
 * visibilidade. Cada camada vai desenhada (o que garante o visual em qualquer editor) e os textos levam também o texto
 * editável, a fonte, o tamanho e a cor. Efeitos que só o estúdio sabe fazer (filtros de imagem, a tarja atrás do
 * texto) chegam já desenhados, sem ser editáveis.
 */
export async function paraPsd(doc: Documento): Promise<Blob> {
  await Promise.all(doc.camadas.filter((c): c is CamadaImagem => c.tipo === "imagem").map((c) => carregarImagem(c.src).catch(() => null)));
  const { writePsd } = await import("ag-psd");
  type CamadaPsd = NonNullable<Parameters<typeof writePsd>[0]["children"]>[number];
  const filhos: CamadaPsd[] = [{ name: "Fundo", left: 0, top: 0, canvas: telaDoFundo(doc, false) }];
  for (const c of doc.camadas) {
    const camada: CamadaPsd = { name: nomeDaCamada(c), left: 0, top: 0, canvas: telaDaCamada(doc, c), opacity: c.opacidade, hidden: Boolean(c.oculta) };
    if (c.tipo === "texto" && !c.fundo && c.rot === 0) {
      const alinhamento = c.alinhar === "center" ? "center" : c.alinhar === "right" ? "right" : "left";
      const x = c.alinhar === "center" ? c.x + c.w / 2 : c.alinhar === "right" ? c.x + c.w - c.recuo : c.x + c.recuo;
      camada.text = {
        text: (c.maiusculas ? c.texto.toUpperCase() : c.texto).replace(/\n/g, "\r"),
        transform: [1, 0, 0, 1, x, c.y + c.recuo + c.tamanho * 0.8],
        style: { font: { name: nomePostScript(c) }, fontSize: c.tamanho, leading: c.tamanho * c.entrelinha, tracking: Math.round(c.espacamento * 1000), fillColor: hex(c.cor) },
        paragraphStyle: { justification: alinhamento },
      };
    }
    filhos.push(camada);
  }
  if (doc.fundo.espessura > 0 && (doc.fundo.bordaCima || doc.fundo.bordaBaixo)) filhos.push({ name: "Fios", left: 0, top: 0, canvas: telaDoFundo(doc, true) });
  const composta = document.createElement("canvas");
  desenhar(composta, doc, 1);
  const dados = writePsd({ width: doc.w, height: doc.h, children: filhos, canvas: composta }, { generateThumbnail: true, invalidateTextLayers: true });
  return new Blob([dados], { type: "image/vnd.adobe.photoshop" });
}

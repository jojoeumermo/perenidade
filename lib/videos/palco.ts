// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O palco dos vídeos curtos: uma função pura do tempo. quadro(pronto, t) devolve o SVG do instante t (em ms), sem
// Math.random nem Date: o mesmo t dá sempre o mesmo desenho (por isso dá para tocar, pausar, arrastar e testar).
// As cores são as variáveis do site (--folha, --ink, --prelo-texto…), então o vídeo segue o tema claro, o escuro,
// o alto contraste e a tinta eletrônica. Identidade "Caderno do Povo": papel pautado ou pontilhado, contorno de
// tinta, sombra dura, carimbo vermelho do prelo, anotação à mão (Caveat) com leve tremor de caneta.
// Sem os atalhos "@/" de propósito: os testes rodam este arquivo direto no Node.

import type { Visual } from "./roteiro";

export interface FrasePronta {
  ini: number;
  fim: number;
  texto: string;
}
export interface CenaPronta {
  id: string;
  visual: Visual;
  ini: number;
  fim: number;
  marcas: Record<string, number>;
  frases: FrasePronta[];
}
export interface Pronto {
  id: string;
  titulo: string;
  aula: string;
  duracao: number;
  narracao: string;
  cenas: CenaPronta[];
  legendas: FrasePronta[];
}

const W = 1280;
const H = 720;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const suave = (x: number) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};

/** Ruído previsível (semente fixa): o tremor da caneta e o granulado do papel saem iguais em qualquer máquina. */
export function ruido(semente: number): number {
  let h = Math.imul(semente ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
}
const semente = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

/** Quebra o texto em linhas de até n caracteres. */
export function quebrar(texto: string, n: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const p of texto.split(/\s+/)) {
    if ((atual + " " + p).trim().length > n && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = (atual + " " + p).trim();
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Traço de caneta: linha com tremor, que se desenha de 0 a 1. */
function traco(x1: number, y1: number, x2: number, y2: number, p: number, s: number, cor = "var(--prelo-texto)", larg = 5): string {
  if (p <= 0) return "";
  const pts: string[] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    pts.push(`${(x1 + (x2 - x1) * k).toFixed(1)},${(y1 + (y2 - y1) * k + ruido(s + i) * 2.2).toFixed(1)}`);
  }
  const comp = Math.hypot(x2 - x1, y2 - y1) * 1.02;
  return `<polyline points="${pts.join(" ")}" fill="none" stroke="${cor}" stroke-width="${larg}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${comp.toFixed(1)}" stroke-dashoffset="${(comp * (1 - clamp(p))).toFixed(1)}"/>`;
}

/** Círculo à mão em volta de uma área. */
function circulo(cx: number, cy: number, rx: number, ry: number, p: number, s: number): string {
  if (p <= 0) return "";
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = -0.4 + (i / 24) * Math.PI * 2.15;
    const r = 1 + ruido(s + i) * 0.03;
    pts.push(`${(cx + Math.cos(a) * rx * r).toFixed(1)},${(cy + Math.sin(a) * ry * r).toFixed(1)}`);
  }
  const comp = Math.PI * (rx + ry) * 1.1;
  return `<polyline points="${pts.join(" ")}" fill="none" stroke="var(--prelo-texto)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${comp.toFixed(1)}" stroke-dashoffset="${(comp * (1 - clamp(p))).toFixed(1)}"/>`;
}

/** Texto que se escreve da esquerda para a direita (máscara que abre), sem desfoque. */
function escrito(id: string, x: number, y: number, larg: number, alto: number, p: number, conteudo: string): string {
  if (p <= 0) return "";
  return `<clipPath id="${id}"><rect x="${x - 4}" y="${y - alto}" width="${(larg + 8) * clamp(p)}" height="${alto * 1.6}"/></clipPath><g clip-path="url(#${id})">${conteudo}</g>`;
}

function papel(tipo: "pauta" | "pontos", s: number): string {
  let fundo = `<rect width="${W}" height="${H}" fill="var(--folha, #fffdf8)"/>`;
  if (tipo === "pauta") {
    for (let y = 120; y < H; y += 48) fundo += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="var(--linha-pauta, #ebe2cf)" stroke-width="2"/>`;
    fundo += `<line x1="96" x2="96" y1="0" y2="${H}" stroke="var(--margem-pauta, #e0837a)" stroke-width="2"/>`;
  } else {
    let pts = "";
    for (let y = 30; y < H; y += 30) for (let x = 30; x < W; x += 30) pts += `M${x} ${y}h0.1`;
    fundo += `<path d="${pts}" stroke="var(--pontos, #e2d9c6)" stroke-width="3" stroke-linecap="round"/>`;
  }
  // Granulado sutil do papel.
  let grao = "";
  for (let i = 0; i < 140; i++) grao += `M${((ruido(s + i * 3) + 1) * W / 2).toFixed(0)} ${((ruido(s + i * 7) + 1) * H / 2).toFixed(0)}h1.2`;
  return fundo + `<path d="${grao}" stroke="var(--ink-soft, #5a4e3c)" stroke-opacity="0.18" stroke-width="2"/>`;
}

/** Cartão com contorno de tinta e sombra dura de 6 px (preta ou vermelha). */
const cartao = (x: number, y: number, w: number, h: number, vermelho = false) =>
  `<rect x="${x + 6}" y="${y + 6}" width="${w}" height="${h}" fill="${vermelho ? "var(--prelo-texto, #c21f16)" : "var(--sombra, #1f1a14)"}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--folha, #fffdf8)" stroke="var(--ink, #1f1a14)" stroke-width="3"/>`;

const SERIF = "var(--font-serif-display), 'EB Garamond', Georgia, serif";
const UI = "var(--font-ui), Inter, Arial, sans-serif";
const MONO = "var(--font-archive), 'IBM Plex Mono', monospace";
const MAO = "var(--font-hand), Caveat, cursive";

function texto(x: number, y: number, t: string, tam: number, fam: string, extra = ""): string {
  return `<text x="${x}" y="${y}" font-family="${fam}" font-size="${tam}" fill="var(--ink, #1f1a14)" ${extra}>${esc(t)}</text>`;
}

/** Quando cada item aparece: na marca, se tiver; senão, em sequência na primeira metade da cena. */
function tempoDoItem(c: CenaPronta, i: number, n: number): number {
  const it = c.visual.itens?.[i];
  if (it?.em && c.marcas[it.em] !== undefined) return c.marcas[it.em];
  return c.ini + 400 + ((c.fim - c.ini) * 0.55 * i) / Math.max(1, n);
}

function desenharCena(c: CenaPronta, t: number, pronto: Pronto): string {
  const v = c.visual;
  const s = semente(pronto.id + c.id);
  const dt = t - c.ini;
  const p = (ms: number) => clamp(dt / ms);
  let o = "";
  switch (v.tipo) {
    case "cartaz": {
      o += papel("pontos", s);
      // Cartaz deslocado para a esquerda, como lambe colado na parede (nada de tudo centralizado).
      const linhas = quebrar(v.titulo ?? pronto.titulo, 22);
      const h = 140 + linhas.length * 84;
      o += `<g transform="translate(0 ${((1 - suave(p(260))) * -14).toFixed(1)}) rotate(-1.2 400 360)">${cartao(110, 140, 760, h)}`;
      if (v.texto) o += texto(150, 200, v.texto.toUpperCase(), 26, MONO, 'letter-spacing="3" fill="var(--prelo-texto, #c21f16)"');
      linhas.forEach((l, i) => (o += texto(150, 290 + i * 84, l, 76, SERIF, 'font-weight="600"')));
      o += `</g>`;
      o += traco(150, 300 + linhas.length * 84 - 40, 150 + Math.min(600, linhas[linhas.length - 1].length * 34), 300 + linhas.length * 84 - 40, (dt - 500) / 700, s);
      if (v.nota) o += escrito(`n${s}`, 930, 560, 300, 50, (dt - 900) / 900, texto(930, 560, v.nota, 46, MAO, 'transform="rotate(-4 930 560)"'));
      break;
    }
    case "pergunta": {
      o += papel("pontos", s);
      const linhas = quebrar(v.texto ?? "", 26);
      linhas.forEach((l, i) => (o += escrito(`q${s}${i}`, 120, 230 + i * 92, l.length * 38, 80, (dt - i * 500) / 900, texto(120, 230 + i * 92, l, 72, SERIF, 'font-weight="600"'))));
      o += texto(1040, 300, "?", 260, SERIF, `fill="var(--prelo-texto, #c21f16)" opacity="${suave(p(600)).toFixed(2)}"`);
      if (v.nota) o += escrito(`qn${s}`, 120, 620, 700, 50, (dt - 1600) / 900, texto(120, 620, v.nota, 48, MAO, 'fill="var(--ink-soft, #5a4e3c)"'));
      break;
    }
    case "folha": {
      o += papel("pauta", s);
      if (v.titulo) o += texto(120, 90, v.titulo, 44, SERIF, 'font-weight="600"');
      const itens = v.itens ?? [];
      itens.forEach((it, i) => {
        const ini = tempoDoItem(c, i, itens.length);
        const y = 168 + i * 96;
        const mono = /[\d=×+−-]/.test(it.texto) && it.texto.length < 40;
        const tam = mono ? 50 : 46;
        const larg = it.texto.length * (mono ? 30 : 24);
        o += escrito(`f${s}${i}`, 130, y, larg, 60, (t - ini) / 1100, texto(130, y, it.texto, tam, mono ? MONO : MAO));
        if (it.destaque) o += circulo(130 + larg / 2, y - 16, larg / 2 + 30, 44, (t - ini - 1200) / 700, s + i * 31);
      });
      break;
    }
    case "carimbo": {
      o += papel("pauta", s);
      const k = p(220);
      const esc2 = 1.12 - 0.12 * suave(k);
      o += `<g opacity="${k > 0 ? 1 : 0}" transform="translate(640 250) rotate(-6) scale(${esc2.toFixed(3)}) translate(-640 -250)">`;
      o += `<rect x="380" y="170" width="520" height="150" fill="none" stroke="var(--prelo-texto, #c21f16)" stroke-width="10"/>`;
      o += texto(640, 278, (v.titulo ?? "ATENÇÃO").toUpperCase(), 92, UI, 'text-anchor="middle" font-weight="800" letter-spacing="6" fill="var(--prelo-texto, #c21f16)"');
      o += `</g>`;
      quebrar(v.texto ?? "", 40).forEach((l, i) => (o += escrito(`c${s}${i}`, 150, 450 + i * 70, l.length * 26, 60, (dt - 700 - i * 400) / 900, texto(150, 450 + i * 70, l, 52, SERIF))));
      break;
    }
    case "lista": {
      o += papel("pontos", s);
      if (v.titulo) o += `${cartao(80, 50, Math.min(1100, 120 + v.titulo.length * 24), 86)}${texto(110, 108, v.titulo, 44, SERIF, 'font-weight="600"')}`;
      const itens = v.itens ?? [];
      const passo = itens.length > 5 ? 82 : 100;
      itens.forEach((it, i) => {
        const ini = tempoDoItem(c, i, itens.length);
        const a = clamp((t - ini) / 300);
        if (a <= 0) return;
        const y = 210 + i * passo;
        o += `<g opacity="${a.toFixed(2)}">`;
        o += `<rect x="110" y="${y - 36}" width="40" height="40" fill="var(--folha, #fffdf8)" stroke="var(--ink, #1f1a14)" stroke-width="3"/>`;
        o += traco(116, y - 18, 128, y - 4, (t - ini - 200) / 200, s + i, it.destaque ? "var(--prelo-texto, #c21f16)" : "var(--ink, #1f1a14)", 5);
        o += traco(128, y - 4, 150, y - 40, (t - ini - 350) / 250, s + i + 9, it.destaque ? "var(--prelo-texto, #c21f16)" : "var(--ink, #1f1a14)", 5);
        o += texto(180, y, it.texto, it.texto.length > 46 ? 34 : 40, UI, it.destaque ? 'font-weight="700"' : "");
        o += `</g>`;
        if (it.destaque) o += traco(180, y + 14, 180 + Math.min(1000, it.texto.length * 20), y + 14, (t - ini - 500) / 600, s + i * 17);
      });
      break;
    }
    case "final": {
      o += papel("pontos", s);
      o += cartao(110, 120, 1060, 400, true);
      o += texto(160, 200, "INSTITUTO LÚCIA", 28, MONO, 'letter-spacing="4" fill="var(--prelo-texto, #c21f16)"');
      quebrar(v.titulo ?? "Agora, os exercícios desta aula.", 30).forEach((l, i) => (o += texto(160, 300 + i * 74, l, 64, SERIF, 'font-weight="600"')));
      if (v.texto) o += texto(160, 460, v.texto, 34, UI, 'fill="var(--ink-soft, #5a4e3c)"');
      o += escrito(`fim${s}`, 760, 620, 420, 50, (dt - 600) / 900, texto(760, 620, "institutolucia.org", 46, MAO, 'transform="rotate(-3 760 620)"'));
      o += texto(110, 690, pronto.narracao, 20, MONO, 'fill="var(--ink-soft, #5a4e3c)"');
      break;
    }
  }
  return o;
}

/** A cena do instante t (a última, depois do fim). */
export const cenaEm = (pronto: Pronto, t: number) => pronto.cenas.find((c) => t < c.fim) ?? pronto.cenas[pronto.cenas.length - 1];

/**
 * O quadro do instante t (ms). reduzido: sem movimento (prefers-reduced-motion), cada cena aparece já pronta, como um
 * passo a passo de quadros fixos.
 */
export function quadro(pronto: Pronto, t: number, opcoes: { reduzido?: boolean } = {}): string {
  const c = cenaEm(pronto, t);
  const tt = opcoes.reduzido ? c.fim - 1 : t;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="presentation" aria-hidden="true">${desenharCena(c, tt, pronto)}</svg>`;
}

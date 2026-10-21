// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A exportação vetorial: SVG e PDF com o texto convertido em curvas. As letras viram desenho com as fontes livres do
// site (cópias estáticas em /fontes/estudio, licença OFL), e formas, marca, mapas, ícones, QR e fundo saem como
// vetor: ampliam sem perder a nitidez (faixa, adesivo, recorte em vinil, bordado). O que só existe como efeito de
// imagem (fotos, textura de serigrafia, meio-tom, carimbo, louros, papel) entra como imagem embutida, no lugar e no
// tamanho certos. As duas saídas nascem da mesma cena: uma lista de caminhos e imagens já na coordenada da página,
// na ordem em que a tela desenha.

import type { Font, PathCommand } from "opentype.js";
import { ziparBinarios } from "@/lib/zip";
import { ESTADOS } from "./desenhos";
import { matrizQr, VETORES } from "./elementos";
import { comPagina } from "./exportacao";
import { ICONES } from "./icones";
import {
  assinatura,
  type Camada,
  CAMINHOS_DO_SIMBOLO,
  type CamadaElemento,
  type CamadaForma,
  type CamadaImagem,
  type CamadaMarca,
  type CamadaTexto,
  carregarTudo,
  coberturaDaPagina,
  COR,
  desenhar,
  diagramar,
  type Documento,
  emLaboratorio,
  flecha,
  type Fonte,
  fonteCss,
  type FonteDeImagem,
  formatoPorMedida,
  type Gradiente,
  imagemTratada,
  type Mascara,
  nomeDaCamada,
  nomeDeArquivo,
  posicaoDaFoto,
  recorteDaCamada,
  tamanhoQueCabe,
  textoFinal,
} from "./motor";
import { marcasDeCorte, montarPdf, type PaginaPdf, textoPdf } from "./pdf";
import type { Projeto } from "./projeto";
import { semMarcas } from "./texto-rico";

// ───── Geometria: caminhos só com M, L, C e Z, e matrizes do plano ─────

type Seg = ["M", number, number] | ["L", number, number] | ["C", number, number, number, number, number, number] | ["Z"];
/** a, b, c, d, e, f: o ponto (x, y) vai para (a·x + c·y + e, b·x + d·y + f), como no canvas. */
type Matriz = [number, number, number, number, number, number];

const IDENTIDADE: Matriz = [1, 0, 0, 1, 0, 0];
/** A transformação n dentro da m (n vale primeiro), como uma chamada nova de translate/rotate no canvas. */
const compor = (m: Matriz, n: Matriz): Matriz => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const translacao = (x: number, y: number): Matriz => [1, 0, 0, 1, x, y];
const rotacao = (a: number): Matriz => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];

function aplicar(m: Matriz, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function transformar(segs: Seg[], m: Matriz): Seg[] {
  if (m === IDENTIDADE) return segs;
  return segs.map((s): Seg => {
    if (s[0] === "Z") return s;
    if (s[0] === "C") {
      const [x1, y1] = aplicar(m, s[1], s[2]);
      const [x2, y2] = aplicar(m, s[3], s[4]);
      const [x, y] = aplicar(m, s[5], s[6]);
      return ["C", x1, y1, x2, y2, x, y];
    }
    const [x, y] = aplicar(m, s[1], s[2]);
    return [s[0], x, y];
  });
}

/** A curva quadrática (controle q) como cúbica, saindo de (x0, y0). */
const quadratica = (x0: number, y0: number, qx: number, qy: number, x: number, y: number): Seg => [
  "C",
  x0 + (2 / 3) * (qx - x0),
  y0 + (2 / 3) * (qy - y0),
  x + (2 / 3) * (qx - x),
  y + (2 / 3) * (qy - y),
  x,
  y,
];

function arcoEmCubicas(cx: number, cy: number, rx: number, ry: number, cos: number, sin: number, inicio: number, varredura: number, fimX?: number, fimY?: number): Seg[] {
  const partes = Math.max(1, Math.ceil(Math.abs(varredura) / (Math.PI / 2) - 1e-9));
  const passo = varredura / partes;
  const alfa = (4 / 3) * Math.tan(passo / 4);
  const ponto = (t: number): [number, number] => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const tangente = (t: number): [number, number] => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  const segs: Seg[] = [];
  for (let i = 0; i < partes; i++) {
    const a = inicio + i * passo;
    const b = a + passo;
    const [ax, ay] = ponto(a);
    const [tax, tay] = tangente(a);
    const [bx, by] = i === partes - 1 && fimX !== undefined && fimY !== undefined ? [fimX, fimY] : ponto(b);
    const [tbx, tby] = tangente(b);
    segs.push(["C", ax + alfa * tax, ay + alfa * tay, bx - alfa * tbx, by - alfa * tby, bx, by]);
  }
  return segs;
}

/** Um arco de elipse do SVG (comando A) em cúbicas, no máximo um quarto de volta por pedaço. */
function arcoDoSvg(x1: number, y1: number, rx: number, ry: number, graus: number, grande: number, horario: number, x2: number, y2: number): Seg[] {
  if (x1 === x2 && y1 === y2) return [];
  if (!rx || !ry) return [["L", x2, y2]];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (graus * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const xl = cos * dx + sin * dy;
  const yl = -sin * dx + cos * dy;
  const lambda = (xl * xl) / (rx * rx) + (yl * yl) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * yl * yl - ry * ry * xl * xl;
  const den = rx * rx * yl * yl + ry * ry * xl * xl;
  let k = Math.sqrt(Math.max(0, num / den));
  if (grande === horario) k = -k;
  const cxl = (k * rx * yl) / ry;
  const cyl = (-k * ry * xl) / rx;
  const cx = cos * cxl - sin * cyl + (x1 + x2) / 2;
  const cy = sin * cxl + cos * cyl + (y1 + y2) / 2;
  const angulo = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = angulo(1, 0, (xl - cxl) / rx, (yl - cyl) / ry);
  let dt = angulo((xl - cxl) / rx, (yl - cyl) / ry, (-xl - cxl) / rx, (-yl - cyl) / ry);
  if (!horario && dt > 0) dt -= 2 * Math.PI;
  if (horario && dt < 0) dt += 2 * Math.PI;
  return arcoEmCubicas(cx, cy, rx, ry, cos, sin, t1, dt, x2, y2);
}

/** Lê um caminho do SVG (qualquer comando, absoluto ou relativo) e devolve só M, L, C e Z absolutos. */
function lerCaminho(d: string): Seg[] {
  const segs: Seg[] = [];
  let i = 0;
  const pular = () => {
    while (i < d.length && (d[i] === " " || d[i] === "," || d[i] === "\n" || d[i] === "\t" || d[i] === "\r")) i++;
  };
  const numero = () => {
    pular();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i, i + 32));
    if (!m) throw new Error(`caminho: número esperado em ${i}`);
    i += m[0].length;
    return Number(m[0]);
  };
  const bandeira = () => {
    pular();
    const ch = d[i++];
    if (ch !== "0" && ch !== "1") throw new Error("caminho: bandeira do arco");
    return Number(ch);
  };
  const temNumero = () => {
    pular();
    return i < d.length && /[-+.\d]/.test(d[i]);
  };
  let x = 0;
  let y = 0;
  let inicioX = 0;
  let inicioY = 0;
  let controleX = 0;
  let controleY = 0;
  let anterior = "";
  let comando = "";
  for (;;) {
    pular();
    if (i >= d.length) break;
    if (/[A-Za-z]/.test(d[i])) comando = d[i++];
    else if (!comando) throw new Error("caminho: comando esperado");
    const relativo = comando !== comando.toUpperCase();
    const tipo = comando.toUpperCase();
    const ox = relativo ? x : 0;
    const oy = relativo ? y : 0;
    switch (tipo) {
      case "M":
        x = ox + numero();
        y = oy + numero();
        inicioX = x;
        inicioY = y;
        segs.push(["M", x, y]);
        // Os pares seguintes ao M são retas.
        comando = relativo ? "l" : "L";
        break;
      case "L":
        x = ox + numero();
        y = oy + numero();
        segs.push(["L", x, y]);
        break;
      case "H":
        x = ox + numero();
        segs.push(["L", x, y]);
        break;
      case "V":
        y = oy + numero();
        segs.push(["L", x, y]);
        break;
      case "C":
      case "S": {
        let x1: number;
        let y1: number;
        if (tipo === "C") {
          x1 = ox + numero();
          y1 = oy + numero();
        } else {
          const segue = anterior === "C" || anterior === "S";
          x1 = segue ? 2 * x - controleX : x;
          y1 = segue ? 2 * y - controleY : y;
        }
        const x2 = ox + numero();
        const y2 = oy + numero();
        x = ox + numero();
        y = oy + numero();
        segs.push(["C", x1, y1, x2, y2, x, y]);
        controleX = x2;
        controleY = y2;
        break;
      }
      case "Q":
      case "T": {
        let qx: number;
        let qy: number;
        if (tipo === "Q") {
          qx = ox + numero();
          qy = oy + numero();
        } else {
          const segue = anterior === "Q" || anterior === "T";
          qx = segue ? 2 * x - controleX : x;
          qy = segue ? 2 * y - controleY : y;
        }
        const nx = ox + numero();
        const ny = oy + numero();
        segs.push(quadratica(x, y, qx, qy, nx, ny));
        controleX = qx;
        controleY = qy;
        x = nx;
        y = ny;
        break;
      }
      case "A": {
        const rx = numero();
        const ry = numero();
        const graus = numero();
        const grande = bandeira();
        const horario = bandeira();
        const nx = ox + numero();
        const ny = oy + numero();
        segs.push(...arcoDoSvg(x, y, rx, ry, graus, grande, horario, nx, ny));
        x = nx;
        y = ny;
        break;
      }
      case "Z":
        segs.push(["Z"]);
        x = inicioX;
        y = inicioY;
        if (temNumero()) throw new Error("caminho: número depois de Z");
        break;
      default:
        throw new Error(`caminho: comando ${comando}`);
    }
    anterior = tipo;
  }
  return segs;
}

const caminhosLidos = new Map<string, Seg[]>();
function caminho(d: string): Seg[] {
  let s = caminhosLidos.get(d);
  if (!s) {
    s = lerCaminho(d);
    caminhosLidos.set(d, s);
  }
  return s;
}

const K = 0.5522847498;
function retangulo(x: number, y: number, w: number, h: number, r = 0): Seg[] {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!r) return [["M", x, y], ["L", x + w, y], ["L", x + w, y + h], ["L", x, y + h], ["Z"]];
  const k = r * K;
  return [
    ["M", x + r, y],
    ["L", x + w - r, y],
    ["C", x + w - r + k, y, x + w, y + r - k, x + w, y + r],
    ["L", x + w, y + h - r],
    ["C", x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h],
    ["L", x + r, y + h],
    ["C", x + r - k, y + h, x, y + h - r + k, x, y + h - r],
    ["L", x, y + r],
    ["C", x, y + r - k, x + r - k, y, x + r, y],
    ["Z"],
  ];
}

function elipse(cx: number, cy: number, rx: number, ry: number): Seg[] {
  const kx = rx * K;
  const ky = ry * K;
  return [
    ["M", cx + rx, cy],
    ["C", cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry],
    ["C", cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy],
    ["C", cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry],
    ["C", cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy],
    ["Z"],
  ];
}

function poligono(pontos: [number, number][]): Seg[] {
  return [...pontos.map(([x, y], i): Seg => [i === 0 ? "M" : "L", x, y]), ["Z"]];
}

function estrela(cx: number, cy: number, raio: number, miolo = 0.382): Seg[] {
  const pontos: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? raio : raio * miolo;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pontos.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poligono(pontos);
}

/** O escudo: reto em cima, as laterais descem e fecham em ponta (como no canvas, com duas quadráticas). */
function escudo(w: number, h: number): Seg[] {
  return [["M", 0, 0], ["L", w, 0], ["L", w, h * 0.55], quadratica(w, h * 0.55, w, h * 0.85, w / 2, h), quadratica(w / 2, h, 0, h * 0.85, 0, h * 0.55), ["Z"]];
}

/** As máscaras da foto, iguais às do motor. */
function mascara(m: Mascara | undefined, w: number, h: number): Seg[] {
  if (m === "circulo") return elipse(w / 2, h / 2, w / 2, h / 2);
  if (m === "estrela") return estrela(w / 2, h / 2, Math.min(w, h) / 2, 0.45);
  if (m === "escudo") return escudo(w, h);
  if (m === "losango") return poligono([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
  if (m === "arco") {
    const r = w / 2;
    const topo = Math.min(r, h);
    return [["M", 0, h], ["L", 0, topo], ...arcoEmCubicas(w / 2, topo, r, r, 1, 0, Math.PI, Math.PI), ["L", w, h], ["Z"]];
  }
  return retangulo(0, 0, w, h);
}

// ───── Cores ─────

interface Cor {
  r: number;
  g: number;
  b: number;
  a: number;
}
let normalizador: CanvasRenderingContext2D | null = null;
const coresLidas = new Map<string, Cor | null>();
/** Qualquer cor do CSS (hex, rgb, rgba, nome) em vermelho, verde, azul e opacidade; nula se for transparente. */
function lerCor(css: string | undefined): Cor | null {
  if (!css || css === "transparent" || css === "none") return null;
  if (coresLidas.has(css)) return coresLidas.get(css)!;
  normalizador ??= document.createElement("canvas").getContext("2d");
  let cor: Cor | null = null;
  if (normalizador) {
    normalizador.fillStyle = "#000000";
    normalizador.fillStyle = css;
    const valor = String(normalizador.fillStyle);
    const hex = /^#([0-9a-f]{6})$/i.exec(valor);
    const rgb = /^rgba?\(([^)]+)\)$/.exec(valor);
    if (hex) {
      const n = parseInt(hex[1], 16);
      cor = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    } else if (rgb) {
      const [r, g, b, a = 1] = rgb[1].split(",").map((v) => Number(v.trim()));
      cor = { r, g, b, a };
    }
  }
  if (cor && cor.a <= 0) cor = null;
  coresLidas.set(css, cor);
  return cor;
}
const TRANSPARENTE: Cor = { r: 0, g: 0, b: 0, a: 0 };
const hexDe = (c: Cor) => `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

// ───── A cena ─────

type Regra = "nonzero" | "evenodd";
type Pintura =
  | { modo: "cor"; cor: Cor; regra: Regra }
  | { modo: "degrade"; de: Cor; para: Cor; x0: number; y0: number; x1: number; y1: number; regra: Regra }
  | { modo: "traco"; cor: Cor; largura: number; ponta: "round" | "butt"; junta: "round" | "miter" };

type Item =
  | { tipo: "caminho"; segs: Seg[]; pintura: Pintura; alfa: number; recorte?: Seg[]; camada: number }
  | { tipo: "imagem"; fonte: FonteDeImagem; m: Matriz; w: number; h: number; alfa: number; recorte?: Seg[]; camada: number };

interface Cena {
  w: number;
  h: number;
  itens: Item[];
  /** O nome de cada camada (para os grupos do SVG) e, nas de texto, o texto (para quem lê com leitor de tela). */
  camadas: { nome: string; texto?: string }[];
}

/** Um "canvas" que, em vez de pintar, anota caminhos e imagens já na coordenada da página. */
class Pincel {
  itens: Item[] = [];
  camada = -1;
  private m: Matriz = IDENTIDADE;
  private alfa = 1;
  private corte: Seg[] | undefined;
  private pilha: { m: Matriz; alfa: number; corte: Seg[] | undefined }[] = [];

  salvar() {
    this.pilha.push({ m: this.m, alfa: this.alfa, corte: this.corte });
  }
  restaurar() {
    const p = this.pilha.pop();
    if (!p) return;
    this.m = p.m;
    this.alfa = p.alfa;
    this.corte = p.corte;
  }
  transformar(n: Matriz) {
    this.m = compor(this.m, n);
  }
  transladar(x: number, y: number) {
    this.transformar(translacao(x, y));
  }
  girar(a: number) {
    if (a) this.transformar(rotacao(a));
  }
  escalar(sx: number, sy = sx) {
    this.transformar([sx, 0, 0, sy, 0, 0]);
  }
  opacidade(a: number) {
    this.alfa *= a;
  }
  /** Recorta o que vier depois (um recorte por vez: o novo toma o lugar do anterior). */
  recortar(segs: Seg[]) {
    this.corte = transformar(segs, this.m);
  }
  preencher(segs: Seg[], css: string | undefined, regra: Regra = "nonzero") {
    const cor = lerCor(css);
    if (!cor || !segs.length || this.alfa <= 0) return;
    this.itens.push({ tipo: "caminho", segs: transformar(segs, this.m), pintura: { modo: "cor", cor, regra }, alfa: this.alfa, recorte: this.corte, camada: this.camada });
  }
  /** O degradê linear igual ao do motor: atravessa a caixa (w × h) no ângulo pedido. */
  degrade(segs: Seg[], g: Gradiente, w: number, h: number, regra: Regra = "nonzero") {
    if (!segs.length || this.alfa <= 0) return;
    const a = (g.angulo * Math.PI) / 180;
    const meio = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
    const [x0, y0] = aplicar(this.m, w / 2 - Math.cos(a) * meio, h / 2 - Math.sin(a) * meio);
    const [x1, y1] = aplicar(this.m, w / 2 + Math.cos(a) * meio, h / 2 + Math.sin(a) * meio);
    const de = lerCor(g.de) ?? TRANSPARENTE;
    const para = lerCor(g.para) ?? TRANSPARENTE;
    this.itens.push({ tipo: "caminho", segs: transformar(segs, this.m), pintura: { modo: "degrade", de, para, x0, y0, x1, y1, regra }, alfa: this.alfa, recorte: this.corte, camada: this.camada });
  }
  tracar(segs: Seg[], css: string | undefined, largura: number, ponta: "round" | "butt" = "butt", junta: "round" | "miter" = "miter") {
    const cor = lerCor(css);
    if (!cor || !segs.length || largura <= 0 || this.alfa <= 0) return;
    const escala = Math.sqrt(Math.abs(this.m[0] * this.m[3] - this.m[1] * this.m[2]));
    this.itens.push({ tipo: "caminho", segs: transformar(segs, this.m), pintura: { modo: "traco", cor, largura: largura * escala, ponta, junta }, alfa: this.alfa, recorte: this.corte, camada: this.camada });
  }
  imagem(fonte: FonteDeImagem, x: number, y: number, w: number, h: number) {
    if (this.alfa <= 0 || w <= 0 || h <= 0) return;
    this.itens.push({ tipo: "imagem", fonte, m: compor(this.m, translacao(x, y)), w, h, alfa: this.alfa, recorte: this.corte, camada: this.camada });
  }
}

// ───── Texto em curvas ─────

/** Os pesos de cada fonte em /fontes/estudio (vale o mais perto do pedido) e quais têm itálico de verdade. */
const PESOS: Record<Fonte, number[]> = { serifa: [400, 500, 600, 700, 800], sans: [400, 500, 600, 700, 800, 900], mono: [400, 500, 600], manuscrita: [400, 500, 600, 700] };
const ITALICAS: Record<Fonte, boolean> = { serifa: true, sans: true, mono: false, manuscrita: false };
/** A inclinação do itálico falso (a mesma do navegador quando a fonte não tem itálico). */
const OBLIQUA = 0.25;

function arquivoDaFonte(fonte: Fonte, peso: number, italico: boolean) {
  const perto = PESOS[fonte].reduce((a, b) => (Math.abs(b - peso) < Math.abs(a - peso) ? b : a));
  const deVerdade = italico && ITALICAS[fonte];
  return { url: `/fontes/estudio/${fonte}-${perto}${deVerdade ? "-italico" : ""}.ttf`, obliqua: italico && !deVerdade };
}

const fontesLidas = new Map<string, Promise<Font | null>>();
function carregarFonte(url: string): Promise<Font | null> {
  let p = fontesLidas.get(url);
  if (!p) {
    p = (async () => {
      try {
        const [{ parse }, resposta] = await Promise.all([import("opentype.js"), fetch(url)]);
        if (!resposta.ok) return null;
        return parse(await resposta.arrayBuffer());
      } catch {
        return null;
      }
    })();
    fontesLidas.set(url, p);
  }
  return p;
}

/** A fonte (e se o itálico é falso) de um pedaço de texto, pela descrição CSS que o motor usou para medir. */
function fonteDoPedaco(fonte: Fonte, css: string) {
  const m = /^(italic )?(\d+) /.exec(css);
  return arquivoDaFonte(fonte, m ? Number(m[2]) : 400, Boolean(m?.[1]));
}

/** Os comandos do opentype em segmentos; com base, inclina as letras a partir da linha de base (itálico falso). */
function dosComandos(comandos: PathCommand[], base: number | null): Seg[] {
  const inclinar = (x: number, y: number) => (base === null ? x : x + OBLIQUA * (base - y));
  const segs: Seg[] = [];
  let x = 0;
  let y = 0;
  for (const c of comandos) {
    if (c.type === "Z") {
      segs.push(["Z"]);
      continue;
    }
    if (c.type === "C") segs.push(["C", inclinar(c.x1, c.y1), c.y1, inclinar(c.x2, c.y2), c.y2, inclinar(c.x, c.y), c.y]);
    else if (c.type === "Q") segs.push(quadratica(inclinar(x, y), y, inclinar(c.x1, c.y1), c.y1, inclinar(c.x, c.y), c.y));
    else segs.push([c.type, inclinar(c.x, c.y), c.y]);
    x = c.x;
    y = c.y;
  }
  return segs;
}

class Letreiro {
  private fontes = new Map<string, Font>();
  /** Carrega as fontes de antemão: sem alguma delas, a camada sai como imagem. */
  async preparar(pedidos: { fonte: Fonte; css: string }[]): Promise<boolean> {
    for (const p of pedidos) {
      const { url } = fonteDoPedaco(p.fonte, p.css);
      if (this.fontes.has(url)) continue;
      const f = await carregarFonte(url);
      if (!f) return false;
      this.fontes.set(url, f);
    }
    return true;
  }
  /** As letras do texto em curvas, com a linha de base em y (o espaçamento entre letras em "em", como no canvas). */
  curvas(texto: string, fonte: Fonte, css: string, x: number, y: number, tamanho: number, espacamento: number): Seg[] {
    const { url, obliqua } = fonteDoPedaco(fonte, css);
    const f = this.fontes.get(url);
    if (!f) return [];
    const desenho = f.getPath(texto, x, y, tamanho, { kerning: true, letterSpacing: espacamento, features: { liga: !espacamento, rlig: true } });
    return dosComandos(desenho.commands, obliqua ? y : null);
  }
}

let regua: CanvasRenderingContext2D | null = null;
function medir(texto: string, css: string, espacamento: number) {
  regua ??= document.createElement("canvas").getContext("2d");
  if (!regua) return 0;
  regua.font = css;
  regua.letterSpacing = `${espacamento}em`;
  return regua.measureText(texto).width;
}

/** Quanto a linha de base fica abaixo do "middle" do canvas, medido pelo próprio navegador (como ele desenha). */
function meioDaLetra(css: string) {
  regua ??= document.createElement("canvas").getContext("2d");
  if (!regua) return 0;
  regua.font = css;
  regua.letterSpacing = "0px";
  regua.textBaseline = "alphabetic";
  const alfabetica = regua.measureText("H").actualBoundingBoxAscent;
  regua.textBaseline = "middle";
  const meio = regua.measureText("H").actualBoundingBoxAscent;
  regua.textBaseline = "alphabetic";
  return alfabetica - meio;
}

/** Um pedaço de letras pronto: os caminhos (no quadro dele), onde o quadro fica na camada e a cor. */
interface Letras {
  segs: Seg[];
  m: Matriz;
  cor: string;
  /** Letra de texto em arco: a sombra anda no quadro da letra, como no canvas. */
  arco: boolean;
}

async function textoNaCena(pincel: Pincel, c: CamadaTexto): Promise<boolean> {
  const tamanho = tamanhoQueCabe(c);
  const d = diagramar(c, undefined, tamanho);
  const letreiro = new Letreiro();
  const pedidos = d.linhas.flatMap((l) => l.pecas.map((p) => ({ fonte: c.fonte, css: p.fonte })));
  if (c.marcador === "numero" || c.marcador === "travessao") pedidos.push({ fonte: c.fonte, css: fonteCss(c, tamanho) });
  if (!(await letreiro.preparar(pedidos))) return false;

  const passo = tamanho * c.entrelinha;
  const altura = d.linhas.length * passo;
  const f = flecha(c, d);
  if (c.fundo) pincel.preencher(retangulo(0, 0, c.w, c.ajustar ? c.h : altura + 2 * c.recuo + f), c.fundo);
  const largura = Math.max(10, c.w - 2 * c.recuo - d.recuoMarcador);
  const corDoMarcador = c.destaque || COR["Vermelho da gráfica"];
  const espContorno = Math.max(1, c.espContorno ?? tamanho * 0.04);
  const comContorno = Boolean(c.vazado || (c.contorno && (c.espContorno ?? 0) > 0));

  // As letras e os marcadores, uma vez só; as passadas (sombra, letra, contorno) reusam.
  const letras: Letras[] = [];
  const marcadores: { segs: Seg[]; cor: string }[] = [];
  let numero = 0;
  d.linhas.forEach((linha, i) => {
    const base = c.recuo + (i + 0.78) * passo + (c.curva && c.curva < 0 ? f : 0);
    const x0 = c.recuo + d.recuoMarcador + (c.alinhar === "left" ? 0 : c.alinhar === "right" ? largura - linha.largura : (largura - linha.largura) / 2);
    if (linha.abre && c.marcador && linha.pecas.length) {
      numero++;
      const mx = x0 - d.recuoMarcador;
      const meio = base - tamanho * 0.32;
      const cor = c.marcador === "travessao" ? c.cor : corDoMarcador;
      if (c.marcador === "estrela") marcadores.push({ segs: estrela(mx + tamanho * 0.34, meio, tamanho * 0.34), cor });
      else if (c.marcador === "ponto") marcadores.push({ segs: elipse(mx + tamanho * 0.25, meio, tamanho * 0.12, tamanho * 0.12), cor });
      else marcadores.push({ segs: letreiro.curvas(c.marcador === "numero" ? `${numero}.` : "—", c.fonte, fonteCss(c, tamanho), mx, base, tamanho, c.espacamento), cor });
    }
    if (c.curva) {
      const teta = (Math.abs(c.curva) * Math.PI) / 180;
      const raio = Math.max(1, linha.largura) / Math.max(0.0001, teta);
      const cx = x0 + linha.largura / 2;
      const arco = c.curva > 0;
      const cy = arco ? base + raio : base - raio;
      let s = 0;
      for (const p of linha.pecas) {
        s = p.x;
        for (const ch of p.texto) {
          const larguraDaLetra = medir(ch, p.fonte, c.espacamento);
          const phi = -teta / 2 + (s + larguraDaLetra / 2) / raio;
          s += larguraDaLetra;
          if (!ch.trim()) continue;
          const m = arco
            ? compor(translacao(cx + raio * Math.sin(phi), cy - raio * Math.cos(phi)), rotacao(phi))
            : compor(translacao(cx + raio * Math.sin(phi), cy + raio * Math.cos(phi)), rotacao(-phi));
          letras.push({ segs: letreiro.curvas(ch, c.fonte, p.fonte, -larguraDaLetra / 2, 0, tamanho, c.espacamento), m, cor: p.cor, arco: true });
        }
      }
      return;
    }
    for (const p of linha.pecas) {
      if (!p.texto.trim()) continue;
      letras.push({ segs: letreiro.curvas(p.texto, c.fonte, p.fonte, x0 + p.x, base, tamanho, c.espacamento), m: IDENTIDADE, cor: p.cor, arco: false });
    }
  });

  const noQuadro = (t: Letras, desloca?: [number, number]) => {
    const m = !desloca ? t.m : t.arco ? compor(t.m, translacao(desloca[0], desloca[1])) : compor(translacao(desloca[0], desloca[1]), t.m);
    return transformar(t.segs, m);
  };
  if (c.sombra) {
    const desloca: [number, number] = [c.sombraX ?? 0, c.sombraY ?? 0];
    for (const mk of marcadores) pincel.preencher(transformar(mk.segs, translacao(desloca[0], desloca[1])), c.sombra);
    for (const t of letras) {
      const segs = noQuadro(t, desloca);
      pincel.preencher(segs, c.sombra);
      if (comContorno && !t.arco) pincel.tracar(segs, c.sombra, espContorno, "butt", "round");
    }
  }
  if (!c.vazado) {
    for (const mk of marcadores) pincel.preencher(mk.segs, mk.cor);
    for (const t of letras) pincel.preencher(noQuadro(t), t.cor);
  }
  if (comContorno) for (const t of letras) pincel.tracar(noQuadro(t), c.vazado && !c.contorno ? t.cor : c.contorno, espContorno, "butt", "round");
  return true;
}

// ───── Marca, formas, fotos e elementos ─────

function simbolo(pincel: Pincel, cor: string) {
  for (const d of CAMINHOS_DO_SIMBOLO) pincel.preencher(caminho(d), cor);
}

async function marcaNaCena(pincel: Pincel, c: CamadaMarca): Promise<boolean> {
  // No laboratório público a marca não sai (como na tela).
  if (emLaboratorio()) return true;
  const lado = Math.min(c.w, c.h);
  if (c.variante === "circulo") {
    pincel.preencher(elipse(lado / 2, lado / 2, lado / 2, lado / 2), c.fundo);
    pincel.salvar();
    pincel.transladar(lado / 2, lado * 0.508);
    pincel.escalar((lado / 120) * 0.62);
    pincel.transladar(-60, -59);
    simbolo(pincel, c.cor);
    pincel.restaurar();
  } else if (c.variante === "nome") {
    const alturaS = c.h;
    const css = fonteCss({ fonte: "serifa", peso: 700, italico: false } as CamadaTexto, alturaS * 0.55);
    const letreiro = new Letreiro();
    if (!(await letreiro.preparar([{ fonte: "serifa", css }]))) return false;
    pincel.salvar();
    pincel.escalar(alturaS / 120);
    simbolo(pincel, c.cor);
    pincel.restaurar();
    const base = alturaS * 0.52 + meioDaLetra(css);
    pincel.preencher(letreiro.curvas("Instituto Lúcia", "serifa", css, alturaS * 1.1, base, alturaS * 0.55, 0), c.cor);
  } else {
    pincel.salvar();
    pincel.escalar(lado / 120);
    simbolo(pincel, c.cor);
    pincel.restaurar();
  }
  return true;
}

function formaNaCena(pincel: Pincel, c: CamadaForma) {
  const preencher = (segs: Seg[]) => {
    if (c.gradiente) pincel.degrade(segs, c.gradiente, c.w, c.h);
    else pincel.preencher(segs, c.preenchimento);
  };
  const pintar = (segs: Seg[]) => {
    preencher(segs);
    if (c.borda && c.espessura > 0) pincel.tracar(segs, c.borda, c.espessura);
  };
  const menor = Math.min(c.w, c.h);
  switch (c.tipo) {
    case "retangulo":
      return pintar(retangulo(0, 0, c.w, c.h, c.raio));
    case "elipse":
      return pintar(elipse(c.w / 2, c.h / 2, c.w / 2, c.h / 2));
    case "estrela":
      return pintar(estrela(c.w / 2, c.h / 2 + menor * 0.04, menor / 2));
    case "triangulo":
      return pintar(poligono([[c.w / 2, 0], [c.w, c.h], [0, c.h]]));
    case "escudo":
      return pintar(escudo(c.w, c.h));
    case "cunha":
      return pintar(poligono([[c.w, 0], [c.w, c.h], [0, c.h]]));
    case "linha": {
      const e = Math.max(1, c.espessura);
      return preencher(retangulo(0, c.h / 2 - e / 2, c.w, e));
    }
    case "raios": {
      const cx = c.w / 2;
      const cy = c.h / 2;
      const raio = Math.max(c.w, c.h);
      const segs: Seg[] = [];
      for (let i = 0; i < 24; i += 2) {
        const a0 = (i * Math.PI * 2) / 24;
        const a1 = ((i + 1) * Math.PI * 2) / 24;
        segs.push(...poligono([[cx, cy], [cx + Math.cos(a0) * raio, cy + Math.sin(a0) * raio], [cx + Math.cos(a1) * raio, cy + Math.sin(a1) * raio]]));
      }
      pincel.salvar();
      pincel.recortar(retangulo(0, 0, c.w, c.h));
      preencher(segs);
      pincel.restaurar();
    }
  }
}

function fotoNaCena(pincel: Pincel, c: CamadaImagem) {
  const fonte = imagemTratada(c);
  const forma = mascara(c.mascara, c.w, c.h);
  pincel.salvar();
  pincel.recortar(forma);
  if (fonte) {
    const pos = posicaoDaFoto(c, fonte.width, fonte.height, c.w, c.h);
    pincel.imagem(fonte, pos.x, pos.y, pos.w, pos.h);
  } else pincel.preencher(retangulo(0, 0, c.w, c.h), COR.Fio);
  pincel.restaurar();
  if (c.borda && c.espessura > 0) {
    const e = c.espessura;
    if (!c.mascara) pincel.tracar(retangulo(e / 2, e / 2, c.w - e, c.h - e), c.borda, e);
    else {
      pincel.salvar();
      pincel.recortar(forma);
      pincel.tracar(forma, c.borda, e * 2);
      pincel.restaurar();
    }
  }
}

/** Os elementos que têm desenho vetorial; os outros (carimbo, selo, louros, fita, pincelada...) saem como imagem. */
function elementoNaCena(pincel: Pincel, e: CamadaElemento): boolean {
  const cor = e.cor || "#1f1a14";
  const { w, h } = e;
  if (e.desenho in VETORES) {
    const v = VETORES[e.desenho as keyof typeof VETORES];
    const escala = Math.min(w / v.caixa[0], h / v.caixa[1]);
    pincel.salvar();
    pincel.transladar((w - v.caixa[0] * escala) / 2, (h - v.caixa[1] * escala) / 2);
    pincel.escalar(escala);
    pincel.transladar(v.desloca[0], v.desloca[1]);
    for (const d of v.caminhos) pincel.preencher(caminho(d), cor, "evenodd");
    pincel.restaurar();
    return true;
  }
  switch (e.desenho) {
    case "brasil-estados": {
      const lado = Math.min(w, h);
      const destaque = new Set((e.conteudo || "").toUpperCase().split(/[^A-Z]+/).filter(Boolean));
      pincel.salvar();
      pincel.transladar(w / 2, h / 2);
      pincel.escalar(lado / 1000);
      for (const estado of ESTADOS) pincel.preencher(caminho(estado.d), destaque.has(estado.uf) ? e.fundo || "#c21f16" : cor, "evenodd");
      pincel.tracar(
        ESTADOS.flatMap((estado) => caminho(estado.d)),
        "rgba(251, 247, 236, 0.9)",
        Math.max(0.6, e.espessura || 1.4),
        "butt",
        "round",
      );
      pincel.restaurar();
      return true;
    }
    case "icone": {
      const nome = e.icone && e.icone in ICONES ? e.icone : "estrela";
      const lado = Math.min(w, h);
      const lista = ICONES[nome].map(caminho);
      pincel.salvar();
      pincel.transladar((w - lado) / 2, (h - lado) / 2);
      pincel.escalar(lado / 24);
      if (e.fundo) for (const segs of lista) pincel.preencher(segs, e.fundo);
      pincel.tracar(lista.flat(), cor, e.espessura > 0 ? e.espessura : 1.6, "round", "round");
      pincel.restaurar();
      return true;
    }
    case "qr": {
      const m = matrizQr(e.conteudo);
      const lado = Math.min(w, h);
      pincel.salvar();
      pincel.transladar((w - lado) / 2, (h - lado) / 2);
      if (e.fundo) pincel.preencher(retangulo(0, 0, lado, lado), e.fundo);
      if (m) {
        // Os módulos vizinhos de cada linha num retângulo só (o arquivo fica pequeno e sem frestas).
        const passo = lado / (m.tamanho + 4);
        const segs: Seg[] = [];
        for (let l = 0; l < m.tamanho; l++)
          for (let col = 0; col < m.tamanho; col++) {
            if (!m.cheio(l, col)) continue;
            let fim = col;
            while (fim + 1 < m.tamanho && m.cheio(l, fim + 1)) fim++;
            segs.push(...retangulo((col + 2) * passo, (l + 2) * passo, (fim - col + 1) * passo, passo));
            col = fim;
          }
        pincel.preencher(segs, cor);
      }
      pincel.restaurar();
      return true;
    }
    case "raios-traco": {
      const n = e.quantidade && e.quantidade >= 6 ? e.quantidade : 36;
      const cx = w / 2;
      const cy = h / 2;
      const r0 = Math.min(w, h) * 0.18;
      const r1 = Math.hypot(w, h) / 2;
      const segs: Seg[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n;
        segs.push(["M", cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], ["L", cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]);
      }
      pincel.salvar();
      pincel.recortar(retangulo(0, 0, w, h));
      pincel.tracar(segs, cor, e.espessura > 0 ? e.espessura : Math.max(1, Math.min(w, h) / 120));
      pincel.restaurar();
      return true;
    }
    case "seta-mao": {
      const largura = e.espessura > 0 ? e.espessura : Math.max(2, Math.min(w, h) / 18);
      pincel.tracar([["M", w * 0.06, h * 0.2], ["C", w * 0.5, h * 0.02, w * 0.92, h * 0.3, w * 0.8, h * 0.86]], cor, largura, "round", "round");
      pincel.tracar([["M", w * 0.6, h * 0.68], ["L", w * 0.8, h * 0.88], ["L", w * 0.96, h * 0.64]], cor, largura, "round", "round");
      return true;
    }
    default:
      return false;
  }
}

/** A camada como vetor; falso quando ela (ou um efeito dela) só existe como imagem. Falso não anota nada. */
async function vetorDaCamada(pincel: Pincel, c: Camada): Promise<boolean> {
  if (c.textura) return false;
  if (c.tipo === "imagem" && ((c.meioTom ?? 0) > 0 || c.moldura === "revelada")) return false;
  pincel.salvar();
  pincel.opacidade(c.opacidade);
  pincel.transladar(c.x + c.w / 2, c.y + c.h / 2);
  pincel.girar((c.rot * Math.PI) / 180);
  pincel.transladar(-c.w / 2, -c.h / 2);
  let ok = true;
  if (c.tipo === "texto") ok = await textoNaCena(pincel, c);
  else if (c.tipo === "imagem") fotoNaCena(pincel, c);
  else if (c.tipo === "marca") ok = await marcaNaCena(pincel, c);
  else if (c.tipo === "elemento") ok = elementoNaCena(pincel, c);
  else formaNaCena(pincel, c);
  pincel.restaurar();
  return ok;
}

interface OpcoesDaCena {
  /** Pixels por unidade da arte nas partes que saem como imagem (2 para tela; perto de 300 dpi para gráfica). */
  resolucao: number;
  /** Quanto o fundo e os fios avançam para fora da página (a sangria, em unidades da arte). */
  sangria: number;
}

/** A página inteira como cena. As variáveis da página precisam estar valendo (veja comPagina). */
async function cenaDaPagina(doc: Documento, o: OpcoesDaCena): Promise<Cena> {
  await carregarTudo(doc);
  const pincel = new Pincel();
  const camadas: Cena["camadas"] = [];
  const f = doc.fundo;
  const s = o.sangria;
  // O fundo: vetor (cor, degradê e a trama de pontinhos) ou, com papel, imagem.
  const caixaComSangria = retangulo(-s, -s, doc.w + 2 * s, doc.h + 2 * s);
  if (f.textura === "papel") {
    pincel.preencher(caixaComSangria, f.cor);
    const tela = document.createElement("canvas");
    desenhar(tela, { ...doc, camadas: [], fundo: { ...f, espessura: 0, vinheta: 0 } }, o.resolucao);
    pincel.imagem(tela, 0, 0, doc.w, doc.h);
  } else {
    if (f.gradiente) pincel.degrade(caixaComSangria, f.gradiente, doc.w, doc.h);
    else pincel.preencher(caixaComSangria, f.cor);
    if (f.pontilhado) {
      const passo = Math.round(doc.w / 40);
      const ponto = Math.max(1.5, passo * 0.06);
      const segs: Seg[] = [];
      for (let y = passo / 2; y < doc.h; y += passo) for (let x = passo / 2; x < doc.w; x += passo) segs.push(...retangulo(x, y, ponto, ponto));
      pincel.preencher(segs, "rgba(31, 26, 20, 0.09)");
    }
  }
  for (const c of doc.camadas) {
    if (c.oculta || c.soGuia) continue;
    pincel.camada = camadas.push({ nome: nomeDaCamada(c), texto: c.tipo === "texto" ? semMarcas(textoFinal(c)).trim() : undefined }) - 1;
    if (await vetorDaCamada(pincel, c)) continue;
    const r = recorteDaCamada(c, o.resolucao);
    pincel.imagem(r.tela, r.x, r.y, r.w, r.h);
  }
  pincel.camada = -1;
  if (f.espessura > 0) {
    if (f.bordaCima) pincel.preencher(retangulo(-s, -s, doc.w + 2 * s, f.espessura + s), f.bordaCima);
    if (f.bordaBaixo) pincel.preencher(retangulo(-s, doc.h - f.espessura, doc.w + 2 * s, f.espessura + s), f.bordaBaixo);
  }
  const cobertura = coberturaDaPagina(doc, o.resolucao);
  if (cobertura) pincel.imagem(cobertura, 0, 0, doc.w, doc.h);
  return { w: doc.w, h: doc.h, itens: pincel.itens, camadas };
}

// ───── As imagens embutidas ─────

function telaDe(fonte: FonteDeImagem): HTMLCanvasElement {
  if (fonte instanceof HTMLCanvasElement) return fonte;
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(fonte.width));
  tela.height = Math.max(1, Math.round(fonte.height));
  tela.getContext("2d")?.drawImage(fonte, 0, 0, tela.width, tela.height);
  return tela;
}

function pixels(tela: HTMLCanvasElement): ImageData | null {
  try {
    return tela.getContext("2d", { willReadFrequently: true })?.getImageData(0, 0, tela.width, tela.height) ?? null;
  } catch {
    return null;
  }
}

const opaca = (dados: ImageData) => {
  const px = dados.data;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 255) return false;
  return true;
};

function blobDe(tela: HTMLCanvasElement, tipo: string, qualidade?: number): Promise<Blob> {
  return new Promise((ok, falha) => tela.toBlob((b) => (b ? ok(b) : falha(new Error("imagem"))), tipo, qualidade));
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => falha(new Error("imagem"));
    leitor.readAsDataURL(blob);
  });
}

/** A imagem para o SVG: a foto original quando já é um data:, senão JPEG (opaca) ou PNG (com transparência). */
async function imagemDoSvg(fonte: FonteDeImagem): Promise<string | null> {
  if (fonte instanceof HTMLImageElement && fonte.src.startsWith("data:")) return fonte.src;
  const tela = telaDe(fonte);
  const dados = pixels(tela);
  if (!dados) return null;
  return dataUrl(await blobDe(tela, opaca(dados) ? "image/jpeg" : "image/png", 0.92));
}

async function comprimir(dados: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
    return new Uint8Array(await new Response(fluxo).arrayBuffer());
  } catch {
    return null;
  }
}

// ───── SVG ─────

const n2 = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};
const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function dDoSvg(segs: Seg[]): string {
  let d = "";
  for (const s of segs) {
    if (s[0] === "Z") d += "Z";
    else if (s[0] === "C") d += `C${n2(s[1])} ${n2(s[2])} ${n2(s[3])} ${n2(s[4])} ${n2(s[5])} ${n2(s[6])}`;
    else d += `${s[0]}${n2(s[1])} ${n2(s[2])}`;
  }
  return d;
}
const opacidade = (nome: string, v: number) => (v < 0.999 ? ` ${nome}="${n2(Math.max(0, v))}"` : "");
const identificador = (nome: string, i: number) => `camada-${i + 1}-${nomeDeArquivo(nome).slice(0, 40) || "sem-nome"}`;

/** Uma página em SVG, com o texto em curvas. As variáveis da página precisam estar valendo (veja comPagina). */
export async function svgDaPagina(doc: Documento, titulo: string): Promise<string> {
  const cena = await cenaDaPagina(doc, { resolucao: 2, sangria: 0 });
  const mm = formatoPorMedida(doc.w, doc.h)?.mm;
  const defs: string[] = [];
  const corpo: string[] = [];
  const recortes = new Map<string, string>();
  const imagens = new Map<FonteDeImagem, string | null>();
  let degrades = 0;
  let aberta = -1;
  const fecharGrupo = () => {
    if (aberta >= 0) corpo.push("</g>");
    aberta = -1;
  };
  for (const item of cena.itens) {
    // Cada camada da arte vira um grupo com o nome dela (os programas de desenho mostram como camada).
    if (item.camada !== aberta) {
      fecharGrupo();
      if (item.camada >= 0) {
        const camada = cena.camadas[item.camada];
        corpo.push(`<g id="${identificador(camada.nome, item.camada)}" data-name="${escapar(camada.nome)}"${camada.texto ? ` aria-label="${escapar(camada.texto)}"` : ""}>`);
        aberta = item.camada;
      }
    }
    let recorte = "";
    if (item.recorte) {
      const d = dDoSvg(item.recorte);
      recorte = recortes.get(d) ?? "";
      if (!recorte) {
        recorte = `recorte-${recortes.size + 1}`;
        recortes.set(d, recorte);
        defs.push(`<clipPath id="${recorte}" clipPathUnits="userSpaceOnUse"><path d="${d}"/></clipPath>`);
      }
    }
    let elemento: string;
    if (item.tipo === "imagem") {
      if (!imagens.has(item.fonte)) imagens.set(item.fonte, await imagemDoSvg(item.fonte));
      const url = imagens.get(item.fonte);
      if (!url) continue;
      elemento = `<image width="${n2(item.w)}" height="${n2(item.h)}" preserveAspectRatio="none" transform="matrix(${item.m.map(n2).join(" ")})" xlink:href="${url}"${opacidade("opacity", item.alfa)}/>`;
    } else {
      const d = dDoSvg(item.segs);
      const p = item.pintura;
      if (p.modo === "traco") {
        elemento = `<path d="${d}" fill="none" stroke="${hexDe(p.cor)}" stroke-width="${n2(p.largura)}"${p.ponta === "round" ? ' stroke-linecap="round"' : ""}${p.junta === "round" ? ' stroke-linejoin="round"' : ""}${opacidade("stroke-opacity", p.cor.a * item.alfa)}/>`;
      } else if (p.modo === "cor") {
        elemento = `<path d="${d}" fill="${hexDe(p.cor)}"${p.regra === "evenodd" ? ' fill-rule="evenodd"' : ""}${opacidade("fill-opacity", p.cor.a * item.alfa)}/>`;
      } else {
        const id = `degrade-${++degrades}`;
        defs.push(
          `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n2(p.x0)}" y1="${n2(p.y0)}" x2="${n2(p.x1)}" y2="${n2(p.y1)}"><stop offset="0" stop-color="${hexDe(p.de)}"${opacidade("stop-opacity", p.de.a)}/><stop offset="1" stop-color="${hexDe(p.para)}"${opacidade("stop-opacity", p.para.a)}/></linearGradient>`,
        );
        elemento = `<path d="${d}" fill="url(#${id})"${p.regra === "evenodd" ? ' fill-rule="evenodd"' : ""}${opacidade("fill-opacity", item.alfa)}/>`;
      }
    }
    // O recorte num grupo à parte: no SVG, o recorte de um elemento com transform andaria junto com ele.
    corpo.push(recorte ? `<g clip-path="url(#${recorte})">${elemento}</g>` : elemento);
  }
  fecharGrupo();
  const nome = doc.nome ? `${titulo} — ${doc.nome}` : titulo;
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${mm ? `${mm[0]}mm` : doc.w}" height="${mm ? `${mm[1]}mm` : doc.h}" viewBox="0 0 ${doc.w} ${doc.h}" role="img">`,
    `<title>${escapar(nome)}</title>`,
    doc.alt ? `<desc>${escapar(doc.alt)}</desc>` : "",
    `<metadata>${emLaboratorio() ? "Feito no laboratório público de design (uso livre, sem vínculo com nenhuma instituição)." : "Feito no estúdio do Instituto Lúcia."} Texto convertido em curvas com fontes de licença livre (SIL Open Font License 1.1).</metadata>`,
    defs.length ? `<defs>${defs.join("")}</defs>` : "",
    ...corpo,
    "</svg>",
  ]
    .filter(Boolean)
    .join("\n");
}

/** As páginas pedidas em .svg (uma só) ou num .zip (várias). */
export async function baixarSvg(p: Projeto, titulo: string, paginas: number[], voltar: Record<string, string>, progresso?: (f: number) => void): Promise<{ blob: Blob; nome: string }> {
  const base = nomeDeArquivo(titulo);
  const arquivos: { nome: string; dados: Blob }[] = [];
  for (const [n, i] of paginas.entries()) {
    const doc = p.paginas[i];
    const svg = await comPagina(p, i, () => svgDaPagina(doc, titulo), voltar);
    const rotulo = p.paginas.length > 1 ? `-${String(i + 1).padStart(2, "0")}${doc.nome ? `-${nomeDeArquivo(doc.nome)}` : ""}` : "";
    arquivos.push({ nome: `${base}${rotulo}.svg`, dados: new Blob([svg], { type: "image/svg+xml" }) });
    progresso?.((n + 1) / paginas.length);
  }
  if (arquivos.length === 1) return { blob: arquivos[0].dados, nome: arquivos[0].nome };
  return { blob: await ziparBinarios(arquivos), nome: `${base}-svg.zip` };
}

// ───── PDF ─────

const n3 = (v: number) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};
const corPdf = (c: Cor) => `${n3(c.r / 255)} ${n3(c.g / 255)} ${n3(c.b / 255)}`;

function dDoPdf(segs: Seg[]): string {
  let d = "";
  for (const s of segs) {
    if (s[0] === "Z") d += "h\n";
    else if (s[0] === "C") d += `${n3(s[1])} ${n3(s[2])} ${n3(s[3])} ${n3(s[4])} ${n3(s[5])} ${n3(s[6])} c\n`;
    else d += `${n3(s[1])} ${n3(s[2])} ${s[0] === "M" ? "m" : "l"}\n`;
  }
  return d;
}

/** Os recursos de uma página do PDF (opacidades, degradês e imagens), cada um anotado uma vez só. */
class RecursosDoPdf {
  opacidades: [number, number][] = [];
  sombreados: string[] = [];
  fotos: NonNullable<PaginaPdf["fotos"]> = [];
  rgba: NonNullable<PaginaPdf["imagensRgba"]> = [];
  private estados = new Map<string, number>();
  private imagens = new Map<FonteDeImagem, string | null>();

  estado(preencher: number, tracar: number): string {
    if (preencher >= 0.999 && tracar >= 0.999) return "";
    const chave = `${n3(preencher)} ${n3(tracar)}`;
    let i = this.estados.get(chave);
    if (i === undefined) {
      i = this.opacidades.push([Math.max(0, preencher), Math.max(0, tracar)]) - 1;
      this.estados.set(chave, i);
    }
    return `/GS${i} gs\n`;
  }
  degrade(p: Extract<Pintura, { modo: "degrade" }>): string {
    // O PDF não guarda opacidade nas pontas do degradê: a cor vale cheia (a opacidade da camada continua valendo).
    const dicionario = `<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [${n3(p.x0)} ${n3(p.y0)} ${n3(p.x1)} ${n3(p.y1)}] /Function << /FunctionType 2 /Domain [0 1] /C0 [${corPdf(p.de)}] /C1 [${corPdf(p.para)}] /N 1 >> /Extend [true true] >>`;
    return `/Sh${this.sombreados.push(dicionario) - 1}`;
  }
  async imagem(fonte: FonteDeImagem): Promise<string | null> {
    if (this.imagens.has(fonte)) return this.imagens.get(fonte)!;
    let nome: string | null = null;
    const tela = telaDe(fonte);
    const dados = pixels(tela);
    if (dados) {
      if (opaca(dados)) {
        const jpeg = new Uint8Array(await (await blobDe(tela, "image/jpeg", 0.92)).arrayBuffer());
        nome = `/Jp${this.fotos.push({ jpeg, w: tela.width, h: tela.height }) - 1}`;
      } else {
        const total = tela.width * tela.height;
        const rgb = new Uint8Array(total * 3);
        const alfa = new Uint8Array(total);
        const px = dados.data;
        for (let i = 0; i < total; i++) {
          rgb[i * 3] = px[i * 4];
          rgb[i * 3 + 1] = px[i * 4 + 1];
          rgb[i * 3 + 2] = px[i * 4 + 2];
          alfa[i] = px[i * 4 + 3];
        }
        const [rgbZ, alfaZ] = await Promise.all([comprimir(rgb), comprimir(alfa)]);
        const flate = Boolean(rgbZ && alfaZ);
        nome = `/Ia${this.rgba.push({ rgb: flate ? rgbZ! : rgb, alfa: flate ? alfaZ! : alfa, w: tela.width, h: tela.height, flate }) - 1}`;
      }
    }
    this.imagens.set(fonte, nome);
    return nome;
  }
}

/** Os operadores do PDF para a cena, na coordenada da arte (quem chama põe a matriz da página antes). */
async function desenhoDaCena(cena: Cena, r: RecursosDoPdf): Promise<string> {
  let ops = "";
  for (const item of cena.itens) {
    let parte = "q\n";
    if (item.recorte) parte += `${dDoPdf(item.recorte)}W n\n`;
    if (item.tipo === "imagem") {
      const nome = await r.imagem(item.fonte);
      if (!nome) continue;
      // A imagem do PDF ocupa o quadrado unitário com a primeira linha em cima: com o eixo y para baixo, ela vira.
      parte += `${r.estado(item.alfa, item.alfa)}${item.m.map(n3).join(" ")} cm\n${n3(item.w)} 0 0 ${n3(-item.h)} 0 ${n3(item.h)} cm\n${nome} Do\n`;
    } else {
      const p = item.pintura;
      const d = dDoPdf(item.segs);
      if (p.modo === "cor") parte += `${r.estado(p.cor.a * item.alfa, 1)}${corPdf(p.cor)} rg\n${d}${p.regra === "evenodd" ? "f*" : "f"}\n`;
      else if (p.modo === "traco") parte += `${r.estado(1, p.cor.a * item.alfa)}${corPdf(p.cor)} RG ${n3(p.largura)} w ${p.ponta === "round" ? 1 : 0} J ${p.junta === "round" ? 1 : 0} j\n${d}S\n`;
      else parte += `${r.estado(item.alfa, 1)}${d}${p.regra === "evenodd" ? "W*" : "W"} n\n${r.degrade(p)} sh\n`;
    }
    ops += `${parte}Q\n`;
  }
  return ops;
}

const PONTOS_POR_MM = 72 / 25.4;
const enc = new TextEncoder();

/**
 * O PDF vetorial: texto em curvas, formas e marca como vetor, fotos e efeitos como imagem (perto de 300 dpi). Nos
 * formatos impressos, na medida final com sangria (o fundo e os fios avançam; o que passa da borda da arte também
 * aparece) e marcas de corte; nos de tela, no tamanho da arte a 150 pixels por polegada, como o PDF da gráfica.
 */
export async function pdfVetorial(p: Projeto, titulo: string, voltar: Record<string, string>, opcoes: { sangria: number; marcas: boolean }, progresso?: (f: number) => void): Promise<Blob> {
  const paginas: PaginaPdf[] = [];
  for (const [i, doc] of p.paginas.entries()) {
    const mm = formatoPorMedida(doc.w, doc.h)?.mm;
    const larguraMm = mm ? mm[0] : (doc.w / 150) * 25.4;
    const alturaMm = mm ? mm[1] : (doc.h / 150) * 25.4;
    const k = (larguraMm * PONTOS_POR_MM) / doc.w;
    const sangriaMm = mm ? opcoes.sangria : 0;
    const sangriaPt = sangriaMm * PONTOS_POR_MM;
    const sangria = sangriaPt / k;
    const resolucao = Math.min(5, Math.max(2, ((larguraMm / 25.4) * 300) / doc.w));
    const cena = await comPagina(p, i, () => cenaDaPagina(doc, { resolucao, sangria }), voltar);
    const margem = mm && opcoes.marcas ? 12 * PONTOS_POR_MM : 0;
    const larguraPt = (larguraMm + 2 * sangriaMm) * PONTOS_POR_MM + 2 * margem;
    const alturaPt = (alturaMm + 2 * sangriaMm) * PONTOS_POR_MM + 2 * margem;
    const corte = margem + sangriaPt;
    const recursos = new RecursosDoPdf();
    // A arte com o eixo y para baixo (como no canvas), recortada na sangria.
    let ops = `q\n${n3(k)} 0 0 ${n3(-k)} ${n3(corte)} ${n3(alturaPt - corte)} cm\n${n3(-sangria)} ${n3(-sangria)} ${n3(doc.w + 2 * sangria)} ${n3(doc.h + 2 * sangria)} re W n\n`;
    ops += await desenhoDaCena(cena, recursos);
    ops += "Q\n";
    if (mm && opcoes.marcas) {
      ops += marcasDeCorte(corte, corte, larguraMm * PONTOS_POR_MM, alturaMm * PONTOS_POR_MM, sangriaPt);
      const linha = `${titulo} — página ${i + 1} de ${p.paginas.length} — ${larguraMm} × ${alturaMm} mm, vetorial (texto em curvas), sangria de ${sangriaMm} mm — ${assinatura()}`;
      ops += `BT /F1 6 Tf 0 0 0 rg ${n3(margem)} ${n3(margem / 3)} Td (${textoPdf(linha)}) Tj ET\n`;
    }
    const comprimido = await comprimir(enc.encode(ops));
    paginas.push({
      largura: larguraPt,
      altura: alturaPt,
      imagens: [],
      ...(comprimido ? { desenhoComprimido: comprimido } : { desenho: ops }),
      opacidades: recursos.opacidades,
      sombreados: recursos.sombreados,
      fotos: recursos.fotos,
      imagensRgba: recursos.rgba,
    });
    progresso?.((i + 1) / p.paginas.length);
  }
  return montarPdf(paginas, titulo);
}

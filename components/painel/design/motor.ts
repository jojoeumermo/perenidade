// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O motor do estúdio de design: o documento (camadas de texto, formas, imagens, elementos e a marca), o desenho na
// tela, a medida dos textos (com estilos misturados, hifenização, listas e texto em arco), as fotos com ajustes,
// os efeitos de cartaz, a animação simples, as guias e a exportação. Tudo roda no navegador.

import { fontes } from "../podcast/Arte";
import { type DadosDoElemento, desenharElemento } from "./elementos";
import { hifenizar, semMarcas, trechos, type Trecho } from "./texto-rico";

export type Fonte = "serifa" | "sans" | "mono" | "manuscrita";
export type Alinhar = "left" | "center" | "right";
export interface Gradiente {
  de: string;
  para: string;
  /** Em graus: 0 vai da esquerda para a direita, 90 de cima para baixo. */
  angulo: number;
}
export type TipoDeAnimacao = "subir" | "aparecer" | "revelar" | "cortina" | "contador" | "crescer";
export interface Animacao {
  tipo: TipoDeAnimacao;
  /** Segundos desde o começo do vídeo. */
  inicio: number;
  duracao: number;
}

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
  /** Camadas com o mesmo grupo se selecionam e se movem juntas. */
  grupo?: string;
  /** Só aparece no estúdio (guia de figurinha, rascunho): não sai na exportação. */
  soGuia?: boolean;
  /** Textura de serigrafia: a tinta "falha" em pontinhos, como impressão manual. */
  textura?: boolean;
  anim?: Animacao | null;
}
export type Marcador = "" | "estrela" | "ponto" | "numero" | "travessao";
export interface CamadaTexto extends Base {
  tipo: "texto";
  /** Aceita _itálico_, **negrito** e ==destaque== (veja texto-rico.ts) e variáveis como {link}. */
  texto: string;
  fonte: Fonte;
  tamanho: number;
  peso: 400 | 500 | 600 | 700 | 800 | 900;
  italico: boolean;
  cor: string;
  alinhar: Alinhar;
  /** Entrelinha, em vezes o tamanho (0,8 a 2). */
  entrelinha: number;
  /** Espaço entre letras, em "em" (-0,05 a 0,4). */
  espacamento: number;
  maiusculas: boolean;
  /** Tarja atrás do texto (vazio: nenhuma). */
  fundo: string;
  /** Recuo interno da tarja, em pontos. */
  recuo: number;
  /** A cor do ==destaque== (padrão: vermelho da gráfica). */
  destaque?: string;
  /** Texto em arco: graus de curvatura (positivo, arco para cima; negativo, sorriso). */
  curva?: number;
  /** Cor do contorno das letras (vazio: sem contorno). */
  contorno?: string;
  espContorno?: number;
  /** Só o contorno, letra vazada. */
  vazado?: boolean;
  /** Sombra sólida deslocada (cor; vazio: sem sombra). */
  sombra?: string;
  sombraX?: number;
  sombraY?: number;
  /** O texto diminui sozinho para caber na caixa (a altura da caixa fica fixa). */
  ajustar?: boolean;
  marcador?: Marcador;
  hifenizar?: boolean;
  /** Estilo de texto da marca ao qual a camada está ligada (muda junto com o estilo). */
  estilo?: string;
}
export type TipoDeForma = "retangulo" | "elipse" | "estrela" | "linha" | "cunha" | "raios" | "triangulo" | "escudo";
export interface CamadaForma extends Base {
  tipo: TipoDeForma;
  preenchimento: string;
  borda: string;
  espessura: number;
  raio: number;
  gradiente?: Gradiente | null;
}
export type Mascara = "" | "circulo" | "estrela" | "escudo" | "arco" | "losango";
export interface CamadaImagem extends Base {
  tipo: "imagem";
  src: string;
  credito: string;
  filtro: "nenhum" | "pb" | "duotom" | "sepia" | "contraste";
  ajuste: "cobrir" | "conter";
  borda: string;
  espessura: number;
  /** Ajustes de -100 a 100. */
  brilho?: number;
  contraste?: number;
  saturacao?: number;
  temperatura?: number;
  espelhar?: boolean;
  virar?: boolean;
  girar?: 0 | 90 | 180 | 270;
  /** Recorte livre, em frações da imagem original (0 a 1). */
  recorte?: { x: number; y: number; w: number; h: number } | null;
  /** A foto dentro da moldura: deslocamento de -1 a 1 e aproximação (1 a 4). */
  enquadre?: { x: number; y: number; zoom: number } | null;
  mascara?: Mascara;
  /** Foto revelada: borda branca, fita e legenda à mão. */
  moldura?: "" | "revelada";
  legendaFoto?: string;
  /** Meio-tom de jornal: tamanho da retícula em pontos (0: desligado). */
  meioTom?: number;
  corMeioTom?: string;
  /** Máscara do fundo removido (PNG em data:, o que é opaco fica, o transparente sai). */
  fundoRemovido?: string;
}
export interface CamadaMarca extends Base {
  tipo: "marca";
  variante: "simbolo" | "circulo" | "nome";
  cor: string;
  fundo: string;
}
export interface CamadaElemento extends Base, DadosDoElemento {
  tipo: "elemento";
}
export type Camada = CamadaTexto | CamadaForma | CamadaImagem | CamadaMarca | CamadaElemento;

export interface Fundo {
  cor: string;
  /** A trama de pontinhos dos posts do instituto. */
  pontilhado: boolean;
  bordaCima: string;
  bordaBaixo: string;
  espessura: number;
  gradiente?: Gradiente | null;
  textura?: "" | "papel" | "serigrafia";
  /** Escurece as bordas (0 a 1). */
  vinheta?: number;
}
export interface Documento {
  v: 1;
  w: number;
  h: number;
  fundo: Fundo;
  camadas: Camada[];
  /** Numa arte de várias páginas: identificação, nome, texto alternativo e a versão (A/B). */
  id?: string;
  nome?: string;
  alt?: string;
  variante?: string;
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

/** Os formatos. Os impressos levam o tamanho em milímetros (para o PDF da gráfica). */
export const FORMATOS = [
  { id: "post", nome: "Post em pé (1080 × 1350)", curto: "Post em pé", w: 1080, h: 1350, grupo: "Instagram" },
  { id: "quadrado", nome: "Post quadrado (1080 × 1080)", curto: "Quadrado", w: 1080, h: 1080, grupo: "Instagram" },
  { id: "story", nome: "Story e Reels (1080 × 1920)", curto: "Story", w: 1080, h: 1920, grupo: "Instagram" },
  { id: "carrossel", nome: "Carrossel (1080 × 1350)", curto: "Carrossel", w: 1080, h: 1350, grupo: "Instagram" },
  { id: "avatar", nome: "Avatar e capa de destaque (1000 × 1000)", curto: "Avatar", w: 1000, h: 1000, grupo: "Instagram" },
  { id: "capa-podcast", nome: "Capa de podcast (3000 × 3000)", curto: "Podcast", w: 3000, h: 3000, grupo: "Site e vídeo" },
  { id: "video", nome: "Vídeo e miniatura do YouTube (1280 × 720)", curto: "Vídeo", w: 1280, h: 720, grupo: "Site e vídeo" },
  { id: "banner", nome: "Cartão de link e OG (1200 × 630)", curto: "Cartão de link", w: 1200, h: 630, grupo: "Site e vídeo" },
  { id: "banner-site", nome: "Faixa do site (1920 × 640)", curto: "Faixa do site", w: 1920, h: 640, grupo: "Site e vídeo" },
  { id: "capa-noticia", nome: "Capa de notícia (1600 × 900)", curto: "Capa de notícia", w: 1600, h: 900, grupo: "Site e vídeo" },
  { id: "capa-rede", nome: "Capa de perfil (1640 × 624)", curto: "Capa de perfil", w: 1640, h: 624, grupo: "Site e vídeo" },
  { id: "cartaz-a4", nome: "Cartaz A4 (210 × 297 mm)", curto: "Cartaz A4", w: 1240, h: 1754, mm: [210, 297], grupo: "Impressos" },
  { id: "cartaz-a3", nome: "Cartaz A3 (297 × 420 mm)", curto: "Cartaz A3", w: 1754, h: 2480, mm: [297, 420], grupo: "Impressos" },
  { id: "folheto-a5", nome: "Folheto A5 (148 × 210 mm)", curto: "Folheto A5", w: 874, h: 1240, mm: [148, 210], grupo: "Impressos" },
  { id: "certificado", nome: "Certificado A4 deitado (297 × 210 mm)", curto: "Certificado", w: 1754, h: 1240, mm: [297, 210], grupo: "Impressos" },
  { id: "convite", nome: "Convite (127 × 178 mm)", curto: "Convite", w: 1500, h: 2100, mm: [127, 178], grupo: "Impressos" },
  { id: "cracha", nome: "Crachá (54 × 86 mm)", curto: "Crachá", w: 638, h: 1011, mm: [54, 85.6], grupo: "Impressos" },
  { id: "estampa", nome: "Estampa de camiseta (20 × 25 cm)", curto: "Estampa", w: 2362, h: 2953, mm: [200, 250], grupo: "Roupa e adesivo" },
  { id: "adesivo", nome: "Adesivo redondo (8 cm)", curto: "Adesivo", w: 945, h: 945, mm: [80, 80], grupo: "Roupa e adesivo" },
  { id: "tag", nome: "Etiqueta de roupa (5 × 9 cm)", curto: "Etiqueta", w: 591, h: 1063, mm: [50, 90], grupo: "Roupa e adesivo" },
] as const satisfies readonly { id: string; nome: string; curto: string; w: number; h: number; mm?: readonly [number, number]; grupo: string }[];
export type FormatoId = (typeof FORMATOS)[number]["id"];
type FormatoQualquer = (typeof FORMATOS)[number] & { mm?: readonly [number, number] };
export const formatoDe = (id: string): FormatoQualquer | undefined => FORMATOS.find((f) => f.id === id);
/** O formato que tem estas medidas (o primeiro, se houver mais de um). */
export const formatoPorMedida = (w: number, h: number): FormatoQualquer | undefined => FORMATOS.find((f) => f.w === w && f.h === h);

export const novoId = () => Math.random().toString(36).slice(2, 10);

export const fundoPadrao = (cor = COR.Pergaminho): Fundo => ({ cor, pontilhado: false, bordaCima: "", bordaBaixo: "", espessura: 0 });

export function documentoVazio(formato: FormatoId | string): Documento {
  const f = formatoDe(formato) ?? FORMATOS[0];
  return { v: 1, w: f.w, h: f.h, fundo: fundoPadrao(), camadas: [] };
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
export const elemento = (c: Partial<CamadaElemento> & Pick<CamadaElemento, "x" | "y" | "w" | "h" | "desenho">): CamadaElemento => ({ id: novoId(), tipo: "elemento", rot: 0, opacidade: 1, cor: COR.Tinta, fundo: "", espessura: 0, conteudo: "", conteudo2: "", ...c });

// ───── Fontes ─────

type Familias = { serifa: string; sans: string; mono: string; manuscrita: string };
let familias: Familias | null = null;
const lerVariavel = (nome: string, reserva: string) => (typeof document === "undefined" ? reserva : getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || reserva);
export async function prepararFontes() {
  const base = await fontes();
  familias ??= { ...base, manuscrita: lerVariavel("--font-hand", "cursive") };
  await Promise.all([
    document.fonts.load(`700 40px ${familias.serifa}`),
    document.fonts.load(`italic 500 40px ${familias.serifa}`),
    document.fonts.load(`italic 600 40px ${familias.serifa}`),
    document.fonts.load(`400 40px ${familias.serifa}`),
    document.fonts.load(`800 40px ${familias.sans}`),
    document.fonts.load(`italic 900 40px ${familias.sans}`),
    document.fonts.load(`500 40px ${familias.mono}`),
    document.fonts.load(`500 40px ${familias.manuscrita}`),
    document.fonts.load(`700 40px ${familias.manuscrita}`),
  ]).catch(() => undefined);
  return familias;
}
const familia = (fonte: Fonte) =>
  familias ? familias[fonte] : fonte === "serifa" ? "Georgia, serif" : fonte === "mono" ? "monospace" : fonte === "manuscrita" ? "cursive" : "system-ui, sans-serif";
export const NOMES_DAS_FONTES: Record<Fonte, string> = { serifa: "EB Garamond", sans: "Inter", mono: "IBM Plex Mono", manuscrita: "Caveat (à mão)" };

// ───── Laboratório público ─────

let laboratorio = false;
/**
 * No laboratório público de design (no site, sem conta), o estúdio não desenha a marca do instituto: nem nas
 * artes abertas de um arquivo, nem coladas de outro lugar. Material do instituto se faz no painel.
 */
export function modoLaboratorio(sim: boolean) {
  laboratorio = sim;
}
export const emLaboratorio = () => laboratorio;
/** Quem assina o que sai do estúdio (a linha da gráfica, os dados do PDF e do SVG). */
export const assinatura = () => (laboratorio ? "Laboratório público de design" : "Instituto Lúcia");

// ───── Variáveis ({link}, {arroba}, {data}, {pagina}, {total}) ─────

let variaveis: Record<string, string> = {};
/** As variáveis valem para os próximos desenhos e medidas (a tela troca ao mudar de página). */
export function usarVariaveis(v: Record<string, string>) {
  variaveis = v;
}
export const comVariaveis = (t: string, v: Record<string, string> = variaveis) => (t.includes("{") ? t.replace(/\{([\p{L}_]+)\}/gu, (inteiro, nome: string) => v[nome.toLowerCase()] ?? inteiro) : t);

// ───── Texto: medida e diagramação ─────

let medidor: CanvasRenderingContext2D | null = null;
function pena(): CanvasRenderingContext2D {
  medidor ??= document.createElement("canvas").getContext("2d");
  return medidor!;
}

interface Peca {
  texto: string;
  fonte: string;
  cor: string;
  x: number;
  largura: number;
}
interface LinhaDiagramada {
  pecas: Peca[];
  largura: number;
  /** Primeira linha de um parágrafo (leva o marcador). */
  abre: boolean;
  paragrafo: number;
}
export interface Diagramacao {
  linhas: LinhaDiagramada[];
  tamanho: number;
  recuoMarcador: number;
  /** A palavra mais larga não coube na largura. */
  estourou: boolean;
}

const pesoNegrito = (peso: number) => Math.min(900, Math.max(700, peso + 200));
function fonteDoTrecho(c: CamadaTexto, t: Pick<Trecho, "italico" | "negrito">, tamanho: number) {
  const italico = c.italico !== t.italico;
  const peso = t.negrito ? pesoNegrito(c.peso) : c.peso;
  return `${italico ? "italic " : ""}${peso} ${tamanho}px ${familia(c.fonte)}`;
}
export const fonteCss = (c: CamadaTexto, tamanho = c.tamanho) => fonteDoTrecho(c, { italico: false, negrito: false }, tamanho);

/** O texto que vai para a tela: variáveis trocadas e maiúsculas aplicadas (as marcas de estilo continuam). */
export function textoFinal(c: CamadaTexto, contador?: number) {
  let t = comVariaveis(c.texto);
  if (contador !== undefined) {
    t = t.replace(/\d[\d.]*(,\d+)?/, (numero) => {
      const valor = Number(numero.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(valor) ? Math.round(valor * contador).toLocaleString("pt-BR") : numero;
    });
  }
  return c.maiusculas ? t.toUpperCase() : t;
}

/**
 * Quebra o texto em linhas que cabem na largura, respeitando as quebras escritas, os estilos misturados e o
 * marcador de lista; com hifenização, divide a palavra que não cabe nas sílabas. Mede cada pedaço na letra dele.
 */
export function diagramar(c: CamadaTexto, ctx: CanvasRenderingContext2D = pena(), tamanho = c.tamanho, contador?: number): Diagramacao {
  ctx.letterSpacing = `${c.espacamento}em`;
  const recuoMarcador = c.marcador ? tamanho * (c.marcador === "numero" ? 1.5 : 1.05) : 0;
  const largura = Math.max(10, c.w - 2 * c.recuo - recuoMarcador);
  const medir = (texto: string, fonte: string) => {
    ctx.font = fonte;
    return ctx.measureText(texto).width;
  };
  const corDe = (t: Trecho) => (t.destaque ? c.destaque || COR["Vermelho da gráfica"] : c.cor);
  // Parágrafos: cada um, uma lista de pedaços (texto + estilo), com os espaços como pedaços próprios.
  const paragrafos: { texto: string; fonte: string; cor: string }[][] = [[]];
  for (const t of trechos(textoFinal(c, contador))) {
    const fonte = fonteDoTrecho(c, t, tamanho);
    t.texto.split("\n").forEach((parte, i) => {
      if (i > 0) paragrafos.push([]);
      for (const pedaco of parte.split(/(\s+)/)) if (pedaco) paragrafos[paragrafos.length - 1].push({ texto: pedaco, fonte, cor: corDe(t) });
    });
  }
  const linhas: LinhaDiagramada[] = [];
  let estourou = false;
  paragrafos.forEach((pedacos, indice) => {
    // Junta os pedaços em palavras (estilos diferentes colados formam uma palavra só) separadas por espaço.
    const palavras: { pecas: { texto: string; fonte: string; cor: string }[]; espacoAntes: number }[] = [];
    let espaco = 0;
    let colada = false;
    for (const p of pedacos) {
      if (/^\s+$/.test(p.texto)) {
        espaco = medir(" ", p.fonte);
        colada = false;
      } else if (colada && palavras.length) palavras[palavras.length - 1].pecas.push(p);
      else {
        palavras.push({ pecas: [p], espacoAntes: espaco });
        espaco = 0;
        colada = true;
      }
    }
    let atual: Peca[] = [];
    let x = 0;
    const fecharLinha = (abre: boolean) => {
      linhas.push({ pecas: atual, largura: x, abre, paragrafo: indice });
      atual = [];
      x = 0;
    };
    const colocar = (palavra: (typeof palavras)[number], larguras: number[], inicio: number) => {
      let px = inicio;
      palavra.pecas.forEach((p, i) => {
        atual.push({ ...p, x: px, largura: larguras[i] });
        px += larguras[i];
      });
      x = px;
    };
    let primeira = true;
    const fila = [...palavras];
    while (fila.length) {
      const palavra = fila.shift()!;
      const larguras = palavra.pecas.map((p) => medir(p.texto, p.fonte));
      const total = larguras.reduce((a, b) => a + b, 0);
      const antes = atual.length ? palavra.espacoAntes : 0;
      if (x + antes + total <= largura) {
        colocar(palavra, larguras, x + antes);
        continue;
      }
      // Não coube: tenta hifenizar (palavra de um estilo só), senão vai inteira para a linha de baixo.
      if (c.hifenizar && palavra.pecas.length === 1 && palavra.pecas[0].texto.length >= 5) {
        const p = palavra.pecas[0];
        const corte = hifenizar(p.texto, (pedaco) => x + antes + medir(pedaco, p.fonte) <= largura);
        if (corte) {
          const larguraCima = medir(corte[0], p.fonte);
          atual.push({ ...p, texto: corte[0], x: x + antes, largura: larguraCima });
          x += antes + larguraCima;
          fecharLinha(primeira);
          primeira = false;
          fila.unshift({ pecas: [{ ...p, texto: corte[1] }], espacoAntes: 0 });
          continue;
        }
      }
      if (atual.length === 0) {
        // Palavra sozinha maior que a linha, mesmo hifenizando: fica estourando.
        estourou = true;
        colocar(palavra, larguras, 0);
        continue;
      }
      fecharLinha(primeira);
      primeira = false;
      fila.unshift({ ...palavra, espacoAntes: 0 });
    }
    fecharLinha(primeira);
  });
  return { linhas, tamanho, recuoMarcador, estourou };
}

/** As linhas, como texto simples (para conferências). */
export function linhasDe(c: CamadaTexto): string[] {
  return diagramar(c).linhas.map((l) => l.pecas.map((p) => p.texto).join(""));
}

/** A flecha do arco: o quanto o texto em arco desce (ou sobe) nas pontas. */
export function flecha(c: CamadaTexto, d: Diagramacao) {
  if (!c.curva) return 0;
  const maior = Math.max(1, ...d.linhas.map((l) => l.largura));
  const teta = (Math.abs(c.curva) * Math.PI) / 180;
  const raio = maior / teta;
  return raio * (1 - Math.cos(teta / 2));
}

const tamanhosAjustados = new Map<string, number>();
/** O tamanho de letra que faz o texto caber na caixa (texto com "ajustar"). */
export function tamanhoQueCabe(c: CamadaTexto): number {
  if (!c.ajustar) return c.tamanho;
  const chave = JSON.stringify([c.texto, c.fonte, c.peso, c.italico, c.w, c.h, c.tamanho, c.entrelinha, c.espacamento, c.maiusculas, c.recuo, c.marcador, c.hifenizar, c.curva, comVariaveis(c.texto)]);
  const pronto = tamanhosAjustados.get(chave);
  if (pronto) return pronto;
  let baixo = 6;
  let alto = Math.max(6, c.tamanho);
  const cabe = (t: number) => {
    const d = diagramar(c, pena(), t);
    return !d.estourou && d.linhas.length * t * c.entrelinha + 2 * c.recuo + flecha(c, d) <= c.h;
  };
  if (cabe(alto)) baixo = alto;
  else
    while (alto - baixo > 0.5) {
      const meio = (alto + baixo) / 2;
      if (cabe(meio)) baixo = meio;
      else alto = meio;
    }
  const resultado = Math.floor(baixo * 2) / 2;
  if (tamanhosAjustados.size > 300) tamanhosAjustados.clear();
  tamanhosAjustados.set(chave, resultado);
  return resultado;
}

/** A altura que o texto ocupa (a caixa acompanha o texto; com "ajustar", a caixa manda). */
export function alturaDoTexto(c: CamadaTexto): number {
  if (c.ajustar) return c.h;
  const d = diagramar(c);
  return Math.max(c.tamanho * c.entrelinha, d.linhas.length * c.tamanho * c.entrelinha) + 2 * c.recuo + flecha(c, d);
}

// ───── Imagens ─────

const guardadas = new Map<string, Promise<HTMLImageElement>>();
const prontas = new Map<string, HTMLImageElement>();
export function carregarImagem(src: string): Promise<HTMLImageElement> {
  let p = guardadas.get(src);
  if (!p) {
    p = new Promise((resolver, recusar) => {
      const img = new Image();
      img.onload = () => {
        prontas.set(src, img);
        resolver(img);
      };
      img.onerror = () => recusar(new Error("imagem"));
      img.src = src;
    });
    guardadas.set(src, p);
  }
  return p;
}
/** Só o que já carregou; a tela é redesenhada quando a promessa termina. */
export const imagemPronta = (src: string): HTMLImageElement | null => prontas.get(src) ?? null;

/** Todas as imagens que o documento usa (fotos e máscaras de fundo removido), para carregar antes de desenhar. */
export const imagensDo = (doc: Documento) => doc.camadas.flatMap((c) => (c.tipo === "imagem" ? [c.src, ...(c.fundoRemovido ? [c.fundoRemovido] : [])] : []));
export const carregarTudo = (doc: Documento) => Promise.all(imagensDo(doc).map((src) => carregarImagem(src).catch(() => null)));

/** Reduz uma imagem do aparelho para caber no documento guardado (JPEG, lado maior 1400). */
export async function prepararImagem(arquivo: Blob, ladoMaior = 1400): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, ladoMaior / Math.max(bitmap.width, bitmap.height));
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

export type FonteDeImagem = CanvasImageSource & { width: number; height: number };
const tratadas = new Map<string, HTMLCanvasElement>();
const precisaTratar = (c: CamadaImagem) => Boolean(c.fundoRemovido || c.recorte || c.girar || c.espelhar || c.virar || c.brilho || c.contraste || c.saturacao || c.temperatura || c.filtro !== "nenhum");
const resumo = (s: string | undefined) => (!s ? "" : s.length > 200 ? `${s.slice(0, 60)}${s.length}${s.slice(-60)}` : s);

/**
 * A foto com os ajustes aplicados (máscara do fundo, recorte, giro, espelho, brilho, contraste, saturação,
 * temperatura e o filtro), pixel a pixel, igual em qualquer navegador. Guardada até mudar algum ajuste.
 */
export function imagemTratada(c: CamadaImagem): FonteDeImagem | null {
  const img = imagemPronta(c.src);
  if (!img) return null;
  if (!precisaTratar(c)) return img;
  const mascara = c.fundoRemovido ? imagemPronta(c.fundoRemovido) : null;
  const chave = JSON.stringify([resumo(c.src), resumo(c.fundoRemovido), Boolean(mascara), c.recorte, c.girar, c.espelhar, c.virar, c.brilho, c.contraste, c.saturacao, c.temperatura, c.filtro]);
  const pronta = tratadas.get(chave);
  if (pronta) return pronta;
  // 1. A máscara do fundo removido, no tamanho da original.
  const base = document.createElement("canvas");
  base.width = img.naturalWidth;
  base.height = img.naturalHeight;
  const b = base.getContext("2d");
  if (!b) return img;
  b.drawImage(img, 0, 0);
  if (mascara) {
    b.globalCompositeOperation = "destination-in";
    b.drawImage(mascara, 0, 0, base.width, base.height);
    b.globalCompositeOperation = "source-over";
  }
  // 2. Recorte e giro.
  const r = c.recorte ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.round(r.x * base.width);
  const sy = Math.round(r.y * base.height);
  const sw = Math.max(1, Math.round(r.w * base.width));
  const sh = Math.max(1, Math.round(r.h * base.height));
  const deitado = c.girar === 90 || c.girar === 270;
  const saida = document.createElement("canvas");
  saida.width = deitado ? sh : sw;
  saida.height = deitado ? sw : sh;
  const s = saida.getContext("2d", { willReadFrequently: true });
  if (!s) return img;
  s.translate(saida.width / 2, saida.height / 2);
  s.rotate(((c.girar ?? 0) * Math.PI) / 180);
  s.scale(c.espelhar ? -1 : 1, c.virar ? -1 : 1);
  s.drawImage(base, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  s.setTransform(1, 0, 0, 1, 0, 0);
  // 3. Cor, pixel a pixel.
  if (c.brilho || c.contraste || c.saturacao || c.temperatura || c.filtro !== "nenhum") {
    const brilho = (c.brilho ?? 0) * 1.1;
    const cc = (c.contraste ?? 0) * 1.28 + (c.filtro === "contraste" ? 60 : c.filtro === "pb" ? 25 : c.filtro === "duotom" ? 45 : 0);
    const fator = (259 * (cc + 255)) / (255 * (259 - Math.min(258, cc)));
    const sat = c.filtro === "pb" || c.filtro === "duotom" ? 0 : 1 + (c.saturacao ?? 0) / 100 + (c.filtro === "contraste" ? 0.1 : 0);
    const temp = (c.temperatura ?? 0) * 0.45;
    const dados = s.getImageData(0, 0, saida.width, saida.height);
    const px = dados.data;
    for (let i = 0; i < px.length; i += 4) {
      let rr = fator * (px[i] + brilho - 128) + 128;
      let gg = fator * (px[i + 1] + brilho - 128) + 128;
      let bb = fator * (px[i + 2] + brilho - 128) + 128;
      const lum = 0.299 * rr + 0.587 * gg + 0.114 * bb;
      rr = lum + (rr - lum) * sat + temp;
      gg = lum + (gg - lum) * sat;
      bb = lum + (bb - lum) * sat - temp;
      if (c.filtro === "sepia") {
        const [r0, g0, b0] = [rr, gg, bb];
        rr = 0.3 * r0 + 0.7 * (0.393 * r0 + 0.769 * g0 + 0.189 * b0);
        gg = 0.3 * g0 + 0.7 * (0.349 * r0 + 0.686 * g0 + 0.168 * b0);
        bb = 0.3 * b0 + 0.7 * (0.272 * r0 + 0.534 * g0 + 0.131 * b0);
      } else if (c.filtro === "duotom") {
        // Preto e branco multiplicado pelo vermelho da gráfica (como o duotom dos cartazes).
        rr *= 0.45 + 0.55 * (194 / 255);
        gg *= 0.45 + 0.55 * (31 / 255);
        bb *= 0.45 + 0.55 * (22 / 255);
      }
      px[i] = rr;
      px[i + 1] = gg;
      px[i + 2] = bb;
    }
    s.putImageData(dados, 0, 0);
  }
  if (tratadas.size > 24) tratadas.delete(tratadas.keys().next().value!);
  tratadas.set(chave, saida);
  return saida;
}

/** Onde a foto fica dentro da caixa (cobrir ou conter, mais o reenquadre). */
export function posicaoDaFoto(c: CamadaImagem, iw: number, ih: number, w: number, h: number) {
  const zoom = c.enquadre?.zoom ?? 1;
  const escala = (c.ajuste === "cobrir" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)) * zoom;
  const fw = iw * escala;
  const fh = ih * escala;
  const ex = c.enquadre?.x ?? 0;
  const ey = c.enquadre?.y ?? 0;
  return { x: ((w - fw) / 2) * (1 + (fw > w ? ex : 0)), y: ((h - fh) / 2) * (1 + (fh > h ? ey : 0)), w: fw, h: fh };
}

export function caminhoDaMascara(m: Mascara | undefined, w: number, h: number): Path2D {
  const p = new Path2D();
  if (m === "circulo") p.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (m === "estrela") {
    const r = Math.min(w, h) / 2;
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i === 0) p.moveTo(w / 2 + rr * Math.cos(a), h / 2 + rr * Math.sin(a));
      else p.lineTo(w / 2 + rr * Math.cos(a), h / 2 + rr * Math.sin(a));
    }
    p.closePath();
  } else if (m === "escudo") {
    p.moveTo(0, 0);
    p.lineTo(w, 0);
    p.lineTo(w, h * 0.55);
    p.quadraticCurveTo(w, h * 0.85, w / 2, h);
    p.quadraticCurveTo(0, h * 0.85, 0, h * 0.55);
    p.closePath();
  } else if (m === "arco") {
    const r = w / 2;
    p.moveTo(0, h);
    p.lineTo(0, Math.min(r, h));
    p.arc(w / 2, Math.min(r, h), r, Math.PI, 0);
    p.lineTo(w, h);
    p.closePath();
  } else if (m === "losango") {
    p.moveTo(w / 2, 0);
    p.lineTo(w, h / 2);
    p.lineTo(w / 2, h);
    p.lineTo(0, h / 2);
    p.closePath();
  } else p.rect(0, 0, w, h);
  return p;
}

const reticulas = new Map<string, HTMLCanvasElement>();
/** O meio-tom: a foto vira pontos (maiores onde é mais escuro), na cor escolhida, sobre o que estiver atrás. */
function meioTom(c: CamadaImagem, fonte: FonteDeImagem, w: number, h: number): HTMLCanvasElement {
  const celula = Math.max(3, c.meioTom ?? 8);
  const chave = JSON.stringify([resumo(c.src), resumo(c.fundoRemovido), c.recorte, c.girar, c.espelhar, c.brilho, c.contraste, c.filtro, c.enquadre, c.ajuste, Math.round(w), Math.round(h), celula, c.corMeioTom]);
  const pronta = reticulas.get(chave);
  if (pronta) return pronta;
  const colunas = Math.max(1, Math.ceil(w / celula));
  const linhas = Math.max(1, Math.ceil(h / celula));
  const amostra = document.createElement("canvas");
  amostra.width = colunas;
  amostra.height = linhas;
  const a = amostra.getContext("2d", { willReadFrequently: true })!;
  const pos = posicaoDaFoto(c, fonte.width, fonte.height, w, h);
  a.drawImage(fonte, (pos.x / w) * colunas, (pos.y / h) * linhas, (pos.w / w) * colunas, (pos.h / h) * linhas);
  const px = a.getImageData(0, 0, colunas, linhas).data;
  const saida = document.createElement("canvas");
  saida.width = Math.max(1, Math.ceil(w));
  saida.height = Math.max(1, Math.ceil(h));
  const s = saida.getContext("2d")!;
  s.fillStyle = c.corMeioTom || COR.Tinta;
  for (let l = 0; l < linhas; l++)
    for (let k = 0; k < colunas; k++) {
      const i = (l * colunas + k) * 4;
      if (px[i + 3] < 20) continue;
      const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      const raio = (celula / 2) * Math.sqrt(1 - lum) * 1.25;
      if (raio < 0.3) continue;
      s.beginPath();
      // Retícula a 45°: as linhas ímpares deslocadas meia célula.
      s.arc(k * celula + celula / 2 + (l % 2 ? celula / 2 : 0), l * celula + celula / 2, raio, 0, Math.PI * 2);
      s.fill();
    }
  if (reticulas.size > 12) reticulas.delete(reticulas.keys().next().value!);
  reticulas.set(chave, saida);
  return saida;
}

function desenharFoto(ctx: CanvasRenderingContext2D, c: CamadaImagem, w: number, h: number) {
  const fonte = imagemTratada(c);
  const caminho = caminhoDaMascara(c.mascara, w, h);
  ctx.save();
  ctx.clip(caminho);
  if (fonte) {
    if (c.meioTom && c.meioTom > 0) ctx.drawImage(meioTom(c, fonte, w, h), 0, 0, w, h);
    else {
      const pos = posicaoDaFoto(c, fonte.width, fonte.height, w, h);
      ctx.drawImage(fonte, pos.x, pos.y, pos.w, pos.h);
    }
  } else {
    ctx.fillStyle = COR.Fio;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  if (c.borda && c.espessura > 0) {
    ctx.save();
    ctx.strokeStyle = c.borda;
    ctx.lineWidth = c.espessura;
    if (!c.mascara) ctx.strokeRect(c.espessura / 2, c.espessura / 2, w - c.espessura, h - c.espessura);
    else {
      ctx.clip(caminho);
      ctx.lineWidth = c.espessura * 2;
      ctx.stroke(caminho);
    }
    ctx.restore();
  }
}

// ───── Texturas ─────

function sorteio(semente: number) {
  let s = semente;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

let graoPronto: HTMLCanvasElement | null = null;
/** Pontinhos aleatórios (sempre os mesmos): a "falha" da tinta na serigrafia. */
function grao(): HTMLCanvasElement {
  if (graoPronto) return graoPronto;
  const t = document.createElement("canvas");
  t.width = 256;
  t.height = 256;
  const g = t.getContext("2d")!;
  const sorte = sorteio(1234567);
  g.fillStyle = "#000";
  for (let i = 0; i < 2600; i++) {
    g.globalAlpha = 0.35 + sorte() * 0.65;
    g.beginPath();
    g.arc(sorte() * 256, sorte() * 256, (0.8 + sorte() * 2.4) / 2, 0, Math.PI * 2);
    g.fill();
  }
  // Riscos finos, como tela de serigrafia gasta.
  g.globalAlpha = 0.25;
  for (let i = 0; i < 40; i++) g.fillRect(sorte() * 256, sorte() * 256, 6 + sorte() * 30, 0.7);
  graoPronto = t;
  return t;
}

let fibrasProntas: HTMLCanvasElement | null = null;
/** Papel: manchas suaves e fibras, para multiplicar sobre o fundo. */
function fibras(): HTMLCanvasElement {
  if (fibrasProntas) return fibrasProntas;
  const t = document.createElement("canvas");
  t.width = 512;
  t.height = 512;
  const g = t.getContext("2d")!;
  const sorte = sorteio(7654321);
  for (let i = 0; i < 60; i++) {
    const r = 20 + sorte() * 90;
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, "rgba(120, 90, 40, 0.06)");
    grad.addColorStop(1, "rgba(120, 90, 40, 0)");
    g.save();
    g.translate(sorte() * 512, sorte() * 512);
    g.fillStyle = grad;
    g.fillRect(-r, -r, 2 * r, 2 * r);
    g.restore();
  }
  g.strokeStyle = "rgba(90, 70, 40, 0.12)";
  g.lineWidth = 0.6;
  for (let i = 0; i < 220; i++) {
    const x = sorte() * 512;
    const y = sorte() * 512;
    const a = sorte() * Math.PI;
    const l = 4 + sorte() * 16;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + sorte() * 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(60, 45, 20, ${0.03 + sorte() * 0.05})`;
    g.fillRect(sorte() * 512, sorte() * 512, 1, 1);
  }
  fibrasProntas = t;
  return t;
}

function preencherComGradiente(ctx: CanvasRenderingContext2D, g: Gradiente, w: number, h: number) {
  const a = (g.angulo * Math.PI) / 180;
  const meio = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
  const grad = ctx.createLinearGradient(w / 2 - Math.cos(a) * meio, h / 2 - Math.sin(a) * meio, w / 2 + Math.cos(a) * meio, h / 2 + Math.sin(a) * meio);
  grad.addColorStop(0, g.de);
  grad.addColorStop(1, g.para);
  return grad;
}

// ───── Desenho ─────

const ESTRELA = [60, 10, 66.29, 29.35, 86.63, 29.35, 70.17, 41.31, 76.46, 60.65, 60, 48.7, 43.54, 60.65, 49.83, 41.31, 33.37, 29.35, 53.71, 29.35];
const LIVRO_E = "M56 108V76C46 69 31 67 12 71V101C31 97 46 100 56 108Z";
const LIVRO_D = "M64 108V76C74 69 89 67 108 71V101C89 97 74 100 64 108Z";
/** O símbolo como caminhos SVG (para a exportação vetorial), no mesmo quadrado de 120 × 120. */
export const CAMINHOS_DO_SIMBOLO = [`M${ESTRELA.join(" ")}Z`, LIVRO_E, LIVRO_D];

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

type Passada = "sombra" | "letra" | "contorno";

function desenharTexto(ctx: CanvasRenderingContext2D, c: CamadaTexto, contador?: number) {
  const tamanho = tamanhoQueCabe(c);
  const d = diagramar(c, ctx, tamanho, contador);
  const passo = tamanho * c.entrelinha;
  const altura = d.linhas.length * passo;
  const f = flecha(c, d);
  if (c.fundo) {
    ctx.fillStyle = c.fundo;
    ctx.fillRect(0, 0, c.w, c.ajustar ? c.h : altura + 2 * c.recuo + f);
  }
  ctx.letterSpacing = `${c.espacamento}em`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  const largura = Math.max(10, c.w - 2 * c.recuo - d.recuoMarcador);
  const corDoMarcador = c.destaque || COR["Vermelho da gráfica"];
  const espContorno = Math.max(1, c.espContorno ?? tamanho * 0.04);
  // Desenha as letras numa passada: sombra, depois o preenchimento, depois o contorno.
  const passada = (modo: Passada) => {
    let numero = 0;
    const dx = modo === "sombra" ? (c.sombraX ?? 0) : 0;
    const dy = modo === "sombra" ? (c.sombraY ?? 0) : 0;
    d.linhas.forEach((linha, i) => {
      const base = c.recuo + (i + 0.78) * passo + (c.curva && c.curva < 0 ? f : 0);
      const x0 = c.recuo + d.recuoMarcador + (c.alinhar === "left" ? 0 : c.alinhar === "right" ? largura - linha.largura : (largura - linha.largura) / 2);
      if (linha.abre && c.marcador && linha.pecas.length) {
        numero++;
        if (modo !== "contorno") {
          const mx = x0 - d.recuoMarcador + dx;
          const meio = base - tamanho * 0.32 + dy;
          ctx.fillStyle = modo === "sombra" ? c.sombra! : c.marcador === "travessao" ? c.cor : corDoMarcador;
          if (c.marcador === "estrela") {
            estrela(ctx, mx + tamanho * 0.34, meio, tamanho * 0.34);
            ctx.fill();
          } else if (c.marcador === "ponto") {
            ctx.beginPath();
            ctx.arc(mx + tamanho * 0.25, meio, tamanho * 0.12, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.font = fonteCss(c, tamanho);
            ctx.fillText(c.marcador === "numero" ? `${numero}.` : "—", mx, base + dy);
          }
        }
      }
      if (c.curva) {
        desenharLinhaEmArco(ctx, c, linha, x0, base, modo, espContorno);
        return;
      }
      for (const p of linha.pecas) {
        if (!p.texto.trim()) continue;
        ctx.font = p.fonte;
        if (modo === "sombra") {
          ctx.fillStyle = c.sombra!;
          ctx.fillText(p.texto, x0 + p.x + dx, base + dy);
          if (c.vazado || (c.contorno && (c.espContorno ?? 0) > 0)) {
            ctx.strokeStyle = c.sombra!;
            ctx.lineWidth = espContorno;
            ctx.strokeText(p.texto, x0 + p.x + dx, base + dy);
          }
        } else if (modo === "letra") {
          ctx.fillStyle = p.cor;
          ctx.fillText(p.texto, x0 + p.x, base);
        } else {
          ctx.strokeStyle = c.vazado && !c.contorno ? p.cor : c.contorno!;
          ctx.lineWidth = espContorno;
          ctx.strokeText(p.texto, x0 + p.x, base);
        }
      }
    });
  };
  if (c.sombra) passada("sombra");
  if (!c.vazado) passada("letra");
  if (c.vazado || (c.contorno && (c.espContorno ?? 0) > 0)) passada("contorno");
}

/** Uma linha de texto em arco: cada letra no seu ângulo. */
function desenharLinhaEmArco(ctx: CanvasRenderingContext2D, c: CamadaTexto, linha: LinhaDiagramada, x0: number, base: number, modo: Passada, espContorno: number) {
  const teta = (Math.abs(c.curva ?? 0) * Math.PI) / 180;
  const raio = Math.max(1, linha.largura) / Math.max(0.0001, teta);
  const cx = x0 + linha.largura / 2;
  const arco = (c.curva ?? 0) > 0;
  const cy = arco ? base + raio : base - raio;
  ctx.save();
  ctx.textAlign = "center";
  let s = 0;
  for (const p of linha.pecas) {
    // Cada pedaço começa onde a diagramação pôs (o espaço entre as palavras não é um pedaço).
    s = p.x;
    ctx.font = p.fonte;
    for (const ch of p.texto) {
      const largura = ctx.measureText(ch).width;
      const phi = -teta / 2 + (s + largura / 2) / raio;
      s += largura;
      if (!ch.trim()) continue;
      ctx.save();
      if (arco) {
        ctx.translate(cx + raio * Math.sin(phi), cy - raio * Math.cos(phi));
        ctx.rotate(phi);
      } else {
        ctx.translate(cx + raio * Math.sin(phi), cy + raio * Math.cos(phi));
        ctx.rotate(-phi);
      }
      if (modo === "sombra") {
        ctx.fillStyle = c.sombra!;
        ctx.fillText(ch, c.sombraX ?? 0, c.sombraY ?? 0);
      } else if (modo === "letra") {
        ctx.fillStyle = p.cor;
        ctx.fillText(ch, 0, 0);
      } else {
        ctx.strokeStyle = c.vazado && !c.contorno ? p.cor : c.contorno!;
        ctx.lineWidth = espContorno;
        ctx.strokeText(ch, 0, 0);
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

function desenharMarca(ctx: CanvasRenderingContext2D, c: CamadaMarca) {
  if (laboratorio) return;
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
}

function desenharForma(ctx: CanvasRenderingContext2D, c: CamadaForma) {
  ctx.fillStyle = c.gradiente ? preencherComGradiente(ctx, c.gradiente, c.w, c.h) : c.preenchimento;
  ctx.strokeStyle = c.borda;
  ctx.lineWidth = c.espessura;
  if (c.tipo === "retangulo") retanguloArredondado(ctx, 0, 0, c.w, c.h, c.raio);
  else if (c.tipo === "elipse") {
    ctx.beginPath();
    ctx.ellipse(c.w / 2, c.h / 2, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
  } else if (c.tipo === "estrela") estrela(ctx, c.w / 2, c.h / 2 + Math.min(c.w, c.h) * 0.04, Math.min(c.w, c.h) / 2);
  else if (c.tipo === "triangulo") {
    ctx.beginPath();
    ctx.moveTo(c.w / 2, 0);
    ctx.lineTo(c.w, c.h);
    ctx.lineTo(0, c.h);
    ctx.closePath();
  } else if (c.tipo === "escudo") {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(c.w, 0);
    ctx.lineTo(c.w, c.h * 0.55);
    ctx.quadraticCurveTo(c.w, c.h * 0.85, c.w / 2, c.h);
    ctx.quadraticCurveTo(0, c.h * 0.85, 0, c.h * 0.55);
    ctx.closePath();
  } else if (c.tipo === "linha") {
    ctx.fillRect(0, c.h / 2 - Math.max(1, c.espessura) / 2, c.w, Math.max(1, c.espessura));
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
    ctx.clip(new Path2D(`M0 0h${c.w}v${c.h}h${-c.w}z`));
    ctx.fill();
    ctx.restore();
    return;
  }
  if ((c.preenchimento && c.preenchimento !== "transparent") || c.gradiente) ctx.fill();
  if (c.borda && c.espessura > 0) ctx.stroke();
}

const letras = () => ({ sans: familia("sans"), serifa: familia("serifa"), mao: familia("manuscrita") });

/** A foto revelada: papel branco, a foto, a fita e a legenda escrita à mão. */
function desenharRevelada(ctx: CanvasRenderingContext2D, c: CamadaImagem) {
  const lado = c.w * 0.055;
  const baixo = c.w * 0.2;
  ctx.save();
  ctx.shadowColor = "rgba(23, 19, 14, 0.28)";
  ctx.shadowBlur = c.w * 0.03;
  ctx.shadowOffsetY = c.w * 0.012;
  ctx.fillStyle = "#fbf9f2";
  ctx.fillRect(0, 0, c.w, c.h);
  ctx.restore();
  ctx.save();
  ctx.translate(lado, lado);
  desenharFoto(ctx, { ...c, borda: "", mascara: "" }, c.w - 2 * lado, Math.max(1, c.h - lado - baixo));
  ctx.restore();
  if (c.legendaFoto) {
    ctx.fillStyle = COR.Tinta;
    ctx.font = `600 ${baixo * 0.42}px ${familia("manuscrita")}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(comVariaveis(c.legendaFoto), c.w / 2, c.h - baixo / 2, c.w - 2 * lado);
  }
  // A fita no alto, um pouco torta.
  ctx.save();
  ctx.translate(c.w / 2 - c.w * 0.16, -c.w * 0.03);
  ctx.rotate(-0.06);
  desenharElemento(ctx, { desenho: "fita", cor: "rgba(233, 220, 188, 0.92)", fundo: "", espessura: 0, conteudo: "", conteudo2: "" }, c.w * 0.32, c.w * 0.075, letras());
  ctx.restore();
}

/** O que cada camada desenha na própria caixa (0, 0, w, h). */
function desenharConteudo(ctx: CanvasRenderingContext2D, c: Camada, contador?: number) {
  if (c.tipo === "texto") desenharTexto(ctx, c, contador);
  else if (c.tipo === "imagem") {
    if (c.moldura === "revelada") desenharRevelada(ctx, c);
    else desenharFoto(ctx, c, c.w, c.h);
  } else if (c.tipo === "marca") desenharMarca(ctx, c);
  else if (c.tipo === "elemento") desenharElemento(ctx, c, c.w, c.h, letras());
  else desenharForma(ctx, c);
}

/** Onde a animação está no tempo t (segundos). Sem t, a camada aparece pronta. */
function momento(c: Camada, t: number | undefined, alturaDoDoc: number) {
  const pronto = { alfa: 1, dy: 0, escala: 1, revela: 1, cortina: -1, contador: undefined as number | undefined };
  if (t === undefined || !c.anim) return pronto;
  const bruto = Math.min(1, Math.max(0, (t - c.anim.inicio) / Math.max(0.05, c.anim.duracao)));
  const suave = 1 - (1 - bruto) ** 3;
  switch (c.anim.tipo) {
    case "aparecer":
      return { ...pronto, alfa: suave };
    case "subir":
      return { ...pronto, alfa: Math.min(1, bruto * 2.5), dy: (1 - suave) * alturaDoDoc * 0.06 };
    case "crescer":
      return { ...pronto, alfa: Math.min(1, bruto * 3), escala: 0.7 + 0.3 * suave };
    case "revelar":
      return { ...pronto, revela: suave };
    case "cortina":
      return { ...pronto, alfa: bruto > 0 ? 1 : 0, cortina: bruto };
    case "contador":
      return { ...pronto, alfa: bruto > 0 ? 1 : 0, contador: suave };
  }
}

/** Desenha a camada numa tela à parte e "come" pontinhos da tinta (serigrafia). */
function desenharComTextura(ctx: CanvasRenderingContext2D, c: Camada, contador?: number) {
  const m = ctx.getTransform();
  const k = Math.max(0.1, Math.hypot(m.a, m.b));
  const folga = Math.max(c.w, c.h) * 0.15;
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.ceil((c.w + 2 * folga) * k));
  tela.height = Math.max(1, Math.ceil((c.h + 2 * folga) * k));
  const t = tela.getContext("2d");
  if (!t) return desenharConteudo(ctx, c, contador);
  t.scale(k, k);
  t.translate(folga, folga);
  desenharConteudo(t, c, contador);
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = "destination-out";
  const padrao = t.createPattern(grao(), "repeat");
  if (padrao) {
    // O grão tem o mesmo tamanho na arte em qualquer aproximação.
    padrao.setTransform(new DOMMatrix().scale(k * Math.max(1, Math.max(c.w, c.h) / 700)));
    t.fillStyle = padrao;
    t.fillRect(0, 0, tela.width, tela.height);
  }
  ctx.drawImage(tela, -folga, -folga, c.w + 2 * folga, c.h + 2 * folga);
}

function desenharCamada(ctx: CanvasRenderingContext2D, c: Camada, t: number | undefined, alturaDoDoc: number) {
  const m = momento(c, t, alturaDoDoc);
  if (m.alfa <= 0) return;
  ctx.save();
  ctx.globalAlpha = c.opacidade * m.alfa;
  ctx.translate(c.x + c.w / 2, c.y + c.h / 2 + m.dy);
  ctx.rotate((c.rot * Math.PI) / 180);
  if (m.escala !== 1) ctx.scale(m.escala, m.escala);
  ctx.translate(-c.w / 2, -c.h / 2);
  if (m.revela < 1) {
    ctx.beginPath();
    ctx.rect(-c.w, -c.h, c.w * (1 + m.revela), c.h * 3);
    ctx.clip();
  }
  if (m.cortina >= 0 && m.cortina < 0.5) {
    // Cortina vermelha: cobre a caixa da camada e depois corre para a direita, revelando.
    ctx.fillStyle = COR["Vermelho da gráfica"];
    ctx.fillRect(0, 0, c.w * (m.cortina * 2), c.h);
  } else {
    if (c.textura) desenharComTextura(ctx, c, m.contador);
    else desenharConteudo(ctx, c, m.contador);
    if (m.cortina >= 0.5 && m.cortina < 1) {
      ctx.fillStyle = COR["Vermelho da gráfica"];
      const k = (m.cortina - 0.5) * 2;
      ctx.fillRect(c.w * k, 0, c.w * (1 - k), c.h);
    }
  }
  ctx.restore();
}

export interface OpcoesDeDesenho {
  /** Segundos, para a animação (sem t, tudo pronto). */
  t?: number;
  /** Sem a cor do fundo (PNG transparente). */
  transparente?: boolean;
  /** Para exportar: tira o que é só guia. */
  exportar?: boolean;
}

/** Pinta o fundo da página (cor ou gradiente, papel, trama de pontinhos) na escala já aplicada. */
function desenharFundo(ctx: CanvasRenderingContext2D, doc: Documento) {
  const f = doc.fundo;
  ctx.fillStyle = f.gradiente ? preencherComGradiente(ctx, f.gradiente, doc.w, doc.h) : f.cor;
  ctx.fillRect(0, 0, doc.w, doc.h);
  if (f.textura === "papel") {
    const padrao = ctx.createPattern(fibras(), "repeat");
    if (padrao) {
      padrao.setTransform(new DOMMatrix().scale(Math.max(1, doc.w / 1080)));
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = padrao;
      ctx.fillRect(0, 0, doc.w, doc.h);
      ctx.restore();
    }
  }
  if (f.pontilhado) {
    const passo = Math.round(doc.w / 40);
    ctx.fillStyle = "rgba(31, 26, 20, 0.09)";
    for (let y = passo / 2; y < doc.h; y += passo) for (let x = passo / 2; x < doc.w; x += passo) ctx.fillRect(x, y, Math.max(1.5, passo * 0.06), Math.max(1.5, passo * 0.06));
  }
}

/** Desenha o documento inteiro numa tela (na escala pedida; 1 = tamanho real). */
export function desenhar(tela: HTMLCanvasElement, doc: Documento, escala = 1, opcoes: OpcoesDeDesenho = {}) {
  const largura = Math.max(1, Math.round(doc.w * escala));
  const altura = Math.max(1, Math.round(doc.h * escala));
  if (tela.width !== largura) tela.width = largura;
  if (tela.height !== altura) tela.height = altura;
  const ctx = tela.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, tela.width, tela.height);
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  if (!opcoes.transparente) desenharFundo(ctx, doc);
  for (const c of doc.camadas) if (!c.oculta && !(opcoes.exportar && c.soGuia)) desenharCamada(ctx, c, opcoes.t, doc.h);
  const f = doc.fundo;
  if (f.espessura > 0) {
    if (f.bordaCima) {
      ctx.fillStyle = f.bordaCima;
      ctx.fillRect(0, 0, doc.w, f.espessura);
    }
    if (f.bordaBaixo) {
      ctx.fillStyle = f.bordaBaixo;
      ctx.fillRect(0, doc.h - f.espessura, doc.w, f.espessura);
    }
  }
  if (!opcoes.transparente && f.textura === "serigrafia") {
    // A tinta falha em pontinhos pela página inteira: o papel (a cor do fundo) aparece por baixo.
    const padrao = ctx.createPattern(grao(), "repeat");
    if (padrao) {
      padrao.setTransform(new DOMMatrix().scale(Math.max(1, doc.w / 700)));
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = padrao;
      ctx.fillRect(0, 0, doc.w, doc.h);
      ctx.globalCompositeOperation = "destination-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = f.cor;
      ctx.fillRect(0, 0, doc.w, doc.h);
      ctx.restore();
    }
  }
  if (!opcoes.transparente && f.vinheta && f.vinheta > 0) {
    const grad = ctx.createRadialGradient(doc.w / 2, doc.h / 2, Math.min(doc.w, doc.h) * 0.35, doc.w / 2, doc.h / 2, Math.hypot(doc.w, doc.h) / 2);
    grad.addColorStop(0, "rgba(23, 19, 14, 0)");
    grad.addColorStop(1, `rgba(23, 19, 14, ${Math.min(0.85, f.vinheta)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, doc.w, doc.h);
  }
}

/**
 * Uma camada desenhada só na caixa dela (com folga para sombra e contorno), numa tela à parte: para o SVG e o PDF
 * vetorial, quando a camada tem um efeito que só existe como imagem.
 */
export function recorteDaCamada(c: Camada, escala = 2): { tela: HTMLCanvasElement; x: number; y: number; w: number; h: number } {
  const b = caixa(c);
  const folga = Math.max(b.w, b.h) * 0.12 + (c.tipo === "texto" ? Math.abs(c.sombraX ?? 0) + Math.abs(c.sombraY ?? 0) + c.tamanho : 0);
  const x = b.x - folga;
  const y = b.y - folga;
  const w = b.w + 2 * folga;
  const h = b.h + 2 * folga;
  // Nunca mais de 6.000 pixels de lado (o navegador recusa telas enormes).
  const k = Math.min(escala, 6000 / Math.max(w, h, 1));
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.ceil(w * k));
  tela.height = Math.max(1, Math.ceil(h * k));
  const ctx = tela.getContext("2d");
  if (ctx) {
    ctx.scale(k, k);
    ctx.translate(-x, -y);
    desenharCamada(ctx, c, undefined, 0);
  }
  return { tela, x, y, w, h };
}

/**
 * O que cobre a página inteira por cima das camadas e não tem desenho vetorial: a falha de tinta da serigrafia (a
 * cor do papel aparecendo em pontinhos, igual ao que o desenho faz ao "comer" a tinta) e a vinheta. Transparente
 * onde não há efeito; nulo quando a página não tem nenhum dos dois.
 */
export function coberturaDaPagina(doc: Documento, escala = 2): HTMLCanvasElement | null {
  const f = doc.fundo;
  const serigrafia = f.textura === "serigrafia";
  if (!serigrafia && !(f.vinheta && f.vinheta > 0)) return null;
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(doc.w * escala));
  tela.height = Math.max(1, Math.round(doc.h * escala));
  const ctx = tela.getContext("2d");
  if (!ctx) return null;
  ctx.scale(escala, escala);
  if (serigrafia) {
    const padrao = ctx.createPattern(grao(), "repeat");
    if (padrao) {
      padrao.setTransform(new DOMMatrix().scale(Math.max(1, doc.w / 700)));
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = padrao;
      ctx.fillRect(0, 0, doc.w, doc.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = f.cor;
      ctx.fillRect(0, 0, doc.w, doc.h);
      ctx.globalCompositeOperation = "source-over";
    }
  }
  if (f.vinheta && f.vinheta > 0) {
    const grad = ctx.createRadialGradient(doc.w / 2, doc.h / 2, Math.min(doc.w, doc.h) * 0.35, doc.w / 2, doc.h / 2, Math.hypot(doc.w, doc.h) / 2);
    grad.addColorStop(0, "rgba(23, 19, 14, 0)");
    grad.addColorStop(1, `rgba(23, 19, 14, ${Math.min(0.85, f.vinheta)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, doc.w, doc.h);
  }
  return tela;
}

/** Uma camada sozinha, numa tela à parte do tamanho da página (para o PSD, a separação de cores e o vetor). */
export function telaDaCamada(doc: Documento, c: Camada, escala = 1): HTMLCanvasElement {
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(doc.w * escala));
  tela.height = Math.max(1, Math.round(doc.h * escala));
  const ctx = tela.getContext("2d");
  if (ctx) {
    ctx.scale(escala, escala);
    desenharCamada(ctx, c, undefined, doc.h);
  }
  return tela;
}

// ───── Guias, réguas e seleção ─────

/** O formato do Instagram pelas medidas: muda o que as guias mostram. */
export function tipoDoInstagram(doc: Pick<Documento, "w" | "h">): "4:5" | "1:1" | "9:16" | null {
  const r = doc.w / doc.h;
  if (Math.abs(r - 0.8) < 0.01) return "4:5";
  if (Math.abs(r - 1) < 0.01 && doc.w <= 1200) return "1:1";
  if (Math.abs(r - 0.5625) < 0.01) return "9:16";
  return null;
}

export interface Ajudas {
  instagram?: boolean;
  /** Margem da marca (80 pontos num post de 1080). */
  margens?: boolean;
  /** Grade de 8 em 8 (de 40 em 40 se a tela estiver longe). */
  grade?: boolean;
}

/** As zonas do Instagram que ficam escondidas ou cortadas (em pontos da arte), com o nome de cada uma. */
export function zonasDoInstagram(doc: Pick<Documento, "w" | "h">): { x: number; y: number; w: number; h: number; nome: string }[] {
  const tipo = tipoDoInstagram(doc);
  const k = doc.w / 1080;
  if (tipo === "4:5" || tipo === "1:1") {
    // A grade do perfil mostra 3:4: corta as laterais.
    const visivel = (doc.h * 3) / 4;
    const corte = Math.max(0, (doc.w - visivel) / 2);
    return corte > 0
      ? [
          { x: 0, y: 0, w: corte, h: doc.h, nome: "Corte da grade do perfil (3:4)" },
          { x: doc.w - corte, y: 0, w: corte, h: doc.h, nome: "" },
        ]
      : [];
  }
  if (tipo === "9:16")
    return [
      { x: 0, y: 0, w: doc.w, h: 250 * k, nome: "Perfil e barra de progresso" },
      { x: 0, y: doc.h - 340 * k, w: doc.w, h: 340 * k, nome: "Resposta e legenda do Reels" },
      { x: doc.w - 130 * k, y: doc.h - 900 * k, w: 130 * k, h: 560 * k, nome: "Botões do Reels" },
    ];
  return [];
}

/** Guias de ajuda por cima da arte (não saem na exportação). k é a escala de pontos para pixels da tela. */
export function desenharAjudas(ctx: CanvasRenderingContext2D, doc: Documento, k: number, a: Ajudas, px = 1) {
  ctx.save();
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (a.grade) {
    const passo = (k / px) * 8 >= 6 ? 8 : 40;
    ctx.strokeStyle = "rgba(110, 31, 26, 0.13)";
    ctx.lineWidth = px / k;
    ctx.beginPath();
    for (let x = passo; x < doc.w; x += passo) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, doc.h);
    }
    for (let y = passo; y < doc.h; y += passo) {
      ctx.moveTo(0, y);
      ctx.lineTo(doc.w, y);
    }
    ctx.stroke();
  }
  if (a.margens) {
    const m = 80 * (doc.w / 1080);
    ctx.strokeStyle = "rgba(212, 166, 74, 0.95)";
    ctx.lineWidth = (1.5 * px) / k;
    ctx.setLineDash([(6 * px) / k, (4 * px) / k]);
    ctx.strokeRect(m, m, doc.w - 2 * m, doc.h - 2 * m);
    ctx.setLineDash([]);
  }
  if (a.instagram) {
    ctx.font = `600 ${(12 * px) / k}px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    for (const z of zonasDoInstagram(doc)) {
      ctx.fillStyle = "rgba(212, 166, 74, 0.22)";
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "rgba(212, 166, 74, 0.95)";
      ctx.lineWidth = (1.5 * px) / k;
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      if (z.nome) {
        const largura = ctx.measureText(z.nome).width;
        const x = Math.min(z.x + (6 * px) / k, doc.w - largura - (10 * px) / k);
        ctx.fillStyle = "rgba(42, 35, 29, 0.88)";
        ctx.fillRect(x - (4 * px) / k, z.y + (4 * px) / k, largura + (8 * px) / k, (18 * px) / k);
        ctx.fillStyle = "#f0cf8e";
        ctx.fillText(z.nome, x, z.y + (7 * px) / k);
      }
    }
  }
  ctx.restore();
}

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

/** A camada de cima sob o ponto (as travadas e escondidas não contam). */
export function camadaEm(doc: Documento, px: number, py: number): Camada | null {
  for (let i = doc.camadas.length - 1; i >= 0; i--) {
    const c = doc.camadas[i];
    if (!c.oculta && !c.travada && dentro(c, px, py)) return c;
  }
  return null;
}
/** Todas as camadas sob o ponto, de cima para baixo (Alt+clique alterna entre elas). */
export const camadasEm = (doc: Documento, px: number, py: number) => [...doc.camadas].reverse().filter((c) => !c.oculta && !c.travada && dentro(c, px, py));

/** A caixa reta que contém a camada (com a rotação). */
export function caixa(c: Pick<Camada, "x" | "y" | "w" | "h" | "rot">) {
  if (!c.rot) return { x: c.x, y: c.y, w: c.w, h: c.h };
  const a = (c.rot * Math.PI) / 180;
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  const w = c.w * cos + c.h * sin;
  const h = c.w * sin + c.h * cos;
  return { x: c.x + c.w / 2 - w / 2, y: c.y + c.h / 2 - h / 2, w, h };
}
/** A caixa que contém várias camadas. */
export function caixaDeVarias(lista: Pick<Camada, "x" | "y" | "w" | "h" | "rot">[]) {
  const caixas = lista.map(caixa);
  const x = Math.min(...caixas.map((b) => b.x));
  const y = Math.min(...caixas.map((b) => b.y));
  return { x, y, w: Math.max(...caixas.map((b) => b.x + b.w)) - x, h: Math.max(...caixas.map((b) => b.y + b.h)) - y, rot: 0 };
}

export type Alca = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "rot";
/** As alças de redimensionar e girar, em coordenadas do documento (já giradas com a camada). */
export function alcas(c: Pick<Camada, "x" | "y" | "w" | "h" | "rot">, escala: number, girar = true): { id: Alca; x: number; y: number }[] {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  const a = (c.rot * Math.PI) / 180;
  const g = (lx: number, ly: number) => ({ x: cx + (lx - c.w / 2) * Math.cos(a) - (ly - c.h / 2) * Math.sin(a), y: cy + (lx - c.w / 2) * Math.sin(a) + (ly - c.h / 2) * Math.cos(a) });
  const lista: { id: Alca; x: number; y: number }[] = [
    { id: "nw", ...g(0, 0) },
    { id: "n", ...g(c.w / 2, 0) },
    { id: "ne", ...g(c.w, 0) },
    { id: "e", ...g(c.w, c.h / 2) },
    { id: "se", ...g(c.w, c.h) },
    { id: "s", ...g(c.w / 2, c.h) },
    { id: "sw", ...g(0, c.h) },
    { id: "w", ...g(0, c.h / 2) },
  ];
  if (girar) lista.push({ id: "rot", ...g(c.w / 2, -28 / escala) });
  return lista;
}

const BORDO = "#6e1f1a";
/**
 * Desenha a seleção por cima da arte: o contorno bordô de cada camada escolhida e as alças da caixa (de uma camada,
 * girando com ela; de várias, a caixa reta que contém todas). k é a escala de pontos para pixels da tela; px, quantos
 * pixels da tela valem um pixel do monitor (telas de alta densidade).
 */
export function desenharSelecao(ctx: CanvasRenderingContext2D, camadas: Camada[], k: number, px = 1) {
  if (!camadas.length) return;
  for (const c of camadas) {
    ctx.save();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
    ctx.rotate((c.rot * Math.PI) / 180);
    ctx.strokeStyle = BORDO;
    ctx.lineWidth = (camadas.length > 1 ? 1 : 1.6) * (px / k);
    if (c.travada) ctx.setLineDash([4 * (px / k), 3 * (px / k)]);
    ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }
  const unica = camadas.length === 1;
  if (unica && camadas[0].travada) return;
  const alvo = unica ? camadas[0] : caixaDeVarias(camadas);
  ctx.save();
  if (!unica) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.strokeStyle = BORDO;
    ctx.lineWidth = 1.6 * (px / k);
    ctx.setLineDash([6 * (px / k), 4 * (px / k)]);
    ctx.strokeRect(alvo.x, alvo.y, alvo.w, alvo.h);
    ctx.setLineDash([]);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const a of alcas(alvo, k / px, unica)) {
    const x = a.x * k;
    const y = a.y * k;
    ctx.fillStyle = a.id === "rot" ? BORDO : "#ffffff";
    ctx.strokeStyle = BORDO;
    ctx.lineWidth = 1.5 * px;
    ctx.beginPath();
    if (a.id === "rot") ctx.arc(x, y, 5.5 * px, 0, Math.PI * 2);
    else ctx.rect(x - 4.5 * px, y - 4.5 * px, 9 * px, 9 * px);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ───── Exportar ─────

export interface OpcoesDeExportacao {
  escala?: number;
  /** JPEG e WebP: de 0,5 a 1. */
  qualidade?: number;
  transparente?: boolean;
  t?: number;
}

export async function exportar(doc: Documento, tipo: "png" | "jpeg" | "webp", opcoes: OpcoesDeExportacao = {}): Promise<Blob> {
  await carregarTudo(doc);
  const tela = document.createElement("canvas");
  desenhar(tela, doc, opcoes.escala ?? 1, { exportar: true, transparente: tipo === "png" && opcoes.transparente, t: opcoes.t });
  return new Promise((resolver, recusar) => tela.toBlob((blob) => (blob ? resolver(blob) : recusar(new Error("exportar"))), `image/${tipo}`, opcoes.qualidade ?? 0.92));
}

/** Uma prévia pequena em JPEG (data:), para a lista de trabalhos. */
export async function miniatura(doc: Documento, lado = 280): Promise<string> {
  await carregarTudo(doc);
  const tela = document.createElement("canvas");
  desenhar(tela, doc, lado / Math.max(doc.w, doc.h), { exportar: true });
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
    const fixa = c.tipo === "imagem" || c.tipo === "marca" || c.tipo === "elemento";
    let nova: Camada;
    if (cheiaV) nova = { ...c, x: c.x * s, y: c.y * ry, w: c.w * s, h: c.h * ry } as Camada;
    else if (ry < s) {
      // Mais baixo: tudo encolhe na mesma proporção; a largura do texto continua a da coluna.
      const larga = c.tipo === "texto" || (cheiaH && !fixa);
      const largura = larga ? c.w * s : c.w * k;
      const x = larga ? c.x * s : c.x * s + (c.w * s - largura) / 2;
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
      if (nova.espContorno) nova.espContorno *= escalaDoTexto;
      if (nova.sombraX) nova.sombraX *= escalaDoTexto;
      if (nova.sombraY) nova.sombraY *= escalaDoTexto;
      if (!nova.ajustar) nova.h = alturaDoTexto(nova);
    }
    if ("espessura" in nova) nova.espessura = nova.espessura * escalaDoTexto;
    return nova;
  });
  return { ...doc, w, h, fundo: { ...doc.fundo, espessura: doc.fundo.espessura * k }, camadas };
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

export const hexParaRgb = (cor: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(cor);
  const n = m ? parseInt(m[1], 16) : 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

/** O nome PostScript das fontes livres do instituto (EB Garamond, Inter, IBM Plex Mono e Caveat, todas com licença OFL). */
function nomePostScript(c: CamadaTexto): string {
  const nome = (fam: string, peso: string) => (peso === "Regular" ? `${fam}-${c.italico ? "Italic" : "Regular"}` : `${fam}-${peso}${c.italico ? "Italic" : ""}`);
  if (c.fonte === "manuscrita") return c.peso >= 600 ? "Caveat-Bold" : "Caveat-Regular";
  if (c.fonte === "mono") return nome("IBMPlexMono", c.peso >= 600 ? "SemiBold" : c.peso >= 500 ? "Medium" : "Regular");
  const pesos: Record<number, string> = { 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" };
  if (c.fonte === "sans") return nome("Inter", pesos[c.peso] ?? "Regular");
  return nome("EBGaramond", c.peso >= 800 ? "ExtraBold" : (pesos[c.peso] ?? "Regular"));
}

export const NOMES_DOS_ELEMENTOS: Record<CamadaElemento["desenho"], string> = {
  "foice-martelo": "Foice e martelo",
  punho: "Punho erguido",
  "punho-cartaz": "Punho de cartaz",
  brasil: "Mapa do Brasil",
  "brasil-estados": "Mapa dos estados",
  icone: "Ícone",
  qr: "Código QR",
  ornamento: "Ornamento",
  carimbo: "Carimbo",
  selo: "Selo",
  fita: "Fita adesiva",
  louros: "Ramos de trigo",
  "raios-traco": "Raios em traço",
  pincelada: "Pincelada",
  "seta-mao": "Seta à mão",
  figurinha: "Guia de figurinha",
};
export const NOMES_DAS_FORMAS: Record<TipoDeForma, string> = { retangulo: "Retângulo", elipse: "Elipse", estrela: "Estrela", linha: "Linha", cunha: "Cunha", raios: "Raios", triangulo: "Triângulo", escudo: "Escudo" };

export const nomeDaCamada = (c: Camada) =>
  (
    c.nome ||
    (c.tipo === "texto"
      ? semMarcas(c.texto).split("\n")[0].slice(0, 40) || "Texto"
      : c.tipo === "imagem"
        ? "Imagem"
        : c.tipo === "marca"
          ? "Marca"
          : c.tipo === "elemento"
            ? NOMES_DOS_ELEMENTOS[c.desenho]
            : NOMES_DAS_FORMAS[c.tipo])
  ).slice(0, 60);

/**
 * A arte como PSD, para abrir no editor avançado: uma camada por camada do estúdio, com nome, posição, opacidade e a
 * visibilidade. Cada camada vai desenhada (o que garante o visual em qualquer editor) e os textos simples levam também
 * o texto editável, a fonte, o tamanho e a cor. Efeitos que só o estúdio sabe fazer (filtros, tarja, arco, contorno,
 * estilos misturados) chegam já desenhados, sem ser editáveis.
 */
export async function paraPsd(doc: Documento): Promise<Blob> {
  await carregarTudo(doc);
  const { writePsd } = await import("ag-psd");
  type CamadaPsd = NonNullable<Parameters<typeof writePsd>[0]["children"]>[number];
  const filhos: CamadaPsd[] = [{ name: "Fundo", left: 0, top: 0, canvas: telaDoFundo(doc, false) }];
  for (const c of doc.camadas) {
    if (c.soGuia) continue;
    // Cada camada vai recortada no tamanho do que tem desenhado: uma tela do tamanho da página por camada somava
    // centenas de megabytes numa arte com muitas camadas e derrubava o navegador em computadores com pouca memória.
    const recorte = recortarTela(telaDaCamada(doc, c));
    const camada: CamadaPsd = { name: nomeDaCamada(c), left: recorte.left, top: recorte.top, canvas: recorte.canvas, opacity: c.opacidade, hidden: Boolean(c.oculta) };
    const simples = c.tipo === "texto" && !c.fundo && c.rot === 0 && !c.curva && !c.contorno && !c.vazado && !c.sombra && !c.marcador && semMarcas(c.texto) === c.texto;
    if (c.tipo === "texto" && simples) {
      const alinhamento = c.alinhar === "center" ? "center" : c.alinhar === "right" ? "right" : "left";
      const x = c.alinhar === "center" ? c.x + c.w / 2 : c.alinhar === "right" ? c.x + c.w - c.recuo : c.x + c.recuo;
      const tamanho = tamanhoQueCabe(c);
      camada.text = {
        text: textoFinal(c).replace(/\n/g, "\r"),
        transform: [1, 0, 0, 1, x, c.y + c.recuo + tamanho * 0.8],
        style: { font: { name: nomePostScript(c) }, fontSize: tamanho, leading: tamanho * c.entrelinha, tracking: Math.round(c.espacamento * 1000), fillColor: hexParaRgb(c.cor) },
        paragraphStyle: { justification: alinhamento },
      };
    }
    filhos.push(camada);
  }
  if (doc.fundo.espessura > 0 && (doc.fundo.bordaCima || doc.fundo.bordaBaixo)) filhos.push({ name: "Fios", left: 0, top: 0, canvas: telaDoFundo(doc, true) });
  const composta = document.createElement("canvas");
  desenhar(composta, doc, 1, { exportar: true });
  const dados = writePsd({ width: doc.w, height: doc.h, children: filhos, canvas: composta }, { generateThumbnail: true, invalidateTextLayers: true });
  // Devolve a memória das telas na hora (o navegador só solta quando a tela some de vez).
  for (const f of filhos) if (f.canvas) (f.canvas as HTMLCanvasElement).width = 0;
  composta.width = 0;
  return new Blob([dados], { type: "image/vnd.adobe.photoshop" });
}

/** Recorta uma tela no retângulo do que tem desenhado (o resto é transparente) e solta a tela original. */
function recortarTela(tela: HTMLCanvasElement): { left: number; top: number; canvas: HTMLCanvasElement } {
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { left: 0, top: 0, canvas: tela };
  const { width: w, height: h } = tela;
  const alfa = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const linha = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (alfa[linha + x * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  if (x1 < 0) {
    tela.width = 1;
    tela.height = 1;
    return { left: 0, top: 0, canvas: tela };
  }
  const recorte = document.createElement("canvas");
  recorte.width = x1 - x0 + 1;
  recorte.height = y1 - y0 + 1;
  recorte.getContext("2d")?.drawImage(tela, x0, y0, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height);
  tela.width = 0;
  return { left: x0, top: y0, canvas: recorte };
}

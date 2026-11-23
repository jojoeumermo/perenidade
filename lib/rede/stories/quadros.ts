// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// P5 (A16): os vários quadros de um story. Cada quadro é tudo o que a tela de criar guarda de um story (fundo, texto, desenho,
// figurinhas, a foto ou o vídeo com os ajustes); ao publicar, cada quadro vira um story, na ordem, e quem vê passa de um ao outro
// como sempre (os stories de uma pessoa já tocam em sequência). "Quem vê" vale para a sequência inteira. Puro, sem "@/" (os testes
// rodam no Node).
import type { AjustesDaMidia, AreaBorradaDoVideo as AreaBorrada, FiltroDoStory, TracoDoStory, Transformacao } from "./midia";
import type { CorDoStory, EstiloDoStory, Figurinha, LegendaDoVideo, MusicaDoStory, NomeDecorativo, PosicaoDaFigurinha, TipoDeFigurinha } from "../tipos-stories";

/** Quantos quadros uma sequência pode ter (cada um é um story; o banco deixa 20 por dia). */
export const LIMITE_DE_QUADROS = 10;

/** A foto ou o vídeo do quadro, como está no aparelho (o endereço é local, "blob:"). */
export type MidiaDoQuadro =
  | { tipo: "imagem"; blob: Blob; url: string }
  | { tipo: "video"; blob: Blob; url: string; duracao: number };

/** Um enfeite (decorativa) com o lugar dele na tela. */
export interface EnfeiteDoQuadro {
  chave: number;
  nome: NomeDecorativo;
  pos: PosicaoDaFigurinha;
}

/** Tudo de um quadro. */
export interface Quadro {
  cor: CorDoStory;
  alvoDaCor: "fundo" | "letra";
  texto: string;
  estilo: EstiloDoStory;
  legenda: string;
  figurinhas: Figurinha[];
  frente: TipoDeFigurinha | null;
  enfeites: EnfeiteDoQuadro[];
  tracos: TracoDoStory[];
  midia: MidiaDoQuadro | null;
  filtro: FiltroDoStory;
  ajustes: AjustesDaMidia;
  transf: Transformacao;
  corte: { inicio: number; fim: number };
  som: boolean;
  alt: string;
  legendas: LegendaDoVideo[];
  legendasGeradas: boolean;
  legendasAprovadas: boolean;
  musica: MusicaDoStory | null;
  /** A foto antes do borrado (para refazer) e as áreas; só no aparelho. */
  fotoOriginal: { blob: Blob; areas: AreaBorrada[] } | null;
  borroesDoVideo: AreaBorrada[];
}

/** Um quadro em branco (a cor do fundo segue a do quadro de antes, para a sequência ter unidade). */
export function quadroVazio(cor: CorDoStory = "azul"): Quadro {
  return {
    cor,
    alvoDaCor: "fundo",
    texto: "",
    estilo: {},
    legenda: "",
    figurinhas: [],
    frente: null,
    enfeites: [],
    tracos: [],
    midia: null,
    filtro: "nenhum",
    ajustes: { brilho: 0, contraste: 0, saturacao: 0 },
    transf: { x: 0, y: 0, escala: 1, giro: 0 },
    corte: { inicio: 0, fim: 0 },
    som: true,
    alt: "",
    legendas: [],
    legendasGeradas: false,
    legendasAprovadas: false,
    musica: null,
    fotoOriginal: null,
    borroesDoVideo: [],
  };
}

/** O quadro tem alguma coisa para publicar? (o vazio fica de fora da sequência) */
export function quadroTemConteudo(q: Quadro): boolean {
  return q.texto.trim() !== "" || q.legenda.trim() !== "" || q.figurinhas.length > 0 || q.enfeites.length > 0 || q.tracos.length > 0 || q.midia !== null;
}

/** Tira o quadro `k` da sequência e diz qual passa a ser o atual (o vizinho de antes; sozinho, sobra um vazio). */
export function tirarQuadro(lista: readonly Quadro[], k: number): { lista: Quadro[]; atual: number } {
  if (lista.length <= 1) return { lista: [quadroVazio(lista[0]?.cor)], atual: 0 };
  const nova = lista.filter((_, i) => i !== k);
  return { lista: nova, atual: Math.min(k, nova.length - 1) };
}

/** Põe um quadro vazio logo depois do `k` (até o limite). Nulo: já está no limite. */
export function porQuadroDepois(lista: readonly Quadro[], k: number): { lista: Quadro[]; atual: number } | null {
  if (lista.length >= LIMITE_DE_QUADROS) return null;
  const nova = [...lista.slice(0, k + 1), quadroVazio(lista[k]?.cor), ...lista.slice(k + 1)];
  return { lista: nova, atual: k + 1 };
}

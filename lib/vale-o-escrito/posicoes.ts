// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: as posições da teia (d3-force). Parte PURA (sem React, sem "@/"), usada pelo servidor e pelo navegador.
//
// 23/11/2026: a simulação rodava no navegador a cada abertura da página, e duas vezes seguidas. Num celular comum eram
// cerca de 2 s de tela travada em cada uma. Agora o servidor calcula a teia de abertura (o banco inteiro, sem filtro) e
// entrega as posições prontas junto com a página. O navegador só calcula quando o grafo muda (filtro, dossiê, caso novo
// ao vivo) e guarda o resultado, para não refazer o mesmo desenho. A simulação é determinística, então o desenho é o
// mesmo que o navegador faria.

import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { posicaoInicial, raioDoNo, type Grafo, type Ponto } from "./visual";

/** O tamanho do palco da teia (unidades do viewBox do SVG). */
export const LARGURA_DA_TEIA = 1000;
export const ALTURA_DA_TEIA = 640;

/** As posições prontas que o servidor manda: a assinatura do grafo e x, y de cada nó, na ordem de grafo.nos. */
export interface PosicoesProntas {
  assinatura: string;
  xy: number[];
}

interface NoSim extends SimulationNodeDatum {
  chave: string;
  raio: number;
}

/** FNV-1a de 32 bits, em hexadecimal. */
function fnv(texto: string, semente: number): string {
  let h = semente >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * O que define o desenho: os nós (chave e raio, na ordem) e as arestas. Dois grafos com a mesma assinatura dão as
 * mesmas posições. Os rótulos (que mudam com o idioma) não entram.
 */
export function assinaturaDoGrafo(g: Grafo): string {
  const texto = `${g.nos.map((n) => `${n.chave}~${raioDoNo(n)}`).join("|")}#${g.arestas.map((a) => `${a.de}>${a.para}`).join("|")}`;
  return `${g.nos.length}.${g.arestas.length}.${fnv(texto, 0x811c9dc5)}${fnv(texto, 0x9e3779b9)}`;
}

/**
 * A simulação de força roda inteira, de uma vez, e para: depois disso nada se mexe (os nós não se arrastam nem se
 * pinçam). Determinística: ponto de partida fixo (posicaoInicial) e o sorteio do d3-force com semente própria, então o
 * mesmo grafo dá sempre o mesmo desenho, no servidor e em qualquer navegador.
 *
 * 09/11/2026: os pontos estavam embolados. Agora a repulsão é maior e chega mais longe, os fios são mais compridos e a
 * colisão respeita o tamanho de cada nó (com folga para o halo), então os casos grandes não engolem os vizinhos.
 */
export function calcularPosicoes(g: Grafo): Map<string, Ponto> {
  const L = LARGURA_DA_TEIA;
  const A = ALTURA_DA_TEIA;
  const nos: NoSim[] = g.nos.map((n, i) => ({ chave: n.chave, raio: raioDoNo(n), ...posicaoInicial(i, g.nos.length, L, A) }));
  const ligas: SimulationLinkDatum<NoSim>[] = g.arestas.map((a) => ({ source: a.de, target: a.para }));
  const sim = forceSimulation<NoSim>(nos)
    .force("liga", forceLink<NoSim, SimulationLinkDatum<NoSim>>(ligas).id((d) => d.chave).distance(96).strength(0.45))
    .force("carga", forceManyBody<NoSim>().strength(-340).distanceMax(700))
    .force("centro", forceCenter(L / 2, A / 2))
    .force("x", forceX<NoSim>(L / 2).strength(0.025))
    .force("y", forceY<NoSim>(A / 2).strength(0.04))
    .force("colisao", forceCollide<NoSim>((d) => d.raio + 15).strength(0.9).iterations(2))
    .stop();
  const passos = Math.min(420, 200 + g.nos.length * 2);
  for (let i = 0; i < passos; i++) sim.tick();
  return new Map(nos.map((n) => [n.chave, { x: n.x ?? L / 2, y: n.y ?? A / 2 }]));
}

// Os desenhos já feitos neste processo (no servidor, valem para todos os idiomas; no navegador, para as trocas de filtro).
const feitos = new Map<string, Map<string, Ponto>>();
const MAXIMO_GUARDADO = 12;

function guardar(assinatura: string, pos: Map<string, Ponto>): Map<string, Ponto> {
  if (feitos.size >= MAXIMO_GUARDADO) feitos.delete(feitos.keys().next().value as string);
  feitos.set(assinatura, pos);
  return pos;
}

/**
 * As posições do grafo: as prontas (vindas do servidor) quando a assinatura bate, senão as já calculadas antes, senão
 * calcula agora.
 */
export function posicoesDoGrafo(g: Grafo, prontas?: PosicoesProntas | null): Map<string, Ponto> {
  const assinatura = assinaturaDoGrafo(g);
  const ja = feitos.get(assinatura);
  if (ja) return ja;
  if (prontas && prontas.assinatura === assinatura && prontas.xy.length === g.nos.length * 2) {
    return guardar(assinatura, new Map(g.nos.map((n, i) => [n.chave, { x: prontas.xy[i * 2], y: prontas.xy[i * 2 + 1] }])));
  }
  return guardar(assinatura, calcularPosicoes(g));
}

/** Para o servidor: as posições do grafo em forma de envio (x, y com duas casas, na ordem dos nós). */
export function posicoesParaEnviar(g: Grafo): PosicoesProntas {
  const pos = posicoesDoGrafo(g);
  const xy: number[] = [];
  for (const n of g.nos) {
    const p = pos.get(n.chave) ?? { x: LARGURA_DA_TEIA / 2, y: ALTURA_DA_TEIA / 2 };
    xy.push(Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100);
  }
  return { assinatura: assinaturaDoGrafo(g), xy };
}

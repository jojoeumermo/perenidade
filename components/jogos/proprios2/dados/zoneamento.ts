// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Fonte } from "../tipos";

export type Uso = "vazio" | "moradia" | "comercio" | "verde" | "servico" | "oficina";
export type Celula = "corrego" | "casa" | Uso;

export const USOS: { id: Uso; nome: string }[] = [
  { id: "vazio", nome: "Sem uso ainda" },
  { id: "moradia", nome: "Moradia popular" },
  { id: "comercio", nome: "Comércio e serviço de bairro" },
  { id: "verde", nome: "Praça e área verde" },
  { id: "servico", nome: "Escola e posto de saúde" },
  { id: "oficina", nome: "Oficina e fábrica pequena" },
];

export const LADO = 5;

/** O mapa de partida: ~ córrego (não se constrói), C casas já existentes (ocupação antiga, zona de interesse social), . lote livre. */
const DESENHO = [". . . ~ .", ". C C ~ .", ". C C ~ .", ". . . . .", ". . . . ."];

export const MAPA_INICIAL: Celula[] = DESENHO.join(" ")
  .split(" ")
  .map((c): Celula => (c === "~" ? "corrego" : c === "C" ? "casa" : "vazio"));

export interface Regra {
  id: string;
  texto: string;
  fonte: string;
  ok: boolean;
}

const pos = (i: number): [number, number] => [Math.floor(i / LADO), i % LADO];
const ehMoradia = (c: Celula) => c === "casa" || c === "moradia";
const manhattan = (a: number, b: number) => {
  const [ra, ca] = pos(a);
  const [rb, cb] = pos(b);
  return Math.abs(ra - rb) + Math.abs(ca - cb);
};
const vizinhos8 = (a: number, b: number) => {
  const [ra, ca] = pos(a);
  const [rb, cb] = pos(b);
  return Math.max(Math.abs(ra - rb), Math.abs(ca - cb)) <= 1;
};

/** Confere o desenho contra as regras do jogo. As regras vêm das diretrizes do Estatuto da Cidade (Lei 10.257/2001, art. 2º). */
export function avaliar(mapa: readonly Celula[]): Regra[] {
  const idx = mapa.map((_, i) => i);
  const moradias = idx.filter((i) => ehMoradia(mapa[i]));
  const servicos = idx.filter((i) => mapa[i] === "servico");
  const oficinas = idx.filter((i) => mapa[i] === "oficina");
  const novas = idx.filter((i) => mapa[i] === "moradia");
  return [
    {
      id: "equipamentos",
      texto: "Toda moradia tem escola ou posto a, no máximo, 3 quadras de distância.",
      fonte: "Estatuto da Cidade, art. 2º, V: oferta de equipamentos urbanos e comunitários, transporte e serviços públicos adequados.",
      ok: servicos.length > 0 && moradias.every((m) => servicos.some((s) => manhattan(m, s) <= 3)),
    },
    {
      id: "incompativeis",
      texto: "Nenhuma oficina ou fábrica encosta (nem na diagonal) em moradia, escola ou posto.",
      fonte: "Estatuto da Cidade, art. 2º, VI, b: evitar a proximidade de usos incompatíveis ou inconvenientes.",
      ok: oficinas.every((o) => idx.every((j) => j === o || !vizinhos8(o, j) || !(ehMoradia(mapa[j]) || mapa[j] === "servico"))),
    },
    {
      id: "moradia-nova",
      texto: "Pelo menos 2 moradias novas, para quem hoje não tem onde morar.",
      fonte:
        "Estatuto da Cidade, art. 2º, I: direito à terra urbana e à moradia. As casas antigas ficam: regularizar a ocupação é diretriz (art. 2º, XIV; zonas especiais de interesse social, art. 4º, V, f).",
      ok: novas.length >= 2,
    },
    {
      id: "verde",
      texto: "Pelo menos uma praça ou área verde.",
      fonte: "Regra do jogo, ligada ao direito a cidades sustentáveis (Estatuto da Cidade, art. 2º, I).",
      ok: mapa.includes("verde"),
    },
    {
      id: "renda",
      texto: "Pelo menos um comércio ou uma oficina, para haver trabalho perto de casa.",
      fonte: "Regra do jogo.",
      ok: mapa.includes("comercio") || oficinas.length > 0,
    },
    {
      id: "todos-usados",
      texto: "Nenhum lote ficou sem uso.",
      fonte: "Regra do jogo.",
      ok: !mapa.includes("vazio"),
    },
  ];
}

export const FONTES_ZONEAMENTO: Fonte[] = [
  { nome: "Lei 10.257/2001, Estatuto da Cidade (planalto.gov.br)", url: "https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10257.htm" },
];

/** Usucapião especial urbana, citada na tela de resultado (Estatuto da Cidade, art. 9º). */
export const NOTA_USUCAPIAO =
  "Quem mora há 5 anos, sem interrupção nem oposição, em área urbana de até 250 m², para moradia própria ou da família, e não tem outro imóvel, pode pedir o domínio (usucapião especial urbana, art. 9º). Isto é informação, não orientação jurídica: procure a Defensoria Pública.";

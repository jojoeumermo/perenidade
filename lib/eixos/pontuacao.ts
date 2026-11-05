// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conta do teste dos 12 eixos, pura e sem dependências: só recebe números e devolve números, sem tocar em disco, em
// navegador, em rede ou em "@/". Por isso serve a três lugares: a tela do teste (components/estudo/DozeEixos.tsx), o
// teste automático (scripts/testar-eixos.mjs) e, na Etapa 8, a pesquisa anônima da equipe, que guarda só o AGREGADO
// (média e distribuição), nunca a resposta de uma pessoa.
//
// Opinião política é dado pessoal sensível (LGPD, Lei 13.709/2018, art. 5º, II); o tratamento exige uma das hipóteses
// do art. 11, e para a pesquisa da equipe isso significa consentimento específico e destacado (art. 11, I). Dado
// anonimizado e agregado deixa de ser dado pessoal (art. 12), mas só se não puder ser revertido: por isso o agregado
// abaixo recusa grupos pequenos (`minimo`).

/** As cinco respostas, de "concordo totalmente" (0) a "discordo totalmente" (4), e quanto cada uma empurra o eixo. */
export const PESOS = [1, 0.5, 0, -0.5, -1] as const;

/** Os três tamanhos do teste: curto (~36 perguntas), médio (~100) e longo (~240). Cada um contém o anterior. */
export const NIVEIS = [1, 2, 3] as const;
export type Nivel = (typeof NIVEIS)[number];

/** Quantas perguntas cada eixo tem em cada tamanho (12 eixos: 36, 96 e 240 perguntas). */
export const PERGUNTAS_POR_EIXO: Record<Nivel, number> = { 1: 3, 2: 8, 3: 20 };

export interface PerguntaPontuavel {
  id: string;
  eixo: string;
  /** O lado do eixo que concordar com a frase favorece: "a" (primeiro polo) ou "b" (segundo). */
  lado: "a" | "b";
  nivel: number;
}

export interface PosicaoNos12Eixos {
  id: string;
  /** De 0 a 100: quanto da posição típica fica do lado "a" de cada eixo. */
  posicao: Record<string, number>;
}

/** As perguntas do tamanho escolhido, alternando os eixos (uma de cada vez) para o teste não ficar repetitivo. */
export function ordemDoNivel<P extends PerguntaPontuavel>(eixos: readonly { id: string }[], perguntas: readonly P[], nivel: number): P[] {
  const porEixo = eixos.map((eixo) =>
    perguntas.filter((p) => p.eixo === eixo.id && p.nivel <= nivel).sort((x, y) => x.nivel - y.nivel || x.id.localeCompare(y.id, "pt", { numeric: true })),
  );
  const maior = Math.max(0, ...porEixo.map((lista) => lista.length));
  return Array.from({ length: maior }, (_, k) => porEixo.flatMap((lista) => (lista[k] ? [lista[k]] : []))).flat();
}

/** Resposta válida: inteiro de 0 a 4. */
export function respostaValida(r: unknown): r is 0 | 1 | 2 | 3 | 4 {
  return typeof r === "number" && Number.isInteger(r) && r >= 0 && r <= 4;
}

/**
 * Onde a pessoa fica em cada eixo: de 0 a 100, a parte das respostas que puxa para o primeiro lado (a). Eixo sem
 * nenhuma resposta fica em 50. Respostas inválidas são ignoradas.
 */
export function pontuarEixos(eixos: readonly { id: string }[], perguntas: readonly PerguntaPontuavel[], respostas: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(
    eixos.map((eixo) => {
      const doEixo = perguntas.filter((p) => p.eixo === eixo.id && respostaValida(respostas[p.id]));
      if (!doEixo.length) return [eixo.id, 50];
      const soma = doEixo.reduce((total, p) => total + PESOS[respostas[p.id]] * (p.lado === "a" ? 1 : -1), 0);
      return [eixo.id, Math.round(50 + (50 * soma) / doEixo.length)];
    }),
  );
}

/** Proximidade de 0 a 100 entre os pontos da pessoa e uma posição típica (distância euclidiana nos eixos). */
export function proximidade(eixos: readonly { id: string }[], pontos: Readonly<Record<string, number>>, posicao: Readonly<Record<string, number>>): number {
  const maximo = Math.sqrt(eixos.length) * 100;
  const distancia = Math.sqrt(eixos.reduce((total, eixo) => total + ((pontos[eixo.id] ?? 50) - (posicao[eixo.id] ?? 50)) ** 2, 0));
  return Math.round(100 * (1 - distancia / maximo));
}

/** Os `limite` candidatos (ideologias, países, figuras) mais próximos, do mais para o menos próximo. */
export function maisProximos<T extends PosicaoNos12Eixos>(eixos: readonly { id: string }[], pontos: Readonly<Record<string, number>>, candidatos: readonly T[], limite = 3): { item: T; proximidade: number }[] {
  return candidatos
    .map((item) => ({ item, proximidade: proximidade(eixos, pontos, item.posicao) }))
    .sort((x, y) => y.proximidade - x.proximidade || x.item.id.localeCompare(y.item.id))
    .slice(0, limite);
}

/** Faixas da distribuição de cada eixo: 0-19, 20-39, 40-59, 60-79, 80-100. */
export const FAIXAS = 5;
export function faixaDe(ponto: number): number {
  return Math.min(FAIXAS - 1, Math.max(0, Math.floor(ponto / (100 / FAIXAS))));
}

export interface AgregadoDosEixos {
  /** Quantas pessoas entraram na conta. */
  n: number;
  /** Média de cada eixo (0 a 100). */
  media: Record<string, number>;
  /** Quantas pessoas caíram em cada uma das cinco faixas de cada eixo. */
  distribuicao: Record<string, number[]>;
}

/**
 * Junta os resultados de várias pessoas SEM guardar nenhum deles: devolve só a média e a distribuição por faixa de cada
 * eixo, e `null` se houver menos de `minimo` pessoas (grupo pequeno demais para não identificar ninguém). É a função que a
 * pesquisa anônima da equipe (Etapa 8) usa para somar.
 */
export function agregarPontos(eixos: readonly { id: string }[], resultados: readonly Readonly<Record<string, number>>[], minimo = 5): AgregadoDosEixos | null {
  const validos = resultados.filter((r) => eixos.every((e) => typeof r[e.id] === "number" && r[e.id] >= 0 && r[e.id] <= 100));
  if (validos.length < Math.max(1, minimo)) return null;
  const media: Record<string, number> = {};
  const distribuicao: Record<string, number[]> = {};
  for (const eixo of eixos) {
    media[eixo.id] = Math.round(validos.reduce((t, r) => t + r[eixo.id], 0) / validos.length);
    const faixas = Array<number>(FAIXAS).fill(0);
    for (const r of validos) faixas[faixaDe(r[eixo.id])]++;
    distribuicao[eixo.id] = faixas;
  }
  return { n: validos.length, media, distribuicao };
}

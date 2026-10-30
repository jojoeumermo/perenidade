// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O laboratório da TRI: o modelo logístico de 3 parâmetros, com itens ILUSTRATIVOS (não são os parâmetros oficiais de
// nenhuma prova), para mostrar duas ideias: (1) com o mesmo número de acertos, quem acerta as fáceis e erra as difíceis
// fica com proficiência estimada maior do que quem faz o contrário (coerência); (2) o chute aparece no parâmetro c.
// NÃO calcula a nota oficial do Enem: a escala, os parâmetros e o método do Inep são outros (edital, item 14.3).
// Sem os atalhos "@/" de propósito: `npm run testar:enem` roda este arquivo direto no Node.

export interface Item {
  /** Discriminação: quanto a chance de acertar muda perto da dificuldade. */
  a: number;
  /** Dificuldade: a proficiência em que a chance (sem contar o chute) chega à metade. */
  b: number;
  /** Acerto ao acaso: a chance de acertar sem saber (com 5 alternativas, por volta de 0,2). */
  c: number;
}

/** P(acerto | θ) = c + (1 − c) / (1 + e^(−a(θ − b))) */
export function probabilidade(item: Item, theta: number): number {
  return item.c + (1 - item.c) / (1 + Math.exp(-item.a * (theta - item.b)));
}

/** A log-verossimilhança de um padrão de respostas (true = acertou) para uma proficiência θ. */
export function verossimilhanca(itens: Item[], respostas: boolean[], theta: number): number {
  return itens.reduce((s, it, i) => {
    const p = Math.min(1 - 1e-12, Math.max(1e-12, probabilidade(it, theta)));
    return s + (respostas[i] ? Math.log(p) : Math.log(1 - p));
  }, 0);
}

/**
 * A proficiência estimada: o θ (entre −4 e 4) que torna o padrão de respostas mais provável, com uma leve preferência
 * pelo centro (o que evita estimativa infinita quando a pessoa acerta ou erra tudo). Busca em grade, passo 0,01.
 */
export function estimarTheta(itens: Item[], respostas: boolean[]): number {
  let melhor = 0;
  let valor = -Infinity;
  for (let t = -400; t <= 400; t++) {
    const theta = t / 100;
    const v = verossimilhanca(itens, respostas, theta) - (theta * theta) / 2;
    if (v > valor) {
      valor = v;
      melhor = theta;
    }
  }
  return melhor;
}

/** Dez itens ilustrativos, do mais fácil ao mais difícil, todos com a mesma discriminação e chute de 0,2. */
export const ITENS_ILUSTRATIVOS: Item[] = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5].map((b) => ({ a: 1.5, b, c: 0.2 }));

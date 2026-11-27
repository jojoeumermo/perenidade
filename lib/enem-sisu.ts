// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A média ponderada do Sisu: cada instituição define os pesos das cinco notas para cada curso, e o Sisu usa a média
// ponderada (MEC, perguntas frequentes do Sisu; fato "sisu-media-ponderada" em content/enem/edicao.yml). Aqui só a
// conta, com as notas e os pesos que a pessoa digita. Nenhuma nota de corte: ela muda a cada edição e está no Sisu.
// Sem os atalhos "@/" de propósito: `npm run testar:enem` roda este arquivo direto no Node.

export const PROVAS_DO_SISU = ["linguagens", "humanas", "natureza", "matematica", "redacao"] as const;
export type ProvaDoSisu = (typeof PROVAS_DO_SISU)[number];

/** Σ(nota × peso) ÷ Σ(peso). Devolve null quando falta nota ou peso, ou quando os pesos somam zero. */
export function mediaPonderada(notas: Partial<Record<ProvaDoSisu, number>>, pesos: Partial<Record<ProvaDoSisu, number>>): number | null {
  let soma = 0;
  let somaPesos = 0;
  for (const p of PROVAS_DO_SISU) {
    const n = notas[p];
    const w = pesos[p];
    if (n === undefined || w === undefined || !Number.isFinite(n) || !Number.isFinite(w) || n < 0 || n > 1000 || w < 0) return null;
    soma += n * w;
    somaPesos += w;
  }
  return somaPesos > 0 ? soma / somaPesos : null;
}

/** Uma oferta do Sisu em public/sisu/ofertas.json: identidade, os 5 pesos na ordem de PROVAS_DO_SISU,
 * vagas da última edição e a nota de corte da ampla concorrência por ano ("2020" a "2025"). */
export type OfertaSisu = {
  curso: string;
  grau: string;
  turno: string;
  campus: string;
  cidade: string;
  uf: string;
  ies: string;
  sg: string;
  p?: [number, number, number, number, number];
  v: number;
  c: Record<string, number>;
  co?: number;
  /** Código MEC do curso (CO_IES_CURSO) quando o nome vale para mais de um código com cortes diferentes. */
  cod?: string;
  /** Sem pesos divulgados (oferta que só existe nos relatórios oficiais): a média mostrada é a simples. */
  sm?: 1;
  /** A nota do ano mais novo veio do relatório oficial do MEC, não do scraping. */
  cf?: 1;
};

export type CatalogoSisu = {
  fonte: string;
  gerado: string;
  anos: number[];
  /** O que cada nota de corte é, ano a ano (conferida com relatório oficial ou última parcial coletada). */
  cortes?: Record<string, string>;
  ofertas: OfertaSisu[];
};

/** A média ponderada das notas da pessoa com os pesos desta oferta (os pesos mudam de curso para curso). */
export function mediaDaOferta(notas: Partial<Record<ProvaDoSisu, number>>, oferta: OfertaSisu): number | null {
  const pesos: Partial<Record<ProvaDoSisu, number>> = {};
  PROVAS_DO_SISU.forEach((prova, i) => (pesos[prova] = oferta.p?.[i] ?? 1)); // sem pesos (sm) cai na média simples
  return mediaPonderada(notas, pesos);
}

/** O ano mais recente com nota de corte registrada para a oferta (null quando não há nenhuma). */
export function ultimoCorte(oferta: OfertaSisu): { ano: number; nota: number } | null {
  const anos = Object.keys(oferta.c).map(Number).sort((a, b) => b - a);
  return anos.length === 0 ? null : { ano: anos[0], nota: oferta.c[String(anos[0])] };
}

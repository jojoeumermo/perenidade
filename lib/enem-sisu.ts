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

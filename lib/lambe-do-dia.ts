// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

export interface Lambe {
  linhas: [string, string, string];
  texto: string;
}

/** O número do dia no fuso de Brasília: o cartaz troca à meia-noite daqui, para todo mundo ao mesmo tempo. */
export function diaDe(data: Date): number {
  return Math.floor((data.getTime() - 3 * 3600 * 1000) / 86_400_000);
}

/** O número da semana em Brasília, contando de segunda a domingo (o dia 0, 01/01/1970, foi uma quinta). */
export function semanaDe(data: Date): number {
  return Math.floor((diaDe(data) + 3) / 7);
}

const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));

/**
 * Qual cartaz sai num dia: um passo fixo que não divide o tamanho da lista, para que dias seguidos não tragam cartazes
 * vizinhos no arquivo e a lista inteira passe antes de algum se repetir.
 */
export function lambeDoDia(dia: number, total: number): number {
  if (total <= 1) return 0;
  let passo = 37;
  while (mdc(passo, total) !== 1) passo++;
  return (((dia * passo) % total) + total) % total;
}

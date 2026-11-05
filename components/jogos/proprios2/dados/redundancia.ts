// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Fonte } from "../tipos";

export const HORAS_NO_ANO = 8760;

/**
 * Disponibilidade de um serviço com `n` servidores iguais e independentes, em que basta um estar de pé, atrás de uma peça
 * comum a todos (energia, rede, o prédio) com disponibilidade `comum`: A = comum x (1 - (1 - a)^n).
 * Todas as disponibilidades vão de 0 a 1. É um modelo de ensino: falhas reais quase nunca são independentes.
 */
export function disponibilidade(a: number, n: number, comum = 1): number {
  if (n < 1) return 0;
  return comum * (1 - Math.pow(1 - a, n));
}

/** Tempo fora do ar por ano, em minutos. */
export function minutosForaPorAno(disp: number): number {
  return (1 - disp) * HORAS_NO_ANO * 60;
}

/** Escreve minutos como "x min", "x h y min" ou "x dias". */
export function escreverTempo(minutos: number): string {
  if (minutos < 1) return `${(minutos * 60).toFixed(0)} segundos`;
  if (minutos < 60) return `${minutos.toFixed(1).replace(".", ",")} minutos`;
  const horas = minutos / 60;
  if (horas < 48) return `${horas.toFixed(1).replace(".", ",")} horas`;
  return `${(horas / 24).toFixed(1).replace(".", ",")} dias`;
}

/** A tabela de referência do livro Site Reliability Engineering (Google), conferida em 2026-11: disponibilidade e fora do ar por ano. */
export const TABELA_SRE: { disp: number; texto: string; minutosPorAno: number }[] = [
  { disp: 0.99, texto: "99%", minutosPorAno: 3.65 * 24 * 60 },
  { disp: 0.999, texto: "99,9%", minutosPorAno: 8.76 * 60 },
  { disp: 0.9999, texto: "99,99%", minutosPorAno: 52.6 },
  { disp: 0.99999, texto: "99,999%", minutosPorAno: 5.26 },
];

export const DISPONIBILIDADES_POR_SERVIDOR = [0.95, 0.99, 0.999] as const;

export const FONTES_REDUNDANCIA: Fonte[] = [
  { nome: "Availability Table, Site Reliability Engineering (Google, CC BY-NC-ND 4.0)", url: "https://sre.google/sre-book/availability-table/" },
];

export const NOTA_DO_MODELO =
  "O cálculo supõe que os servidores falham um independente do outro. Na vida real eles dividem energia, rede, programa e erros de configuração, e é isso que costuma derrubar todos de uma vez. Por isso a peça comum entra na conta: ela limita o que mais servidores conseguem ganhar. Os valores do jogo (95%, 99%, 99,9% por servidor; 99,9% ou 99,99% para a peça comum) são exemplos, não medições de nenhum serviço.";

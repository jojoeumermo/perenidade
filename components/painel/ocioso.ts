// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import { getItem, KEYS } from "@/lib/storage";

/**
 * Sem uso por este tempo, o painel se fecha sozinho: aparelho esquecido aberto não vira porta de entrada. Era meia hora
 * e derrubava quem só deixou a aba de lado; agora o padrão é um dia, e cada pessoa escolhe em Minha conta › Aparelhos
 * (de uma hora a nunca, neste aparelho). O último uso vale para todas as abas do navegador.
 */
export const OCIOSO_PADRAO_MIN = 24 * 60;
export const OPCOES_OCIOSO: [number, string][] = [[60, "1 hora"], [8 * 60, "8 horas"], [24 * 60, "1 dia (padrão)"], [7 * 24 * 60, "7 dias"], [0, "Nunca, neste aparelho"]];

export function minutosOcioso(): number {
  const guardado = getItem(KEYS.painelOcioso);
  const n = Number(guardado);
  return guardado !== "" && Number.isFinite(n) && n >= 0 ? n : OCIOSO_PADRAO_MIN;
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Encaixe } from "../encaixes";
import { AoVivoAgora } from "./AoVivoAgora";

/**
 * Encaixe da F4 (perfis e organizações): o que esta frente pendura nas telas comuns. Hoje: o cartão "Ao vivo agora" na coluna da
 * direita (prancha computador-inicio). Tudo atrás da flag "alumia-org" (o componente confere e, desligada, não desenha nada) e das
 * regras de privacidade do PLANO-ALUMIA §6 (pessoas na sala só agregadas e a partir de 3).
 */
export const encaixe: Encaixe = {
  colunaDireita: [AoVivoAgora],
};

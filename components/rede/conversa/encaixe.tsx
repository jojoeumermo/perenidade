// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Encaixe } from "../encaixes";
import { BuscaDaColuna, ComunidadesAtivas } from "../comunidades/ComunidadesAtivas";

/**
 * Encaixe da F3 (conversa, comunidades, descoberta e avisos): o que esta frente pendura nas telas comuns. Daqui em diante o
 * arquivo é da F3 (PLANO-ALUMIA §9). Tudo o que entra aqui só aparece na casca da Alumia nova (flag "alumia-2") e segue as regras
 * de privacidade do PLANO-ALUMIA §6.
 *
 * Coluna da direita (prancha computador-inicio): a busca "pessoas, atos, #temas" (no alto da coluna, na prancha) e "Comunidades
 * ativas" (depois de "Atos perto de você", da F2). As telas da comunidade e da conversa não precisam de encaixe: trocam sozinhas
 * quando o layout põe [data-al="2"] (components/rede/conversa/base3.tsx, useAlumia2).
 */
export const encaixe: Encaixe = {
  colunaDireita: [BuscaDaColuna, ComunidadesAtivas],
};

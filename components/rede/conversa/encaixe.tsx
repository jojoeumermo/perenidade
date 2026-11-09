// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Encaixe } from "../encaixes";
import { ComunidadesAtivas } from "../comunidades/ComunidadesAtivas";

/**
 * Encaixe da F3 (conversa, comunidades, descoberta e avisos): o que esta frente pendura nas telas comuns. Daqui em diante o
 * arquivo é da F3 (PLANO-ALUMIA §9). Tudo o que entra aqui só aparece na casca da Alumia nova (flag "alumia-2") e segue as regras
 * de privacidade do PLANO-ALUMIA §6.
 *
 * Coluna da direita (prancha computador-inicio): "Comunidades ativas" (depois de "Atos perto de você", da F2). A busca do alto da
 * coluna é da casca (ela já põe uma): a daqui saiu para a coluna não ter duas buscas iguais (ALUMIA-ATE-O-FIM, A4). O componente
 * BuscaDaColuna continua exportado em ../comunidades/ComunidadesAtivas para quem precisar dele numa tela. As telas da comunidade e
 * da conversa não precisam de encaixe: trocam sozinhas quando o layout põe [data-al="2"] (components/rede/conversa/base3.tsx).
 */
export const encaixe: Encaixe = {
  colunaDireita: [ComunidadesAtivas],
};

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O interruptor do grupo "cartão do post" do prompt 4 (itens 30, 31, 35 e 120): "alumia-p4-cartao-do-post", só pelo nome e
// desligado por padrão, além de "rede-v2" + "alumia-2". No banco, as funções de mudar conferem a decisão do painel
// (interno.rede_p4_cartao_ligado). Sem "@/" de propósito (roda nos testes).
import { ligado, type Recurso } from "../../../recursos";
import { alumia2Ligada } from "../../rotas-novas";

export const RECURSO_DO_CARTAO: Recurso = "alumia-p4-cartao-do-post";

/** O grupo aparece nesta montagem? `lista` existe para o teste (com ela, a Alumia nova não é conferida). */
export function cartaoP4Ligado(lista?: Set<string>): boolean {
  if (!lista && !alumia2Ligada()) return false;
  return ligado(RECURSO_DO_CARTAO, lista);
}

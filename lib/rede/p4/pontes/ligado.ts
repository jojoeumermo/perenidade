// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O interruptor do lote "pontes" do prompt 4 (itens 81 a 88 e 130 a 134): "alumia-p4-pontes", só pelo nome e desligado por padrão,
// além de "rede-v2" + "alumia-2". No banco, as funções conferem a decisão do painel (interno.rede_p4_pontes_ligado). Sem "@/" de
// propósito (roda nos testes).
import { ligado, type Recurso } from "../../../recursos";
import { alumia2Ligada } from "../../rotas-novas";

export const RECURSO_DAS_PONTES: Recurso = "alumia-p4-pontes";

/** O lote aparece nesta montagem? `lista` existe para o teste (com ela, a Alumia nova não é conferida). */
export function pontesP4Ligado(lista?: Set<string>): boolean {
  if (!lista && !alumia2Ligada()) return false;
  return ligado(RECURSO_DAS_PONTES, lista);
}

/** Só o interruptor do lote, sem a Alumia nova: a aula ao vivo (janela de Libras) é do site, fora da casca da Alumia. */
export function pontesP4LigadoNoSite(lista?: Set<string>): boolean {
  return ligado(RECURSO_DAS_PONTES, lista);
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As telas da F4 só aparecem com "rede-v2" + "alumia-2" + "alumia-org" (lib/rede/rotas-novas.ts). Num lugar só para as peças
// encaixadas (coluna da direita, perfil) não esquecerem nenhuma das três. Sem "@/" de propósito.
import { ligado, type Recurso } from "../../recursos";
import { alumia2Ligada } from "../rotas-novas";

/** A Alumia nova e a flag pedida estão ligadas? */
export function recursoLigado(recurso: Recurso): boolean {
  return alumia2Ligada() && ligado(recurso);
}

/** As organizações (selo, consultas, plenárias, contas) estão ligadas? */
export function orgLigada(): boolean {
  return recursoLigado("alumia-org");
}

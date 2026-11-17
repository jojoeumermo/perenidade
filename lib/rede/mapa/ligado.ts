// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quando o mapa e o ao vivo (frente 13B) aparecem: com a Alumia nova ("rede-v2" + "alumia-2") e os interruptores da onda 13,
// "alumia-mapa" (o mapa, /alumia/mapa) e "alumia-ao-vivo" (o "Pergunte a…" com hora marcada, /alumia/mapa/ao-vivo e na caixa de
// perguntas). Os dois só ligam pelo nome e precisam do SQL 20261119-alumia-o13-mapa.sql. Sem "@/" de propósito (o teste lê daqui).
import { ligado, type Recurso } from "../../recursos";
import { alumia2Ligada } from "../rotas-novas";

/** Os nomes dos interruptores (quem junta a onda os põe em lib/recursos.ts, em SO_PELO_NOME). */
export const INTERRUPTOR_DO_MAPA: string = "alumia-mapa";
export const INTERRUPTOR_DO_AO_VIVO: string = "alumia-ao-vivo";

export function mapaLigado(): boolean {
  return alumia2Ligada() && ligado(INTERRUPTOR_DO_MAPA as Recurso);
}

export function aoVivoLigado(): boolean {
  return alumia2Ligada() && ligado(INTERRUPTOR_DO_AO_VIVO as Recurso);
}

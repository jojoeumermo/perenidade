// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quando a turma, a agenda de provas e a monitoria (frente 11C) aparecem: com a Alumia nova ("rede-v2" + "alumia-2") e o
// interruptor do estudo da onda 11, "alumia-estudo" (lib/recursos.ts, só pelo nome: precisa do SQL da onda 11, com
// supabase/migracoes/20261117-alumia-o11-turma.sql). O mesmo das questões e da redação (lib/rede/rotas-novas.ts). Sem "@/" de propósito.
import { ligado } from "../../../../lib/recursos";
import { alumia2Ligada } from "../../../../lib/rede/rotas-novas";

export function estudoLigado(): boolean {
  return alumia2Ligada() && ligado("alumia-estudo");
}

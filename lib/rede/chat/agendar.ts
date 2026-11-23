// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O envio agendado do chat (Prompt 4, item 18, atrás de "alumia-p4-conversa"): o texto fica SÓ no aparelho que agendou, cifrado na
// loja do chat, e sai pelo caminho de sempre na hora, se o aparelho estiver ligado com a Alumia aberta. O servidor não sabe que a
// mensagem existe antes de ela sair (e, quando sai, é uma mensagem comum, do tamanho de sempre). As regras ficam aqui para a tela e o
// serviço usarem as mesmas. Sem "@/" de propósito: roda no Node (scripts/testar-p4-conversa.mjs).

/** O envio agendado vai de 1 minuto a 30 dias à frente. */
export const AGENDAR_DE = 60_000;
export const AGENDAR_ATE = 30 * 86_400_000;
/** De quanto em quanto tempo a tela do chat confere se alguma agendada venceu. */
export const CONFERIR_AGENDADAS_MS = 30_000;

/** A hora escolhida vale? */
export function horaValida(quando: number, agora: number): boolean {
  return Number.isFinite(quando) && quando >= agora + AGENDAR_DE && quando <= agora + AGENDAR_ATE;
}

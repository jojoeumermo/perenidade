// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os freios do bloqueio e as regras dos pedidos de conversa, conferidos NO APARELHO (onda R2, itens 2.4 e 2.5). O servidor não sabe
// quem bloqueia quem nem quem pede conversa a quem: bloquear é trocar o passe de depósito da caixa (lib/rede/caixas/cliente.ts,
// `trocar(..., bloqueio = true)`), e o pedido chega cifrado na caixa de pedidos. Por isso os freios de antes ("20 bloqueios por hora",
// "desbloquear só depois de 3 horas", "recusa não se repete por 30 dias", "quem pode me chamar") moram aqui, sobre a lista
// sincronizada entre os aparelhos da pessoa (lib/rede/aparelhos/sincronia.ts, da frente dos cofres). Funções puras, sem relógio
// escondido: o tempo entra como argumento.
// Sem "@/" de propósito.

const HORA_MS = 3_600_000;
const DIA_MS = 86_400_000;

/** No máximo 20 bloqueios por hora (o freio contra quem usa o bloqueio para testar quem está do outro lado). */
export const BLOQUEIOS_POR_HORA = 20;
/** Desbloquear só 3 horas depois de bloquear (o bloqueio não vira liga-desliga para incomodar). */
export const ESPERA_PARA_DESBLOQUEAR_MS = 3 * HORA_MS;
/** A recusa de um pedido vale 30 dias: o mesmo pedido, nesse tempo, é descartado em silêncio. */
export const RECUSA_VALE_MS = 30 * DIA_MS;

/** Pode bloquear agora? `feitos` são os momentos (ms) dos bloqueios anteriores. Devolve também a lista sem os de mais de 1 hora. */
export function podeBloquear(feitos: readonly number[], agora: number): { pode: boolean; feitos: number[] } {
  const recentes = feitos.filter((t) => Number.isFinite(t) && t <= agora && agora - t < HORA_MS);
  return { pode: recentes.length < BLOQUEIOS_POR_HORA, feitos: recentes };
}

/** Pode desbloquear quem foi bloqueado em `bloqueadoEm`? (Momento no futuro, de relógio mexido, conta como agora.) */
export function podeDesbloquear(bloqueadoEm: number, agora: number): boolean {
  return Number.isFinite(bloqueadoEm) && agora - Math.min(bloqueadoEm, agora) >= ESPERA_PARA_DESBLOQUEAR_MS;
}

/** Quem pode me chamar: todos (com pedido), só quem eu sigo, ninguém. */
export type QuemPodeChamar = "pedidos" | "seguidos" | "ninguem";

/** Uma recusa guardada: a identidade (base64 da chave Ed25519 da conta) de quem pediu e até quando vale. */
export interface Recusa {
  identidade: string;
  ate: number;
}

/**
 * O pedido que chegou passa? Confere a regra de quem pode chamar e as recusas ainda valendo. Pedido que não passa é descartado em
 * silêncio (quem pediu não sabe se foi recusado, se a regra não deixou ou se a pessoa não viu).
 */
export function pedidoPassa(p: { regra: QuemPodeChamar; identidade: string; eleSegue: boolean; recusas: readonly Recusa[]; agora: number }): boolean {
  if (p.regra === "ninguem") return false;
  if (p.regra === "seguidos" && !p.eleSegue) return false;
  return !p.recusas.some((r) => r.identidade === p.identidade && r.ate > p.agora);
}

/** Anota (ou renova) a recusa de quem pediu e tira as vencidas. */
export function anotarRecusa(recusas: readonly Recusa[], identidade: string, agora: number): Recusa[] {
  return [...recusas.filter((r) => r.ate > agora && r.identidade !== identidade), { identidade, ate: agora + RECUSA_VALE_MS }];
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// 74. Mudar de servidor no Fediverso: as contas puras (sem rede), que o teste prova no Node. Quem busca a conta nova e manda o Move é
// o servidor do site (app/api/rede/fediverso/mudar e lib/rede/fediverso/entrega.ts). Sem "@/" de propósito.

/** Os ids de um campo do ActivityPub que pode vir como texto, objeto com "id" ou lista dos dois. */
export function idsDe(v: unknown): string[] {
  const lista = Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
  return lista
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string" ? (x as { id: string }).id : null))
    .filter((x): x is string => !!x);
}

/**
 * A conta nova declara a antiga como apelido (alsoKnownAs)? É o que o Mastodon e os outros conferem antes de aceitar o Move: sem
 * isso, qualquer um poderia "levar" as seguidoras de outra pessoa. O documento tem de ser do próprio endereço pedido.
 */
export function declaraApelido(doc: Record<string, unknown> | null, alvo: string, atorAntigo: string): boolean {
  if (!doc || typeof doc.id !== "string" || doc.id !== alvo) return false;
  return idsDe(doc.alsoKnownAs).includes(atorAntigo);
}

/** A atividade Move (ActivityStreams): o ator antigo se move para o novo. */
export function atividadeMove(contexto: unknown, id: string, atorAntigo: string, atorNovo: string): Record<string, unknown> {
  return { "@context": contexto, id, type: "Move", actor: atorAntigo, object: atorAntigo, target: atorNovo };
}

/** O documento do ator com o "movedTo" (só quando a mudança já foi enviada). */
export function comMovedTo<T extends Record<string, unknown>>(doc: T, alvo: string | null): T & { movedTo?: string } {
  return alvo && /^https:\/\/[^\s]{1,490}$/.test(alvo) ? { ...doc, movedTo: alvo } : doc;
}

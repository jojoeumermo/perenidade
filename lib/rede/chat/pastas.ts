// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As pastas das conversas (Prompt 4, item 16), que já existiam na lista do chat (components/rede/chat/Tela.tsx): cada conversa leva
// um rótulo livre, guardado SÓ neste aparelho, cifrado com o histórico (lib/rede/chat/historico.ts, mudarOrganizacao). O servidor
// não sabe que pastas existem nem em qual pasta está cada conversa. Aqui ficam só as contas que a tela faz, sem navegador, para o
// teste (scripts/testar-p4-conversa.mjs) provar o que a lista mostra.
// Sem "@/" de propósito.

/** O que a lista precisa de cada conversa: só a pasta. */
export interface ComPasta {
  pasta: string;
}

/** As pastas que aparecem nos botões da lista: sem repetir, sem a vazia, em ordem alfabética do idioma. */
export function pastasDoResumo(resumo: ReadonlyMap<string, ComPasta>): string[] {
  return [...new Set([...resumo.values()].map((o) => o.pasta).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** As conversas da pasta escolhida ("" = todas). Conversa sem organização guardada está em "todas" e em nenhuma pasta. */
export function conversasDaPasta<T extends { id: string }>(todas: readonly T[], resumo: ReadonlyMap<string, ComPasta>, pasta: string): T[] {
  return pasta ? todas.filter((c) => resumo.get(c.id)?.pasta === pasta) : [...todas];
}

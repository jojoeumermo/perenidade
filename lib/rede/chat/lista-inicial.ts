// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lista de conversas da tela inicial do chat (a página Conversas e a janela flutuante), antes de o aparelho estar pronto.
// Sem "@/" de propósito: os testes rodam este arquivo direto no Node.

const codigoDe = (e: unknown): string =>
  typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : e instanceof Error ? e.message : "";

/**
 * A lista de conversas quando este aparelho ainda não tem o chat novo (não ativou, ou ativou em outro aparelho): o cliente do
 * chat responde "dm_sem_chave" (lib/rede/cliente-chat.ts, exigirChat) e a tela inicial mostrava esse erro ("Falta a chave") no
 * lugar do convite para ativar. Aqui esse caso vira lista vazia, e a tela decide pelo estado do aparelho (ativar, ligar pelo QR).
 * Qualquer outro erro segue adiante.
 */
export function listaSemChatAqui<T>(erro: unknown): T[] {
  if (codigoDe(erro) === "dm_sem_chave") return [];
  throw erro;
}

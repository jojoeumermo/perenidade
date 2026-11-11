// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A reserva das telas novas: quando a função nova do banco ainda não existe (a migração não rodou), a tela cai na função de hoje.
// SÓ nesse caso. Qualquer outro erro (limite de uso, conta suspensa, sem permissão, não encontrado, sem conexão) sobe como está,
// para a tela mostrar o motivo em vez de chamar de novo (gastando a cota outra vez e escondendo o que aconteceu).
// Sem "@/" de propósito (roda no Node nos testes).

/** O código de um erro de chamada (BackendError.code), ou "falha". */
function codigo(erro: unknown): string {
  return typeof erro === "object" && erro !== null && "code" in erro ? String((erro as { code: unknown }).code) : "falha";
}

/**
 * O banco disse que a função não existe? lib/backend.ts traduz PGRST202 (PostgREST: função não encontrada) e 42883 (Postgres:
 * função indefinida) para "banco_desatualizado"; os dois códigos crus também valem, para quem chama o banco por outro caminho.
 */
export function faltaFuncaoNoBanco(erro: unknown): boolean {
  const c = codigo(erro);
  return c === "banco_desatualizado" || c === "PGRST202" || c === "42883";
}

/** Chama a função nova; só se ela não existir no banco, a de hoje. Os outros erros sobem sem segunda chamada. */
export async function comReserva<T>(nova: () => Promise<T>, deHoje: () => Promise<T>): Promise<T> {
  try {
    return await nova();
  } catch (erro) {
    if (faltaFuncaoNoBanco(erro)) return deHoje();
    throw erro;
  }
}

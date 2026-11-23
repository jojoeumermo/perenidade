// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Pedaço não encontrado" (ChunkLoadError): depois de publicar uma versão nova do site, a aba que ficou aberta pede um pedaço
// de JavaScript da versão velha, que não existe mais, e a tela cai em "This page couldn't load". A saída é recarregar a página
// UMA vez (a versão nova chega inteira). A guarda fica no sessionStorage desta aba: se o recarregar não resolver, não entra em
// laço; a pessoa vê a tela de erro e decide. Nada vai ao servidor.

/** A chave da guarda (só desta aba, e some quando a aba fecha). Guarda só um horário, nada sobre a pessoa. */
export const CHAVE_DO_PEDACO = "lucia:recarregou-por-pedaco";
/** Depois de recarregar, outro pedaço perdido nesse intervalo não recarrega de novo (evita o laço). */
export const INTERVALO_DO_PEDACO_MS = 2 * 60 * 1000;

const PADRAO =
  /ChunkLoadError|Loading (?:CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

/** O erro é de um pedaço da versão velha que não existe mais? */
export function ehPedacoPerdido(erro: unknown): boolean {
  if (!erro) return false;
  if (typeof erro === "string") return PADRAO.test(erro);
  if (typeof erro === "object") {
    const e = erro as { name?: unknown; message?: unknown };
    return (typeof e.name === "string" && e.name === "ChunkLoadError") || (typeof e.message === "string" && PADRAO.test(e.message));
  }
  return false;
}

interface Guarda {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

function guardaDaAba(): Guarda | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Pode recarregar agora? Marca a guarda e diz sim uma vez; dentro do intervalo, diz não. Sem armazenamento (aba privada com tudo
 * bloqueado), não recarrega: sem a guarda, um recarregar que não resolve viraria laço.
 */
export function podeRecarregarPorPedaco(agora = Date.now(), guarda: Guarda | null = guardaDaAba()): boolean {
  if (!guarda) return false;
  try {
    const antes = Number(guarda.getItem(CHAVE_DO_PEDACO) ?? "");
    if (Number.isFinite(antes) && antes > 0 && agora - antes < INTERVALO_DO_PEDACO_MS) return false;
    guarda.setItem(CHAVE_DO_PEDACO, String(agora));
    return true;
  } catch {
    return false;
  }
}

/** Recarrega a página se o erro for de pedaço perdido e a guarda deixar. Diz se vai recarregar. */
export function recarregarSePedacoPerdido(erro: unknown): boolean {
  if (typeof window === "undefined" || !ehPedacoPerdido(erro) || !podeRecarregarPorPedaco()) return false;
  window.location.reload();
  return true;
}

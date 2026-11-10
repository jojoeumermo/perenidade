// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O codinome mostrado na casca (cartão da conta, barra do celular) vem da "situação" carregada uma vez pela Rede. Quando a pessoa
// troca o codinome no editor do perfil, o editor avisa por este evento e a Rede troca o nome na hora, sem recarregar a página.
// Na prévia (nada vai ao banco), o codinome salvo fica no sessionStorage do editor e a Rede o lê ao abrir.

export const EVENTO_DO_CODINOME = "alumia:codinome";

/** A chave do sessionStorage da prévia do perfil livre (components/rede/perfil/livre/dados.ts). */
export const CHAVE_DA_PREVIA_DO_PERFIL = "alumia:previa:perfil-livre";

/** Avisa a casca que o codinome mudou. */
export function avisarCodinome(codinome: string): void {
  try {
    window.dispatchEvent(new CustomEvent<string>(EVENTO_DO_CODINOME, { detail: codinome }));
  } catch {
    // sem window (servidor): nada a avisar
  }
}

/** O codinome salvo na prévia para `handle`, se houver. */
export function codinomeDaPrevia(handle: string | null | undefined): string | null {
  if (!handle) return null;
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_DA_PREVIA_DO_PERFIL);
    const meu = bruto ? ((JSON.parse(bruto) as Record<string, unknown>)[`meu:${handle}`] as { codinome?: unknown } | undefined) : undefined;
    return typeof meu?.codinome === "string" && meu.codinome.trim() ? meu.codinome.trim() : null;
  } catch {
    return null;
  }
}

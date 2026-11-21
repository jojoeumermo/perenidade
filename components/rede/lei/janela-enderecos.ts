// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A parte pura da janela dos termos (P5, A6; JanelaDosTermos.tsx): que endereço abre dentro da janela e onde ela não aparece. Sem
// "@/" e sem React de propósito: roda também no teste (scripts/testar-p5-entrada.mjs).

/** As cinco páginas que abrem dentro da janela (as mesmas de PaginaDaLei em base.tsx). */
export type PaginaDaJanela = "termos" | "privacidade" | "guardamos" | "regras" | "ajuda";

const ROTA_PARA_PAGINA: Record<string, PaginaDaJanela> = { termos: "termos", privacidade: "privacidade", "o-que-guardamos": "guardamos", regras: "regras", ajuda: "ajuda" };

/**
 * Onde a janela não aparece mesmo com o aceite pendente: "Meus dados" (quem não concorda baixa os dados e apaga a conta) e
 * "Denunciar" (quem está sendo exposto ou ameaçado denuncia antes de qualquer coisa).
 */
export const SEM_JANELA = /\/(meus-dados|denunciar)\/?$/;

/** O link leva a uma tela sem janela (sai da janela em vez de trocar a aba)? */
export const levaParaForaDaJanela = (href: string) => /\/(meus-dados|denunciar)\/?(?:[?#]|$)/.test(href);

/**
 * A página da lei de um endereço da Alumia (/pt/alumia/regras, /regras no endereço próprio), com a âncora; nula para o resto
 * (outra origem, outra tela, endereço quebrado).
 */
export function paginaDoEndereco(href: string, origem: string): { pagina: PaginaDaJanela; ancora: string } | null {
  let url: URL;
  try {
    url = new URL(href, origem);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origem).origin) return null;
  const m = /^(?:\/(?:pt|en|es|fr|ru|zh))?(?:\/alumia)?\/(termos|privacidade|o-que-guardamos|regras|ajuda)\/?$/.exec(url.pathname);
  return m ? { pagina: ROTA_PARA_PAGINA[m[1]], ancora: url.hash.slice(1) } : null;
}

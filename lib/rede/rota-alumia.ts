// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A rota da Alumia mudou de /[lang]/comunidade para /[lang]/alumia (PLANO-ALUMIA, seção 1). Este arquivo é a lógica pura da
// troca de endereço, usada pelo proxy.ts e pelos testes (npm run testar:alumia-rota). Sem os atalhos "@/" de propósito: roda
// direto no Node.
//
// Regras:
//   - /<idioma>/comunidade(/resto)?busca  → 308 /<idioma>/alumia(/resto)?busca (a busca vai junto, sem mudar nada);
//   - /comunidade(/resto)?busca (sem idioma) → 308 /pt/alumia(/resto)?busca (um salto só, sem passar por /pt/comunidade);
//   - /comunidades, /comunidade-x, /pt/comunidades-tradicionais… NÃO são da Alumia e seguem como estão;
//   - o destino é sempre um caminho do próprio site (começa com /<idioma>/alumia): nunca um redirecionamento aberto.

export const IDIOMAS_DA_ALUMIA = ["pt", "en", "es", "fr", "ru", "zh"] as const;

/** A raiz da Alumia num idioma, sem barra no fim. */
export const raizDaAlumia = (lang: string): string => `/${lang}/alumia`;

const ANTIGO = /^(?:\/([a-z]{2}))?\/comunidade(\/.*)?$/;

/** A busca como deve ir no endereço novo: "" ou "?…" (um "?" sozinho vira nada). */
function busca(search: string): string {
  if (!search || search === "?") return "";
  return search.startsWith("?") ? search : `?${search}`;
}

/**
 * O caminho novo (/<idioma>/alumia…) para um caminho antigo (/<idioma>/comunidade…), sem a busca; nulo quando o caminho não
 * é um endereço antigo da Alumia. Uma barra sozinha no fim cai ("/pt/comunidade/" → "/pt/alumia").
 */
export function caminhoNovoDaAlumia(pathname: string): string | null {
  const m = ANTIGO.exec(pathname);
  if (!m) return null;
  const lang = m[1];
  if (lang !== undefined && !(IDIOMAS_DA_ALUMIA as readonly string[]).includes(lang)) return null;
  // Duas barras seguidas no resto não mudam o destino (continua no próprio site), mas ficam fora por limpeza.
  const resto = (m[2] ?? "").replace(/\/{2,}/g, "/").replace(/\/$/, "");
  return `${raizDaAlumia(lang ?? "pt")}${resto}`;
}

/** O destino (caminho + busca) do 308 de um endereço antigo da Alumia, ou nulo quando o pedido não é de um. */
export function destinoDaComunidade(pathname: string, search = ""): string | null {
  const novo = caminhoNovoDaAlumia(pathname);
  return novo === null ? null : `${novo}${busca(search)}`;
}

/** O caminho (sem o idioma) é uma tela da Alumia, no endereço novo ou no antigo? "/alumia/p/x" e "/comunidade" sim; "/comunidades" não. */
export function ehCaminhoDaAlumia(caminho: string): boolean {
  return /^\/(alumia|comunidade)(\/|$)/.test(caminho);
}

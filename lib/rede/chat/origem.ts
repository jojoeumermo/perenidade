// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O chat privado num endereço próprio (conversas.institutolucia.org; conversas.localhost para testar). Documento:
// docs/rede/ORIGEM-ISOLADA.md.
//
// Por que: as chaves do chat (a loja da biblioteca do Matrix, o histórico, a gaveta) moram no IndexedDB da ORIGEM em que o chat
// roda. Num endereço só dele, um script malicioso que rode em qualquer outra página do site (XSS) não alcança essas chaves, nem
// a memória da aba do chat. E a página do chat ganha uma política de segurança estrita: só roda script com o "nonce" sorteado a
// cada pedido (sem script inline solto, sem eval de JavaScript), não entra em quadro de ninguém e não abre janela de fora.
//
// Sem "@/": o proxy.ts (borda) usa.

/** O endereço do chat (NEXT_PUBLIC_CHAT_URL, sem barra no fim). Vazio: o chat fica onde sempre esteve. */
export const CHAT_URL = (process.env.NEXT_PUBLIC_CHAT_URL ?? "").trim().replace(/\/$/, "");

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];

/**
 * O endereço .onion do chat (NEXT_PUBLIC_CHAT_ONION, só o nome, sem o protocolo). Com ele, as respostas do chat levam o cabeçalho
 * Onion-Location: o Navegador Tor oferece abrir o chat pelo serviço onion (docs/rede/ONION.md).
 */
export const CHAT_ONION = /^[a-z2-7]{56}\.onion$/.test((process.env.NEXT_PUBLIC_CHAT_ONION ?? "").trim()) ? (process.env.NEXT_PUBLIC_CHAT_ONION ?? "").trim() : "";

/** O pedido chegou no endereço do chat? */
export function hostDoChat(host: string | null | undefined): boolean {
  const h = (host ?? "").toLowerCase().split(":")[0];
  // O serviço onion (docs/rede/ONION.md) também é só do chat.
  return h.startsWith("conversas.") || h.endsWith(".onion") || (CHAT_URL !== "" && h === new URL(CHAT_URL).hostname);
}

export type DecisaoNoChat = { tipo: "reescrever"; destino: string } | { tipo: "seguir" } | { tipo: "chat"; destino: string } | { tipo: "site"; destino: string };

/**
 * No endereço do chat só abre o chat (e entrar na conta). "/" e "/<idioma>" mostram as conversas; o painel (para onde o entrar
 * leva) volta para as conversas; qualquer outra página vai para o site do instituto.
 */
export function rotaNoChat(caminho: string): DecisaoNoChat {
  const partes = caminho.split("/").filter(Boolean);
  const lang = IDIOMAS.includes(partes[0] ?? "") ? partes[0] : null;
  const resto = lang ? partes.slice(1) : partes;
  const l = lang ?? "pt";
  if (resto.length === 0) return { tipo: "reescrever", destino: `/${l}/alumia/conversas` };
  if (lang && resto[0] === "alumia" && resto[1] === "conversas") return { tipo: "seguir" };
  if (lang && resto[0] === "entrar") return { tipo: "seguir" };
  if (resto[0] === "painel" || (resto[0] === "alumia" && resto.length === 1)) return { tipo: "chat", destino: `/${l}` };
  return { tipo: "site", destino: caminho };
}

/** No site do instituto (e na Alumia), com o endereço do chat ligado: as conversas vão para lá. */
export function caminhoDoSiteParaOChat(caminho: string, busca: string): string | null {
  if (!CHAT_URL) return null;
  const m = /^\/(pt|en|es|fr|ru|zh)\/alumia\/conversas(?:\/|$)/.exec(caminho);
  return m ? `${CHAT_URL}/${m[1]}${busca}` : null;
}

/** Um "nonce" novo (16 bytes sorteados, base64). */
export function novoNonce(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

/**
 * A política de scripts do endereço do chat. Ela vem junto com a política geral do site (next.config.ts): o navegador aplica as
 * duas, e vale a mais estrita. `'strict-dynamic'`: só roda o que o script com o nonce carregar (os pedaços do próprio site).
 * `'wasm-unsafe-eval'`: só compilar WebAssembly (a biblioteca de cifra), sem eval de JavaScript.
 */
export function politicaDoChat(nonce: string, desenvolvimento = false): string {
  return [
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

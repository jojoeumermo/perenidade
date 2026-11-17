// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O chat privado num endereço próprio (conversas.institutolucia.org; conversas.localhost para testar).
//
// Por que: as chaves do chat (a loja da biblioteca do Matrix, o histórico, a gaveta) moram no IndexedDB da ORIGEM em que o chat
// roda. Num endereço só dele, um script malicioso que rode em qualquer outra página do site (XSS) não alcança essas chaves, nem
// a memória da aba do chat. E a página do chat ganha uma política de segurança estrita: só roda script com o "nonce" sorteado a
// cada pedido (sem script inline solto, sem eval de JavaScript), não entra em quadro de ninguém e não abre janela de fora.
//
// Sem "@/": o proxy.ts (borda) usa.
import { prefsScript } from "../../prefs-script";
import { scriptDaAparencia } from "../aparencia-da-rede";

/** O endereço do chat (NEXT_PUBLIC_CHAT_URL, sem barra no fim). Vazio: o chat fica onde sempre esteve. */
export const CHAT_URL = (process.env.NEXT_PUBLIC_CHAT_URL ?? "").trim().replace(/\/$/, "");

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];

/**
 * O endereço .onion do chat (NEXT_PUBLIC_CHAT_ONION, só o nome, sem o protocolo). Com ele, as respostas do chat levam o cabeçalho
 * Onion-Location: o Navegador Tor oferece abrir o chat pelo serviço onion.
 */
export const CHAT_ONION = /^[a-z2-7]{56}\.onion$/.test((process.env.NEXT_PUBLIC_CHAT_ONION ?? "").trim()) ? (process.env.NEXT_PUBLIC_CHAT_ONION ?? "").trim() : "";

/** O pedido chegou no endereço do chat? */
export function hostDoChat(host: string | null | undefined): boolean {
  const h = (host ?? "").toLowerCase().split(":")[0];
  // O serviço onion também é só do chat.
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
 * Os dois scripts inline do próprio site que a página do chat precisa antes da primeira pintura: as preferências (tema, letra,
 * contraste: lib/prefs-script.ts) e a aparência da Alumia (lib/rede/aparencia-da-rede.ts). Eles saem no HTML sem o nonce (o layout
 * não lê o pedido, para o resto do site continuar saindo do cache), então a política do chat os libera pelo hash do texto exato.
 * Só eles: qualquer outro script inline continua barrado. Calculados uma vez por processo.
 */
let hashes: Promise<string[]> | null = null;
export function hashesDosScripts(): Promise<string[]> {
  hashes ??= Promise.all(
    [prefsScript, scriptDaAparencia].map(async (texto) => {
      const resumo = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
      let s = "";
      for (const x of resumo) s += String.fromCharCode(x);
      return `'sha256-${btoa(s)}'`;
    }),
  );
  return hashes;
}

/** O serviço de contas (NEXT_PUBLIC_SUPABASE_URL) e o canal de tempo real dele: os únicos destinos de fora que o chat chama. */
function servicoDeContas(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
}

/**
 * A política de segurança INTEIRA do endereço do chat. O navegador recebe UM cabeçalho Content-Security-Policy só: o do proxy
 * (proxy.ts) é gravado por último e fica no lugar da política geral do next.config.ts, não junto com ela. Por isso esta política
 * repete tudo o que a página precisa e fecha o resto: sem `default-src 'self'`, a página onde moram as chaves poderia abrir
 * conexão, imagem, fonte, quadro e mídia de qualquer origem. `'strict-dynamic'`: só roda o que o script com o nonce carregar (os
 * pedaços do próprio site). `'wasm-unsafe-eval'`: só compilar WebAssembly (a biblioteca de cifra), sem eval de JavaScript.
 * O único destino de fora é o serviço de contas (e o tempo real dele): a entrada passa pelo servidor do site, sem desafio de fora.
 */
export function politicaDoChat(nonce: string, desenvolvimento = false, scriptsDaPagina: string[] = []): string {
  const servico = servicoDeContas();
  const tempoReal = servico.replace(/^https:/, "wss:");
  const junta = (...partes: string[]) => partes.join(" ").replace(/\s+/g, " ").trim();
  return [
    "default-src 'self'",
    junta(`script-src 'nonce-${nonce}'`, ...scriptsDaPagina, `'strict-dynamic' 'wasm-unsafe-eval'${desenvolvimento ? " 'unsafe-eval'" : ""}`),
    "style-src 'self' 'unsafe-inline'",
    junta("img-src 'self' data: blob:", servico),
    "font-src 'self'",
    junta("connect-src 'self'", servico, tempoReal, desenvolvimento ? "ws:" : ""),
    junta("media-src 'self' blob:", servico),
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    // blob: é a prévia, no próprio aparelho, de um arquivo recebido na conversa.
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

/** Os serviços do site que a tela do chat chama: a entrada (porta), a conta e a impressão da rede (o banimento por rede). */
export const SERVICOS_DO_CHAT = ["/api/alumia/porta", "/api/alumia/conta", "/api/alumia/impressao"];

const EXTENSOES_DA_PAGINA = /\.(?:png|ico|svg|webp|jpe?g|woff2?|css|js|mjs|wasm|webmanifest)$/i;

/**
 * No endereço do chat (conversas.* e o .onion), o que NÃO é página: "seguir" (os arquivos do build e os que a página usa: ícone,
 * fonte, folha de estilo, script, WebAssembly), "barrar" (404: os dados abertos do site, como /pt/aulas.json, /podcast.xml,
 * /sitemap.xml e /.well-known, e todo serviço /api que o chat não usa) ou null (segue para a decisão das páginas, ou para o
 * serviço /api permitido). Pelo .onion o pedido não passa pela Cloudflare: lá só responde o que o chat precisa.
 */
export function arquivoNoChat(caminho: string): "seguir" | "barrar" | null {
  if (caminho.startsWith("/_next/")) return "seguir";
  if (caminho.startsWith("/api/")) return SERVICOS_DO_CHAT.some((p) => caminho === p || caminho.startsWith(`${p}/`)) ? null : "barrar";
  const ultimo = caminho.split("/").pop() ?? "";
  if (caminho.includes("/.well-known") || caminho.includes("/.")) return "barrar";
  if (!ultimo.includes(".")) return null;
  return EXTENSOES_DA_PAGINA.test(ultimo) ? "seguir" : "barrar";
}

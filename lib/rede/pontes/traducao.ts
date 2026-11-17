// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A tradução de um post pelo SERVIDOR PRÓPRIO de tradução (por exemplo, um LibreTranslate rodando na nossa máquina). Só no
// servidor do site (app/api/rede/traduzir): o endereço vem de ALUMIA_TRADUCAO_URL (e, se o tradutor pedir, a chave de
// ALUMIA_TRADUCAO_CHAVE), variáveis sem o prefixo NEXT_PUBLIC_ que nunca chegam ao navegador nem ao repositório. Sem a variável,
// a tradução não existe e o botão não aparece. Nada é guardado nem escrito em log: nem o texto, nem a tradução, nem quem pediu.
// ALUMIA_TRADUCAO_URL tem de apontar para um tradutor da PRÓPRIA Alumia: o texto que vai pode ser de núcleo, de comunidade fechada
// ou só de membros. Por isso o endereço só vale com https, ou com http dentro da própria máquina ou da rede interna (localhost,
// nome sem ponto como o serviço do docker, ou endereço de rede privada). Um tradutor público de terceiros não serve.
// Sem "@/" de propósito (o teste chama com um fetch falso).
import { IDIOMAS_DA_TRADUCAO, LIMITES_DAS_PONTES } from "./regras";

export interface ConfigDaTraducao {
  /** O endereço do tradutor, sem a barra do fim. */
  url: string;
  chave: string;
  buscar?: typeof fetch;
}

/** O servidor está dentro da própria máquina ou da rede interna: localhost, nome sem ponto (serviço do docker) ou rede privada. */
export function servidorInterno(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "::1") return true;
  if (/^[a-z0-9-]+$/.test(h) && /[a-z]/.test(h)) return true;
  const partes = h.split(".");
  if (partes.length === 4 && partes.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) {
    const [a, b] = partes.map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return /^f[cd][0-9a-f]{2}:/.test(h);
}

/**
 * A configuração do ambiente do servidor; nula sem o endereço, com um endereço que não é http/https, ou com http (sem TLS) para
 * um servidor fora da máquina e da rede interna: o texto não viaja em claro pela internet.
 */
export function configDaTraducao(ambiente: Record<string, string | undefined> = process.env): ConfigDaTraducao | null {
  if (typeof window !== "undefined") return null;
  const url = (ambiente.ALUMIA_TRADUCAO_URL ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?$/i.test(url)) return null;
  let endereco: URL;
  try {
    endereco = new URL(url);
  } catch {
    return null;
  }
  if (endereco.username || endereco.password) return null;
  if (endereco.protocol === "http:" && !servidorInterno(endereco.hostname)) return null;
  return { url, chave: (ambiente.ALUMIA_TRADUCAO_CHAVE ?? "").trim() };
}

/** O idioma de destino aceito (os da Alumia); o resto vira nulo. */
export function idiomaDestino(lang: unknown): string | null {
  return typeof lang === "string" && (IDIOMAS_DA_TRADUCAO as readonly string[]).includes(lang) ? lang : null;
}

export type ResultadoDaTraducao = { ok: true; texto: string; origem: string | null } | { ok: false; erro: "sem_tradutor" | "tradutor_fora" | "invalido" };

/**
 * Traduz um texto (no formato do LibreTranslate: POST /translate com q, source "auto", target e format "text"). Só texto: nada
 * de HTML vai nem volta. O tempo máximo é de 15 segundos; redirecionamento é recusado.
 */
export async function traduzir(texto: string, destino: string, config: ConfigDaTraducao | null = configDaTraducao()): Promise<ResultadoDaTraducao> {
  if (!config) return { ok: false, erro: "sem_tradutor" };
  const q = texto.slice(0, LIMITES_DAS_PONTES.traducaoTexto);
  if (!q.trim() || !idiomaDestino(destino)) return { ok: false, erro: "invalido" };
  const buscar = config.buscar ?? fetch;
  try {
    const r = await buscar(`${config.url}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, source: "auto", target: destino, format: "text", ...(config.chave ? { api_key: config.chave } : {}) }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return { ok: false, erro: "tradutor_fora" };
    const corpo = (await r.json().catch(() => null)) as { translatedText?: unknown; detectedLanguage?: { language?: unknown } } | null;
    if (!corpo || typeof corpo.translatedText !== "string") return { ok: false, erro: "tradutor_fora" };
    const origem = typeof corpo.detectedLanguage?.language === "string" ? corpo.detectedLanguage.language.slice(0, 8) : null;
    return { ok: true, texto: corpo.translatedText.slice(0, LIMITES_DAS_PONTES.traducaoTexto * 2), origem };
  } catch {
    return { ok: false, erro: "tradutor_fora" };
  }
}

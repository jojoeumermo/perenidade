// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.

export async function sha256(texto: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Impressão curta e estável para deduplicar eventos e alertas. */
export const impressao = async (...partes: unknown[]) => (await sha256(partes.map((p) => String(p ?? "")).join("|"))).slice(0, 40);

/** fetch com prazo, sem lançar: devolve null quando algo dá errado. */
export async function pegar(url: string, init: RequestInit = {}, prazo = 10_000): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(prazo) });
  } catch {
    return null;
  }
}

export async function pegarJson<T>(url: string, init: RequestInit = {}, prazo = 10_000): Promise<T | null> {
  const resposta = await pegar(url, init, prazo);
  if (!resposta?.ok) return null;
  try {
    return (await resposta.json()) as T;
  } catch {
    return null;
  }
}

export const agora = () => new Date().toISOString();
export const minutosAtras = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

/** Mediana de uma lista de números (ignora nulos). */
export function mediana(valores: (number | null | undefined)[]): number | null {
  const lista = valores.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (lista.length === 0) return null;
  const meio = Math.floor(lista.length / 2);
  return lista.length % 2 ? lista[meio] : (lista[meio - 1] + lista[meio]) / 2;
}

/** Endereços que só robô de invasão procura: os mesmos do proxy do site, para marcar eventos como "isca". */
export const ISCA = /^\/(wp-[^/]*|wordpress|administrator|admin|adminer|phpmyadmin|pma|mysql|cgi-bin|vendor|backup|backups|bkp|old|config|credentials|secrets?|server-status|server-info|actuator|console|debug|telescope|horizon|laravel|drupal|joomla|magento|xmlrpc|autodiscover|owa|ecp|boaform|hnap1|shell|cmd|eval|solr|jenkins|_profiler|_ignition|graphql|swagger|api-docs|api\/v\d|\.env[^/]*|\.git|\.svn|\.hg|\.aws|\.ssh|\.docker|\.vscode|\.idea|\.ds_store|\.htaccess|\.htpasswd)(\/|$)|\.(php\d?|phtml|asp|aspx|jsp|jspx|cgi|pl|env|sql|sqlite|db|bak|old|orig|swp|ini|conf|cfg|ya?ml|log|pem|key|p12|pfx|tar|tgz|gz|rar|7z)$/i;

/** Texto curto e sem caracteres de controle, para gravar o que veio de fora. */
export const limpo = (valor: unknown, maximo = 300) => String(valor ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximo);

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Consultas a serviços abertos de fora (Wikipedia, Banco Central, IBGE, Câmara, dicionários, acervos).
// Só roda no servidor do site: o navegador de quem visita fala apenas com o nosso domínio, então nenhum
// serviço de fora fica sabendo quem leu o quê, e a política de segurança das páginas continua intocada.
// Cada resposta fica guardada no servidor pelo tempo pedido, para não sobrecarregar os serviços.

/** Os únicos destinos permitidos. Endereço fora desta lista não é consultado. */
const permitidos = [
  "api.wikimedia.org",
  "pt.wikipedia.org",
  "en.wikipedia.org",
  "es.wikipedia.org",
  "ru.wikipedia.org",
  "zh.wikipedia.org",
  "pt.wikisource.org",
  "pt.wiktionary.org",
  "pt.wikibooks.org",
  "commons.wikimedia.org",
  "www.wikidata.org",
  "api.bcb.gov.br",
  "servicodados.ibge.gov.br",
  "dadosabertos.camara.leg.br",
  "legis.senado.leg.br",
  "api.dicionario-aberto.net",
  "api.dictionaryapi.dev",
  "api.tatoeba.org",
  "archive.org",
  "openlibrary.org",
  "gutendex.com",
  "meclivros.mec.gov.br",
  "api.openalex.org",
  "api.crossref.org",
  "de1.api.radio-browser.info",
  "de2.api.radio-browser.info",
  "fi1.api.radio-browser.info",
  "api.pwnedpasswords.com",
  "factchecktools.googleapis.com",
];

/** Os serviços pedem para se identificar: nome do projeto e endereço. */
const AGENTE = "InstitutoLucia/1.0 (+https://institutolucia.org)";
/** Nenhuma resposta de fora passa deste tamanho: o que vier maior é descartado. */
const MAXIMO = 2_000_000;

export interface Opcoes {
  /** Por quantos segundos a resposta fica guardada no servidor. */
  guardar?: number;
  /** Prazo de espera, em milissegundos. */
  prazo?: number;
  cabecalhos?: Record<string, string>;
  /** Resposta "não encontrado" (404) vira este texto, em vez de falha: para serviços que dizem assim que não acharam. */
  se404?: string;
}

/** Busca um endereço da lista e devolve o texto, ou null se algo der errado (fora do ar, lento, grande demais). */
export async function buscarTexto(endereco: string, { guardar = 3600, prazo = 8000, cabecalhos = {}, se404 }: Opcoes = {}): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !permitidos.includes(url.hostname)) return null;
  try {
    const resposta = await fetch(url, {
      headers: { "User-Agent": AGENTE, Accept: "application/json, text/xml;q=0.9, */*;q=0.5", ...cabecalhos },
      signal: AbortSignal.timeout(prazo),
      next: { revalidate: guardar },
    });
    if (resposta.status === 404 && se404 !== undefined) return se404;
    if (!resposta.ok) return null;
    const texto = await resposta.text();
    return texto.length > MAXIMO ? null : texto;
  } catch {
    return null;
  }
}

/** O mesmo, já lendo JSON. */
export async function buscarJson<T>(endereco: string, opcoes: Opcoes = {}): Promise<T | null> {
  const texto = await buscarTexto(endereco, opcoes);
  if (texto === null) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

/** Resposta das rotas /api: JSON, guardada no intermediário pelo tempo pedido e sem nada de quem pediu. */
export function responder(corpo: unknown, guardar = 3600, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": guardar > 0 ? `public, max-age=${Math.min(guardar, 3600)}, s-maxage=${guardar}, stale-while-revalidate=${guardar}` : "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

/** Texto de busca vindo do endereço: limpo, curto, sem caracteres de controle. Vazio quando não serve. */
export function termo(valor: string | null, minimo = 2, maximo = 80): string {
  const limpo = (valor ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximo);
  return limpo.length >= minimo ? limpo : "";
}

/** Tira marcação HTML de um trecho vindo de fora: aqui só entra texto. */
export const semHtml = (texto: string) =>
  texto
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Consultas a serviços abertos de fora (Wikipedia, Banco Central, IBGE, Câmara, dicionários, acervos).
// Só roda no servidor do site: o navegador de quem visita fala apenas com o nosso domínio, então nenhum
// serviço de fora fica sabendo quem leu o quê, e a política de segurança das páginas continua intocada.
// Nada fica guardado no servidor (o Data Cache da Vercel gravava uma entrada por endereço e por busca, e cada robô que
// variava a busca era uma gravação paga): quem guarda é a borda (Vercel e Cloudflare), pelo Cache-Control de responder().
// A busca é normalizada (termo) e a rota manda para o endereço normalizado (canonica), para que "Casa", "casa" e
// "casa " sejam uma entrada só na borda.

/** Os únicos destinos permitidos. Endereço fora desta lista não é consultado. */
const permitidos = [
  "api.wikimedia.org",
  "pt.wikipedia.org",
  "en.wikipedia.org",
  "es.wikipedia.org",
  "ru.wikipedia.org",
  "zh.wikipedia.org",
  "fr.wikipedia.org",
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
/** Quantos redirecionamentos seguidos são aceitos, e só para endereços que também estão na lista. */
const SALTOS = 2;

/** Só https e só os destinos da lista: vale para o endereço pedido e para cada redirecionamento. */
export const permitido = (url: URL) => url.protocol === "https:" && permitidos.includes(url.hostname);

export interface Opcoes {
  /**
   * @deprecated Não tem mais efeito: a resposta de fora não é guardada no servidor, e o tempo na borda vem do
   * Cache-Control de responder(). Continua aceito para os chamadores antigos não quebrarem.
   */
  guardar?: number;
  /** Prazo de espera, em milissegundos. */
  prazo?: number;
  cabecalhos?: Record<string, string>;
  /** Resposta "não encontrado" (404) vira este texto, em vez de falha: para serviços que dizem assim que não acharam. */
  se404?: string;
}

/** Busca um endereço da lista e devolve o texto, ou null se algo der errado (fora do ar, lento, grande demais). */
export async function buscarTexto(endereco: string, { prazo = 8000, cabecalhos = {}, se404 }: Opcoes = {}): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return null;
  }
  if (!permitido(url)) return null;
  try {
    let resposta = await fetch(url, {
      headers: { "User-Agent": AGENTE, Accept: "application/json, text/xml;q=0.9, */*;q=0.5", ...cabecalhos },
      signal: AbortSignal.timeout(prazo),
      // Redirecionamentos não são seguidos às cegas: o destino também precisa estar na lista (abaixo).
      redirect: "manual",
    });
    for (let salto = 0; salto < SALTOS && resposta.status >= 300 && resposta.status < 400; salto++) {
      const destino = resposta.headers.get("location");
      if (!destino) return null;
      let proximo: URL;
      try {
        proximo = new URL(destino, url);
      } catch {
        return null;
      }
      if (!permitido(proximo)) return null;
      resposta = await fetch(proximo, {
        headers: { "User-Agent": AGENTE, Accept: "application/json, text/xml;q=0.9, */*;q=0.5", ...cabecalhos },
        signal: AbortSignal.timeout(prazo),
        redirect: "manual",
      });
    }
    if (resposta.status >= 300 && resposta.status < 400) return null;
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

/**
 * Texto de busca vindo do endereço: limpo, curto, sem caracteres de controle, na forma Unicode composta (NFC) e em
 * minúsculas, para que a mesma busca escrita de jeitos diferentes seja uma entrada só no cache da borda. Os serviços
 * consultados com isto fazem busca de texto sem distinguir maiúsculas. Vazio quando não serve.
 */
export function termo(valor: string | null, minimo = 2, maximo = 80): string {
  // Precisa ser idempotente (termo(termo(x)) === termo(x)), senão canonica() redirecionaria de novo: corta por caractere
  // (sem partir um emoji), normaliza outra vez depois das minúsculas e tira o espaço que o corte deixar no fim.
  const minusculo = (valor ?? "").normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().normalize("NFC");
  const limpo = Array.from(minusculo).slice(0, maximo).join("").trim();
  return Array.from(limpo).length >= minimo ? limpo : "";
}

/**
 * Quando a busca do endereço não está na forma normalizada (termo), devolve um redirecionamento permanente (308) para o
 * mesmo endereço com a busca normalizada; senão, null. Assim a borda guarda uma resposta só por busca, em vez de uma por
 * jeito de escrever. O redirecionamento também fica guardado na borda.
 */
export function canonica(pedido: Request, nome: string, normalizado: string): Response | null {
  if (!normalizado) return null;
  const url = new URL(pedido.url);
  if (url.searchParams.get(nome) === normalizado) return null;
  url.searchParams.set(nome, normalizado);
  return new Response(null, { status: 308, headers: { Location: `${url.pathname}${url.search}`, "Cache-Control": "public, max-age=86400, s-maxage=86400", "X-Robots-Tag": "noindex" } });
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

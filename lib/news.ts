// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fontes from "@/content/noticias.json";

// Giro de notícias: as manchetes mais recentes de veículos populares, independentes e públicos, lidas dos
// endereços de distribuição (RSS) que cada um oferece. O site mostra só o título, a data e o link: o texto
// continua na casa de quem escreveu. A lista de veículos fica em content/noticias.json.

export interface Headline {
  title: string;
  link: string;
  date: string;
  source: string;
}

export interface Outlet {
  name: string;
  site: string;
  headlines: Headline[];
}

/** De quanto em quanto tempo (em segundos) as manchetes são buscadas de novo. */
export const NEWS_REFRESH = 900;

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" };

/** Texto limpo: sem marcação, sem CDATA, com os códigos de caractere trocados pelos caracteres. */
function clean(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole: string, name: string) => entities[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, " ")
    .trim();
}

const tag = (block: string, name: string) => new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block)?.[1] ?? "";

/** Só aceita link https que aponte para o próprio veículo: um endereço estranho dentro do feed é descartado. */
function safeLink(raw: string, site: string): string {
  try {
    const url = new URL(clean(raw));
    const home = new URL(site).hostname.replace(/^www\./, "");
    const host = url.hostname.replace(/^www\./, "");
    return url.protocol === "https:" && (host === home || host.endsWith(`.${home}`)) ? url.toString() : "";
  } catch {
    return "";
  }
}

async function read(source: { nome: string; site: string; feed: string }): Promise<Outlet> {
  const outlet: Outlet = { name: source.nome, site: source.site, headlines: [] };
  try {
    const response = await fetch(source.feed, {
      next: { revalidate: NEWS_REFRESH },
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; leitor de manchetes; +https://institutolucia.org/pt/noticias)", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    });
    if (!response.ok) return outlet;
    const xml = (await response.text()).slice(0, 1_500_000);
    for (const [, block] of xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)) {
      const title = clean(tag(block, "title")).slice(0, 220);
      const link = safeLink(tag(block, "link"), source.site);
      const time = Date.parse(clean(tag(block, "pubDate") || tag(block, "dc:date")));
      if (!title || !link || Number.isNaN(time) || time > Date.now() + 3_600_000) continue;
      outlet.headlines.push({ title, link, date: new Date(time).toISOString(), source: source.nome });
      if (outlet.headlines.length >= 8) break;
    }
  } catch {
    // Veículo fora do ar ou lento: fica de fora desta rodada e volta na próxima.
  }
  return outlet;
}

export async function getNews(): Promise<{ latest: Headline[]; outlets: Outlet[]; at: string }> {
  const outlets = (await Promise.all(fontes.map(read))).filter((outlet) => outlet.headlines.length > 0);
  // Nas últimas, no máximo quatro por veículo: quem publica muito não empurra os outros para fora.
  const latest = outlets
    .flatMap((outlet) => outlet.headlines.slice(0, 4))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
  return { latest, outlets, at: new Date().toISOString() };
}

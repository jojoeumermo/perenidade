// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Pesquisa em acervos e enciclopédias abertos, para a equipe preencher fichas do acervo, verbetes do glossário e
// datas da linha do tempo com fonte à vista. Nada daqui vai ao ar sozinho: é ponto de partida para quem escreve,
// que confere, cita a fonte e envia pela fila de revisão. Usado pelo painel.
//
//   obras:    Internet Archive (textos com licença ou domínio público), Open Library, Gutendex (Project Gutenberg)
//   verbetes: Wikipédia, Wikidata (datas de nascimento e morte), Wikisource, Wikimedia Commons
import { buscarJson, responder, semHtml, termo } from "@/lib/externo";

export interface Achado {
  fonte: string;
  titulo: string;
  detalhe: string;
  licenca: string;
  link: string;
}

const ano = (valor: unknown) => (typeof valor === "string" ? (/^[+-]?(\d{1,4})-/.exec(valor)?.[1] ?? "") : "");

async function internetArchive(busca: string): Promise<Achado[]> {
  const q = `(${busca}) AND mediatype:texts AND (licenseurl:* OR collection:opensource OR collection:gutenberg OR collection:americana)`;
  const dados = await buscarJson<{ response?: { docs?: { identifier?: string; title?: string; creator?: string | string[]; year?: string; licenseurl?: string; language?: string | string[] }[] } }>(
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&fl%5B%5D=licenseurl&fl%5B%5D=language&rows=8&output=json`,
    { guardar: 86400, prazo: 12000 },
  );
  return (dados?.response?.docs ?? [])
    .filter((doc) => doc.identifier && doc.title)
    .map((doc) => ({
      fonte: "Internet Archive",
      titulo: String(doc.title).slice(0, 200),
      detalhe: [[doc.creator].flat().filter(Boolean).join(", "), doc.year, [doc.language].flat().filter(Boolean).join(", ")].filter(Boolean).join(" · ").slice(0, 200),
      licenca: doc.licenseurl ? doc.licenseurl.replace(/^https?:\/\//, "") : "conferir na página",
      link: `https://archive.org/details/${encodeURIComponent(doc.identifier!)}`,
    }));
}

async function openLibrary(busca: string): Promise<Achado[]> {
  const dados = await buscarJson<{ docs?: { key?: string; title?: string; author_name?: string[]; first_publish_year?: number; ebook_access?: string }[] }>(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(busca)}&limit=8&fields=key,title,author_name,first_publish_year,ebook_access`,
    { guardar: 86400 },
  );
  return (dados?.docs ?? [])
    .filter((doc) => doc.key && doc.title)
    .map((doc) => ({
      fonte: "Open Library",
      titulo: doc.title!.slice(0, 200),
      detalhe: [(doc.author_name ?? []).slice(0, 3).join(", "), doc.first_publish_year].filter(Boolean).join(" · "),
      licenca: doc.ebook_access === "public" ? "leitura livre (domínio público)" : "só a ficha; a obra pode ter direitos",
      link: `https://openlibrary.org${doc.key}`,
    }));
}

async function gutendex(busca: string): Promise<Achado[]> {
  const dados = await buscarJson<{ results?: { id?: number; title?: string; authors?: { name?: string; death_year?: number | null }[]; languages?: string[]; copyright?: boolean | null }[] }>(
    `https://gutendex.com/books/?search=${encodeURIComponent(busca)}`,
    { guardar: 86400, prazo: 10000 },
  );
  return (dados?.results ?? [])
    .filter((livro) => livro.id && livro.title)
    .slice(0, 8)
    .map((livro) => ({
      fonte: "Project Gutenberg",
      titulo: livro.title!.slice(0, 200),
      detalhe: [(livro.authors ?? []).map((autor) => `${autor.name ?? ""}${autor.death_year ? ` (†${autor.death_year})` : ""}`).join(", "), (livro.languages ?? []).join(", ")].filter(Boolean).join(" · "),
      licenca: livro.copyright === false ? "domínio público nos EUA; no Brasil, conferir 70 anos da morte" : "conferir",
      link: `https://www.gutenberg.org/ebooks/${livro.id}`,
    }));
}

async function wikipedia(busca: string): Promise<Achado[]> {
  const dados = await buscarJson<{ query?: { search?: { title?: string; snippet?: string }[] } }>(
    `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(busca)}&srlimit=5&format=json&utf8=1`,
    { guardar: 86400 },
  );
  return (dados?.query?.search ?? [])
    .filter((item) => item.title)
    .map((item) => ({ fonte: "Wikipédia", titulo: item.title!, detalhe: semHtml(item.snippet ?? "").slice(0, 240), licenca: "CC BY-SA 4.0", link: `https://pt.wikipedia.org/wiki/${encodeURIComponent(item.title!.replace(/ /g, "_"))}` }));
}

async function wikidata(busca: string): Promise<Achado[]> {
  const achados = await buscarJson<{ search?: { id?: string }[] }>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(busca)}&language=pt&uselang=pt&type=item&limit=4&format=json`,
    { guardar: 86400 },
  );
  const ids = (achados?.search ?? []).map((item) => item.id).filter((id): id is string => Boolean(id && /^Q\d+$/.test(id)));
  if (ids.length === 0) return [];
  const entidades = await buscarJson<{ entities?: Record<string, { labels?: Record<string, { value?: string }>; descriptions?: Record<string, { value?: string }>; claims?: Record<string, { mainsnak?: { datavalue?: { value?: { time?: string } } } }[]> }> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&props=labels|descriptions|claims&languages=pt|en&format=json`,
    { guardar: 86400 },
  );
  return ids
    .map((id) => {
      const item = entidades?.entities?.[id];
      if (!item) return null;
      const nome = item.labels?.pt?.value ?? item.labels?.en?.value ?? id;
      const nasceu = ano(item.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time);
      const morreu = ano(item.claims?.P570?.[0]?.mainsnak?.datavalue?.value?.time);
      const datas = nasceu || morreu ? `${nasceu || "?"}–${morreu}` : "";
      return { fonte: "Wikidata", titulo: nome, detalhe: [datas, item.descriptions?.pt?.value ?? item.descriptions?.en?.value ?? ""].filter(Boolean).join(" · ").slice(0, 240), licenca: "CC0 (dados livres)", link: `https://www.wikidata.org/wiki/${id}` };
    })
    .filter((item): item is Achado => item !== null);
}

async function wikimedia(site: "pt.wikisource.org" | "commons.wikimedia.org", busca: string): Promise<Achado[]> {
  const arquivos = site === "commons.wikimedia.org";
  const dados = await buscarJson<{ query?: { search?: { title?: string; snippet?: string }[] } }>(
    `https://${site}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(busca)}&srnamespace=${arquivos ? 6 : 0}&srlimit=5&format=json&utf8=1`,
    { guardar: 86400 },
  );
  return (dados?.query?.search ?? [])
    .filter((item) => item.title)
    .map((item) => ({
      fonte: arquivos ? "Wikimedia Commons" : "Wikisource",
      titulo: item.title!.replace(/^File:/, ""),
      detalhe: semHtml(item.snippet ?? "").slice(0, 200),
      licenca: arquivos ? "licença na página do arquivo (copie o crédito de lá)" : "domínio público ou licença livre: conferir na página",
      link: `https://${site}/wiki/${encodeURIComponent(item.title!.replace(/ /g, "_"))}`,
    }));
}

export async function GET(pedido: Request) {
  const parametros = new URL(pedido.url).searchParams;
  const busca = termo(parametros.get("q"), 3, 100);
  const tipo = parametros.get("tipo") === "verbetes" ? "verbetes" : "obras";
  if (!busca) return responder({ achados: [] }, 3600);
  const grupos = await Promise.all(
    tipo === "obras"
      ? [internetArchive(busca), openLibrary(busca), gutendex(busca)]
      : [wikipedia(busca), wikidata(busca), wimedia(busca)],
  );
  return responder({ tipo, achados: grupos.flat() }, 86400);
}

/** Wikisource e Commons juntos, para a busca de verbetes. */
async function wimedia(busca: string): Promise<Achado[]> {
  const [textos, imagens] = await Promise.all([wikimedia("pt.wikisource.org", busca), wikimedia("commons.wikimedia.org", busca)]);
  return [...textos, ...imagens];
}

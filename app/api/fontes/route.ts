// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Pesquisa em acervos e enciclopédias abertos, para a equipe preencher fichas do acervo, verbetes do glossário e
// datas da linha do tempo com fonte à vista. Nada daqui vai ao ar sozinho: é ponto de partida para quem escreve,
// que confere, cita a fonte e envia pela fila de revisão. Usado pelo painel.
//
//   obras:    Internet Archive (textos com licença ou domínio público), Open Library, Gutendex (Project Gutenberg),
//             MEC Livros (biblioteca digital do Ministério da Educação: empréstimo gratuito com conta gov.br)
//   verbetes: Wikipédia, Wikidata (datas de nascimento e morte), Wikisource, Wikimedia Commons, Wikcionário
//   estudos:  OpenAlex (só artigos e livros de acesso aberto), Crossref (só com licença Creative Commons),
//             Wikilivros (livros didáticos livres)
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

/** O catálogo do MEC Livros: obras com direitos, emprestadas de graça pela conta gov.br; as de domínio público, livres. */
async function mecLivros(busca: string): Promise<Achado[]> {
  const dados = await buscarJson<{ books?: { id?: string | number; title?: string; authors?: string[]; publisher?: string; published_date?: string; categories?: string[]; is_public_domain?: boolean }[] }>(
    `https://meclivros.mec.gov.br/api/backend/books/search?query=${encodeURIComponent(busca)}`,
    { guardar: 86400, prazo: 12000 },
  );
  return (dados?.books ?? [])
    .filter((livro) => livro.id && livro.title)
    .slice(0, 8)
    .map((livro) => ({
      fonte: "MEC Livros",
      titulo: String(livro.title).slice(0, 200),
      detalhe: [(livro.authors ?? []).slice(0, 3).join(", "), livro.publisher, (livro.published_date ?? "").slice(0, 4), (livro.categories ?? []).slice(0, 2).join(", ")].filter(Boolean).join(" · ").slice(0, 240),
      licenca: livro.is_public_domain ? "domínio público" : "empréstimo gratuito com conta gov.br; a obra tem direitos (só ficha de referência)",
      link: `https://meclivros.mec.gov.br/search/view-work?id=${encodeURIComponent(String(livro.id))}`,
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

type Wiki = "pt.wikisource.org" | "commons.wikimedia.org" | "pt.wiktionary.org" | "pt.wikibooks.org";
const nomesDasWikis: Record<Wiki, string> = { "pt.wikisource.org": "Wikisource", "commons.wikimedia.org": "Wikimedia Commons", "pt.wiktionary.org": "Wikcionário", "pt.wikibooks.org": "Wikilivros" };
const licencasDasWikis: Record<Wiki, string> = {
  "pt.wikisource.org": "domínio público ou licença livre: conferir na página",
  "commons.wikimedia.org": "licença na página do arquivo (copie o crédito de lá)",
  "pt.wiktionary.org": "CC BY-SA 4.0",
  "pt.wikibooks.org": "CC BY-SA 4.0",
};

async function wikimedia(site: Wiki, busca: string): Promise<Achado[]> {
  const arquivos = site === "commons.wikimedia.org";
  const dados = await buscarJson<{ query?: { search?: { title?: string; snippet?: string }[] } }>(
    `https://${site}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(busca)}&srnamespace=${arquivos ? 6 : 0}&srlimit=5&format=json&utf8=1`,
    { guardar: 86400 },
  );
  return (dados?.query?.search ?? [])
    .filter((item) => item.title)
    .map((item) => ({
      fonte: nomesDasWikis[site],
      titulo: item.title!.replace(/^File:/, ""),
      detalhe: semHtml(item.snippet ?? "").slice(0, 200),
      licenca: licencasDasWikis[site],
      link: `https://${site}/wiki/${encodeURIComponent(item.title!.replace(/ /g, "_"))}`,
    }));
}

/** "cc-by-nc-nd" vira "CC BY-NC-ND"; o que não é Creative Commons nem domínio público fica para conferir. */
const licencaAberta = (licenca?: string | null) =>
  licenca?.startsWith("cc-") ? `CC ${licenca.slice(3).toUpperCase()}` : licenca === "public-domain" ? "domínio público" : "acesso aberto: conferir a licença na página";

/** Artigos e livros acadêmicos de acesso aberto (em português, espanhol ou inglês), com o endereço da versão aberta. */
async function openAlex(busca: string): Promise<Achado[]> {
  const dados = await buscarJson<{ results?: { id?: string; display_name?: string; publication_year?: number; type?: string; authorships?: { author?: { display_name?: string } }[]; open_access?: { oa_url?: string | null }; primary_location?: { license?: string | null; source?: { display_name?: string } | null } | null }[] }>(
    `https://api.openalex.org/works?search=${encodeURIComponent(busca)}&filter=is_oa:true,language:pt|es|en&per-page=8&select=id,display_name,publication_year,type,authorships,open_access,primary_location`,
    { guardar: 86400, prazo: 12000 },
  );
  return (dados?.results ?? [])
    .filter((obra) => obra.display_name && (obra.open_access?.oa_url || obra.id))
    .map((obra) => ({
      fonte: "OpenAlex (acesso aberto)",
      titulo: semHtml(obra.display_name!).slice(0, 200),
      detalhe: [(obra.authorships ?? []).slice(0, 3).map((autoria) => autoria.author?.display_name).filter(Boolean).join(", "), obra.publication_year, obra.primary_location?.source?.display_name].filter(Boolean).join(" · ").slice(0, 240),
      licenca: licencaAberta(obra.primary_location?.license),
      link: obra.open_access?.oa_url || obra.id!,
    }));
}

/** Publicações com licença Creative Commons registrada no Crossref (revistas científicas e livros). */
async function crossref(busca: string): Promise<Achado[]> {
  const dados = await buscarJson<{ message?: { items?: { DOI?: string; title?: string[]; author?: { given?: string; family?: string }[]; issued?: { "date-parts"?: number[][] }; "container-title"?: string[]; license?: { URL?: string }[] }[] } }>(
    `https://api.crossref.org/works?query=${encodeURIComponent(busca)}&filter=has-license:true&rows=12&select=DOI,title,author,issued,container-title,license`,
    { guardar: 86400, prazo: 12000 },
  );
  return (dados?.message?.items ?? [])
    .map((obra) => ({ obra, livre: (obra.license ?? []).map((licenca) => licenca.URL ?? "").find((url) => /creativecommons\.org/.test(url)) }))
    .filter(({ obra, livre }) => obra.DOI && obra.title?.[0] && livre)
    .slice(0, 6)
    .map(({ obra, livre }) => ({
      fonte: "Crossref (licença aberta)",
      titulo: semHtml(obra.title![0]).slice(0, 200),
      detalhe: [(obra.author ?? []).slice(0, 3).map((autor) => [autor.given, autor.family].filter(Boolean).join(" ")).join(", "), obra.issued?.["date-parts"]?.[0]?.[0], obra["container-title"]?.[0]].filter(Boolean).join(" · ").slice(0, 240),
      licenca: livre!.replace(/^https?:\/\//, ""),
      link: `https://doi.org/${obra.DOI}`,
    }));
}

const tipos = ["obras", "verbetes", "estudos"] as const;

export async function GET(pedido: Request) {
  const parametros = new URL(pedido.url).searchParams;
  const busca = termo(parametros.get("q"), 3, 100);
  const tipo = tipos.find((valor) => valor === parametros.get("tipo")) ?? "obras";
  if (!busca) return responder({ achados: [] }, 3600);
  const fontes = {
    obras: () => [internetArchive(busca), openLibrary(busca), gutendex(busca), mecLivros(busca)],
    verbetes: () => [wikipedia(busca), wikidata(busca), wikimedia("pt.wikisource.org", busca), wikimedia("commons.wikimedia.org", busca), wikimedia("pt.wiktionary.org", busca)],
    estudos: () => [openAlex(busca), crossref(busca), wikimedia("pt.wikibooks.org", busca)],
  };
  const grupos = await Promise.all(fontes[tipo]());
  return responder({ tipo, achados: grupos.flat() }, 86400);
}

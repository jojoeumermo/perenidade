// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 50 (Prompt 4): RSS e Atom por comunidade pública e por #tema. O banco decide o que sai (o mesmo recorte do RSS da onda 13:
// public.rede_alc_rss para comunidade e perfil de organização com selo, public.rede_p4_de_rss_tag para o #tema); aqui só se monta o
// XML. Texto puro (escapado), sem foto, sem número, sem e-mail. Sem "@/" de propósito (roda nos testes).
import { enderecoAbsoluto, escapar, idiomaOk, semControle, tituloDoItem, type ItemQueSai, type TextosDoRss } from "../alcance/regras";

/** Um canal como o banco devolve, também o do #tema. */
export interface CanalDoFeed {
  tipo: "perfil" | "comunidade" | "tag";
  nome: string;
  titulo: string;
  descricao: string;
  itens: ItemQueSai[];
}

export interface TextosDoFeed extends TextosDoRss {
  /** "Posts públicos com #{nome} na Alumia" */
  descricaoTema: string;
}

const preencher = (modelo: string, campos: Record<string, string>) => modelo.replace(/\{(\w+)\}/g, (m, k: string) => (k in campos ? campos[k] : m));
const resumo = (texto: string, max: number) => {
  const t = semControle(texto).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};
const iso = (x: string) => {
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
};

/** A letra do endereço: c (comunidade), u (perfil), t (#tema). */
export const LETRAS = { c: "comunidade", u: "perfil", t: "tag" } as const;
export type Letra = keyof typeof LETRAS;

/** A página do canal na Alumia. */
export function paginaDoCanal(canal: Pick<CanalDoFeed, "tipo" | "nome">, lang: string, bases: { alumia: string; site: string }): string {
  const caminho = canal.tipo === "perfil" ? `/u/${canal.nome}` : canal.tipo === "tag" ? `/tag/${canal.nome}` : `/c/${canal.nome}`;
  return enderecoAbsoluto(lang, caminho, bases);
}

/** Os endereços dos feeds no servidor do site. */
export function enderecoDoFeed(site: string, formato: "rss" | "atom", letra: Letra, nome: string, lang = "pt"): string {
  const base = `${site.replace(/\/+$/, "")}/api/rede/${formato}/${letra}/${encodeURIComponent(nome)}`;
  return idiomaOk(lang) === "pt" ? base : `${base}?lang=${idiomaOk(lang)}`;
}

function descricao(canal: CanalDoFeed, textos: TextosDoFeed): string {
  if (canal.descricao?.trim()) return resumo(canal.descricao, 500);
  const modelo = canal.tipo === "perfil" ? textos.descricaoPerfil : canal.tipo === "tag" ? textos.descricaoTema : textos.descricaoComunidade;
  return preencher(modelo, { nome: canal.tipo === "tag" ? canal.nome : canal.titulo });
}

function corpo(item: ItemQueSai, link: string, textos: TextosDoFeed): string {
  return [item.aviso ? preencher(textos.aviso, { aviso: resumo(item.aviso, 200) }) : "", semControle(item.texto).trim(), item.longo ? `${textos.continua}: ${link}` : ""].filter(Boolean).join("\n\n");
}
const tituloDe = (item: ItemQueSai, textos: TextosDoFeed) => (item.aviso ? preencher(textos.aviso, { aviso: resumo(item.aviso, 120) }) : tituloDoItem(item, textos));
const autorDe = (item: ItemQueSai) => (item.autor.handle ? `${item.autor.codinome} (@${item.autor.handle})` : item.autor.codinome);

/** O Atom 1.0 de um canal (comunidade aberta, perfil de organização com selo ou #tema). */
export function montarAtom(canal: CanalDoFeed, o: { lang: string; bases: { alumia: string; site: string }; textos: TextosDoFeed; proprio: string }): string {
  const pagina = paginaDoCanal(canal, o.lang, o.bases);
  const ultimo = canal.itens.reduce<string | null>((m, i) => (!m || i.criado_em > m ? i.criado_em : m), null);
  const entradas = canal.itens.map((item) => {
    const link = enderecoAbsoluto(o.lang, `/p/${item.id}`, o.bases);
    return [
      "  <entry>",
      `    <title>${escapar(tituloDe(item, o.textos))}</title>`,
      `    <link rel="alternate" type="text/html" href="${escapar(link)}"/>`,
      `    <id>${escapar(link)}</id>`,
      `    <published>${iso(item.criado_em)}</published>`,
      `    <updated>${iso(item.editado_em ?? item.criado_em)}</updated>`,
      `    <author><name>${escapar(autorDe(item))}</name></author>`,
      item.comunidade ? `    <category term="${escapar(item.comunidade.slug)}" label="${escapar(item.comunidade.nome)}"/>` : "",
      `    <content type="text">${escapar(corpo(item, link, o.textos))}</content>`,
      "  </entry>",
    ].filter(Boolean).join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${o.lang === "zh" ? "zh-CN" : o.lang === "pt" ? "pt-BR" : o.lang}">`,
    `  <title>${escapar(`${canal.titulo} · Alumia`)}</title>`,
    `  <subtitle>${escapar(descricao(canal, o.textos))}</subtitle>`,
    `  <link rel="alternate" type="text/html" href="${escapar(pagina)}"/>`,
    `  <link rel="self" type="application/atom+xml" href="${escapar(o.proprio)}"/>`,
    `  <id>${escapar(o.proprio)}</id>`,
    `  <updated>${iso(ultimo ?? new Date(0).toISOString())}</updated>`,
    ...entradas,
    "</feed>",
    "",
  ].join("\n");
}

/** O RSS 2.0 de um #tema (comunidade e perfil continuam no montarRss da onda 13). */
export function montarRssDoTema(canal: CanalDoFeed, o: { lang: string; bases: { alumia: string; site: string }; textos: TextosDoFeed; proprio: string }): string {
  const pagina = paginaDoCanal(canal, o.lang, o.bases);
  const itens = canal.itens.map((item) => {
    const link = enderecoAbsoluto(o.lang, `/p/${item.id}`, o.bases);
    return [
      "    <item>",
      `      <title>${escapar(tituloDe(item, o.textos))}</title>`,
      `      <link>${escapar(link)}</link>`,
      `      <guid isPermaLink="true">${escapar(link)}</guid>`,
      `      <pubDate>${new Date(iso(item.criado_em)).toUTCString()}</pubDate>`,
      `      <dc:creator>${escapar(autorDe(item))}</dc:creator>`,
      item.comunidade ? `      <category>${escapar(item.comunidade.nome)}</category>` : "",
      `      <description>${escapar(corpo(item, link, o.textos))}</description>`,
      "    </item>",
    ].filter(Boolean).join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${escapar(`${canal.titulo} · Alumia`)}</title>`,
    `    <link>${escapar(pagina)}</link>`,
    `    <description>${escapar(descricao(canal, o.textos))}</description>`,
    `    <language>${o.lang === "zh" ? "zh-CN" : o.lang === "pt" ? "pt-BR" : o.lang}</language>`,
    `    <atom:link href="${escapar(o.proprio)}" rel="self" type="application/rss+xml"/>`,
    "    <ttl>30</ttl>",
    ...itens,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

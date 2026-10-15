// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { arquivoPublico, enderecoDoAudio } from "@/lib/podcast";
import { feed } from "@/lib/podcast-servidor";
import { site } from "@/lib/site";

// O feed do podcast. É ele que se cadastra uma vez no Spotify, no Apple Podcasts, no YouTube Music e nos outros
// agregadores: dali em diante, cada episódio publicado no painel chega sozinho a todos (em até quinze minutos).
export const revalidate = 900;

const xml = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const cdata = (texto: string) => `<![CDATA[${texto.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

/** Markdown das notas → HTML simples (parágrafos, títulos, listas, negrito e links), que é o que os agregadores mostram. */
function notasEmHtml(md: string): string {
  const inline = (linha: string) =>
    xml(linha)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, rotulo: string, url: string) => `<a href="${url}">${rotulo}</a>`);
  return md
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((bloco) => {
      const linhas = bloco.split("\n").filter((linha) => linha.trim());
      if (linhas.length === 0) return "";
      if (linhas.every((linha) => /^\s*[-*]\s+/.test(linha))) return `<ul>${linhas.map((linha) => `<li>${inline(linha.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      if (linhas.every((linha) => /^\s*\d+[.)]\s+/.test(linha))) return `<ol>${linhas.map((linha) => `<li>${inline(linha.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
      const titulo = /^#{1,6}\s+(.+)$/.exec(linhas[0]);
      if (titulo && linhas.length === 1) return `<h3>${inline(titulo[1])}</h3>`;
      return `<p>${linhas.map(inline).join("<br/>")}</p>`;
    })
    .join("");
}

export async function GET() {
  const { config, episodios } = await feed();
  const nome = config?.nome || "Podcast do Instituto Lúcia";
  const pagina = `${site.url}/pt/podcasts`;
  const capa = config?.capa ? arquivoPublico(config.capa) : `${site.url}/icone-512.png`;
  const categoria = config?.categoria || "Education";

  const itens = episodios
    .map((e) => {
      const url = `${pagina}/${e.slug}`;
      const audio = enderecoDoAudio(e);
      const tipo = e.audio ? e.audio_tipo || "audio/mpeg" : /\.m4a(\?|$)/i.test(audio) ? "audio/mp4" : /\.ogg(\?|$)/i.test(audio) ? "audio/ogg" : "audio/mpeg";
      const notas = `${e.resumo ? `<p>${xml(e.resumo)}</p>` : ""}${notasEmHtml(e.notas ?? "")}<p><a href="${url}">${xml("Ouça no site, com transcrição, fontes e a conversa do episódio.")}</a></p>`;
      return [
        "<item>",
        `<title>${xml(e.titulo)}</title>`,
        `<link>${xml(url)}</link>`,
        `<guid isPermaLink="false">instituto-lucia-podcast-${e.id}</guid>`,
        `<pubDate>${new Date(e.publicado_em).toUTCString()}</pubDate>`,
        `<description>${cdata(notas)}</description>`,
        `<content:encoded>${cdata(notas)}</content:encoded>`,
        `<enclosure url="${xml(audio)}" length="${e.audio ? e.audio_bytes : 0}" type="${tipo}"/>`,
        `<itunes:duration>${e.duracao}</itunes:duration>`,
        e.capa ? `<itunes:image href="${xml(arquivoPublico(e.capa))}"/>` : "",
        e.numero != null ? `<itunes:episode>${e.numero}</itunes:episode>` : "",
        e.temporada ? `<itunes:season>${e.temporada}</itunes:season>` : "",
        "<itunes:episodeType>full</itunes:episodeType>",
        `<itunes:explicit>${e.explicito ? "true" : "false"}</itunes:explicit>`,
        e.tem_legendas ? `<podcast:transcript url="${xml(`${pagina}/${e.slug}/legendas.vtt`)}" type="text/vtt" language="pt-BR" rel="captions"/>` : "",
        (e.capitulos?.length ?? 0) > 0 ? `<podcast:chapters url="${xml(`${pagina}/${e.slug}/capitulos.json`)}" type="application/json+chapters"/>` : "",
        ...(e.convidados ?? []).map((nomeConvidado) => `<podcast:person role="guest">${xml(nomeConvidado)}</podcast:person>`),
        "</item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const corpo = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${xml(nome)}</title>
<link>${xml(pagina)}</link>
<atom:link href="${xml(`${site.url}/podcast.xml`)}" rel="self" type="application/rss+xml"/>
<language>pt-br</language>
<description>${cdata(config?.descricao || "Podcast de formação do Instituto Lúcia.")}</description>
<copyright>${xml(`CC BY-SA 4.0 · ${site.name}`)}</copyright>
<itunes:author>${xml(config?.autor || site.name)}</itunes:author>
<itunes:owner><itunes:name>${xml(config?.autor || site.name)}</itunes:name>${config?.email ? `<itunes:email>${xml(config.email)}</itunes:email>` : ""}</itunes:owner>
<itunes:image href="${xml(capa)}"/>
<image><url>${xml(capa)}</url><title>${xml(nome)}</title><link>${xml(pagina)}</link></image>
<itunes:category text="${xml(categoria)}">${config?.subcategoria ? `<itunes:category text="${xml(config.subcategoria)}"/>` : ""}</itunes:category>
<itunes:explicit>${config?.explicito ? "true" : "false"}</itunes:explicit>
<itunes:type>episodic</itunes:type>
<podcast:locked>no</podcast:locked>
<podcast:funding url="${xml(`${site.url}/pt/apoie`)}">Apoie o Instituto Lúcia</podcast:funding>
${itens}
</channel>
</rss>
`;
  return new Response(corpo, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}

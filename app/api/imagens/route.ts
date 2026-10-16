// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Busca de imagens livres para o estúdio de design: arquivos da Wikimedia Commons com licença que permite reuso.
// Consultado pelo servidor do site, como os outros serviços abertos; devolve miniatura, autor e licença de cada um.
import { buscarJson, responder, semHtml, termo } from "@/lib/externo";

interface Pagina {
  title?: string;
  imageinfo?: { thumburl?: string; url?: string; descriptionshorturl?: string; extmetadata?: Record<string, { value?: string }> }[];
}

export async function GET(pedido: Request) {
  const busca = termo(new URL(pedido.url).searchParams.get("q"), 3, 80);
  if (!busca) return responder({ achados: [] }, 3600);
  const dados = await buscarJson<{ query?: { pages?: Record<string, Pagina> } }>(
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`filetype:bitmap ${busca}`)}&gsrnamespace=6&gsrlimit=24&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&iiextmetadatafilter=LicenseShortName|Artist|Credit&format=json&utf8=1`,
    { guardar: 86400 },
  );
  const achados = Object.values(dados?.query?.pages ?? {})
    .map((pagina) => {
      const info = pagina.imageinfo?.[0];
      const titulo = (pagina.title ?? "").replace(/^File:/, "");
      const licenca = semHtml(info?.extmetadata?.LicenseShortName?.value ?? "");
      if (!info?.thumburl || !titulo || !licenca) return null;
      // Só o que pode ser reaproveitado: domínio público, CC0, CC BY e CC BY-SA.
      if (!/^(Public domain|CC0|CC BY(-SA)?( [0-9.]+)?|PD.*)$/i.test(licenca)) return null;
      return {
        titulo: titulo.replace(/\.[a-z]+$/i, "").replace(/_/g, " ").slice(0, 120),
        arquivo: titulo,
        miniatura: `/api/imagem?arquivo=${encodeURIComponent(titulo)}&largura=480`,
        autor: semHtml(info.extmetadata?.Artist?.value ?? "").slice(0, 120),
        licenca,
        pagina: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(titulo.replace(/ /g, "_"))}`,
      };
    })
    .filter((item) => item !== null);
  return responder({ achados }, 86400);
}

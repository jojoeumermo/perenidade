// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Neste dia": fatos selecionados pela Wikipédia para a data de hoje (horário de Brasília), no idioma da página.
// Texto da Wikipédia, licença CC BY-SA: a página mostra a fonte e o link de cada fato.
import { buscarJson, responder, semHtml } from "@/lib/externo";

const idiomas: Record<string, string> = { pt: "pt", en: "en", es: "es", ru: "ru", zh: "zh", fr: "fr" };

interface Feed {
  selected?: { year?: number; text?: string; pages?: { titles?: { normalized?: string }; content_urls?: { desktop?: { page?: string } } }[] }[];
}

export async function GET(pedido: Request) {
  const lingua = idiomas[new URL(pedido.url).searchParams.get("lang") ?? ""] ?? "pt";
  const [dia, mes] = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date()).split("/");
  const feed = await buscarJson<Feed>(`https://api.wikimedia.org/feed/v1/wikipedia/${lingua}/onthisday/selected/${mes}/${dia}`, { guardar: 3600 });
  const fatos = (feed?.selected ?? [])
    .filter((fato) => typeof fato.year === "number" && typeof fato.text === "string" && fato.text.trim())
    .slice(0, 6)
    .map((fato) => {
      const pagina = fato.pages?.find((item) => item.content_urls?.desktop?.page?.startsWith(`https://${lingua}.wikipedia.org/`));
      return { ano: fato.year, texto: semHtml(fato.text!).replace(/\s*\((?:na |em )?imagem\)|\s*\(pictured\)|\s*\((?:en la |en )?imagen\)|\s*\(на (?:фото|изображении)\)|\s*\((?:en |sur l\'|sur la )?(?:image|photo)\)|\s*（[^）]*图[^）]*）/gi, "").slice(0, 400), link: pagina?.content_urls?.desktop?.page ?? `https://${lingua}.wikipedia.org/`, titulo: pagina?.titles?.normalized ?? "" };
    });
  return responder({ dia: `${dia}/${mes}`, fatos, fonte: `https://${lingua}.wikipedia.org/`, licenca: "CC BY-SA 4.0" }, fatos.length ? 3600 : 300);
}

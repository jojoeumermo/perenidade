// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Neste dia": fatos de luta do povo para a data de hoje (horário de Brasília), no idioma da página. Primeiro as datas
// escolhidas pela equipe (content/neste-dia.json, em português); depois, entre tudo o que a Wikipédia lista para o
// dia, os fatos de greve, revolução, independência, direitos e resistência (lib/neste-dia.ts). Texto da Wikipédia,
// licença CC BY-SA: a página mostra a fonte e o link de cada fato.
import curadoria from "@/content/neste-dia.json";
import { buscarJson, responder } from "@/lib/externo";
import { escolherFatos, type Feed, type FatoDoDia } from "@/lib/neste-dia";

const idiomas: Record<string, string> = { pt: "pt", en: "en", es: "es", ru: "ru", zh: "zh", fr: "fr" };

export async function GET(pedido: Request) {
  const lingua = idiomas[new URL(pedido.url).searchParams.get("lang") ?? ""] ?? "pt";
  const [dia, mes] = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date()).split("/");
  const feed = await buscarJson<Feed>(`https://api.wikimedia.org/feed/v1/wikipedia/${lingua}/onthisday/all/${mes}/${dia}`, { guardar: 3600 });
  const curados: FatoDoDia[] = lingua === "pt" ? curadoria.fatos.filter((fato) => fato.dia === `${mes}-${dia}`).map(({ ano, texto, link }) => ({ ano, texto, link })) : [];
  const fatos = escolherFatos(feed, lingua, curados);
  return responder({ dia: `${dia}/${mes}`, fatos, fonte: `https://${lingua}.wikipedia.org/`, licenca: "CC BY-SA 4.0" }, fatos.length ? 3600 : 300);
}

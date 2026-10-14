// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Frases traduzidas do Tatoeba (tatoeba.org), licença CC BY 2.0 FR: cada frase vai com o nome de quem a escreveu
// e o link para a página dela, como a licença pede.
import { buscarJson, responder, termo } from "@/lib/externo";

const linguas = ["por", "eng", "fra", "spa"] as const;
type Lingua = (typeof linguas)[number];
const lingua = (valor: string | null, padrao: Lingua): Lingua => ((linguas as readonly string[]).includes(valor ?? "") ? (valor as Lingua) : padrao);

interface Tatoeba {
  data?: { id?: number; text?: string; owner?: string | null; license?: string; translations?: { id?: number; text?: string; lang?: string; owner?: string | null; license?: string }[] }[];
}

export async function GET(pedido: Request) {
  const parametros = new URL(pedido.url).searchParams;
  const busca = termo(parametros.get("q"), 2, 60);
  const de = lingua(parametros.get("de"), "eng");
  const para = lingua(parametros.get("para"), "por");
  if (!busca || de === para) return responder({ frases: [] }, 86400);
  const dados = await buscarJson<Tatoeba>(
    `https://api.tatoeba.org/unstable/sentences?lang=${de}&q=${encodeURIComponent(busca)}&trans%3Alang=${para}&sort=relevance&limit=12`,
    { guardar: 604800 },
  );
  if (dados === null) return responder({ frases: [], erro: "indisponivel" }, 0);
  const frases = (dados.data ?? [])
    .map((frase) => {
      const traducao = frase.translations?.find((item) => item.lang === para && item.text);
      if (!frase.id || !frase.text || !traducao?.text) return null;
      return {
        id: frase.id,
        texto: frase.text.slice(0, 300),
        traducao: traducao.text.slice(0, 300),
        autores: [frase.owner, traducao.owner].filter(Boolean),
        link: `https://tatoeba.org/pt-br/sentences/show/${frase.id}`,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
  return responder({ frases, fonte: "Tatoeba", licenca: "CC BY 2.0 FR" }, 604800);
}

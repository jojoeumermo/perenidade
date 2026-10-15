// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Dicionário: português pelo Dicionário Aberto (dicionario-aberto.net, verbetes do Novo Diccionário da Língua
// Portuguesa, 1913, com a grafia da época) e inglês pelo Free Dictionary API (dictionaryapi.dev, dados do Wiktionary).
import { buscarJson, responder, termo } from "@/lib/externo";

interface Aberto {
  word?: string;
  xml?: string;
}
interface Ingles {
  word?: string;
  phonetic?: string;
  meanings?: { partOfSpeech?: string; definitions?: { definition?: string; example?: string }[] }[];
  sourceUrls?: string[];
}

export interface Sentido {
  classe: string;
  definicoes: { texto: string; exemplo?: string }[];
}

/** Lê o XML de um verbete do Dicionário Aberto: classe gramatical e uma definição por linha. */
function lerVerbete(xml: string): Sentido[] {
  const sentidos: Sentido[] = [];
  for (const bloco of xml.match(/<sense>[\s\S]*?<\/sense>/g) ?? []) {
    const classe = (/<gramGrp>([\s\S]*?)<\/gramGrp>/.exec(bloco)?.[1] ?? "").trim();
    const def = (/<def>([\s\S]*?)<\/def>/.exec(bloco)?.[1] ?? "")
      .replace(/<[^>]*>/g, "")
      .split("\n")
      .map((linha) => linha.replace(/_/g, "").trim())
      .filter(Boolean);
    if (def.length) sentidos.push({ classe, definicoes: def.slice(0, 12).map((texto) => ({ texto: texto.slice(0, 400) })) });
  }
  return sentidos.slice(0, 6);
}

export async function GET(pedido: Request) {
  const parametros = new URL(pedido.url).searchParams;
  const palavra = termo(parametros.get("palavra"), 1, 40).toLowerCase();
  const lingua = parametros.get("lingua") === "en" ? "en" : "pt";
  if (!palavra || !/^[\p{L}' -]+$/u.test(palavra)) return responder({ palavra, sentidos: [] }, 86400);

  if (lingua === "pt") {
    const verbetes = await buscarJson<Aberto[]>(`https://api.dicionario-aberto.net/word/${encodeURIComponent(palavra)}`, { guardar: 604800 });
    if (verbetes === null) return responder({ palavra, erro: "indisponivel" }, 0);
    const sentidos = verbetes.flatMap((verbete) => (verbete.xml ? lerVerbete(verbete.xml) : []));
    return responder({ palavra, sentidos, fonte: "Dicionário Aberto", link: `https://dicionario-aberto.net/search/${encodeURIComponent(palavra)}`, licenca: "CC BY-SA 2.5" }, 604800);
  }

  // O serviço responde 404 quando não conhece a palavra: isso é "não encontrado", não falha.
  const entradas = await buscarJson<Ingles[]>(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(palavra)}`, { guardar: 604800, prazo: 10000, se404: "[]" });
  if (entradas === null) return responder({ palavra, erro: "indisponivel" }, 0);
  if (!Array.isArray(entradas)) return responder({ palavra, sentidos: [] }, 86400);
  const sentidos: Sentido[] = entradas.flatMap((entrada) =>
    (entrada.meanings ?? []).map((sentido) => ({
      classe: sentido.partOfSpeech ?? "",
      definicoes: (sentido.definitions ?? [])
        .filter((item) => item.definition)
        .slice(0, 8)
        .map((item) => ({ texto: item.definition!.slice(0, 400), exemplo: item.example?.slice(0, 300) })),
    })),
  );
  return responder(
    { palavra, fonetica: entradas.find((entrada) => entrada.phonetic)?.phonetic ?? "", sentidos: sentidos.slice(0, 8), fonte: "Free Dictionary API (Wiktionary)", link: entradas[0]?.sourceUrls?.[0] ?? `https://en.wiktionary.org/wiki/${encodeURIComponent(palavra)}`, licenca: "CC BY-SA 3.0" },
    604800,
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Dicionário: português pelo Wikcionário (pt.wiktionary.org, o dicionário livre, com a língua de hoje) e, quando a
// palavra não está lá, pelo Dicionário Aberto (dicionario-aberto.net, verbetes do Novo Diccionário da Língua
// Portuguesa, 1913, com a grafia da época); inglês pelo Free Dictionary API (dictionaryapi.dev, dados do Wiktionary).
// Os dicionários comerciais (Aurélio, Houaiss, Michaelis) têm direitos reservados e não podem ser copiados.
import { buscarJson, buscarTexto, responder, semHtml, termo } from "@/lib/externo";

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

/** Partes do verbete do Wikcionário que não são sentidos da palavra. */
const FORA = /^(Tradu|Etimologia|Pron[uú]ncia|Ver também|Refer|Sin[oô]nimos|Ant[oô]nimos|Express|Verbetes|Locu|Descri|Notas|Anagramas|Divis|Fon|No |Na |Nos |Nas )/i;

/** O conteúdo da primeira lista numerada do trecho, com as listas de dentro (sentidos e exemplos) no lugar certo. */
function primeiraLista(trecho: string): string | null {
  const inicio = trecho.search(/<ol[\s>]/);
  if (inicio < 0) return null;
  const marcas = /<\/?ol[\s>]/g;
  marcas.lastIndex = inicio;
  let nivel = 0;
  for (let marca = marcas.exec(trecho); marca; marca = marcas.exec(trecho)) {
    nivel += marca[0][1] === "/" ? -1 : 1;
    if (nivel === 0) return trecho.slice(trecho.indexOf(">", inicio) + 1, marca.index);
  }
  return null;
}

/** Tira as listas de dentro de outra lista (exemplos, citações, subsentidos), da mais interna para fora. */
function semListasInternas(html: string): string {
  const interna = /<(ul|dl|ol)[\s>](?:(?!<(?:ul|dl|ol)[\s>])[\s\S])*?<\/\1>/g;
  let antes = "";
  let agora = html;
  while (agora !== antes) {
    antes = agora;
    agora = agora.replace(interna, "");
  }
  return agora;
}

/**
 * Lê a página do Wikcionário (o HTML do serviço da Wikimedia): só a seção do português, e nela cada classe
 * gramatical com a lista numerada dos sentidos. Exemplos e citações (as listas dentro de cada sentido) ficam de fora.
 */
function lerWikcionario(html: string): Sentido[] {
  const inicio = html.search(/<h1[^>]*id="(?:Portugu%C3%AAs|Português)"/);
  if (inicio < 0) return [];
  const resto = html.slice(inicio + 3);
  const fim = resto.search(/<h1[\s>]/);
  const secao = fim < 0 ? resto : resto.slice(0, fim);
  const sentidos: Sentido[] = [];
  const titulos = [...secao.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/g)];
  titulos.forEach((titulo, i) => {
    const classe = semHtml(titulo[2]).replace(/\s+/g, " ");
    if (!classe || FORA.test(classe)) return;
    const depois = secao.slice((titulo.index ?? 0) + titulo[0].length, titulos[i + 1]?.index ?? secao.length);
    const lista = primeiraLista(depois);
    if (!lista) return;
    const definicoes = [...semListasInternas(lista).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
      // Fora o estilo que o Wikcionário embute no meio do texto e as chamadas de nota ([1]).
      .map((item) => semHtml(item[1].replace(/<(style|sup)[\s>][\s\S]*?<\/\1>/g, "")).replace(/\s+/g, " ").trim())
      .filter((texto) => texto.length > 1)
      .slice(0, 8)
      .map((texto) => ({ texto: texto.slice(0, 400) }));
    if (definicoes.length) sentidos.push({ classe, definicoes });
  });
  return sentidos.slice(0, 6);
}

export async function GET(pedido: Request) {
  const parametros = new URL(pedido.url).searchParams;
  const palavra = termo(parametros.get("palavra"), 1, 40).toLowerCase();
  const lingua = parametros.get("lingua") === "en" ? "en" : "pt";
  if (!palavra || !/^[\p{L}' -]+$/u.test(palavra)) return responder({ palavra, sentidos: [] }, 86400);

  if (lingua === "pt") {
    // Primeiro o Wikcionário; 404 é "não tem essa página", e aí vale o Dicionário Aberto.
    const pagina = await buscarTexto(`https://pt.wiktionary.org/api/rest_v1/page/html/${encodeURIComponent(palavra)}`, { guardar: 604800, prazo: 8000, se404: "", cabecalhos: { Accept: "text/html" } });
    const doWikcionario = pagina ? lerWikcionario(pagina) : [];
    if (doWikcionario.length) {
      return responder({ palavra, sentidos: doWikcionario, fonte: "Wikcionário", link: `https://pt.wiktionary.org/wiki/${encodeURIComponent(palavra)}`, licenca: "CC BY-SA 4.0" }, 604800);
    }
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

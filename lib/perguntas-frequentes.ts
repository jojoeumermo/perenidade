// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As perguntas frequentes do botão "?" (components/assistente). Respostas PRONTAS, escritas à mão em
// content/perguntas-frequentes.json, nos 6 idiomas. Sem IA, sem pedido a servidor nenhum e sem texto livre interpretado:
// o que a pessoa digita só FILTRA esta lista, aqui no navegador, e não sai do aparelho.
//
// Este arquivo é puro (sem React, sem rede, sem disco): o servidor monta a lista do idioma (lib/perguntas-frequentes-dados.ts)
// e o navegador só usa filtrarPerguntas.

/** Uma pergunta pronta, já no idioma da página. */
export interface PerguntaFrequente {
  id: string;
  pergunta: string;
  resposta: string;
  /** Palavras a mais para o filtro (sinônimos), separadas por espaço. */
  palavras: string;
  /** Rota interna, sem o idioma (ex.: "/podcasts"), ou null quando a resposta basta. */
  href: string | null;
}

/** Tira acentos, passa para minúsculas e troca o que não é letra nem número por espaço. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Palavras que aparecem em quase toda pergunta e não ajudam a escolher ("como", "onde", "the"…). Já sem acento.
const VAZIAS = new Set(
  (
    "o a os as um uma uns umas de do da dos das e em no na nos nas num numa por pelo pela para pra com sem como onde que qual quais quem quando " +
    "eu meu minha meus minhas me se ao aos ou e tem ter ha esta estao sao ser vou faco fazer posso pode site isso isto aqui ai la " +
    "el la los las un una del al y en por para con sin como donde que cual quien cuando yo mi mis es son hay puedo esta " +
    "le la les un une des du de et en au aux pour par avec sans comment ou que qui quel quelle je mon ma mes est sont il y peut " +
    "the a an of to in on at for with how where what which who when i my me is are do does can there it this " +
    "как где что кто когда мне мой моя на в и с для это есть ли"
  ).split(" "),
);

/** As palavras que contam numa busca: sem acento, sem as vazias e com pelo menos 2 letras. */
export function termosDaBusca(busca: string): string[] {
  const vistos = new Set<string>();
  for (const termo of normalizar(busca).split(" ")) if (termo.length >= 2 && !VAZIAS.has(termo)) vistos.add(termo);
  return [...vistos];
}

/**
 * Filtra a lista pelo que a pessoa digitou. Cada palavra digitada que aparece na pergunta, na resposta ou nas palavras a mais
 * soma pontos (mais na pergunta); e uma palavra a mais que aparece inteira no que foi digitado também soma (isso cobre o
 * chinês, escrito sem espaço, e plurais como "aulas" → "aula"). Volta só as que somaram, das mais para as menos parecidas,
 * mantendo a ordem da lista no empate. Busca vazia (ou só de palavras vazias) devolve a lista inteira.
 */
export function filtrarPerguntas<T extends PerguntaFrequente>(lista: readonly T[], busca: string): T[] {
  const termos = termosDaBusca(busca);
  if (!termos.length) return [...lista];
  const digitado = ` ${normalizar(busca)} `;
  const pontuadas: { item: T; pontos: number; ordem: number }[] = [];
  lista.forEach((item, ordem) => {
    const pergunta = normalizar(item.pergunta);
    const resto = `${normalizar(item.resposta)} ${normalizar(item.palavras)}`;
    let pontos = 0;
    for (const termo of termos) {
      if (pergunta.includes(termo)) pontos += 3;
      else if (resto.includes(termo)) pontos += 1;
    }
    for (const palavra of normalizar(item.palavras).split(" ")) {
      if (palavra.length < 2 || VAZIAS.has(palavra)) continue;
      // Com espaço em volta nas línguas com espaço; no chinês (sem espaço), basta estar contida.
      if (/[㐀-鿿]/.test(palavra) ? digitado.includes(palavra) : digitado.includes(` ${palavra}`)) pontos += 2;
    }
    if (pontos > 0) pontuadas.push({ item, pontos, ordem });
  });
  return pontuadas.sort((a, b) => b.pontos - a.pontos || a.ordem - b.ordem).map((p) => p.item);
}

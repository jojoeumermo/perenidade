// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A busca que entende pergunta (Etapa 4, R1-15). Quem escreve "como faço para estudar na EJA" quer um caminho, não
// uma lista de palavras parecidas. content/busca-intencoes.json guarda as perguntas comuns da vida e para onde cada
// uma leva (só páginas e aulas que já existem; scripts/testar-busca-viva.mjs confere). Tudo aqui é puro e roda no
// aparelho: a pergunta não vai para servidor nenhum. Sem os atalhos "@/" de propósito, para o teste rodar no Node.

export type Destino =
  | { tipo: "aula"; id: string }
  | { tipo: "pagina"; caminho: string }
  | { tipo: "ferramenta"; id: string }
  | { tipo: "trilha"; slug: string };

export interface Intencao {
  id: string;
  /** Frases em português, já sem acento e em minúsculas. */
  padroes: string[];
  destinos: Destino[];
  /** Para quem mantém o arquivo: o que a intenção cobre (não aparece na tela). */
  nota: string;
}

/** O casamento mínimo para a caixa "Melhor caminho" aparecer. */
export const LIMIAR = 0.6;
/** No máximo três destinos na caixa. */
export const MAXIMO_DE_DESTINOS = 3;

// O jeito de perguntar, que não diz o assunto: sai antes da conta.
const ABERTURAS = [
  "como e que eu faco para",
  "como eu faco para",
  "como eu faco pra",
  "como faco para",
  "como faco pra",
  "como faco",
  "como eu faco",
  "como fazer para",
  "o que e que e",
  "o que e",
  "o que sao",
  "onde eu",
  "onde",
];

// Palavras que aparecem em qualquer pergunta. Saem dos dois lados (da pergunta e dos padrões), por isso a lista pode
// ser generosa sem estragar os padrões.
const VAZIAS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos",
  "para", "pra", "pro", "com", "por", "pelo", "pela", "que", "eu", "me", "meu", "minha", "meus", "minhas", "se", "ao",
  "como", "quero", "queria", "gostaria", "preciso", "posso", "consigo", "saber", "sobre", "qual", "quais", "isso", "esse",
  "essa", "aqui", "ja", "ou", "mas", "tem", "ter", "ser", "sou", "estou", "vou", "muito", "mais",
]);

/** Sem acento, sem maiúscula, sem pontuação e sem o jeito de perguntar ("como faço", "o que é", "onde"). */
export function normalizar(consulta: string): string {
  let texto = ` ${consulta
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
  for (const abertura of ABERTURAS) texto = texto.split(` ${abertura} `).join(" ");
  return texto.replace(/\s+/g, " ").trim();
}

/** As palavras que contam: sem as vazias e com o plural simples tirado ("contas" e "conta" valem igual). */
export function palavras(texto: string): Set<string> {
  const lista = normalizar(texto)
    .split(" ")
    .filter((p) => p && !VAZIAS.has(p))
    .map((p) => (p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p));
  return new Set(lista);
}

/**
 * Quanto a pergunta casa com um padrão, de 0 a 1: as palavras em comum divididas pelo tamanho do maior dos dois.
 * Assim "golpe de 1964" não casa com "golpe" (metade da pergunta fica de fora), e "eja" casa com "eja".
 */
export function pontuar(consulta: string, padrao: string): number {
  const q = palavras(consulta);
  const p = palavras(padrao);
  if (q.size === 0 || p.size === 0) return 0;
  let comum = 0;
  for (const palavra of q) if (p.has(palavra)) comum++;
  return comum / Math.max(q.size, p.size);
}

export interface Casamento {
  intencao: Intencao;
  pontos: number;
}

/** As intenções que casam com a pergunta (pontos de 0,6 para cima), da melhor para a pior. */
export function casamentos(consulta: string, intencoes: readonly Intencao[]): Casamento[] {
  const achados: Casamento[] = [];
  for (const intencao of intencoes) {
    const pontos = Math.max(0, ...intencao.padroes.map((padrao) => pontuar(consulta, padrao)));
    if (pontos >= LIMIAR) achados.push({ intencao, pontos });
  }
  return achados.sort((a, b) => b.pontos - a.pontos);
}

/** O endereço do destino, sem o idioma (o componente de link acrescenta). */
export function hrefDe(destino: Destino): string {
  switch (destino.tipo) {
    case "aula":
      return `/trilhas/${destino.id}`;
    case "trilha":
      return `/trilhas/${destino.slug}`;
    case "ferramenta":
      return `/ferramentas/${destino.id}`;
    case "pagina":
      return destino.caminho;
  }
}

/**
 * Até três destinos para a pergunta: os da intenção que melhor casou e, se sobrar lugar, os das seguintes (sem
 * repetir). Sem casamento, a lista vem vazia e a busca fica exatamente como era.
 */
export function casar(consulta: string, intencoes: readonly Intencao[]): Destino[] {
  const destinos: Destino[] = [];
  const vistos = new Set<string>();
  for (const { intencao } of casamentos(consulta, intencoes)) {
    for (const destino of intencao.destinos) {
      const href = hrefDe(destino);
      if (vistos.has(href)) continue;
      vistos.add(href);
      destinos.push(destino);
      if (destinos.length >= MAXIMO_DE_DESTINOS) return destinos;
    }
  }
  return destinos;
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O modo sem servidor do acompanhante (Etapa 4, E4-10, R1-63, parte 1): sem conta, com o assistente desligado ou sem
// internet, a dúvida é respondida com TRECHOS DAS AULAS do próprio site, achados no índice de busca (/{lang}/indice.json,
// o mesmo da página de busca, baixado só quando a pessoa usa). Sem IA e sem servidor: nada é escrito por máquina, só
// recortado das aulas, com o link de cada uma. A busca roda no aparelho (lib/search.ts).
// Sem os atalhos "@/" de propósito: `npm run testar:acompanhante` roda este arquivo no Node.

import { buildSearch, type SearchEntry } from "../search";
import { normalize } from "../text";

export interface TrechoLocal {
  titulo: string;
  /** O endereço da aula, como está no índice (já com o idioma). */
  href: string;
  /** A trilha ou o contexto da aula. */
  contexto: string;
  /** O pedaço do texto da aula que mais casa com a dúvida, copiado como está. */
  trecho: string;
}

export const QUANTOS = 3;
const TAMANHO = 320;
/** Palavras que não ajudam a achar o trecho (as da pergunta, não as do assunto). */
const VAZIAS = new Set("a o as os um uma uns umas de do da dos das em no na nos nas por para pra com sem que qual quais como quando onde porque por que e ou se nao sim eu voce me te isso isto esse essa este esta ser estar ter fazer faz e ao aos sobre entre mais menos muito pouco nao entendi explica explique o que significa quero saber".split(" "));

/** As palavras que importam na dúvida, sem acento, sem maiúscula e sem as vazias. */
export function termosDe(pergunta: string): string[] {
  return [...new Set(normalize(pergunta).split(/[^a-z0-9]+/).filter((p) => p.length > 2 && !VAZIAS.has(p)))];
}

/**
 * O pedaço de até ~320 caracteres do texto com mais palavras da dúvida: a frase que casa melhor e as vizinhas, sem
 * cortar palavra. Nada é reescrito.
 */
export function melhorTrecho(texto: string, termos: readonly string[]): string {
  const frases = texto.replace(/\s+/g, " ").match(/[^.!?。]+[.!?。]*/g)?.map((f) => f.trim()).filter(Boolean) ?? [];
  if (!frases.length) return "";
  let melhor = 0;
  let pontos = -1;
  frases.forEach((frase, i) => {
    const n = normalize(frase);
    const p = termos.reduce((s, t) => s + (n.includes(t) ? 1 : 0), 0);
    if (p > pontos) {
      pontos = p;
      melhor = i;
    }
  });
  let trecho = frases[melhor];
  for (let i = melhor + 1; i < frases.length && trecho.length + frases[i].length + 1 <= TAMANHO; i++) trecho += ` ${frases[i]}`;
  if (trecho.length > TAMANHO) {
    const corte = trecho.lastIndexOf(" ", TAMANHO);
    trecho = `${trecho.slice(0, corte > 0 ? corte : TAMANHO)}…`;
  }
  return (melhor > 0 ? "…" : "") + trecho;
}

/** Monta a busca só com as aulas do índice (uma vez por índice). */
export function buscaDasAulas(indice: readonly SearchEntry[]) {
  const aulas = indice.filter((e) => e.kind === "aula");
  return { aulas, buscar: buildSearch(aulas) };
}

/**
 * Até 3 trechos de aulas que respondem à dúvida, com o link de cada aula. `indice` é o /indice.json já baixado (ou a
 * busca já montada, para não montar de novo a cada pergunta). Devolve [] quando nada casa: a tela então diz isso,
 * em vez de inventar.
 */
export function responderLocal(pergunta: string, indice: readonly SearchEntry[] | ReturnType<typeof buscaDasAulas>): TrechoLocal[] {
  const termos = termosDe(pergunta);
  if (!termos.length) return [];
  const busca = Array.isArray(indice) ? buscaDasAulas(indice as readonly SearchEntry[]) : (indice as ReturnType<typeof buscaDasAulas>);
  const vistos = new Set<string>();
  const achados: TrechoLocal[] = [];
  for (const { entry } of busca.buscar(termos.join(" "), 12)) {
    if (vistos.has(entry.href)) continue;
    vistos.add(entry.href);
    const trecho = melhorTrecho(entry.text, termos);
    if (!trecho) continue;
    achados.push({ titulo: entry.title, href: entry.href, contexto: entry.context, trecho });
    if (achados.length === QUANTOS) break;
  }
  return achados;
}

/** Baixa o índice do idioma (só no navegador, só quando se usa). Falhou: lista vazia. */
export async function carregarIndice(lang: string, buscar: typeof fetch = fetch): Promise<SearchEntry[]> {
  try {
    const resposta = await buscar(`/${lang}/indice.json`);
    if (!resposta.ok) return [];
    const dado = (await resposta.json()) as unknown;
    return Array.isArray(dado) ? (dado as SearchEntry[]) : [];
  } catch {
    return [];
  }
}

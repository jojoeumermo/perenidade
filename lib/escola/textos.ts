// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos de interface da Escola Lúcia Maria ficam em i18n/escola/<pacote>/{pt,en,es,fr,ru,zh}.json, completos nos 6
// idiomas (scripts/testar-textos-escola.mjs confere), fora do núcleo do i18n. O servidor importa os 6 arquivos do
// pacote, escolhe o idioma com `escolher` e passa a parte de cada componente por props: o navegador não baixa os seis.
// Componente de cliente importa daqui só tipos (import type), nunca valores: os seis JSON da base viriam junto.
// Sem os atalhos "@/" de propósito (roda no Node nos testes).

import en from "../../i18n/escola/base/en.json";
import es from "../../i18n/escola/base/es.json";
import fr from "../../i18n/escola/base/fr.json";
import pt from "../../i18n/escola/base/pt.json";
import ru from "../../i18n/escola/base/ru.json";
import zh from "../../i18n/escola/base/zh.json";

export const IDIOMAS_DA_ESCOLA = ["pt", "en", "es", "fr", "ru", "zh"] as const;
export type IdiomaDaEscola = (typeof IDIOMAS_DA_ESCOLA)[number];

/** Os 6 dicionários de um pacote; o português é a referência (o tipo vem dele). */
export type Dicionarios<T> = Record<IdiomaDaEscola, T>;

/** O dicionário do idioma pedido; idioma desconhecido cai no português. */
export function escolher<T>(dicionarios: Dicionarios<T>, lang: string): T {
  return (dicionarios as Record<string, T>)[lang] ?? dicionarios.pt;
}

/** Troca {nome} pelo valor (mesma convenção do resto do site). */
export function preencher(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));
}

/** Os textos da base da Escola (E4-01): navegação, entrada, Quem foi Lúcia Maria, abertura e páginas provisórias. */
export type TextosDaBase = typeof pt;
const BASE: Dicionarios<TextosDaBase> = { pt, en, es, fr, ru, zh };
export const textosDaBase = (lang: string): TextosDaBase => escolher(BASE, lang);

/**
 * O trecho "por que a escola existe" da abertura, COPIADO do texto publicado em /quem-somos
 * (content/paginas/quem-somos[.idioma].md): a última frase do segundo parágrafo da primeira seção ("O fundador"), a
 * que diz de onde o instituto nasce. Só tira a marcação do Markdown (negrito, itálico, links); não muda palavra.
 * Devolve null se o texto mudou de forma e a frase não foi achada (a abertura então pula o quadro, sem inventar).
 */
export function trechoDoQuemSomos(markdown: string): string | null {
  const corpo = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/, "");
  const secao = corpo.split(/^## .*$/m)[1];
  if (!secao) return null;
  const paragrafos = secao
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const paragrafo = paragrafos[1];
  if (!paragrafo) return null;
  const limpo = paragrafo
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|\*|_)(\S[^*_]*?)\1/g, "$2")
    .replace(/\s+/g, " ");
  // A última frase: depois do último ". " (ou "。" no chinês) que não fecha o parágrafo.
  const corte = Math.max(limpo.lastIndexOf(". ", limpo.length - 2), limpo.lastIndexOf("。", limpo.length - 2));
  const frase = (corte >= 0 ? limpo.slice(corte + (limpo[corte] === "。" ? 1 : 2)) : limpo).trim();
  return frase.length > 20 ? frase : null;
}

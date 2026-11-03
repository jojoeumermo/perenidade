// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A leitura guiada da Escola Lúcia Maria (E4-07, R1-44): perguntas por seção de uma obra do Acervo, escritas a partir do
// texto e marcadas "em revisão", com a indicação do trecho de referência de cada seção (onde ler, sem reproduzir o
// texto). As respostas de quem lê ficam SÓ no aparelho, em "lucia:escola:leituras" (chave reservada da Escola: entra na
// cópia de segurança que a própria pessoa baixa e sai no "apagar meus dados"). Nada vai para servidor.
// Puro e sem "@/" de propósito: `npm run testar:escola-cursos` roda este arquivo direto no Node.

import { CHAVES_DA_ESCOLA } from "./estudante";

export const CHAVE_DAS_LEITURAS = CHAVES_DA_ESCOLA.leituras;
export const MAX_RESPOSTA = 4000;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface SecaoDaLeitura {
  /** Identificador curto da seção (letras minúsculas, números e hífen). */
  id: string;
  titulo: string;
  /** Onde ler: a parte da obra e o assunto do trecho, sem copiar o texto. */
  referencia: string;
  perguntas: string[];
}

export interface LeituraGuiada {
  /** Slug da obra em content/acervo (igual ao nome do arquivo da leitura). */
  obra: string;
  titulo: string;
  /** "em-revisao" até a coordenação revisar as perguntas. */
  revisao: "em-revisao" | "revisada";
  /** Uma ou duas frases sobre como usar a leitura guiada. */
  apresentacao: string;
  secoes: SecaoDaLeitura[];
}

/** Confere uma leitura guiada. Devolve a lista de erros (vazia quando está tudo certo). */
export function validarLeitura(dado: unknown, existeObra: (slug: string) => boolean): string[] {
  if (!dado || typeof dado !== "object") return ["a leitura não é um objeto"];
  const l = dado as Partial<LeituraGuiada>;
  const erros: string[] = [];
  const texto = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  if (!texto(l.obra) || !SLUG.test(l.obra!)) erros.push(`obra inválida: ${String(l.obra)}`);
  else if (!existeObra(l.obra!)) erros.push(`obra não está no Acervo: ${l.obra}`);
  if (!texto(l.titulo)) erros.push(`falta "titulo"`);
  if (!texto(l.apresentacao)) erros.push(`falta "apresentacao"`);
  if (l.revisao !== "em-revisao" && l.revisao !== "revisada") erros.push(`"revisao" deve ser "em-revisao" ou "revisada"`);
  if (!Array.isArray(l.secoes) || l.secoes.length === 0) {
    erros.push("a leitura não tem seções");
    return erros;
  }
  const ids = new Set<string>();
  for (const [i, s] of l.secoes.entries()) {
    if (!s || typeof s !== "object") {
      erros.push(`seção ${i + 1} não é um objeto`);
      continue;
    }
    if (!texto(s.id) || !SLUG.test(s.id)) erros.push(`seção ${i + 1}: id inválido`);
    else if (ids.has(s.id)) erros.push(`seção repetida: ${s.id}`);
    ids.add(s.id);
    if (!texto(s.titulo)) erros.push(`seção ${i + 1} sem título`);
    if (!texto(s.referencia)) erros.push(`seção ${i + 1} sem trecho de referência`);
    if (!Array.isArray(s.perguntas) || s.perguntas.length === 0 || !s.perguntas.every(texto)) erros.push(`seção ${i + 1}: "perguntas" deve ser uma lista de textos`);
  }
  return erros;
}

// ───────────── Respostas no aparelho ─────────────

/** { obra: { secao: ["resposta da pergunta 1", ...] } } */
export type RespostasDasLeituras = Record<string, Record<string, string[]>>;

function lerTudo(): RespostasDasLeituras {
  try {
    const bruto = JSON.parse(globalThis.localStorage?.getItem(CHAVE_DAS_LEITURAS) ?? "{}");
    return limpar(bruto);
  } catch {
    return {};
  }
}

/** Fica só com o que tem a forma certa (o guardado pode ter sido mexido à mão ou vir de uma cópia antiga). */
export function limpar(bruto: unknown): RespostasDasLeituras {
  const saida: RespostasDasLeituras = {};
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return saida;
  for (const [obra, secoes] of Object.entries(bruto as Record<string, unknown>)) {
    if (!SLUG.test(obra) || !secoes || typeof secoes !== "object" || Array.isArray(secoes)) continue;
    const limpas: Record<string, string[]> = {};
    for (const [secao, respostas] of Object.entries(secoes as Record<string, unknown>)) {
      if (!SLUG.test(secao) || !Array.isArray(respostas)) continue;
      limpas[secao] = respostas.map((r) => (typeof r === "string" ? r.slice(0, MAX_RESPOSTA) : ""));
    }
    saida[obra] = limpas;
  }
  return saida;
}

/** As respostas guardadas de uma obra (vazio quando não há nada ou não há armazenamento). */
export function lerRespostas(obra: string): Record<string, string[]> {
  return lerTudo()[obra] ?? {};
}

/** Grava a resposta de uma pergunta. Resposta vazia apaga. Devolve false quando o aparelho não deixa guardar. */
export function gravarResposta(obra: string, secao: string, indice: number, resposta: string): boolean {
  if (!SLUG.test(obra) || !SLUG.test(secao) || !Number.isInteger(indice) || indice < 0 || indice > 50) return false;
  const tudo = lerTudo();
  const daObra = tudo[obra] ?? {};
  const lista = [...(daObra[secao] ?? [])];
  while (lista.length <= indice) lista.push("");
  lista[indice] = resposta.slice(0, MAX_RESPOSTA);
  while (lista.length && !lista[lista.length - 1].trim()) lista.pop();
  if (lista.length) daObra[secao] = lista;
  else delete daObra[secao];
  if (Object.keys(daObra).length) tudo[obra] = daObra;
  else delete tudo[obra];
  try {
    if (Object.keys(tudo).length) globalThis.localStorage.setItem(CHAVE_DAS_LEITURAS, JSON.stringify(tudo));
    else globalThis.localStorage.removeItem(CHAVE_DAS_LEITURAS);
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
    return true;
  } catch {
    return false;
  }
}

/** Apaga as respostas de uma obra, neste aparelho. */
export function apagarRespostas(obra: string): boolean {
  const tudo = lerTudo();
  if (!(obra in tudo)) return true;
  delete tudo[obra];
  try {
    if (Object.keys(tudo).length) globalThis.localStorage.setItem(CHAVE_DAS_LEITURAS, JSON.stringify(tudo));
    else globalThis.localStorage.removeItem(CHAVE_DAS_LEITURAS);
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
    return true;
  } catch {
    return false;
  }
}

/** Quantas perguntas da leitura já têm resposta. */
export function respondidas(leitura: Pick<LeituraGuiada, "secoes">, respostas: Record<string, string[]>): number {
  return leitura.secoes.reduce((soma, s) => soma + s.perguntas.filter((_, i) => (respostas[s.id]?.[i] ?? "").trim().length > 0).length, 0);
}

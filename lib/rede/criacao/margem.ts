// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, itens 33 e 34: a parte pura da margem (o rascunho coletivo e as anotações do acervo). O banco
// (supabase/migracoes/20261127-p4-criacao-coletiva.sql) guarda cada anotação com a versão da página, o começo e o fim em letras e o
// próprio trecho; quando o texto muda, a tela acha o trecho de novo aqui, no aparelho. Nada daqui fala com o servidor. Sem "@/".

/** Uma anotação como a margem precisa dela para pintar o texto. */
export interface Ancora {
  id: string;
  versao: number;
  inicio: number | null;
  fim: number | null;
  trecho: string;
}

/** Quantas vezes o trecho aparece no texto (texto puro, sem expressão regular; a mesma conta de interno.rede_p4_cc_vezes). */
export function vezes(texto: string, trecho: string): number {
  if (!trecho) return 0;
  let n = 0;
  let i = texto.indexOf(trecho);
  while (i >= 0) {
    n++;
    i = texto.indexOf(trecho, i + trecho.length);
  }
  return n;
}

/**
 * Onde a anotação está no texto de agora. Na mesma versão, onde foi feita (se o trecho ainda bate). Em outra versão, a ocorrência
 * do trecho mais perto do lugar de antes; sem nenhuma, nula (a tela mostra "o trecho mudou" e a anotação fica só na lista).
 * Comentário da página inteira (sem trecho): nulo.
 */
export function reancorar(corpo: string, a: Ancora, versaoAtual: number): { inicio: number; fim: number } | null {
  if (a.inicio == null || a.fim == null || !a.trecho) return null;
  if (a.versao === versaoAtual && corpo.slice(a.inicio, a.fim) === a.trecho) return { inicio: a.inicio, fim: a.fim };
  let melhor: number | null = null;
  let i = corpo.indexOf(a.trecho);
  while (i >= 0) {
    if (melhor === null || Math.abs(i - a.inicio) < Math.abs(melhor - a.inicio)) melhor = i;
    i = corpo.indexOf(a.trecho, i + 1);
  }
  return melhor === null ? null : { inicio: melhor, fim: melhor + a.trecho.length };
}

/** Um pedaço do texto e as anotações que caem nele (vazio = texto sem anotação). */
export interface Pedaco {
  texto: string;
  inicio: number;
  ids: string[];
}

/**
 * Corta o texto nos limites de todas as marcas, para a tela pintar cada pedaço com as anotações que caem nele (marcas que se cruzam
 * viram pedaços com mais de um id). Marcas fora do texto são ignoradas.
 */
export function pedacos(corpo: string, marcas: readonly { id: string; inicio: number; fim: number }[]): Pedaco[] {
  const validas = marcas.filter((m) => m.inicio >= 0 && m.fim > m.inicio && m.fim <= corpo.length);
  const cortes = new Set<number>([0, corpo.length]);
  for (const m of validas) {
    cortes.add(m.inicio);
    cortes.add(m.fim);
  }
  const lista = [...cortes].sort((a, b) => a - b);
  const saida: Pedaco[] = [];
  for (let k = 0; k < lista.length - 1; k++) {
    const ini = lista[k];
    const fim = lista[k + 1];
    if (fim <= ini) continue;
    saida.push({ texto: corpo.slice(ini, fim), inicio: ini, ids: validas.filter((m) => m.inicio <= ini && m.fim >= fim).map((m) => m.id) });
  }
  return saida;
}

/** Os limites de um trecho anotável: até 500 letras (o banco recusa mais), sem começar nem terminar em espaço. */
export const MAXIMO_DO_TRECHO = 500;

/**
 * Ajusta uma seleção (começo e fim em letras do texto) para o que o banco aceita: tira os espaços das pontas e recusa o vazio e o
 * que passa de 500 letras. Nula = não dá para anotar esse trecho.
 */
export function selecaoValida(corpo: string, inicio: number, fim: number): { inicio: number; fim: number; trecho: string } | null {
  let a = Math.max(0, Math.min(inicio, fim));
  let b = Math.min(corpo.length, Math.max(inicio, fim));
  while (a < b && /\s/.test(corpo[a])) a++;
  while (b > a && /\s/.test(corpo[b - 1])) b--;
  if (b <= a || b - a > MAXIMO_DO_TRECHO) return null;
  return { inicio: a, fim: b, trecho: corpo.slice(a, b) };
}

/**
 * Uma sugestão de troca precisa de um trecho que aparece UMA vez no texto (senão o banco não sabe qual trocar). Devolve o motivo
 * quando não dá ("nenhuma" ou "repetido"), ou nulo quando dá.
 */
export function trechoParaSugerir(corpo: string, trecho: string): "nenhuma" | "repetido" | null {
  const n = vezes(corpo, trecho);
  return n === 0 ? "nenhuma" : n > 1 ? "repetido" : null;
}

/** Como o texto fica se a sugestão for aceita (a mesma troca do banco: o trecho, uma vez, vira a proposta). */
export function comSugestao(corpo: string, trecho: string, proposta: string): string {
  return vezes(corpo, trecho) === 1 ? corpo.replace(trecho, () => proposta) : corpo;
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A aula em fatias (Etapa 4, R1-17): divide o texto de uma aula em partes de 3 a 5 minutos de leitura, sem mudar a
// página. A aula continua UMA página (busca, offline e link para um trecho seguem valendo); as partes só ganham marcas,
// um índice e o "Parar aqui" no navegador (components/aula/Fatias.tsx). Puro e sem os atalhos "@/": roda direto no Node
// (`npm run testar:aula-viva`).
//
// A conta de minutos é a mesma de minutesOf em lib/content.ts: 180 palavras por minuto, contadas sobre o texto sem a
// marcação. Cada fatia fica com 540 a 900 palavras (3 a 5 minutos) sempre que o texto deixa: a quebra cai de preferência
// num título (## ou ###); seção longa demais é partida entre parágrafos. Aula de até 1080 palavras (6 minutos) é uma
// fatia só: partida, ficaria com duas metades de menos de 3 minutos.

import { plainText } from "./text";

export const PALAVRAS_POR_MINUTO = 180;
export const MINIMO = 540;
export const MAXIMO = 900;
/** Até aqui a aula não é partida: duas metades ficariam abaixo do mínimo. */
export const INTEIRA = MAXIMO * 1.2;

/** Onde a fatia começa, para o navegador achar o ponto no texto montado. */
export type Ancora =
  | { tipo: "inicio" }
  /** O n-ésimo título ## ou ### da aula (contando do 0, na ordem do texto). */
  | { tipo: "titulo"; n: number }
  /** O parágrafo que começa com estas letras (minúsculas, sem acento, só letras e números). */
  | { tipo: "texto"; texto: string };

export interface Fatia {
  /** Posição do primeiro caractere da fatia no Markdown da aula. */
  inicio: number;
  /** Posição logo depois do último caractere. */
  fim: number;
  minutos: number;
  palavras: number;
  /** O primeiro título da fatia, se ela tiver um. */
  titulo: string | null;
  ancora: Ancora;
}

interface Unidade {
  inicio: number;
  fim: number;
  palavras: number;
  titulo: string | null;
  /** Índice do título (## ou ###) que abre a unidade. */
  cabecalho: number | null;
  /** Um parágrafo de texto corrido: pode abrir uma fatia no meio de uma seção. */
  ancoraDeTexto: string | null;
}

export const contarPalavras = (markdown: string) => plainText(markdown).split(" ").filter(Boolean).length;

/** As letras com que o texto começa, do jeito que o navegador também consegue calcular a partir do texto montado. */
export function letrasDoComeco(texto: string, quantas = 40): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, quantas);
}

/** O começo de um parágrafo em Markdown, sem a marcação de ênfase, código e link. */
function comecoDoParagrafo(md: string): string {
  return letrasDoComeco(
    md
      .replace(/\$\$[\s\S]*?\$\$/g, " ")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[`*_~]/g, ""),
  );
}

const TITULO = /^(#{2,3})[ \t]+(.+?)[ \t#]*$/;
const CERCA = /^[ \t]{0,3}(`{3,}|~{3,})/;

/** Quebra o Markdown em unidades: cada título abre uma, e cada linha em branco fora de bloco de código fecha a anterior. */
function unidades(md: string): Unidade[] {
  const saida: Unidade[] = [];
  const linhas = md.split("\n");
  let pos = 0;
  let cerca: string | null = null;
  let atual: { inicio: number; fim: number; titulo: string | null; cabecalho: number | null; primeira: string } | null = null;
  let titulos = 0;
  const fechar = () => {
    if (!atual) return;
    const texto = md.slice(atual.inicio, atual.fim);
    const primeira = atual.primeira.trimStart();
    // Só parágrafo de texto pode abrir fatia no meio da seção: lista, tabela, citação, imagem, fórmula ou bloco de
    // código não têm um começo de texto confiável no navegador.
    const corrido = atual.cabecalho === null && /^[\p{L}\p{N}"“'(*_]/u.test(primeira) && !/^(\d+[.)]\s|[*_-]\s|\*\*\*|---)/.test(primeira);
    const letras = corrido ? comecoDoParagrafo(primeira) : "";
    saida.push({ inicio: atual.inicio, fim: atual.fim, palavras: contarPalavras(texto), titulo: atual.titulo, cabecalho: atual.cabecalho, ancoraDeTexto: letras.length >= 12 ? letras : null });
    atual = null;
  };
  for (const linha of linhas) {
    const inicio = pos;
    const fim = pos + linha.length;
    pos = fim + 1;
    if (cerca) {
      if (atual) atual.fim = fim;
      if (linha.trim().startsWith(cerca)) cerca = null;
      continue;
    }
    const abreCerca = CERCA.exec(linha);
    if (abreCerca) {
      cerca = abreCerca[1][0].repeat(3);
      if (!atual) atual = { inicio, fim, titulo: null, cabecalho: null, primeira: linha };
      atual.fim = fim;
      continue;
    }
    const titulo = TITULO.exec(linha);
    if (titulo) {
      fechar();
      atual = { inicio, fim, titulo: titulo[2].replace(/[*_`]/g, "").trim(), cabecalho: titulos++, primeira: linha };
      continue;
    }
    if (!linha.trim()) {
      // A linha em branco logo depois de um título não fecha: o título fica junto do primeiro parágrafo dele.
      if (atual && !(atual.cabecalho !== null && md.slice(atual.inicio, atual.fim).trim().split("\n").length === 1)) fechar();
      continue;
    }
    if (!atual) atual = { inicio, fim, titulo: null, cabecalho: null, primeira: linha };
    atual.fim = fim;
  }
  fechar();
  return saida;
}

const minutosDe = (palavras: number) => Math.max(1, Math.ceil(palavras / PALAVRAS_POR_MINUTO));

/**
 * Divide a aula em fatias de 540 a 900 palavras. Aula de até 1080 palavras volta como uma fatia só (a página não muda).
 * A primeira fatia começa no começo do texto; as outras, num título ou num parágrafo de texto corrido.
 */
export function fatiar(markdown: string): Fatia[] {
  const md = markdown.replace(/\r\n?/g, "\n");
  const us = unidades(md);
  const total = us.reduce((s, u) => s + u.palavras, 0);
  if (!us.length) return [];
  const montar = (grupo: Unidade[], primeira: boolean): Fatia => {
    const palavras = grupo.reduce((s, u) => s + u.palavras, 0);
    const abre = grupo[0];
    const ancora: Ancora = primeira ? { tipo: "inicio" } : abre.cabecalho !== null ? { tipo: "titulo", n: abre.cabecalho } : { tipo: "texto", texto: abre.ancoraDeTexto ?? "" };
    return { inicio: primeira ? 0 : abre.inicio, fim: grupo[grupo.length - 1].fim, minutos: minutosDe(palavras), palavras, titulo: grupo.find((u) => u.titulo)?.titulo ?? null, ancora };
  };
  // Até 6 minutos (1080 palavras) a aula fica inteira: partida em duas, cada metade teria menos de 3 minutos.
  if (total <= INTEIRA) return [montar(us, true)];

  // O tamanho-alvo de cada fatia: o texto dividido igualmente no menor número de fatias de até 900 palavras.
  const alvo = total / Math.ceil(total / MAXIMO);
  const grupos: Unidade[][] = [[]];
  let soma = 0;
  for (const u of us) {
    const grupo = grupos[grupos.length - 1];
    const anterior = grupo[grupo.length - 1];
    // Um título sozinho no fim de uma fatia não serve: ele vai com o texto dele.
    const podeQuebrar = grupo.length > 0 && !(anterior?.cabecalho !== null && anterior?.palavras !== undefined && md.slice(anterior.inicio, anterior.fim).trim().split("\n").length === 1);
    // Quebra quando a fatia já tem o mínimo e a unidade a levaria para longe do alvo (ou acima do máximo); num título
    // de preferência, num parágrafo de texto corrido quando a seção é longa.
    const passaria = soma >= MINIMO && (soma + u.palavras / 2 > alvo || soma + u.palavras > MAXIMO);
    const quebraNoTitulo = u.cabecalho !== null && passaria;
    const quebraNoTexto = u.cabecalho === null && u.ancoraDeTexto !== null && passaria && (soma + u.palavras > MAXIMO || !us.slice(us.indexOf(u)).some((v) => v.cabecalho !== null && v.inicio - u.inicio < 2000));
    if (podeQuebrar && (quebraNoTitulo || quebraNoTexto)) {
      grupos.push([u]);
      soma = u.palavras;
    } else {
      grupo.push(u);
      soma += u.palavras;
    }
  }
  // A última ficou curta: junta com a anterior se a soma não passar do máximo; senão, puxa unidades da anterior.
  if (grupos.length > 1) {
    const ultimo = grupos[grupos.length - 1];
    const penultimo = grupos[grupos.length - 2];
    const palavras = (g: Unidade[]) => g.reduce((s, u) => s + u.palavras, 0);
    if (palavras(ultimo) < MINIMO) {
      if (palavras(ultimo) + palavras(penultimo) <= MAXIMO) {
        grupos.pop();
        penultimo.push(...ultimo);
      } else {
        while (palavras(ultimo) < MINIMO && penultimo.length > 1) {
          const candidata = penultimo[penultimo.length - 1];
          if (palavras(penultimo) - candidata.palavras < MINIMO) break;
          if (candidata.cabecalho === null && candidata.ancoraDeTexto === null) break;
          penultimo.pop();
          ultimo.unshift(candidata);
        }
      }
    }
  }
  return grupos.map((g, i) => montar(g, i === 0));
}

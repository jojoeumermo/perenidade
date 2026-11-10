// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O mosaico do ato (PLANO-ALUMIA seções 3 e 6.2; pranchas celular-modo-atos e computador-inicio): uma grade de cartões em que
// letras 5×7 desenham a palavra do ato. Cartão aceso = confirmação; quanto mais gente, mais nítida fica a palavra. O "seu" cartão
// é dourado, com anel. Lógica pura (roda no servidor, no navegador e nos testes; sem "@/" de propósito).
//
// Privacidade (LGPD art. 11: presença em ato revela opinião política, dado sensível):
//   - a grade e QUAIS cartões acendem vêm só da semente (o id do ato), nunca de quem confirmou;
//   - o mosaico recebe uma PROPORÇÃO em passos de 10 %, nunca um número de pessoas, e nada acende abaixo de 3 confirmações
//     (proporcaoDoMosaico: a mesma regra que a função do banco vai aplicar, para o número nunca sair do servidor);
//   - o cartão dourado ("você") é escolhido no aparelho de quem confirmou (cartaoDoVoce, com uma semente local) e não vai a lugar
//     nenhum: o servidor não sabe qual é, e ninguém mais o vê.

/** A fonte 5×7 (cada letra: 7 linhas de 5 colunas, "#" = parte da letra). A–Z, 0–9 e alguns sinais. */
export const FONTE_5X7: Readonly<Record<string, readonly string[]>> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
};

/** Largura de uma letra, do espaço entre palavras e do respiro entre letras, em cartões. */
export const LARGURA_DA_LETRA = 5;
export const ALTURA_DA_LETRA = 7;
export const LARGURA_DO_ESPACO = 3;

/** O mínimo de confirmações para o mosaico acender alguma coisa (PRIVACIDADE.md §8: agregado só a partir de 3). */
export const MINIMO_PARA_ACENDER = 3;
/** O denominador nunca é menor que isto: com 3 confirmações acende 10 %, não 100 %. */
export const PISO_DO_DENOMINADOR = 30;

/**
 * A palavra como o mosaico desenha: maiúsculas, sem acento (Á → A, Ç → C), só letras A–Z e espaços simples, no máximo 14
 * caracteres. É EXATAMENTE a regra do banco da F2 (PLANO-ALUMIA §5: palavra ~ '^[A-Z ]{2,14}$'): o que a tela mostra é o que o
 * banco aceita. Números e sinais viram espaço (a fonte tem os algarismos, mas a palavra do ato não usa). Vazia se não sobrar nada.
 */
export function normalizarPalavra(palavra: string): string {
  const sem = palavra
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sem.slice(0, 14).trim();
}

/** A largura (em cartões) de uma linha de texto, sem as margens. */
export function larguraDaLinha(linha: string): number {
  let largura = 0;
  for (let i = 0; i < linha.length; i++) {
    largura += linha[i] === " " ? LARGURA_DO_ESPACO : LARGURA_DA_LETRA;
    if (i < linha.length - 1) largura += 1;
  }
  return largura;
}

/**
 * Quebra a palavra em linhas que caibam em `colunas` (já contando a margem de 1 cartão de cada lado), só nos espaços. Uma
 * palavra sozinha maior que a largura fica numa linha só (a grade cresce): nunca se corta uma letra.
 */
export function quebrarEmLinhas(palavra: string, colunas?: number): string[] {
  if (!palavra) return [];
  if (!colunas) return [palavra];
  const util = colunas - 2;
  const linhas: string[] = [];
  let atual = "";
  for (const parte of palavra.split(" ")) {
    const tentativa = atual ? `${atual} ${parte}` : parte;
    if (!atual || larguraDaLinha(tentativa) <= util) atual = tentativa;
    else {
      linhas.push(atual);
      atual = parte;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export interface OpcoesDaGrade {
  /** Largura máxima da grade em cartões (com as margens). Sem ela, a palavra vai numa linha só (como no computador). */
  quebrar?: number;
}

export interface Grade {
  colunas: number;
  linhas: number;
  /** Para cada cartão (linha a linha), se ele faz parte de uma letra. */
  letra: boolean[];
  /** A palavra já normalizada, e em quantas linhas ela foi desenhada. */
  palavra: string;
  linhasDeTexto: string[];
}

/**
 * A grade da palavra: 1 cartão de margem em volta, 1 linha de cartões entre as linhas de texto, cada linha centralizada.
 * "PASSE LIVRE" com quebrar = 31 dá 31 × 17 (a prancha do celular); sem quebrar, 65 × 9 (a do computador).
 */
export function gradeDaPalavra(palavra: string, opcoes: OpcoesDaGrade = {}): Grade {
  const limpa = normalizarPalavra(palavra);
  const linhasDeTexto = quebrarEmLinhas(limpa, opcoes.quebrar);
  const larguras = linhasDeTexto.map(larguraDaLinha);
  const util = Math.max(0, ...larguras, opcoes.quebrar ? opcoes.quebrar - 2 : 0);
  const colunas = Math.max(util + 2, 3);
  const n = linhasDeTexto.length;
  const linhas = n === 0 ? ALTURA_DA_LETRA + 2 : n * ALTURA_DA_LETRA + (n - 1) + 2;
  const letra = new Array<boolean>(colunas * linhas).fill(false);
  linhasDeTexto.forEach((texto, i) => {
    const topo = 1 + i * (ALTURA_DA_LETRA + 1);
    let x = 1 + Math.floor((util - larguras[i]) / 2);
    for (const ch of texto) {
      const glifo = FONTE_5X7[ch];
      if (ch === " " || !glifo) {
        x += (ch === " " ? LARGURA_DO_ESPACO : LARGURA_DA_LETRA) + 1;
        continue;
      }
      for (let y = 0; y < ALTURA_DA_LETRA; y++) {
        for (let c = 0; c < LARGURA_DA_LETRA; c++) if (glifo[y][c] === "#") letra[(topo + y) * colunas + x + c] = true;
      }
      x += LARGURA_DA_LETRA + 1;
    }
  });
  return { colunas, linhas, letra, palavra: limpa, linhasDeTexto };
}

/** Uma semente de 32 bits a partir de um texto (FNV-1a). Mesma entrada, mesma semente, em qualquer aparelho. */
export function sementeDe(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Um gerador pseudoaleatório pequeno e determinístico (mulberry32): mesma semente, mesma sequência. */
export function gerador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A proporção acesa a partir das confirmações, como o servidor calcula (a tela nunca recebe o número): nulo abaixo de 3;
 * senão, confirmados ÷ max(30, meta), arredondado PARA BAIXO em passos de 10 %, entre 10 % e 100 %.
 */
export function proporcaoDoMosaico(confirmados: number | null | undefined, meta?: number | null): number | null {
  if (confirmados === null || confirmados === undefined || !Number.isFinite(confirmados) || confirmados < MINIMO_PARA_ACENDER) return null;
  const denominador = Math.max(PISO_DO_DENOMINADOR, meta && Number.isFinite(meta) && meta > 0 ? Math.floor(meta) : 0);
  const passos = Math.floor((Math.floor(confirmados) / denominador) * 10);
  return Math.min(10, Math.max(1, passos)) / 10;
}

/** Aceita só proporções em passos de 10 % (0,1 … 1); qualquer outra coisa (inclusive um número de pessoas) vira nulo. */
export function proporcaoValida(p: number | null | undefined): number | null {
  if (p === null || p === undefined || !Number.isFinite(p)) return null;
  const passos = Math.round(p * 10);
  if (passos < 1 || passos > 10 || Math.abs(p * 10 - passos) > 1e-6) return null;
  return passos / 10;
}

/**
 * Quais cartões estão acesos: a ordem vem SÓ da semente (embaralhamento determinístico); acendem os primeiros
 * ceil(proporção × total). Letra e fundo acendem na mesma proporção, e por isso a palavra fica mais nítida com mais gente.
 */
export function cartoesAcesos(grade: Grade, semente: number, proporcao: number | null): boolean[] {
  const total = grade.colunas * grade.linhas;
  const acesos = new Array<boolean>(total).fill(false);
  const p = proporcaoValida(proporcao);
  if (p === null) return acesos;
  const ordem = Array.from({ length: total }, (_, i) => i);
  const sorte = gerador(semente);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(sorte() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  const quantos = Math.ceil(p * total);
  for (let k = 0; k < quantos; k++) acesos[ordem[k]] = true;
  return acesos;
}

/**
 * O cartão dourado de quem confirmou: um cartão aceso escolhido com uma semente DO APARELHO (sementeLocal), para que a posição
 * não diga nada a ninguém. Com `letra` (a grade da palavra), escolhe só entre os acesos FORA da palavra, para não apagar um pixel
 * dela; só cai num cartão de letra quando todo aceso é de letra. Nulo se nada está aceso.
 */
export function cartaoDoVoce(acesos: readonly boolean[], sementeLocal: number, letra?: readonly boolean[]): number | null {
  const todos: number[] = [];
  acesos.forEach((aceso, i) => aceso && todos.push(i));
  const foraDaPalavra = letra ? todos.filter((i) => !letra[i]) : todos;
  const candidatos = foraDaPalavra.length ? foraDaPalavra : todos;
  if (candidatos.length === 0) return null;
  return candidatos[Math.floor(gerador(sementeLocal)() * candidatos.length)];
}

export type TipoDoCartao = "aceso" | "apagado" | "letra-acesa" | "letra-apagada" | "voce";

export interface Mosaico {
  colunas: number;
  linhas: number;
  cartoes: TipoDoCartao[];
  palavra: string;
  proporcao: number | null;
}

/** Tudo junto: a grade da palavra, os acesos pela semente do ato e, se a pessoa confirmou, o cartão dourado dela. */
export function montarMosaico(
  palavra: string,
  semente: string,
  proporcao: number | null,
  opcoes: OpcoesDaGrade & { voce?: boolean; sementeLocal?: string } = {},
): Mosaico {
  const grade = gradeDaPalavra(palavra, opcoes);
  const p = proporcaoValida(proporcao);
  const acesos = cartoesAcesos(grade, sementeDe(semente), p);
  const voce = opcoes.voce ? cartaoDoVoce(acesos, sementeDe(`${opcoes.sementeLocal ?? ""}:${semente}:voce`), grade.letra) : null;
  const cartoes = grade.letra.map<TipoDoCartao>((letra, i) =>
    i === voce ? "voce" : letra ? (acesos[i] ? "letra-acesa" : "letra-apagada") : acesos[i] ? "aceso" : "apagado",
  );
  return { colunas: grade.colunas, linhas: grade.linhas, cartoes, palavra: grade.palavra, proporcao: p };
}

/** As cores do rosto 4×4 (Avatar16): 0 vazio, 1 papel, 2 cor da pessoa/comunidade, 3 vermelho, 4 cinza noite. */
export type CorDoAvatar = 0 | 1 | 2 | 3 | 4;

/**
 * O rosto de 16 cartões (4 × 4) de um perfil, só a partir do @nome (nunca de foto nem de dado da pessoa): o mesmo @nome dá
 * sempre o mesmo desenho. Pelo menos 9 cartões cheios e as 4 cores aparecem misturadas, como nas pranchas.
 */
export function celulasDoAvatar(semente: string): CorDoAvatar[] {
  const sorte = gerador(sementeDe(`avatar:${semente}`));
  const celulas: CorDoAvatar[] = [];
  for (let i = 0; i < 16; i++) {
    const r = sorte();
    celulas.push(r < 0.18 ? 0 : r < 0.42 ? 1 : r < 0.7 ? 2 : r < 0.86 ? 3 : 4);
  }
  // Garante corpo: no mínimo 9 cartões cheios, preenchendo os vazios a partir de um ponto tirado da semente.
  let cheios = celulas.filter((c) => c !== 0).length;
  const inicio = Math.floor(sorte() * 16);
  for (let passo = 0; cheios < 9 && passo < 16; passo++) {
    const k = (inicio + passo * 5) % 16;
    if (celulas[k] === 0) {
      celulas[k] = (1 + Math.floor(sorte() * 3)) as CorDoAvatar;
      cheios++;
    }
  }
  return celulas;
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O desenho automático de cada codinome (P5, A2): no lugar do mosaico de 16 cartões ao acaso, um desenho com identidade em
// 12 × 12 ladrilhos. Quase metade dos codinomes ganha um símbolo (foice e martelo, estrela, o A da anarquia, a bandeira
// anarcocomunista, o punho, o rosto de Marx, a raposa, o gato, a rosa, o livro, o lampião, o megafone…), em cinco cores, espelhado
// ou não, com o acento vermelho ou dourado; os outros ganham um rosto montado de peças (pele, cabelo, cor do cabelo, olhos, boca,
// barba, roupa), milhares de combinações. Todos os desenhos são do próprio projeto (AGPL, como o resto): nada de imagem de fora.
//
// O mesmo codinome dá sempre o mesmo desenho (sai da semente, como o mosaico de antes), no aparelho: nada vai a servidor nenhum.
// Quem quiser outra coisa pinta o próprio rosto em "Editar perfil" ou escolhe aparecer com foto; isso continua igual.
// Lógica pura (roda no servidor, no navegador e nos testes; sem "@/" de propósito).
import { gerador, sementeDe } from "./mosaico";

/** O desenho tem 12 × 12 ladrilhos. */
export const LADO_DO_DESENHO = 12;

/**
 * As tintas de um desenho: o fundo, a tinta escura, o claro, o vermelho, o dourado e quatro tons de pele.
 * Quem desenha na tela (Avatar16, a entrada) traduz cada tinta para a cor (coresDoDesenho).
 */
export type Tinta = "fundo" | "tinta" | "claro" | "vermelho" | "dourado" | "pele1" | "pele2" | "pele3" | "pele4";

const LETRAS: Readonly<Record<string, Tinta>> = {
  ".": "fundo", "#": "tinta", o: "claro", r: "vermelho", d: "dourado", "1": "pele1", "2": "pele2", "3": "pele3", "4": "pele4",
};

/**
 * Os símbolos, em 12 linhas de 12 letras: "." fundo, "#" tinta, "o" claro, "r" vermelho, "d" dourado. Desenhados aqui, no
 * próprio projeto. A bandeira anarcocomunista sai de uma regra (a diagonal), não de letras.
 */
export const SIMBOLOS: Readonly<Record<string, readonly string[]>> = {
  "foice-e-martelo": [
    ".......##...",
    "..##.....##.",
    ".###......#.",
    "####......##",
    ".####......#",
    "..#.#.....##",
    ".....#...##.",
    "......#.##..",
    "......###...",
    "..#####.#...",
    ".##......#..",
    "##........#.",
  ],
  estrela: [
    ".....rr.....",
    ".....rr.....",
    "....rrrr....",
    "....rrrr....",
    "rrrrrrrrrrrr",
    ".rrrrrrrrrr.",
    "..rrrrrrrr..",
    "...rrrrrr...",
    "...rrrrrr...",
    "..rrrr.rrrr.",
    "..rrr...rrr.",
    ".rr......rr.",
  ],
  anarquia: [
    "...######...",
    "..#..##..#..",
    ".#..####..#.",
    "#...#..#...#",
    "#..##..##..#",
    "#..#....#..#",
    "#.########.#",
    "#.#......#.#",
    "#.#......#.#",
    ".##......##.",
    "..##....##..",
    "...######...",
  ],
  punho: [
    "............",
    "..##.##.##..",
    ".#oo#oo#oo#.",
    ".#oo#oo#oo#.",
    ".#oo#oo#oo##",
    ".#########o#",
    ".#ooooooo#o#",
    "..#oooooo#o#",
    "..#ooooooo#.",
    "...#ooooo#..",
    "...#ooooo#..",
    "...#ooooo#..",
  ],
  marx: [
    "..oooooooo..",
    ".oo111111oo.",
    "oo11111111oo",
    "oo1#1111#1oo",
    "oo11111111oo",
    "oo1oo11oo1oo",
    "oooooooooooo",
    "oooooooooooo",
    ".oooooooooo.",
    ".oooooooooo.",
    "..oooooooo..",
    "...oooooo...",
  ],
  raposa: [
    ".#........#.",
    ".##......##.",
    ".#r#....#r#.",
    ".#rr####rr#.",
    ".#rrrrrrrr#.",
    "#rr#rrrr#rr#",
    "#rrrrrrrrrr#",
    "#oorrrrrroo#",
    ".#oooooooo#.",
    "..#oooooo#..",
    "...#o##o#...",
    "....####....",
  ],
  gato: [
    "#..........#",
    "##........##",
    "#o#......#o#",
    "#oo######oo#",
    "#oooooooooo#",
    "#o##oooo##o#",
    "#oooooooooo#",
    "#oooorroooo#",
    "#oo#o##o#oo#",
    ".#oooooooo#.",
    "..#oooooo#..",
    "...######...",
  ],
  rosa: [
    "....rrrr....",
    "..rrr##rrr..",
    ".rr#rrrr#rr.",
    ".rr#r##r#rr.",
    ".rrr#rr#rrr.",
    "..rrr##rrr..",
    "....r##r....",
    ".....##.....",
    ".##..##.....",
    ".###.##.....",
    "..##.##.....",
    ".....##.....",
  ],
  livro: [
    "............",
    "............",
    ".##......##.",
    "#oo##..##oo#",
    "#oooo##oooo#",
    "#o##o##o##o#",
    "#oooo##oooo#",
    "#o##o##o##o#",
    "#oooo##oooo#",
    "##ooo##ooo##",
    ".###.##.###.",
    ".....##.....",
  ],
  lampiao: [
    "....####....",
    "...#....#...",
    "....####....",
    "...######...",
    "..#oooooo#..",
    "..#oorroo#..",
    "..#orrdro#..",
    "..#orddro#..",
    "..#oorroo#..",
    "..#oooooo#..",
    "...######...",
    "..########..",
  ],
  sol: [
    ".....dd.....",
    ".d...dd...d.",
    "..d......d..",
    "....dddd....",
    "...dddddd...",
    "dd.dd#d#dd.d",
    "dd.dddddd.dd",
    "...dd##dd...",
    "....dddd....",
    "..d......d..",
    ".d...dd...d.",
    ".....dd.....",
  ],
  lua: [
    "....oooo....",
    "..oooo......",
    ".ooo........",
    ".oo......d..",
    "ooo.....ddd.",
    "oo.......d..",
    "oo..........",
    "ooo.........",
    ".oo.........",
    ".ooo....o...",
    "..oooo......",
    "....oooo....",
  ],
  coracao: [
    "............",
    "..###..###..",
    ".#rrr##rrr#.",
    "#rorrrrrrrr#",
    "#orrrrrrrrr#",
    "#rrrrrrrrrr#",
    ".#rrrrrrrr#.",
    "..#rrrrrr#..",
    "...#rrrr#...",
    "....#rr#....",
    ".....##.....",
    "............",
  ],
  arvore: [
    "....####....",
    "..##oo####..",
    ".##o#######.",
    ".##########.",
    "############",
    "############",
    ".##########.",
    "..###oo###..",
    ".....oo.....",
    ".....oo.....",
    "....oooo....",
    "..oooooooo..",
  ],
  engrenagem: [
    ".....##.....",
    "..#.####.#..",
    ".##########.",
    "..###..###..",
    ".###....###.",
    "####....####",
    "####....####",
    ".###....###.",
    "..###..###..",
    ".##########.",
    "..#.####.#..",
    ".....##.....",
  ],
  megafone: [
    "............",
    ".........##.",
    "........#o#.",
    ".......#oo#.",
    "..####.#oo#r",
    ".#oooo#ooo#.",
    ".#oooo#ooo#r",
    "..####.#oo#.",
    "...#...#oo#r",
    "...##...#o#.",
    "....#....##.",
    "............",
  ],
  coruja: [
    ".#........#.",
    ".##......##.",
    ".##########.",
    "#oo##oo##oo#",
    "#o#d#oo#d#o#",
    "#oo##oo##oo#",
    ".####dd####.",
    ".###.dd.###.",
    ".##########.",
    ".###.##.###.",
    "..########..",
    "...d....d...",
  ],
  trigo: [
    ".....dd.....",
    "....d##d....",
    "...dd##dd...",
    "....d##d....",
    "...dd##dd...",
    "....d##d....",
    "...dd##dd...",
    "....d##d....",
    ".....##.....",
    ".....##.....",
    "....r##r....",
    ".....##.....",
  ],
  pomba: [
    "............",
    "......##....",
    ".....#oo#...",
    "....#o#oo#d.",
    "...#ooooo#..",
    "..#oooooo#..",
    ".#ooooooo#..",
    "#oooooooo#..",
    ".##oooooo##.",
    "...##ooo#oo#",
    ".....###.##.",
    "............",
  ],
  cacto: [
    ".....##.....",
    "....#oo#....",
    "....#oo#.##.",
    ".##.#oo##oo#",
    "#oo##oo#oo#.",
    ".#oo#oo##o#.",
    "..#ooooo##..",
    "....#oo#....",
    "....#oo#....",
    "..rrrrrrrr..",
    "...rrrrrr...",
    "...rrrrrr...",
  ],
};

/** A bandeira anarcocomunista: preta em cima, vermelha embaixo, cortada na diagonal. */
function bandeiraAnarcocomunista(): string[] {
  return Array.from({ length: LADO_DO_DESENHO }, (_, y) =>
    Array.from({ length: LADO_DO_DESENHO }, (_, x) => (x + y < LADO_DO_DESENHO - 1 ? "#" : "r")).join(""),
  );
}

const TODOS_OS_SIMBOLOS: Readonly<Record<string, readonly string[]>> = { ...SIMBOLOS, anarcocomunista: bandeiraAnarcocomunista() };
/** Os nomes dos símbolos, em ordem fixa (a ordem entra no sorteio: não reordenar sem querer mudar os desenhos de todo mundo). */
export const NOMES_DOS_SIMBOLOS = Object.keys(TODOS_OS_SIMBOLOS);

// ─────────────────────────────── os rostos montados de peças ───────────────────────────────

/** A cabeça: as colunas ocupadas em cada linha (de, até). Linha 10 é o pescoço, linha 11 os ombros. */
const CABECA: Readonly<Record<number, readonly [number, number]>> = { 1: [4, 7], 2: [3, 8], 3: [2, 9], 4: [2, 9], 5: [2, 9], 6: [2, 9], 7: [2, 9], 8: [3, 8], 9: [4, 7] };
export const PELES = ["pele1", "pele2", "pele3", "pele4"] as const;
const CABELOS = ["careca", "curto", "black", "longo", "coque", "boina", "lenco", "franja"] as const;
const CORES_DO_CABELO = ["tinta", "tinta", "dourado", "vermelho", "claro"] as const;
const OLHOS = ["pontos", "fechados", "oculos"] as const;
const BOCAS = ["sorriso", "reta", "grito"] as const;
const BARBAS = ["nenhuma", "nenhuma", "bigode", "barba"] as const;
const ROUPAS = ["vermelho", "tinta", "claro"] as const;

/** Quantos rostos diferentes as peças montam. */
export const QUANTOS_ROSTOS = PELES.length * CABELOS.length * CORES_DO_CABELO.length * OLHOS.length * BOCAS.length * BARBAS.length * ROUPAS.length;

type Grade = Tinta[];

function rosto(sorte: () => number): Grade {
  const pega = <T,>(lista: readonly T[]): T => lista[Math.floor(sorte() * lista.length)];
  const pele = pega(PELES);
  const cabelo = pega(CABELOS);
  const corDoCabelo = pega(CORES_DO_CABELO);
  const olhos = pega(OLHOS);
  const boca = pega(BOCAS);
  const barba = pega(BARBAS);
  const roupa = pega(ROUPAS);
  const g: Grade = Array.from({ length: LADO_DO_DESENHO * LADO_DO_DESENHO }, () => "fundo");
  const p = (x: number, y: number, t: Tinta) => {
    if (x >= 0 && x < LADO_DO_DESENHO && y >= 0 && y < LADO_DO_DESENHO) g[y * LADO_DO_DESENHO + x] = t;
  };
  const linha = (y: number, de: number, ate: number, t: Tinta) => {
    for (let x = de; x <= ate; x++) p(x, y, t);
  };
  // Atrás da cabeça: o black power (uma nuvem grande) e o cabelo comprido (caindo dos lados).
  if (cabelo === "black") {
    linha(0, 2, 9, corDoCabelo);
    linha(1, 1, 10, corDoCabelo);
    for (let y = 2; y <= 6; y++) linha(y, 0, 11, corDoCabelo);
    linha(7, 1, 10, corDoCabelo);
  }
  if (cabelo === "longo") for (let y = 3; y <= 10; y++) { linha(y, 1, 2, corDoCabelo); linha(y, 9, 10, corDoCabelo); }
  // Ombros, pescoço e cabeça.
  linha(11, 1, 10, roupa);
  linha(10, 5, 6, pele);
  for (const [y, [de, ate]] of Object.entries(CABECA)) linha(Number(y), de, ate, pele);
  // Cabelo por cima.
  if (cabelo === "curto" || cabelo === "black" || cabelo === "longo" || cabelo === "coque" || cabelo === "franja") {
    linha(1, 4, 7, corDoCabelo);
    linha(2, 3, 8, corDoCabelo);
    p(2, 3, corDoCabelo);
    p(9, 3, corDoCabelo);
  }
  if (cabelo === "franja") linha(3, 2, 7, corDoCabelo);
  if (cabelo === "coque") { linha(0, 5, 6, corDoCabelo); p(4, 0, corDoCabelo); p(7, 0, corDoCabelo); }
  if (cabelo === "boina") {
    linha(0, 3, 9, "tinta");
    linha(1, 2, 9, "tinta");
    linha(2, 2, 9, "tinta");
    p(6, 1, "vermelho");
  }
  if (cabelo === "lenco") {
    linha(2, 2, 9, "vermelho");
    linha(1, 4, 7, "vermelho");
    p(10, 3, "vermelho");
    p(10, 4, "vermelho");
  }
  // Olhos.
  // Os olhos levam o branco ao lado da menina dos olhos: em toda pele o olho se lê (o preto sozinho some na pele escura).
  if (olhos === "pontos") { p(3, 5, "claro"); p(4, 5, "tinta"); p(7, 5, "tinta"); p(8, 5, "claro"); }
  if (olhos === "fechados") { linha(5, 3, 4, "tinta"); linha(5, 7, 8, "tinta"); linha(4, 3, 4, "claro"); linha(4, 7, 8, "claro"); }
  if (olhos === "oculos") { linha(5, 3, 8, "tinta"); p(4, 5, "claro"); p(7, 5, "claro"); }
  // Barba antes da boca (a boca fica por cima).
  if (barba === "barba") { linha(7, 2, 9, corDoCabelo); linha(8, 3, 8, corDoCabelo); linha(9, 4, 7, corDoCabelo); }
  if (barba === "bigode" || barba === "barba") linha(7, 4, 7, corDoCabelo === "tinta" ? "tinta" : corDoCabelo);
  // Boca.
  // A boca em vermelho (aparece em toda pele e por cima da barba).
  if (boca === "sorriso") { p(4, 7, "vermelho"); p(7, 7, "vermelho"); linha(8, 5, 6, "vermelho"); }
  if (boca === "reta") linha(8, 4, 7, "vermelho");
  if (boca === "grito") { linha(7, 5, 6, "vermelho"); linha(8, 5, 6, "vermelho"); }
  return g;
}

// ─────────────────────────────── o desenho de um codinome ───────────────────────────────

export interface Desenho {
  /** O que é ("raposa", "rosto"…): só para o teste e para quem lê o código. */
  nome: string;
  /** 144 tintas, linha por linha. */
  grade: Tinta[];
  /** A cor própria (1 a 5, as cores das comunidades) que pinta o fundo (ou a tinta, no invertido). */
  cor: 1 | 2 | 3 | 4 | 5;
  /** Invertido: fundo escuro e o desenho na cor própria (só nos símbolos). */
  invertido: boolean;
}

function lerSimbolo(linhas: readonly string[], espelhado: boolean, trocaAcento: boolean): Grade {
  const g: Grade = [];
  for (const l of linhas) {
    const letras = espelhado ? [...l].reverse() : [...l];
    for (const c of letras) {
      const t = LETRAS[c] ?? "fundo";
      // A troca do acento: o vermelho vira dourado e o dourado vira vermelho (a estrela dourada, a rosa dourada, o sol vermelho).
      g.push(trocaAcento && t === "vermelho" ? "dourado" : trocaAcento && t === "dourado" ? "vermelho" : t);
    }
  }
  return g;
}

/**
 * O desenho de um codinome (ou @nome). Sem nada que sirva, o desenho do vazio (a semente "" dá sempre o mesmo). A ordem dos
 * sorteios é fixa: mudar a ordem muda o desenho de todo mundo.
 */
export function desenhoDe(semente: string): Desenho {
  const sorte = gerador(sementeDe(`desenho:${semente}`));
  const cor = (1 + Math.floor(sorte() * 5)) as Desenho["cor"];
  if (sorte() < 0.45) {
    const nome = NOMES_DOS_SIMBOLOS[Math.floor(sorte() * NOMES_DOS_SIMBOLOS.length)];
    const espelhado = sorte() < 0.5 && nome !== "anarquia" && nome !== "marx";
    const invertido = sorte() < 0.4;
    // A bandeira anarcocomunista fica sempre vermelha e preta.
    const trocaAcento = sorte() < 0.35 && nome !== "anarcocomunista";
    return { nome, grade: lerSimbolo(TODOS_OS_SIMBOLOS[nome], espelhado, trocaAcento), cor, invertido };
  }
  return { nome: "rosto", grade: rosto(sorte), cor, invertido: false };
}

/** As cores de verdade (hexadecimal) de um desenho: as cinco cores das comunidades, a noite, o creme, o vermelho e o dourado. */
export const COR_PROPRIA = ["#1fc2b5", "#ff5c8a", "#ff8a1f", "#5b8cff", "#a27bff"] as const;
const FIXAS: Readonly<Record<Exclude<Tinta, "fundo" | "tinta">, string>> = {
  claro: "#f3efe6", vermelho: "#e8321f", dourado: "#ffc21a", pele1: "#f1c7a0", pele2: "#d39a6a", pele3: "#a8714a", pele4: "#6e4529",
};
export const NOITE_DO_DESENHO = "#141211";

/**
 * Traduz as tintas para cores. `propria` é a cor de fundo (ou a do desenho, no invertido): um hexadecimal ou uma variável CSS.
 */
export function corDaTinta(t: Tinta, propria: string, invertido: boolean): string {
  if (t === "fundo") return invertido ? NOITE_DO_DESENHO : propria;
  if (t === "tinta") return invertido ? propria : NOITE_DO_DESENHO;
  return FIXAS[t];
}

/** O desenho como cores (144, linha por linha), com a cor própria em hexadecimal. */
export function coresDoDesenho(semente: string): string[] {
  const d = desenhoDe(semente);
  return d.grade.map((t) => corDaTinta(t, COR_PROPRIA[d.cor - 1], d.invertido));
}

/**
 * O desenho em caminhos SVG, uma cor por caminho (para o Avatar16 não desenhar 144 retângulos por rosto). Cada ladrilho é um
 * quadrado 1 × 1 no espaço 0–12; os ladrilhos seguidos de uma linha viram um só retângulo.
 */
export function caminhosDoDesenho(grade: readonly Tinta[]): { tinta: Tinta; d: string }[] {
  const porTinta = new Map<Tinta, string[]>();
  for (let y = 0; y < LADO_DO_DESENHO; y++) {
    let x = 0;
    while (x < LADO_DO_DESENHO) {
      const t = grade[y * LADO_DO_DESENHO + x];
      let fim = x + 1;
      while (fim < LADO_DO_DESENHO && grade[y * LADO_DO_DESENHO + fim] === t) fim++;
      if (t !== "fundo") {
        const lista = porTinta.get(t) ?? [];
        lista.push(`M${x} ${y}h${fim - x}v1h${x - fim}z`);
        porTinta.set(t, lista);
      }
      x = fim;
    }
  }
  return [...porTinta].map(([tinta, partes]) => ({ tinta, d: partes.join("") }));
}

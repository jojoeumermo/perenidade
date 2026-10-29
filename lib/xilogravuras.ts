// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/**
 * As vinhetas de xilogravura do lambe-lambe: uma por dia, do tamanho de um selo (120 × 40), como o enfeite que fecha um
 * folheto de cordel. Cada uma junta um motivo do Brasil inteiro e da América Latina (mandacaru, araucária, buriti, jangada,
 * triângulo do forró, cuia de chimarrão, lhama, casario de morro...) com um céu e um chão; nenhuma combinação se repete no ano.
 * Silhueta chapada na cor do texto, com os sulcos do entalhe recortados (regra evenodd), como a matriz de madeira.
 */

const r = (n: number) => Math.round(n * 100) / 100;

/** Estrela de cinco pontas como subcaminho. */
function estrela(cx: number, cy: number, raio: number, interno = 0.42): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 === 0 ? raio : raio * interno;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${r(cx + rr * Math.cos(a))} ${r(cy + rr * Math.sin(a))}`;
  });
  return `M${pts.join(" L")} Z`;
}

/** Círculo como subcaminho (para recortar e somar no mesmo caminho). */
const circ = (cx: number, cy: number, raio: number) => `M${r(cx - raio)} ${r(cy)} a${raio} ${raio} 0 1 0 ${r(2 * raio)} 0 a${raio} ${raio} 0 1 0 ${r(-2 * raio)} 0 Z`;
const ret = (x: number, y: number, w: number, h: number) => `M${x} ${y} h${w} v${h} h${-w} Z`;
/** Raios em volta de um centro, como os do sol de cordel: n triângulos finos entre os ângulos de início e fim. */
function raios(cx: number, cy: number, de: number, ate: number, n: number, inicio = 0, fim = 2 * Math.PI, meia = 0.12): string {
  const volta = fim - inicio >= 2 * Math.PI - 1e-6;
  const passo = volta ? (fim - inicio) / n : (fim - inicio) / Math.max(n - 1, 1);
  return Array.from({ length: n }, (_, i) => {
    const a = inicio + i * passo;
    const ax = cx + de * Math.cos(a - meia);
    const ay = cy + de * Math.sin(a - meia);
    const bx = cx + de * Math.cos(a + meia);
    const by = cy + de * Math.sin(a + meia);
    return `M${r(ax)} ${r(ay)} L${r(cx + ate * Math.cos(a))} ${r(cy + ate * Math.sin(a))} L${r(bx)} ${r(by)} Z`;
  }).join(" ");
}
/** Leque de folhas: cada lâmina sai fina do centro e abre por fora, como a palma do buriti. */
function leque(cx: number, cy: number, raio: number, n: number, inicio: number, fim: number, meia = 0.08): string {
  const passo = (fim - inicio) / Math.max(n - 1, 1);
  return Array.from({ length: n }, (_, i) => {
    const a = inicio + i * passo;
    return `M${r(cx)} ${r(cy)} L${r(cx + raio * Math.cos(a - meia))} ${r(cy + raio * Math.sin(a - meia))} L${r(cx + raio * 1.06 * Math.cos(a))} ${r(cy + raio * 1.06 * Math.sin(a))} L${r(cx + raio * Math.cos(a + meia))} ${r(cy + raio * Math.sin(a + meia))} Z`;
  }).join(" ");
}
const p = (d: string) => `<path fill-rule="evenodd" d="${d}"/>`;

/** Os motivos principais, no lado esquerdo do selo (x de 14 a 62, chão em y ≈ 36). */
export const MOTIVOS: Record<string, string> = {
  // Sertão
  mandacaru: p("M30 38 V16 Q30 12 34 12 Q38 12 38 16 V38 Z M30 30 H24 V22 Q24 19 27 19 Q30 19 30 22 Z M38 26 H44 V20 Q44 17 47 17 Q50 17 50 20 V30 H38 Z M33.4 16 h1.2 v20 h-1.2 Z M26.4 22 h1.2 v6 h-1.2 Z M46.4 20 h1.2 v6 h-1.2 Z"),
  carcara: p(`M37 16 Q30 13 22 14 L14 11 L19 15 L13 16 L19 18 L14 21 L22 19 Q30 19 34 21 L33 27 L37 31 L41 27 L40 21 Q44 19 52 19 L60 21 L55 18 L61 16 L55 15 L60 11 L52 14 Q44 13 37 16 Z ${circ(37, 15.4, 2.6)} M35.6 13 L37 10.6 L38.4 13 Z`),
  chapeu: p(`M16 31 Q37 3 58 31 Q37 23 16 31 Z ${estrela(37, 19, 3.6)} ${circ(28, 23, 1.2)} ${circ(46, 23, 1.2)} M16 31 Q37 27 58 31 V33 Q37 29 16 33 Z`),
  lamparina: p("M24 36 h24 l-3 -6 h-18 Z M30 30 q6 -10 12 0 Z M35.2 22 h1.6 v-4 h-1.6 Z M36 6 q5 6 0 11 q-5 -5 0 -11 Z"),
  // Litoral e rios
  coqueiro: p(`M40 37 C40 29 38 21 34 13 L36.4 12.4 C40.4 20.4 42.6 28.4 43.4 37 Z M35 13 Q25 8 16 15 Q26 10.6 35 14.4 Z M35 13 Q30 3 21 3 Q30 6.4 35 13 Z M35 13 Q42 3 51 5 Q42 6.6 35 13 Z M35 13 Q47 9 54 17 Q45 11.6 35 14.4 Z ${circ(34, 15.6, 1.6)} ${circ(37.4, 15.4, 1.6)}`),
  jangada: p("M16 33 H56 L52 36.4 H20 Z M34.6 33 V7 H36.4 V33 Z M37.4 8 L53 30.4 H37.4 Z M40 16 L45 23.4 H40 Z"),
  canoa: p(`M14 32 Q36 39 60 32 Q36 35.6 14 32 Z ${circ(34, 21, 2.4)} M31 24 h6 l1.4 8 h-8.8 Z M44 15 L29 36 L30.4 36.8 L45.4 15.8 Z`),
  peixe: p(`M16 24 Q30 13 45 24 Q30 35 16 24 Z M45 24 L54 17 L51.6 24 L54 31 Z ${circ(22.4, 22.4, 1.1)} M30 18.6 q3 5.4 0 10.8 h1.4 q3 -5.4 0 -10.8 Z M35 19.6 q2.4 4.4 0 8.8 h1.3 q2.4 -4.4 0 -8.8 Z`),
  vitoria: p("M12 33 Q24 28 36 33 Q24 37 12 33 Z M24 33 L24 30 Z M38 31 Q50 26 62 31 Q50 35 38 31 Z M50 31 L50 28 Z M33 28 q4 -12 8 0 q-4 -3 -8 0 Z M31 27 q-2 -8 4 -9 q-3 4 -4 9 Z M43 27 q2 -8 -4 -9 q3 4 4 9 Z"),
  // Cerrado, Pantanal, Norte
  buriti: p(`M37.3 37 V13 H39.9 V37 Z M37.3 18 h2.6 v0.9 h-2.6 Z M37.3 24 h2.6 v0.9 h-2.6 Z M37.3 30 h2.6 v0.9 h-2.6 Z ${leque(38.6, 13, 13, 9, Math.PI * 1.06, Math.PI * 1.94, 0.1)}`),
  ipe: p(`M37 37 L37 26 L33 20 L35 19 L38 24 L41 18 L43 19 L39 26 L39 37 Z ${circ(30, 15, 6)} ${circ(38, 10, 7)} ${circ(46, 15, 6)} ${circ(38, 17, 6)} ${circ(24, 30, 1)} ${circ(52, 27, 1)} ${circ(48, 33, 0.9)} ${circ(27, 35, 0.9)}`),
  tuiuiu: p(`${circ(41, 9, 3)} M43.4 8.4 L56 11 L43.4 10.6 Z M40 11.6 Q38 16 38 20 L41.4 20 Q41 16 42.6 11.6 Z M30 21 Q38 16 46 21 Q44 28 36 28 Q31 27 30 21 Z M35 28 L33 37 H34.4 L36.6 28 Z M39.4 28 L40 37 H41.4 L40.8 28 Z`),
  onca: p(`M14 26 Q16 19 26 19 H44 Q48 15 53 16 L56 20 L53 22 Q50 23 49 27 L51 36 H48.4 L45.6 29 H27 L25 36 H22.4 L23 28 Q18 29 14 26 Z ${circ(30, 23, 1.2)} ${circ(35, 25, 1.2)} ${circ(40, 22.4, 1.2)} ${circ(44, 25.6, 1)} M53 18 h1 v1 h-1 Z`),
  arara: p(`${circ(36, 11, 4)} M39.4 9 Q44 11 41 15 L39 12.6 Z M32 14 Q28 22 31 30 L34 30 Q34 22 39 15 Z M31 30 L26 38 L28 38 L33 31 Z M33 30 L31 38 L33 38 L35 30 Z M34.8 9.6 h1.6 v1.6 h-1.6 Z`),
  // Sul
  araucaria: p("M37 37 V14 H39 V37 Z M14 10 Q38 21 62 10 L60 8 L57 11 L54 8.4 L51 11.6 L47 9 L44 12.4 L38 10.4 L32 12.4 L29 9 L25 11.6 L22 8.4 L19 11 L16 8 Z M22 18 Q38 26 54 18 L52.4 16 L50 18.4 L47 16.4 L43 19 L38 17.4 L33 19 L29 16.4 L26 18.4 L23.6 16 Z"),
  cuia: p("M28 24 Q28 37 37 37 Q46 37 46 24 Z M29 22 h16 v2.6 h-16 Z M38 22 L46 6 L47.6 6.8 L40 22 Z M30.6 28 q6.4 3 12.8 0 v1.6 q-6.4 3 -12.8 0 Z"),
  // Andes e América Latina
  montanha: p("M8 37 L26 12 L34 22 L42 9 L62 37 Z M26 12 L22.4 17 L25 16 L27 18.6 L29.6 16.4 Z M42 9 L38 15 L41 14 L43 16.6 L46 14 Z"),
  lhama: p("M22 22 Q24 18 30 18 H42 Q44 18 44 22 V26 Q44 28 42 28 L42 37 H39.6 L39 29 H28 L27.4 37 H25 L25 28 Q22 27 22 22 Z M40 18 L42 5 L46 5 L45.6 9 L49 10.4 L45 12 L43.4 19 Z M43 4 l1 -2.4 l1 2.4 Z"),
  milho: p("M37 37 V9 H39 V37 Z M38 30 Q27 27 22 18 Q29 24 38 26.4 Z M38 23 Q49 20 54 11 Q47 19 38 20 Z M41 21 Q46 17 46 11 Q44 6 41 9 Z M42.4 11 h1.4 v1.4 h-1.4 Z M42.4 14 h1.4 v1.4 h-1.4 Z M42.4 17 h1.4 v1.4 h-1.4 Z M38 9 L34 3 L35 2.6 L38.4 7 L38.4 2 h1.2 L39.6 7 L43 2.6 L44 3 L40 9 Z"),
  // Terra e trabalho
  enxada: p("M20 36 L46 12 L48.4 14.4 L22.4 38 Z M45 9 L56 13 L53 21 L43 15 Z"),
  cana: p("M24 37 V10 h2.4 V37 Z M24 18 h2.4 v1 h-2.4 Z M24 27 h2.4 v1 h-2.4 Z M35 37 V6 h2.4 V37 Z M35 15 h2.4 v1 h-2.4 Z M35 25 h2.4 v1 h-2.4 Z M46 37 V12 h2.4 V37 Z M46 20 h2.4 v1 h-2.4 Z M46 29 h2.4 v1 h-2.4 Z M26 12 Q32 6 34 2 Q31 8 26 13.4 Z M37 8 Q42 4 48 4 Q42 6 37 9.4 Z M48 14 Q54 10 58 10 Q53 12 48 15.4 Z"),
  semente: p("M36.2 37 V24 h1.6 V37 Z M37 25 Q27 25 24 15 Q34 15 37 25 Z M37 22 Q46 22 50 12 Q40 12 37 22 Z M27 17.4 Q32 18.4 35 22.4 L34.4 23 Q31.4 19.4 27 18.4 Z M47.6 14 Q43 15 39.4 19 L40 19.6 Q43.4 16 48 15 Z"),
  capacete: p("M18 31 H56 V34 H18 Z M22 31 Q22 16 37 16 Q52 16 52 31 Z M35 16 h4 v15 h-4 Z M27 22 q2 -3 5 -4 v2 q-2.4 1 -3.6 3 Z"),
  panela: p("M22 22 h30 v2 h-2 v8 Q50 36 46 36 H28 Q24 36 24 32 V24 h-2 Z M18 24 h4 v3 h-4 Z M52 24 h4 v3 h-4 Z M30 18 q-2 -4 0 -8 q2 4 0 8 Z M37 18 q-2 -5 0 -10 q2 5 0 10 Z M44 18 q-2 -4 0 -8 q2 4 0 8 Z M26 28 h22 v1.4 h-22 Z"),
  relogio: p(`${circ(37, 21, 14)} ${circ(37, 21, 11)} M36.2 12 h1.6 v9.4 h-1.6 Z M37 20.2 l7 4 l-0.8 1.4 l-7 -4 Z ${circ(37, 21, 1.6)}`),
  // Cidade e periferia
  casa: p("M22 37 V23 L37 12 L52 23 V37 Z M33.4 37 V29 H40.6 V37 Z M43 26 h5 v4.4 h-5 Z M26 26 h5 v4.4 h-5 Z M18 24 L37 9.6 L56 24 L54.6 25.6 L37 12.4 L19.4 25.6 Z"),
  casario: p("M6 40 Q38 15 70 40 Z M22 24 h9 v8 h-9 Z M31.4 20 h10 v9 h-10 Z M42 23 h9 v8 h-9 Z M26 32 h9 v7 h-9 Z M36 30 h10 v8 h-10 Z M47 31 h8 v7 h-8 Z M24 26 h2 v2 h-2 Z M34 22.4 h2 v2 h-2 Z M37.4 22.4 h2 v2 h-2 Z M44.4 25 h2 v2 h-2 Z M28.4 34 h2 v2 h-2 Z M39 32.4 h2 v2 h-2 Z M49.4 33 h2 v2 h-2 Z"),
  predio: p("M14 37 V18 h9 V37 Z M24 37 V8 h11 V37 Z M36 37 V15 h9 V37 Z M46 37 V22 h11 V37 Z M16 21 h2 v2 h-2 Z M19.4 21 h2 v2 h-2 Z M16 26 h2 v2 h-2 Z M19.4 26 h2 v2 h-2 Z M26.4 11 h2 v2 h-2 Z M30.4 11 h2 v2 h-2 Z M26.4 16 h2 v2 h-2 Z M30.4 16 h2 v2 h-2 Z M26.4 21 h2 v2 h-2 Z M30.4 21 h2 v2 h-2 Z M38.4 18 h2 v2 h-2 Z M38.4 23 h2 v2 h-2 Z M48.4 25 h2 v2 h-2 Z M52.4 25 h2 v2 h-2 Z"),
  fabrica: p(`M16 37 V26 L24 21 V26 L32 21 V26 L40 21 V37 Z M42 37 V11 h5 V37 Z M20 30 h4 v3 h-4 Z M28 30 h4 v3 h-4 Z ${circ(49, 8, 2.6)} ${circ(53.6, 5, 2.1)} ${circ(57.4, 3, 1.5)}`),
  escola: p("M18 37 V22 H56 V37 Z M30 22 L37 14 L44 22 Z M36.2 14 V5 h1.6 V14 Z M37.8 5 h6 v4 h-6 Z M34 37 V29 h6 V37 Z M22 25 h5 v4 h-5 Z M47 25 h5 v4 h-5 Z M35 18.4 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z"),
  onibus: p(`M14 33 V18 Q14 15 17 15 H56 Q59 15 59 18 V33 Z M18 18 h7 v6 h-7 Z M27 18 h7 v6 h-7 Z M36 18 h7 v6 h-7 Z M45 18 h10 v10 h-10 Z ${circ(22, 34, 3.4)} ${circ(22, 34, 1.2)} ${circ(50, 34, 3.4)} ${circ(50, 34, 1.2)}`),
  trem: p(`M14 32 V20 h18 V32 Z M33 32 V14 h14 v-4 h4 v4 h4 v18 Z M17 23 h5 v5 h-5 Z M25 23 h5 v5 h-5 Z M37 17 h6 v5 h-6 Z ${circ(20, 34, 2.6)} ${circ(28, 34, 2.6)} ${circ(40, 34, 3.2)} ${circ(51, 34, 3.2)} ${circ(40, 34, 1.1)} ${circ(51, 34, 1.1)}`),
  bicicleta: p(`${circ(24, 29, 7)} ${circ(24, 29, 5.4)} ${circ(50, 29, 7)} ${circ(50, 29, 5.4)} M24 28.4 L34 18 L45 18 L50 28.4 L48.6 29.6 L44.4 20 H35 L25.4 29.6 Z M33.4 18.4 L36 28.6 L37.4 28.2 L34.8 18 Z M31 15 h6 v1.6 h-6 Z M44 18 L46 13 h4 v1.6 h-3 L45.4 18.6 Z`),
  // Cultura
  berimbau: p(`M30 4 Q46 21 30 38 L31.6 38.8 Q48.4 21 31.6 3.2 Z M31 4 L31 38 L32 38 L32 4 Z ${circ(35.6, 30, 4.6)} ${circ(35.6, 30, 2)}`),
  triangulo: p("M34 8 L50 34 L46.8 34 L34 13.2 L21.2 34 H44 V36.4 H18 Z M34 6 a2 2 0 1 0 0.01 0 Z M52 14 L58 24 L56.6 24.8 L50.6 14.8 Z"),
  tambor: p("M28 11 h16 l-3 26 h-10 Z M28 11 Q36 7 44 11 Q36 14 28 11 Z M30.6 16 L41.4 16 L33 24 L41 32 L31.4 32 L39.6 24 Z"),
  violao: p(`M30 37 Q20 37 21 29 Q22 24 26 23 Q23 19 26 15 Q29 11.4 34 13 Q38 14.4 38 19 Q42 19 44 23 Q46 30 40 35 Q36 37.4 30 37 Z ${circ(32, 25, 2.6)} M28 31 h8 v1.4 h-8 Z M35 15 L50 4 L51.6 6 L36.6 17 Z M49 3 L54 1.4 L55.4 4.6 L51.4 6.4 Z`),
  pandeiro: p(`${circ(37, 22, 13)} ${circ(37, 22, 10)} ${circ(37, 9.6, 1.6)} ${circ(49.4, 22, 1.6)} ${circ(24.6, 22, 1.6)} ${circ(37, 34.4, 1.6)} ${circ(45.8, 13.2, 1.4)} ${circ(28.2, 30.8, 1.4)}`),
  boi: p("M16 27 Q15 20 22 19 Q26 14 31 18 H42 Q46 17 48 19 L52 16 Q55 15 57 18 L55 22 Q53 25 50 25 L49 28 L50 36 H47.4 L45.6 29 H27 L25.4 36 H22.8 L23.4 29 Q18 30 16 27 Z M52 16 Q50 10 53 8 Q52 12 54 15 Z M56 17 Q60 13 59 9 Q58.4 13 55.4 16 Z M16 25 Q11 26 10 32 L11.4 32.4 Q12.4 28 16.4 27 Z M53.6 19 h1.4 v1.4 h-1.4 Z"),
  // Ideias e luta
  livro: p("M16 17 Q27 13 36.4 17 V36 Q27 32 16 36 Z M37.6 17 Q47 13 58 17 V36 Q47 32 37.6 36 Z M19 20.4 q7 -2 14 0 v1.2 q-7 -2 -14 0 Z M19 24.4 q7 -2 14 0 v1.2 q-7 -2 -14 0 Z M19 28.4 q7 -2 14 0 v1.2 q-7 -2 -14 0 Z M41 20.4 q7 -2 14 0 v1.2 q-7 -2 -14 0 Z M41 24.4 q7 -2 14 0 v1.2 q-7 -2 -14 0 Z"),
  lapis: p("M18 33 L44 7 L50 13 L24 39 Z M18 33 L16 41 L24 39 Z M42 9 L48 15 L46.6 16.4 L40.6 10.4 Z"),
  punho: p("M31 37 V26 H43 V37 Z M29 26 V15 Q29 12 32 12 H42 Q45 12 45 15 V26 Z M33.2 12 v7 h1.2 v-7 Z M37.2 12 v7 h1.2 v-7 Z M41.2 12 v7 h1.2 v-7 Z M29 19 h10 v1.4 h-10 Z"),
  bandeira: p(`M24 37 V6 h2.4 V37 Z M26.4 7 Q34 4 42 8 Q49 11 56 8 V21 Q49 24 42 21 Q34 17 26.4 20 Z ${estrela(41, 14, 3.6)}`),
  megafone: p("M22 19 L44 10 V33 L22 24 Z M17 18.4 h5 v6.2 h-5 Z M29 24 l-3 9 h3.4 l3 -8 Z M47 15 q4 6 0 13 l1.4 0.8 q4.6 -7.4 0 -14.6 Z"),
  estrela: p(estrela(37, 21, 16)),
  pomba: p("M14 24 Q22 19 30 22 Q34 13 44 12 Q40 16 40 20 Q48 18 56 22 Q46 24 40 28 Q32 33 24 30 Q19 28 14 24 Z M44 14 L50 12 L45 15.6 Z M52 22 Q56 19 58 20 L54 23 Z M41.6 14.4 h1.4 v1.4 h-1.4 Z"),
  roda: p(`${circ(22, 16, 3)} M18 20 h8 l2 10 h-3 l-1 6 h-4 l-1 -6 h-3 Z ${circ(37, 13, 3)} M33 17 h8 l2 10 h-3 l-1 9 h-4 l-1 -9 h-3 Z ${circ(52, 16, 3)} M48 20 h8 l2 10 h-3 l-1 6 h-4 l-1 -6 h-3 Z M26 22 h7 v1.6 h-7 Z M41 22 h7 v1.6 h-7 Z`),
  multidao: p(`${circ(18, 24, 3.4)} M12 37 Q12 28 18 28 Q24 28 24 37 Z ${circ(28, 20, 3.8)} M21.4 37 Q21.4 25 28 25 Q34.6 25 34.6 37 Z ${circ(39, 22, 3.6)} M32.6 37 Q32.6 27 39 27 Q45.4 27 45.4 37 Z ${circ(50, 19, 3.8)} M43.4 37 Q43.4 24 50 24 Q56.6 24 56.6 37 Z M48.6 8 h1.6 v11 h-1.6 Z`),
  vela: p("M33 37 V18 h8 V37 Z M37 4 q6 6 0 12 q-6 -6 0 -12 Z M36.4 16 h1.2 v2.4 h-1.2 Z M28 37 h18 v1.6 h-18 Z M35 22 h1.4 v12 h-1.4 Z"),
  flor: p(`${circ(37, 13, 3)} ${circ(31.6, 11.4, 3.4)} ${circ(42.4, 11.4, 3.4)} ${circ(33, 17.4, 3.4)} ${circ(41, 17.4, 3.4)} ${circ(37, 13, 1.4)} M36.2 19 h1.6 V37 h-1.6 Z M37 30 Q28 30 25 23 Q33 23 37 30 Z M37 26 Q45 26 49 19 Q41 19 37 26 Z`),
  gota: p("M37 5 Q48 19 48 26 a11 11 0 1 1 -22 0 Q26 19 37 5 Z M31 25 q0 6 5 8 l-0.6 1.4 q-6 -2.6 -6 -9.4 Z"),
  rede: p("M18 37 V10 h2 V37 Z M54 37 V10 h2 V37 Z M20 14 Q37 34 54 14 L54 17 Q37 37 20 17 Z M24 17.4 L26.4 22 M30 22 h1 v1 Z"),
  terreiro: p(`M14 37 V24 L37 13 L60 24 V37 Z M33 37 V27 h8 V37 Z M18 37 V27 M22 28 h4 v5 h-4 Z M48 28 h4 v5 h-4 Z ${circ(37, 21, 1.6)}`),
  hospital: p("M18 37 V16 H56 V37 Z M33 37 V29 h8 V37 Z M34.8 19 h4.4 v3 h3 v4.4 h-3 v3 h-4.4 v-3 h-3 v-4.4 h3 Z M22 20 h5 v4 h-5 Z M47 20 h5 v4 h-5 Z M22 28 h5 v4 h-5 Z M47 28 h5 v4 h-5 Z"),
};

/** O céu, no lado direito do selo. */
export const CEUS: Record<string, string> = {
  sol: p(`${circ(96, 14, 6)} ${raios(96, 14, 8, 12.6, 10)}`),
  lua: p("M101 5 a9 9 0 1 0 0 18 a7 7 0 1 1 0 -18 Z"),
  estrelas: p(`${estrela(88, 9, 3.4)} ${estrela(101, 15, 2.6)} ${estrela(110, 7, 2.2)}`),
  nuvem: p(`M84 20 a5 5 0 0 1 4 -7 a7 7 0 0 1 13 -2 a5 5 0 0 1 8 5 a4 4 0 0 1 -1 8 H87 a4 4 0 0 1 -3 -4 Z`),
  chuva: p(`M84 16 a5 5 0 0 1 4 -7 a7 7 0 0 1 13 -2 a5 5 0 0 1 8 5 a4 4 0 0 1 -1 8 H87 a4 4 0 0 1 -3 -4 Z M88 24 l-2 5 h1.4 l2 -5 Z M95 24 l-2 5 h1.4 l2 -5 Z M102 24 l-2 5 h1.4 l2 -5 Z M91 30 l-1.6 4 h1.4 l1.6 -4 Z M98 30 l-1.6 4 h1.4 l1.6 -4 Z`),
  passaros: p("M84 12 q3 -3 6 0 q3 -3 6 0 q-3 -1.4 -6 1.4 q-3 -2.8 -6 -1.4 Z M98 18 q2.4 -2.4 4.8 0 q2.4 -2.4 4.8 0 q-2.4 -1.2 -4.8 1.2 q-2.4 -2.4 -4.8 -1.2 Z M102 7 q2 -2 4 0 q2 -2 4 0 q-2 -1 -4 1 q-2 -2 -4 -1 Z"),
  nascente: p(`M84 32 a12 12 0 0 1 24 0 Z ${raios(96, 32, 14, 19.4, 9, Math.PI * 1.06, Math.PI * 1.94, 0.07)}`),
  cometa: p(`${estrela(104, 10, 4)} M100 13 L82 26 L84 27 L101.4 14.6 Z M98 11 L84 19 L85 20.4 L99 12.6 Z`),
};

/** O chão, embaixo, de ponta a ponta. */
export const CHAOS: Record<string, string> = {
  chao: p("M0 38 Q60 33 120 38 V40 H0 Z"),
  morro: p("M0 40 Q18 31 40 36.4 Q70 27 98 34.6 Q110 31.4 120 33.4 V40 Z"),
  mar: p(`M0 36 ${Array.from({ length: 8 }, () => "q7.5 -3 15 0").join(" ")} V40 H0 Z`),
  rio: p(`M0 34.6 ${Array.from({ length: 6 }, () => "q10 -2.2 20 0").join(" ")} v1.6 ${Array.from({ length: 6 }, () => "q-10 2.2 -20 0").join(" ")} Z M0 38 ${Array.from({ length: 6 }, () => "q10 -2.2 20 0").join(" ")} V40 H0 Z`),
  roca: p(`M0 38 H120 V40 H0 Z ${Array.from({ length: 15 }, (_, i) => `M${4 + i * 8} 38 q-2 -3 -1 -5 q2 2 1.6 5 Z M${4.6 + i * 8} 38 q2 -3 1 -5 q-2 2 -1.6 5 Z`).join(" ")}`),
  calcada: p(`M0 35 H120 V40 H0 Z ${Array.from({ length: 10 }, (_, i) => `M${i * 12} 37.6 q3 -2.4 6 0 t6 0 v0.9 q-3 2.4 -6 0 t-6 0 Z`).join(" ")}`),
  trilho: p(`M0 36 H120 V37.2 H0 Z M0 38.6 H120 V39.8 H0 Z ${Array.from({ length: 15 }, (_, i) => ret(2 + i * 8, 35.2, 2.4, 4.8)).join(" ")}`),
};

export const LISTA_MOTIVOS = Object.keys(MOTIVOS);
export const LISTA_CEUS = Object.keys(CEUS);
export const LISTA_CHAOS = Object.keys(CHAOS);

/** O desenho de uma vinheta ("motivo/ceu/chao"). Peça desconhecida fica de fora, sem quebrar. */
export function xilogravura(especificacao: string): string {
  const [motivo, ceu, chao] = especificacao.split("/");
  return [CHAOS[chao] ?? CHAOS.chao, MOTIVOS[motivo] ?? MOTIVOS.mandacaru, CEUS[ceu] ?? ""].join("");
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os selos desenhados do site: pictogramas em traço, no lugar dos emojis. Cada um tem o traço na cor do texto e um
// detalhe no vermelho do prelo, como os carimbos dos cartazes. Leves (só um caminho de SVG), iguais em qualquer
// aparelho e no tema claro e no escuro.

type Desenho = { t: string; v?: string; f?: string; p?: string; letra?: string };

/** Círculo em caminho de SVG (o caminho único de cada selo aceita vários círculos emendados). */
const c = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
/** Elipse, do mesmo jeito. */
const e = (x: number, y: number, rx: number, ry: number) => `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

// t = traço (cor do texto), v = traço vermelho, f = preenchimento vermelho, p = preenchimento na cor do texto,
// letra = texto curto em letra de máquina.
const DESENHOS: Record<string, Desenho> = {
  livro: { t: "M4 7c4-1.5 8-1.5 12 1v18c-4-2.5-8-2.5-12-1zM28 7c-4-1.5-8-1.5-12 1v18c4-2.5 8-2.5 12-1z", v: "M16 8v18" },
  livros: { t: "M5 6h5v21H5zM11 6h5v21h-5zM18 7.5l4.5-1.3 5 19.5-4.5 1.2z", v: "M5 11h5M11 11h5" },
  caderno: { t: "M8 4h17v24H8zM8 9H5M8 15H5M8 21H5", v: "M12 4v24" },
  clipe: { t: "M20 9l-9 9a3 3 0 0 0 4.2 4.2l9.5-9.5a5 5 0 0 0-7-7L8 15.4a7 7 0 0 0 9.9 9.9L25 18" },
  mapa: { t: "M4 8l7-3 10 3 7-3v19l-7 3-10-3-7 3zM11 5v19M21 8v19", v: "M14 14.5l2.5 2.5M16.5 14.5L14 17" },
  claquete: { t: "M4 13h24v14H4zM4 13l3-7 21 0-3 7", v: "M10 6l-3 7M17 6l-3 7M24 6l-3 7" },
  fala: { t: "M5 6h22v14H14l-6 5v-5H5z", v: "M10 12h3M16 12h6" },
  balao: { t: "M5 7h22v13H13l-6 5v-5H5z", v: "M10 13.5h.5M16 13.5h.5M22 13.5h.5" },
  aspas: { t: "M6 18c0-6 2-9 7-10v3c-2 .5-3 2-3 4h3v6H6zM18 18c0-6 2-9 7-10v3c-2 .5-3 2-3 4h3v6h-7z", v: "M6 27h20" },
  vela: { t: "M12 14h8v14h-8zM9 28h14", v: "M16 4c2 3 3 4.5 3 6.5a3 3 0 0 1-6 0c0-2 1-3.5 3-6.5z" },
  lampada: { t: "M11 21c-3-2-5-5-5-8a10 10 0 0 1 20 0c0 3-2 6-5 8v3H11zM12 28h8", v: "M16 21v-7l-3-3M16 14l3-3" },
  jornal: { t: "M4 6h19v21H7a3 3 0 0 1-3-3zM23 11h5v13a3 3 0 0 1-3 3", v: "M8 10h11v5H8z", f: "" },
  globo: { t: "M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24zM4 16h24M16 4c4 4 4 20 0 24M16 4c-4 4-4 20 0 24", v: "M7 9h18M7 23h18" },
  check: { t: "M5 5h22v22H5z", v: "M10 16.5l4 4 8-9" },
  letras: { t: "M5 24l5-15 5 15M7 19h6", v: "M19 24V14h4a3 3 0 0 1 0 6h-4M23 20a3 3 0 0 1 0 4h-4" },
  lapis: { t: "M6 26l2-6L21 7l4 4-13 13zM18 10l4 4", v: "M6 26l6-2" },
  caneta: { t: "M22 4l6 6-14 14-8 2 2-8z", v: "M18 8l6 6M6 26l4-4" },
  calculadora: { t: "M8 4h16v24H8zM11 8h10v5H11z", v: "M12 17h.5M16 17h.5M20 17h.5M12 21h.5M16 21h.5M20 21h.5M12 25h8" },
  abaco: { t: "M5 5h22v22H5zM5 11h22M5 17h22M5 23h22", f: "M9 9.5h3v3H9zM14 15.5h3v3h-3zM19 21.5h3v3h-3z" },
  grafico: { t: "M5 5v22h22", v: "M8 22l6-7 5 4 8-10" },
  barras: { t: "M5 5v22h22M9 22v-6M14 22V11M19 22v-8", v: "M24 22V7" },
  regua: { t: "M3 21L21 3l8 8-18 18zM8 16l2 2M11 13l3 3M14 10l2 2M17 7l3 3" },
  frasco: { t: "M12 4h8M13 4v8L6 25a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3l-7-13V4", v: "M9 20h14" },
  tubo: { t: "M11 4h10M13 4v20a3 3 0 0 0 6 0V4", v: "M13 16h6M15 20h.5M17 13h.5" },
  balanca: { t: "M16 5v22M10 27h12M5 9h22", v: "M5 9l-3 8h6zM27 9l-3 8h6z" },
  dna: { t: "M10 3c0 7 12 9 12 16s-12 9-12 10M22 3c0 7-12 9-12 16", v: "M12 8h8M11 14h10M12 20h8" },
  planeta: { t: "M16 9a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", v: "M4 21c3 2 11-1 18-6s8-8 6-9-6 0-9 1" },
  terminal: { t: "M4 5h24v22H4zM4 10h24", v: "M9 15l4 3-4 3M15 21h7" },
  chaves: { t: "M12 6c-3 0-4 1-4 4v3l-3 3 3 3v3c0 3 1 4 4 4M20 6c3 0 4 1 4 4v3l3 3-3 3v3c0 3-1 4-4 4", v: "M14 16h.5M18 16h.5" },
  binario: { t: "M4 5h24v22H4z", letra: "01" },
  cronometro: { t: "M16 8a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM13 4h6M16 4v4", v: "M16 18V12M23 9l2-2" },
  silabas: { t: "M4 6h24v20H4z", letra: "ba" },
  boca: { t: "M4 16c4-6 20-6 24 0-4 6-20 6-24 0z", v: "M8 16h16" },
  diapasao: { t: "M11 4v12a5 5 0 0 0 10 0V4M16 21v8", v: "M5 9c-1 2-1 4 0 6M27 9c1 2 1 4 0 6" },
  metronomo: { t: "M12 4h8l5 24H7zM9 20h14", v: "M16 20l6-12" },
  teclado: { t: "M3 8h26v16H3zM8 8v16M13 8v16M18 8v16M23 8v16", f: "M6.5 8h3v9h-3zM16.5 8h3v9h-3zM21.5 8h3v9h-3z" },
  nota: { t: "M12 24V7l14-3v17", v: "M12 24a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM26 21a3 3 0 1 1-3-3 3 3 0 0 1 3 3z" },
  paleta: { t: "M16 4C9 4 4 9 4 15c0 6 5 10 9 10 2 0 2-2 1-3s0-3 2-3h4c4 0 8-2 8-6 0-5-5-9-12-9z", f: "M9 13a1.6 1.6 0 1 0 0 .1zM13 8.5a1.6 1.6 0 1 0 0 .1zM19 8.5a1.6 1.6 0 1 0 0 .1z" },
  fuso: { t: "M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24zM4 16h24", v: "M16 9v7l5 3" },
  moedas: { t: "M10 10a6 3 0 1 0 12 0 6 3 0 0 0-12 0zM10 10v6c0 1.7 2.7 3 6 3s6-1.3 6-3v-6M10 16v6c0 1.7 2.7 3 6 3s6-1.3 6-3v-6", v: "M4 27h24" },
  fabrica: { t: "M3 27V14l7 4v-4l7 4v-4l7 4V5h5v22z", v: "M8 22h3M15 22h3M22 22h3" },
  coracao: { t: "M16 27S4 20 4 12a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 8-12 15-12 15z", v: "M16 12v8M12 16h8" },
  pulso: { t: "M16 27S4 20 4 12a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 8-12 15-12 15z", v: "M4 16h6l2-4 3 8 2-4h11" },
  microscopio: { t: "M12 4l5 3-6 10-5-3zM14 10l6 3M8 27h18M18 27a8 8 0 0 0 0-14", v: "M9 20h6" },
  alvo: { t: "M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24zM16 9a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", f: "M14 14h4v4h-4z" },
  reacao: { t: "M12 4h8M13 4v8L6 25a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3l-7-13V4", v: "M13 21h.5M17 18h.5M19 23h.5M15 15h.5" },
  fluxo: { t: "M12 4h8v6h-8zM4 22h8v6H4zM20 22h8v6h-8z", v: "M16 10v6H8v6M16 16h8v6" },
  cadeado: { t: "M7 14h18v14H7zM11 14V9a5 5 0 0 1 10 0v5", v: "M16 19v4" },
  grafo: { t: "M8 8l16 4M8 8l2 16M24 12l-14 12M24 12l2 12M10 24h16", f: "M5.5 5.5h5v5h-5zM21.5 9.5h5v5h-5zM7.5 21.5h5v5h-5zM23.5 21.5h5v5h-5z" },
  quebracabeca: { t: "M5 5h9v4a2.5 2.5 0 1 0 5 0V5h8v9h-4a2.5 2.5 0 1 0 0 5h4v8H5z", v: "M5 16h9v11" },
  tijolos: { t: "M3 8h26v16H3zM3 16h26M10 8v8M22 8v8M16 16v8M6 16v8M27 16v8", v: "M10 8h12v8H10z" },
  cubo: { t: "M16 4l11 6v12l-11 6-11-6V10zM16 16l11-6M16 16v12M16 16L5 10", v: "M16 4l11 6-11 6L5 10z" },
  recibo: { t: "M7 3h18v26l-3-2-3 2-3-2-3 2-3-2-3 2z", v: "M11 10h10M11 15h10M11 20h6" },
  onda: { t: "M3 16c3-8 5-8 8 0s5 8 8 0 5-8 8 0", v: "M3 24h26" },
  lua: { t: "M21 5a11 11 0 1 0 6 18A9 9 0 0 1 21 5z", f: "M24 7l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" },
  tomada: { t: "M9 5h14v10a7 7 0 0 1-14 0zM16 22v6", v: "M13 5V2M19 5V2M13 12h6" },
  pincel: { t: "M26 4L14 16l2 2L28 6zM14 16c-4 0-6 3-6 6s-2 4-4 5c6 1 12-1 12-7", v: "M11 21l2 2" },
  hanzi: { t: "M4 4h24v24H4z", letra: "字" },
  py: { t: "M4 5h24v22H4z", letra: "Py" },
  php: { t: "M4 5h24v22H4z", letra: "php" },
  tags: { t: "M4 5h24v22H4z", letra: "</>" },
  rede: { t: "M16 4v8M16 20v8M4 16h8M20 16h8", f: "M13 13h6v6h-6zM13 2h6v5h-6zM13 25h6v5h-6zM2 13h5v6H2zM25 13h5v6h-5z" },
  escudo: { t: "M16 4l11 4v7c0 7-5 11-11 13C10 26 5 22 5 15V8z", v: "M11 16l4 4 6-8" },
  pinguim: { t: "M16 4c-5 0-7 4-7 9 0 4-3 6-3 10 0 3 4 5 10 5s10-2 10-5c0-4-3-6-3-10 0-5-2-9-7-9z", v: "M13 11h.5M18.5 11h.5M14.5 15l1.5 2 1.5-2" },
  raio: { t: "M18 3L7 18h8l-2 11 12-16h-8z" },
  ima: { t: "M7 5h6v11a3 3 0 0 0 6 0V5h6v11a9 9 0 0 1-18 0z", f: "M7 5h6v4H7zM19 5h6v4h-6z" },
  robo: { t: "M7 11h18v15H7zM16 5v6M4 17v4M28 17v4", v: "M11 16h3v3h-3zM18 16h3v3h-3zM12 22h8" },
  virus: { t: "M16 9a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 3v6M16 23v6M3 16h6M23 16h6M7 7l4 4M21 21l4 4M25 7l-4 4M11 21l-4 4", f: "M14 14h4v4h-4z" },
  escola: { t: "M4 13L16 5l12 8M7 12v15h18V12M13 27v-7h6v7", v: "M16 13a2 2 0 1 0 0 .1" },
  pessoa: { t: "M16 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM6 28c0-6 4.5-10 10-10s10 4 10 10" },
  pessoas: { t: "M11 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 27c0-5 3.5-8 8-8s8 3 8 8M21 8a4 4 0 0 1 0 7M23 19c3.5.5 6 3.5 6 8" },
  microfone: { t: "M12 4h8v14h-8zM7 15a9 9 0 0 0 18 0M16 24v4M11 28h10", v: "M12 9h8M12 13h8" },
  dado: { t: "M5 5h22v22H5z", f: "M9 9h4v4H9zM19 19h4v4h-4zM14 14h4v4h-4z" },
  trofeu: { t: "M10 4h12v8a6 6 0 0 1-12 0zM10 7H5v2a5 5 0 0 0 5 5M22 7h5v2a5 5 0 0 1-5 5M16 18v5M10 28h12M12 23h8v5", v: "M16 8v4" },
  baixar: { t: "M5 22v5h22v-5", v: "M16 4v16M10 14l6 6 6-6" },
  atualizar: { t: "M26 12A10 10 0 0 0 7 9M6 20a10 10 0 0 0 19 3", v: "M7 3v6h6M25 29v-6h-6" },
  ferramentas: { t: "M19 7a6 6 0 0 0-7.6 7.6L4 22l6 6 7.4-7.4A6 6 0 0 0 25 13l-4 4-4-1-1-4z" },
  caixa: { t: "M4 10l12-6 12 6v12l-12 6-12-6zM4 10l12 6 12-6M16 16v12", v: "M10 7l12 6" },
  sino: { t: "M8 22V14a8 8 0 0 1 16 0v8l3 3H5zM13 25a3 3 0 0 0 6 0" },
  estrela: { t: "M16 3l3.6 8.3 9 .8-6.8 6 2 8.9L16 22.3 8.2 27l2-8.9-6.8-6 9-.8z" },
  punho: { t: "M9 16c0-2 1.5-3 3-3s3 1 3 3v-1c0-2 1.5-3 3-3s3 1 3 3v1c0-1.5 1.2-2.5 2.5-2.5S26 14.5 26 16v5c0 5-4 8-9 8h-2c-5 0-8-3-8-8v-3c0-1.5.8-2 2-2z", v: "M16 3l1.4 3.3 3.6.3-2.7 2.3.8 3.5L16 10.6l-3.1 1.8.8-3.5L11 6.6l3.6-.3z" },
  folha: { t: "M7 3h13l5 5v21H7zM20 3v5h5", v: "M11 14h10M11 19h10M11 24h6" },
  pasta: { t: "M3 8h9l3 3h14v16H3z", v: "M3 14h26" },
  imagem: { t: "M4 6h24v20H4z", v: "M4 22l7-7 6 6 4-4 7 7", f: "M20 10h4v4h-4z" },
  video: { t: "M3 8h18v16H3zM21 13l8-4v14l-8-4" , v: "M10 12l5 4-5 4z" },
  calendario: { t: "M4 7h24v21H4zM4 13h24M10 4v6M22 4v6", f: "M9 17h4v4H9z" },
  alfinete: { t: "M12 4h8l-1 8 4 4H9l4-4zM16 16v12", v: "M12 4h8" },
  lixeira: { t: "M6 9h20M12 9V5h8v4M8 9l1 19h14l1-19", v: "M13 14v9M19 14v9" },
  grade: { t: "M4 4h10v10H4zM18 4h10v10H18zM4 18h10v10H4zM18 18h10v10H18z" },
  lupa: { t: "M13 4a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", v: "M20 20l8 8" },
  som: { t: "M4 12h5l7-6v20l-7-6H4z", v: "M21 11a6 6 0 0 1 0 10M24 7a11 11 0 0 1 0 18" },
  mudo: { t: "M4 12h5l7-6v20l-7-6H4z", v: "M21 12l7 8M28 12l-7 8" },
  mao: { t: "M10 16V7a2 2 0 0 1 4 0v8V5a2 2 0 0 1 4 0v10V7a2 2 0 0 1 4 0v12c0 6-3 9-8 9-4 0-6-2-8-6l-3-5a2 2 0 0 1 3-2l2 2" },
  bandeira: { t: "M7 4v25", v: "M7 5h17l-4 6 4 6H7" },
  fogo: { t: "M16 28c-6 0-9-4-9-9 0-6 6-9 6-15 4 3 6 6 6 10 1-1 2-3 2-4 3 3 4 6 4 9 0 5-3 9-9 9z", v: "M16 28c-2 0-4-2-4-4s2-4 4-7c2 3 4 5 4 7s-2 4-4 4z" },
  bateria: { t: "M3 10h23v12H3zM26 14h3v4h-3", f: "M6 13h8v6H6z" },
  casa: { t: "M4 15L16 5l12 10M7 13v15h18V13", v: "M13 28v-8h6v8" },
  chip: { t: "M9 9h14v14H9zM12 4v5M16 4v5M20 4v5M12 23v5M16 23v5M20 23v5M4 12h5M4 16h5M4 20h5M23 12h5M23 16h5M23 20h5", f: "M13 13h6v6h-6z" },
  engrenagem: { t: "M16 11a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M25.2 6.8l-2.8 2.8M9.6 22.4l-2.8 2.8" },
  tela: { t: "M3 5h26v17H3zM11 27h10M16 22v5", v: "M7 9h18v9H7z" },
  celular: { t: "M10 3h12v26H10z", v: "M14 25h4" },
  aperto: { t: "M3 12l6-4 7 3 7-3 6 4M3 12v8l9 7 4-3 4 3 9-7v-8M16 11l-4 4 3 3 4-4" },
  moeda: { t: "M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24z", v: "M19 11h-4a2.5 2.5 0 0 0 0 5h2a2.5 2.5 0 0 1 0 5h-4M16 8v3M16 21v3" },
  folhaverde: { t: "M6 26C6 13 13 6 27 5c0 14-7 21-20 21z", v: "M6 26L18 14" },
  sol: { t: "M16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM16 3v3M16 26v3M3 16h3M26 16h3M7 7l2 2M23 23l2 2M25 7l-2 2M9 23l-2 2" },
  cerebro: { t: "M12 5a4 4 0 0 0-4 4 4 4 0 0 0-3 6 4 4 0 0 0 2 7 4 4 0 0 0 6 3V5zM20 5a4 4 0 0 1 4 4 4 4 0 0 1 3 6 4 4 0 0 1-2 7 4 4 0 0 1-6 3V5z", v: "M13 12h-3M19 12h3M13 19h-3M19 19h3" },
  bolha: { t: "M16 6a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", v: "M11 13a5 5 0 0 1 4-4" },
  pino: { t: "M16 28s-9-8-9-15a9 9 0 0 1 18 0c0 7-9 15-9 15z", f: "M13.5 10.5h5v5h-5z" },
  mira: { t: "M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24zM16 2v6M16 24v6M2 16h6M24 16h6" },
  bussola: { t: "M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24z", v: "M20 12l-2 6-6 2 2-6z" },
  ampulheta: { t: "M8 4h16M8 28h16M10 4c0 6 6 8 6 12s-6 6-6 12M22 4c0 6-6 8-6 12s6 6 6 12", f: "M13 24h6v2h-6z" },
  // Os blocos do editor de aulas.
  paragrafo: { t: "M5 13h22M5 18h22M5 23h14", v: "M5 8h22" },
  titulo: { t: "M7 7h18M16 7v19", v: "M11 26h10" },
  lista: { t: "M12 8h15M12 16h15M12 24h15", f: "M5 6h4v4H5zM5 14h4v4H5zM5 22h4v4H5z" },
  numerada: { t: "M13 8h14M13 16h14M13 24h14", v: "M5 6l2-1v6M5 14h3l-3 4h3M5 21h3l-2 2 2 2H5" },
  tabela: { t: "M4 6h24v20H4zM4 19h24M13 6v20", v: "M4 12h24" },
  formula: { t: "M4 17l3-1 4 9 6-19h11", v: "M20 13l6 8M26 13l-6 8" },
  pergunta: { t: "M5 5h22v22H5z", letra: "?" },
  linhadotempo: { t: "M3 16h26", f: "M6 13h5v6H6zM14 13h5v6h-5zM22 13h5v6h-5z", v: "M8.5 7v6M16.5 19v6M24.5 7v6" },
  geometria: { t: "M16 5L5 26h22z", v: "M10 26a6 6 0 0 1 4-6" },
  molecula: { t: "M13 16a3 3 0 1 0 6 0 3 3 0 1 0-6 0M4 7a3 3 0 1 0 6 0 3 3 0 1 0-6 0M22 7a3 3 0 1 0 6 0 3 3 0 1 0-6 0M13 26a3 3 0 1 0 6 0 3 3 0 1 0-6 0", v: "M9 9l5 5M23 9l-5 5M16 19v4" },
  cartoes: { t: "M9 9h17v18H9z", v: "M6 6h16v3M6 6v18h3" },
  forca: { t: "M6 28h14M10 28V4h12v4", v: "M19 11a3 3 0 1 0 6 0 3 3 0 1 0-6 0M22 14v6M19 17h6M22 20l-3 4M22 20l3 4" },
  // Os experimentos dos laboratórios (o Laboratório de IA foi o primeiro).
  "rede-neural": { t: `${c(6, 9, 3)}${c(6, 23, 3)}${c(16, 6, 3)}${c(16, 16, 3)}${c(16, 26, 3)}M9 9l4-2M9 9l4 6M9 23l4-6M9 23l4 2M19 6l4 8M19 16h4M19 26l4-8`, f: c(26, 16, 3.4) },
  vizinhos: { t: c(16, 16, 10), f: c(16, 16, 3), p: `${c(9, 11, 2)}${c(22, 12, 2)}${c(20, 23, 2)}` },
  agrupamento: { t: e(10, 11, 7, 6), v: e(22, 22, 7, 6), p: `${c(8, 10, 1.6)}${c(12, 13, 1.6)}${c(11, 8, 1.6)}`, f: `${c(20, 21, 1.6)}${c(24, 24, 1.6)}${c(23, 19, 1.6)}` },
  sobreajuste: { t: "M3 24C9 22 14 14 29 8", v: "M3 25L7 13l3 9 4-13 3 11 4-13 3 11 5-12", p: `${c(7, 13, 1.6)}${c(14, 9, 1.6)}${c(21, 7, 1.6)}` },
  "proxima-palavra": { t: "M4 7h24v14H14l-6 5v-5H4zM9 14h6", v: "M18 14h2", f: "M22 11.5h2.5v5H22z" },
  vies: { t: "M16 4v24M8 28h16M5 11h22", v: "M5 11l-3 8h6zM27 11l-3 10h6z" },
  "caderno-python": { t: "M5 4h22v24H5zM5 9h22", v: "M10 15l3 3-3 3M15 21h6" },
  multimetro: { t: "M8 3h16v26H8zM11 6h10v6H11z", v: "M16 22a3 3 0 1 0 0 .1M16 19v-3" },
  lampada2: { t: "M12 21c-3-2-5-5-5-8a9 9 0 0 1 18 0c0 3-2 6-5 8v3h-8zM13 28h6", f: c(16, 13, 3) },
  led: { t: "M10 14a6 6 0 0 1 12 0v6H10zM8 20h16M13 20v9M19 20v6", v: "M24 6l3-3M26 10h4M20 4l1-3" },
  capacitor: { t: "M3 16h10M19 16h10M13 7v18", v: "M19 7v18" },
  porta: { t: "M5 8h9a8 8 0 0 1 0 16H5zM22 16h6M2 12h3M2 20h3", f: c(24, 16, 1.6) },
  fonte: { t: "M5 6h22v20H5zM9 20h14", v: "M10 13h4M12 11v4M18 13h4" },
  probabilidade: { t: "M5 5h22v22H5z", f: `${c(10, 10, 2)}${c(22, 22, 2)}${c(16, 16, 2)}`, p: `${c(22, 10, 2)}${c(10, 22, 2)}` },
  segregacao: { t: "M3 28h26", f: "M5 18h5v10H5zM18 14h5v14h-5z", p: "M11 21h5v7h-5zM24 19h5v9h-5z", v: "M7 18l1-3 2 3M20 14l1-3 2 3" },
  riqueza: { t: "M5 27V22M10 27v-3M15 27v-2M20 27v-1", f: "M23 27V5h4v22z" },
  epidemia: { t: `${c(8, 9, 3)}${c(20, 7, 3)}${c(26, 20, 3)}${c(10, 24, 3)}M11 10l6-2M22 9l3 8M23 21l-10 3`, f: c(16, 16, 3.5) },
  predador: { t: "M3 26c4-14 8-14 12 0s8 14 14-6", v: "M3 18c4 10 8 10 12 0s8-14 14 4" },
  ondas: { t: "M3 12c3-6 5-6 8 0s5 6 8 0 5-6 8 0", v: "M3 22c2-4 3.5-4 5 0s3.5 4 5 0 3.5-4 5 0 3.5 4 5 0 3.5-4 5 0" },
  automatos: { t: "M4 4h24v24H4zM12 4v24M20 4v24M4 12h24M4 20h24", f: "M12 4h8v8h-8zM4 12h8v8H4zM20 12h8v8h-8zM12 20h8v8h-8z" },
  regex: { t: "M4 6h24v20H4z", letra: ".*" },
  rastro: { t: "M4 16s5-8 12-8 12 8 12 8-5 8-12 8S4 16 4 16z", f: c(16, 16, 3.5) },
  sensor: { t: "M10 3h12v26H10z", v: "M5 9c-2 3-2 11 0 14M27 9c2 3 2 11 0 14", f: c(16, 16, 2.5) },
};

export type NomeDoSelo = keyof typeof DESENHOS;
export const temSelo = (nome: string): nome is NomeDoSelo => nome in DESENHOS;

/**
 * Um selo desenhado. `quadro` põe o desenho no quadrado de contorno (a classe .selo do globals.css);
 * sem quadro, sai só o desenho, do tamanho da classe.
 */
export function Selo({ nome, className = "h-7 w-7", quadro = false, titulo }: { nome: string; className?: string; quadro?: boolean; titulo?: string }) {
  const d = DESENHOS[nome] ?? DESENHOS.estrela;
  const desenho = (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      <path d={d.t} />
      {d.v && <path d={d.v} stroke="var(--prelo-texto)" />}
      {d.f && <path d={d.f} fill="var(--prelo-texto)" stroke="none" />}
      {d.p && <path d={d.p} fill="currentColor" stroke="none" />}
      {d.letra && (
        <text x="16" y={d.letra.length > 2 ? 20 : 21} textAnchor="middle" fontSize={d.letra.length > 2 ? 9.5 : 12} fontWeight="600" fontFamily="var(--font-archive), ui-monospace, monospace" fill="var(--prelo-texto)" stroke="none">
          {d.letra}
        </text>
      )}
    </svg>
  );
  return quadro ? <span className="selo">{desenho}</span> : desenho;
}

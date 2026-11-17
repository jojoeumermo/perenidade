// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A arte em PNG de um post (frente 13C), desenhada no próprio aparelho num <canvas>, no estilo "Mosaico da Arquibancada": fundo
// noite (ou creme), a faixa tecida no alto, a marca de ladrilhos, o título em Archivo condensada e caixa alta, o texto, o carimbo
// da data quando é um ato, quem escreveu, o QR do link (feito com a biblioteca qrcode do projeto) e a fileira de ladrilhos no pé.
// Nada vai a serviço de fora. As cores são as dos tokens da Alumia (styles/alumia-tokens.css; o teste confere que não se
// desencontram): o canvas não lê variável de CSS, e a pessoa escolhe o fundo sem depender do tema em que a tela está.
// A parte de medir e quebrar o texto é pura (roda nos testes). Sem "@/" de propósito.

export interface Paleta {
  fundo: string;
  superficie: string;
  linha: string;
  texto: string;
  texto2: string;
  texto3: string;
  vermelho: string;
  dourado: string;
  /** O papel e a tinta do QR: sempre escuro sobre claro (a câmera lê melhor). */
  qrClaro: string;
  qrEscuro: string;
}

/** Os tokens do tema escuro (o padrão das pranchas). */
export const PALETA_NOITE: Paleta = {
  fundo: "#0f0e0d", superficie: "#1b1917", linha: "#2a2622", texto: "#f3efe6", texto2: "#d9d3c9", texto3: "#a9a29a",
  vermelho: "#e8321f", dourado: "#ffc21a", qrClaro: "#f3efe6", qrEscuro: "#0f0e0d",
};

/** Os tokens do tema claro. */
export const PALETA_CREME: Paleta = {
  fundo: "#f3efe6", superficie: "#fbf8f2", linha: "#d5cdbf", texto: "#0f0e0d", texto2: "#2f2a25", texto3: "#5c554d",
  vermelho: "#bc2217", dourado: "#7a5800", qrClaro: "#fbf8f2", qrEscuro: "#0f0e0d",
};

/** A faixa tecida: 11 listras nas proporções 5-2-3-1-4-2-3-1-3-2-4 (a mesma de --al-faixa). */
export const FAIXA_TECIDA: readonly { cor: string; peso: number }[] = [
  { cor: "#c21f16", peso: 5 }, { cor: "#f0b323", peso: 2 }, { cor: "#23408e", peso: 3 }, { cor: "#f3efe6", peso: 1 },
  { cor: "#2e6b4f", peso: 4 }, { cor: "#e4577f", peso: 2 }, { cor: "#ea7a24", peso: 3 }, { cor: "#0f0e0d", peso: 1 },
  { cor: "#1f8a85", peso: 3 }, { cor: "#f0b323", peso: 2 }, { cor: "#c21f16", peso: 4 },
];

export type Formato = "retrato" | "quadrado";
export const TAMANHOS: Record<Formato, { largura: number; altura: number }> = {
  retrato: { largura: 1080, altura: 1350 },
  quadrado: { largura: 1080, altura: 1080 },
};

/**
 * Quebra o texto em linhas que cabem na largura (medida pela função dada), respeitando as quebras do próprio texto; palavra maior
 * que a linha é partida. Passou de `maximo` linhas, a última termina em "…".
 */
export function quebrarEmLinhas(texto: string, medir: (s: string) => number, largura: number, maximo: number): string[] {
  const linhas: string[] = [];
  let cortou = false;
  const paragrafos = String(texto ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().split("\n");
  fora: for (const paragrafo of paragrafos) {
    const palavras = paragrafo.split(/[ \t]+/).filter(Boolean);
    if (palavras.length === 0) {
      if (linhas.length > 0 && linhas[linhas.length - 1] !== "") linhas.push("");
      if (linhas.length >= maximo) {
        cortou = true;
        break;
      }
      continue;
    }
    let atual = "";
    for (let palavra of palavras) {
      // Palavra que não cabe sozinha: parte em pedaços que cabem.
      while (medir(palavra) > largura && palavra.length > 1) {
        let n = palavra.length - 1;
        while (n > 1 && medir(palavra.slice(0, n)) > largura) n--;
        if (atual) {
          linhas.push(atual);
          atual = "";
          if (linhas.length >= maximo) {
            cortou = true;
            break fora;
          }
        }
        linhas.push(palavra.slice(0, n));
        palavra = palavra.slice(n);
        if (linhas.length >= maximo) {
          cortou = true;
          break fora;
        }
      }
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (medir(tentativa) <= largura) {
        atual = tentativa;
      } else {
        linhas.push(atual);
        atual = palavra;
        if (linhas.length >= maximo) {
          cortou = true;
          break fora;
        }
      }
    }
    if (atual) {
      linhas.push(atual);
      if (linhas.length >= maximo) {
        cortou = paragrafos.indexOf(paragrafo) < paragrafos.length - 1;
        break;
      }
    }
  }
  while (linhas.length > 0 && linhas[linhas.length - 1] === "") linhas.pop();
  if (linhas.length > maximo) {
    linhas.length = maximo;
    cortou = true;
  }
  if (cortou && linhas.length > 0) {
    let ultima = linhas[linhas.length - 1];
    while (ultima && medir(`${ultima}…`) > largura) ultima = ultima.slice(0, -1);
    linhas[linhas.length - 1] = `${ultima.trimEnd()}…`;
  }
  return linhas;
}

/**
 * O maior tamanho de letra (entre `maior` e `menor`, de 4 em 4) em que o título cabe em `maxLinhas` linhas. Devolve o tamanho e
 * as linhas (no menor tamanho, cortadas com "…" se ainda não couber).
 */
export function ajustarTitulo(texto: string, medirNoTamanho: (s: string, tamanho: number) => number, largura: number, maxLinhas: number, maior: number, menor: number): { tamanho: number; linhas: string[] } {
  for (let t = maior; t >= menor; t -= 4) {
    const linhas = quebrarEmLinhas(texto, (s) => medirNoTamanho(s, t), largura, maxLinhas + 1);
    if (linhas.length <= maxLinhas && !linhas.some((l) => l.endsWith("…"))) return { tamanho: t, linhas };
  }
  return { tamanho: menor, linhas: quebrarEmLinhas(texto, (s) => medirNoTamanho(s, menor), largura, maxLinhas) };
}

/** O que a arte mostra. */
export interface ConteudoDaArte {
  titulo: string | null;
  texto: string;
  aviso: string;
  codinome: string;
  handle: string | null;
  comunidade: string | null;
  /** A data do ato (carimbo), já escrita ("16 NOV"); nula quando não é ato. */
  carimbo: string | null;
  /** O endereço para o QR; nulo = sem QR. */
  qr: string | null;
  /** Os textos fixos já no idioma. */
  marca: string;
  chamada: string;
  rotuloAviso: string;
}

/** A matriz do QR (biblioteca qrcode: QRCode.create). */
export interface MatrizDoQr {
  tamanho: number;
  escuro: (linha: number, coluna: number) => boolean;
}

type Contexto = CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string };

/** Desenha a arte no contexto dado (o canvas já no tamanho do formato). `familia` é a família de letra resolvida da tela. */
export function desenharArte(ctx: Contexto, formato: Formato, paleta: Paleta, c: ConteudoDaArte, familia: string, qr: MatrizDoQr | null): void {
  const { largura: L, altura: A } = TAMANHOS[formato];
  const M = 84;
  const util = L - 2 * M;
  const letra = (peso: number, tamanho: number, condensada: boolean) => {
    ctx.font = `${peso} ${tamanho}px ${familia}`;
    try {
      ctx.fontStretch = condensada ? "ultra-condensed" : "normal";
    } catch {
      // navegador sem fontStretch no canvas: fica a largura normal
    }
  };
  const medirEm = (peso: number, condensada: boolean) => (s: string, tamanho: number) => {
    letra(peso, tamanho, condensada);
    return ctx.measureText(s).width;
  };

  // Fundo e faixa tecida.
  ctx.fillStyle = paleta.fundo;
  ctx.fillRect(0, 0, L, A);
  const somaPesos = FAIXA_TECIDA.reduce((s, f) => s + f.peso, 0);
  let x = 0;
  for (const f of FAIXA_TECIDA) {
    const w = (f.peso / somaPesos) * L;
    ctx.fillStyle = f.cor;
    ctx.fillRect(Math.floor(x), 0, Math.ceil(w) + 1, 18);
    x += w;
  }

  // A marca: quatro ladrilhos e "ALUMIA".
  const topo = 18 + 56;
  const lad = 20;
  const cores = [paleta.texto, paleta.vermelho, paleta.dourado, paleta.texto];
  cores.forEach((cor, i) => {
    ctx.fillStyle = cor;
    ctx.fillRect(M + (i % 2) * (lad + 4), topo + Math.floor(i / 2) * (lad + 4), lad, lad);
  });
  letra(900, 52, true);
  ctx.fillStyle = paleta.texto;
  ctx.textBaseline = "middle";
  ctx.fillText(c.marca.toUpperCase(), M + 2 * lad + 4 + 18, topo + lad + 2);

  // A comunidade, numa pílula de contorno, à direita.
  if (c.comunidade) {
    letra(900, 34, true);
    const nome = quebrarEmLinhas(c.comunidade.toUpperCase(), (s) => ctx.measureText(s).width, util / 2, 1)[0] ?? "";
    const w = ctx.measureText(nome).width + 44;
    const px = L - M - w;
    ctx.strokeStyle = paleta.texto2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(px, topo - 2, w, 48, 24);
    ctx.stroke();
    ctx.fillStyle = paleta.texto2;
    ctx.fillText(nome, px + 22, topo + 22);
  }

  // O pé: quem escreveu (à esquerda), o QR (à direita) e a fileira de ladrilhos.
  const altoDoPe = qr ? 250 : 120;
  const peTopo = A - 60 - altoDoPe;
  let y = topo + 48 + 60;

  // O carimbo do ato (a data), torto como os carimbos das pranchas.
  if (c.carimbo) {
    letra(900, 60, true);
    const w = ctx.measureText(c.carimbo).width + 48;
    ctx.save();
    ctx.translate(M + w / 2, y + 40);
    ctx.rotate(-0.07);
    ctx.strokeStyle = paleta.vermelho;
    ctx.lineWidth = 4;
    ctx.strokeRect(-w / 2, -38, w, 76);
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 + 7, -31, w - 14, 62);
    ctx.fillStyle = paleta.vermelho;
    ctx.textAlign = "center";
    ctx.fillText(c.carimbo, 0, 2);
    ctx.restore();
    ctx.textAlign = "left";
    y += 116;
  }

  ctx.textBaseline = "alphabetic";
  if (c.aviso) {
    // Com aviso de conteúdo, a arte não adianta o texto: vai o aviso (e o título, se houver).
    letra(800, 34, false);
    const linhasAviso = quebrarEmLinhas(`${c.rotuloAviso}: ${c.aviso}`, (s) => ctx.measureText(s).width, util - 48, 3);
    const h = linhasAviso.length * 44 + 36;
    ctx.fillStyle = paleta.superficie;
    ctx.fillRect(M, y, util, h);
    ctx.fillStyle = paleta.dourado;
    ctx.fillRect(M, y, 10, h);
    ctx.fillStyle = paleta.texto;
    linhasAviso.forEach((l, i) => ctx.fillText(l, M + 34, y + 50 + i * 44));
    y += h + 40;
  }
  if (c.titulo?.trim()) {
    const { tamanho, linhas } = ajustarTitulo(c.titulo.toUpperCase(), medirEm(900, true), util, c.aviso ? 3 : 4, formato === "retrato" ? 132 : 112, 60);
    letra(900, tamanho, true);
    ctx.fillStyle = paleta.texto;
    linhas.forEach((l, i) => ctx.fillText(l, M, y + tamanho * 0.9 + i * tamanho * 0.95));
    y += tamanho * 0.95 * linhas.length + 36;
  }
  if (!c.aviso && c.texto.trim()) {
    const restante = peTopo - 40 - y;
    const semTitulo = !c.titulo?.trim();
    const peso = semTitulo ? 700 : 400;
    letra(peso, 40, false);
    // Sem título, o texto é a arte: o maior tamanho (de 76 a 40) em que ele cabe inteiro; com título, um tamanho fixo de apoio.
    let tamanho = 38;
    let linhas: string[] = [];
    for (let t = semTitulo ? (formato === "retrato" ? 76 : 68) : 38; t >= (semTitulo ? 40 : 38); t -= 4) {
      letra(peso, t, false);
      const maximo = Math.max(1, Math.floor(restante / (t * 1.3)));
      linhas = quebrarEmLinhas(c.texto, (s) => ctx.measureText(s).width, util, maximo);
      tamanho = t;
      if (!linhas.some((l) => l.endsWith("…"))) break;
    }
    letra(peso, tamanho, false);
    const passo = tamanho * 1.3;
    ctx.fillStyle = semTitulo ? paleta.texto : paleta.texto2;
    linhas.forEach((l, i) => ctx.fillText(l, M, y + tamanho + i * passo));
  }

  // Linha do pé.
  ctx.fillStyle = paleta.linha;
  ctx.fillRect(M, peTopo, util, 3);
  const larguraDoQr = qr ? 210 : 0;
  letra(800, 40, false);
  ctx.fillStyle = paleta.texto;
  const nome = quebrarEmLinhas(c.codinome, (s) => ctx.measureText(s).width, util - larguraDoQr - 40, 1)[0] ?? "";
  ctx.fillText(nome, M, peTopo + 70);
  if (c.handle) {
    letra(400, 32, false);
    ctx.fillStyle = paleta.texto3;
    ctx.fillText(`@${c.handle}`, M, peTopo + 116);
  }
  if (qr) {
    const lado = larguraDoQr;
    const qx = L - M - lado;
    const qy = peTopo + 26;
    ctx.fillStyle = paleta.qrClaro;
    ctx.fillRect(qx, qy, lado, lado);
    const borda = 12;
    const modulo = (lado - 2 * borda) / qr.tamanho;
    ctx.fillStyle = paleta.qrEscuro;
    for (let l = 0; l < qr.tamanho; l++) {
      for (let k = 0; k < qr.tamanho; k++) {
        if (qr.escuro(l, k)) ctx.fillRect(qx + borda + k * modulo, qy + borda + l * modulo, Math.ceil(modulo), Math.ceil(modulo));
      }
    }
    letra(900, 30, true);
    ctx.fillStyle = paleta.vermelho;
    ctx.textAlign = "right";
    ctx.fillText(c.chamada.toUpperCase(), qx - 20, qy + lado - 8);
    ctx.textAlign = "left";
  }

  // A fileira de ladrilhos (o mosaico da arquibancada), no pé.
  const n = 27;
  const passoLad = L / n;
  for (let i = 0; i < n; i++) {
    const f = FAIXA_TECIDA[(i * 7) % FAIXA_TECIDA.length];
    ctx.fillStyle = i % 3 === 1 ? paleta.superficie : f.cor;
    ctx.fillRect(Math.round(i * passoLad) + 2, A - 34, Math.round(passoLad) - 4, 30);
  }
}

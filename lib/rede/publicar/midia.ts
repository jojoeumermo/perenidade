// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Mídia da Rede (pacote publicar): descobre o tipo do arquivo pelos primeiros bytes (nunca pela extensão nem pelo que o
// navegador diz) e TIRA do arquivo tudo o que não é imagem: EXIF (local do GPS, modelo do aparelho, data), XMP, perfil de cor
// embutido, comentários, miniatura e qualquer sobra depois do fim da imagem. O navegador já reencoda no canvas (que não leva
// metadado); isto é a segunda trava, no servidor, porque um cliente alterado poderia mandar o arquivo cru (LGPD art. 6º, III:
// minimização; a localização de uma pessoa que escreve numa rede de luta é dado que não deve nunca chegar ao leitor).
// Sem dependências e sem "@/": roda no servidor, no navegador e no Node dos testes.

export type MidiaIdentificada = { tipo: "imagem" | "audio"; mime: string; ext: "jpg" | "png" | "webp" | "webm" | "ogg" | "m4a" };

const texto = (b: Uint8Array, de: number, ate: number) => String.fromCharCode(...b.subarray(de, ate));

/** Imagem JPG/PNG/WebP e áudio WebM/Ogg/MP4 (o que o gravador do navegador produz). O resto é recusado (nulo). */
export function identificarMidia(b: Uint8Array): MidiaIdentificada | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { tipo: "imagem", mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && texto(b, 1, 4) === "PNG" && b[4] === 0x0d && b[5] === 0x0a) return { tipo: "imagem", mime: "image/png", ext: "png" };
  if (texto(b, 0, 4) === "RIFF" && texto(b, 8, 12) === "WEBP") return { tipo: "imagem", mime: "image/webp", ext: "webp" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { tipo: "audio", mime: "audio/webm", ext: "webm" };
  if (texto(b, 0, 4) === "OggS") return { tipo: "audio", mime: "audio/ogg", ext: "ogg" };
  if (texto(b, 4, 8) === "ftyp") return { tipo: "audio", mime: "audio/mp4", ext: "m4a" };
  return null;
}

// ── JPEG ──

/** Marcadores que não têm tamanho (RSTn, SOI, EOI, TEM). */
const semTamanho = (m: number) => m === 0x01 || (m >= 0xd0 && m <= 0xd9);

/**
 * Reescreve o JPEG só com o que desenha a imagem. Fica: JFIF (APP0), Adobe (APP14, decide a conversão de cor), tabelas, quadro e
 * dados. Sai: EXIF/XMP/Photoshop (APP1, APP13), ICC e o resto dos APPn, comentários (COM) e tudo depois do EOI.
 */
function limparJpeg(b: Uint8Array): Uint8Array | null {
  const saida: number[][] = [[0xff, 0xd8]];
  let i = 2;
  const partes: Uint8Array[] = [];
  const guardar = (de: number, ate: number) => partes.push(b.subarray(de, ate));
  while (i < b.length) {
    if (b[i] !== 0xff) return null; // lixo entre marcadores: recusa
    while (b[i] === 0xff && i < b.length) i++; // enchimento
    const m = b[i++];
    if (m === undefined) return null;
    if (m === 0xd9) {
      partes.push(Uint8Array.of(0xff, 0xd9));
      return juntar([Uint8Array.from(saida[0]), ...partes]);
    }
    if (semTamanho(m)) {
      partes.push(Uint8Array.of(0xff, m));
      continue;
    }
    if (i + 2 > b.length) return null;
    const tamanho = (b[i] << 8) | b[i + 1];
    if (tamanho < 2 || i + tamanho > b.length) return null;
    const fim = i + tamanho;
    const guardarEste = !(m >= 0xe1 && m <= 0xef && m !== 0xee) && m !== 0xfe; // tira APP1..APP15 (menos Adobe) e COM
    if (guardarEste) {
      partes.push(Uint8Array.of(0xff, m));
      guardar(i, fim);
    }
    i = fim;
    if (m === 0xda) {
      // Início da varredura: os dados vão até o próximo marcador que não seja byte "0xFF 0x00" nem reinício (RSTn).
      const comeco = i;
      while (i < b.length) {
        if (b[i] === 0xff) {
          const n = b[i + 1];
          if (n === 0x00 || (n >= 0xd0 && n <= 0xd7)) {
            i += 2;
            continue;
          }
          if (n === 0xff) {
            i++;
            continue;
          }
          break;
        }
        i++;
      }
      guardar(comeco, i);
    }
  }
  return null; // acabou sem EOI
}

// ── PNG ──

/** Os blocos que desenham a imagem. Tudo o mais (eXIf, tEXt, zTXt, iTXt, tIME, iCCP, pHYs, blocos privados) sai. */
const PNG_FICA = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "sBIT"]);

function limparPng(b: Uint8Array): Uint8Array | null {
  const partes: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  let vistoIend = false;
  while (i + 12 <= b.length) {
    const tamanho = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const tipo = texto(b, i + 4, i + 8);
    const fim = i + 12 + tamanho;
    if (fim > b.length) return null;
    if (PNG_FICA.has(tipo)) partes.push(b.subarray(i, fim));
    i = fim;
    if (tipo === "IEND") {
      vistoIend = true;
      break; // o que vier depois do IEND não é imagem
    }
  }
  return vistoIend ? juntar(partes) : null;
}

// ── WebP ──

const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/** Tira os blocos EXIF, XMP e ICCP do WebP, limpa os bits correspondentes no VP8X e acerta o tamanho do contêiner. */
function limparWebp(b: Uint8Array): Uint8Array | null {
  const corpo: Uint8Array[] = [];
  let i = 12;
  const total = Math.min(b.length, u32le(b, 4) + 8);
  while (i + 8 <= total) {
    const tipo = texto(b, i, i + 4);
    const tamanho = u32le(b, i + 4);
    const fim = i + 8 + tamanho + (tamanho & 1);
    if (fim > total + 1 && i + 8 + tamanho > total) return null;
    const bloco = b.slice(i, Math.min(fim, b.length));
    if (tipo === "EXIF" || tipo === "XMP " || tipo === "ICCP") {
      i = fim;
      continue;
    }
    if (tipo === "VP8X" && tamanho >= 10) bloco[8] = bloco[8] & ~(0x20 | 0x08 | 0x04);
    corpo.push(bloco);
    i = fim;
  }
  if (!corpo.length) return null;
  const tamanhoCorpo = corpo.reduce((s, x) => s + x.length, 0);
  const cabeca = new Uint8Array(12);
  cabeca.set(b.subarray(0, 12));
  const t = tamanhoCorpo + 4;
  cabeca[4] = t & 0xff;
  cabeca[5] = (t >> 8) & 0xff;
  cabeca[6] = (t >> 16) & 0xff;
  cabeca[7] = (t >>> 24) & 0xff;
  return juntar([cabeca, ...corpo]);
}

function juntar(partes: Uint8Array[]): Uint8Array {
  const saida = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of partes) {
    saida.set(p, o);
    o += p.length;
  }
  return saida;
}

/** A imagem sem nenhum metadado, ou nulo se o arquivo não é uma imagem bem formada (a rota recusa). */
export function limparImagem(b: Uint8Array): Uint8Array | null {
  const id = identificarMidia(b);
  if (!id || id.tipo !== "imagem") return null;
  try {
    if (id.ext === "jpg") return limparJpeg(b);
    if (id.ext === "png") return limparPng(b);
    return limparWebp(b);
  } catch {
    return null;
  }
}

/** Largura e altura lidas do cabeçalho (sem decodificar); nulo se não der para ler. */
export function dimensoesDaImagem(b: Uint8Array): { largura: number; altura: number } | null {
  const id = identificarMidia(b);
  if (!id || id.tipo !== "imagem") return null;
  if (id.ext === "png") {
    if (b.length < 24) return null;
    return { largura: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, altura: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0 };
  }
  if (id.ext === "jpg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) {
        i++;
        continue;
      }
      if (semTamanho(m)) {
        i += 2;
        continue;
      }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { altura: (b[i + 5] << 8) | b[i + 6], largura: (b[i + 7] << 8) | b[i + 8] };
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
    return null;
  }
  // WebP
  let i = 12;
  while (i + 8 <= b.length) {
    const tipo = texto(b, i, i + 4);
    const dado = i + 8;
    if (tipo === "VP8X" && dado + 10 <= b.length) return { largura: 1 + (b[dado + 4] | (b[dado + 5] << 8) | (b[dado + 6] << 16)), altura: 1 + (b[dado + 7] | (b[dado + 8] << 8) | (b[dado + 9] << 16)) };
    if (tipo === "VP8 " && dado + 10 <= b.length) return { largura: (b[dado + 6] | (b[dado + 7] << 8)) & 0x3fff, altura: (b[dado + 8] | (b[dado + 9] << 8)) & 0x3fff };
    if (tipo === "VP8L" && dado + 5 <= b.length) {
      const bits = u32le(b, dado + 1);
      return { largura: (bits & 0x3fff) + 1, altura: ((bits >>> 14) & 0x3fff) + 1 };
    }
    i = dado + u32le(b, i + 4) + (u32le(b, i + 4) & 1);
  }
  return null;
}

/** O arquivo ainda carrega algum metadado que `limparImagem` tiraria? (Para o teste e para a conferência da rota.) */
export function temMetadado(b: Uint8Array): boolean {
  const limpo = limparImagem(b);
  return limpo === null ? true : limpo.length !== b.length;
}

/** Tamanhos máximos que a rota aceita (o depósito também limita a 3 MB). */
export const LIMITE_IMAGEM = 3 * 1024 * 1024;
export const LIMITE_AUDIO = 1_500_000;
export const MAX_LADO = 8000;

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A segunda limpeza do vídeo, no servidor (app/api/rede/video). A primeira é a do aparelho: o vídeo é regravado pelo gravador do
// navegador antes de sair (lib/rede/midia/regravar.ts), e o arquivo que sai já não leva GPS, modelo da câmera nem data.
// Aqui o servidor confere de novo, porque um cliente alterado poderia mandar o arquivo cru: identifica o formato pelos bytes (só
// MP4 e WEBM) e NEUTRALIZA, no lugar, tudo o que guarda metadado, sem mexer no que toca:
//   · MP4: as caixas "udta", "meta", "uuid" e "XMP_" viram "free" (o mesmo tamanho, o conteúdo zerado: nenhum deslocamento
//     muda) e as datas de criação e de mudança de "mvhd", "tkhd" e "mdhd" viram zero; faixa que não é de vídeo nem de som
//     ("hdlr" diferente de "vide" e "soun", ou entrada de metadado com tempo na "stsd", como a gpmd da GoPro, a camm do Android e
//     a mebx da Apple, que levam o GPS nos dados do "mdat") faz o arquivo ser recusado: o gravador do navegador só põe vídeo e som;
//   · WEBM: "Tags", "Attachments" e "Chapters" do segmento, e "DateUTC" e "Title" do "Info" e o "Name" de cada faixa, viram
//     "Void" (o elemento de enchimento da norma, do mesmo tamanho); faixa com tipo diferente de vídeo e de som (legenda,
//     metadado) faz o arquivo ser recusado.
// Estrutura que não fecha (caixa maior que o arquivo, elemento sem fim) = nulo, e a rota recusa o arquivo. Puro (os testes rodam
// no Node). Sem "@/" de propósito.

export type VideoIdentificado = { tipo: "video/mp4"; ext: "mp4" } | { tipo: "video/webm"; ext: "webm" };

const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

// As marcas de "ftyp" que são imagem (HEIF/AVIF), não vídeo.
const MARCAS_DE_IMAGEM = new Set(["heic", "heix", "heim", "heis", "mif1", "msf1", "avif", "avis"]);

/** O formato pelos bytes do começo (nunca pelo nome nem pelo tipo que o navegador diz). Nulo = não é MP4 nem WEBM. */
export function identificarVideo(b: Uint8Array): VideoIdentificado | null {
  if (b.length >= 12 && ascii(b, 4, 4) === "ftyp") {
    return MARCAS_DE_IMAGEM.has(ascii(b, 8, 4)) ? null : { tipo: "video/mp4", ext: "mp4" };
  }
  if (b.length >= 16 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    // O cabeçalho EBML diz o DocType: só "webm" (o Matroska geral pode levar anexos e capítulos de todo tipo).
    const cabeca = ascii(b, 0, Math.min(b.length, 64));
    return cabeca.includes("webm") ? { tipo: "video/webm", ext: "webm" } : null;
  }
  return null;
}

// ── MP4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const CAIXAS_DE_METADADO = new Set(["udta", "meta", "uuid", "XMP_"]);
const CAIXAS_COM_FILHAS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "mvex", "moof", "traf", "mfra"]);
const CAIXAS_COM_DATA = new Set(["mvhd", "tkhd", "mdhd"]);
// As faixas que o gravador do navegador escreve. Qualquer outra (metadado com tempo, texto, legenda, código de tempo) é recusada.
const FAIXAS_ACEITAS = new Set(["vide", "soun"]);
// Entradas da "stsd" de metadado com tempo (o GPS fica nos dados delas, no "mdat"): recusadas onde quer que apareçam.
const ENTRADAS_DE_METADADO = new Set(["gpmd", "camm", "mebx", "tmcd", "metx", "mett", "urim", "tx3g", "wvtt", "stpp"]);

function u32(b: Uint8Array, i: number): number {
  return ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
}

/** As entradas da "stsd" (versão e marcas, quantas, e cada uma com tamanho e tipo): nenhuma pode ser de metadado com tempo. */
function entradasAceitas(b: Uint8Array, inicio: number, fim: number): boolean {
  if (fim - inicio < 8) return false;
  const n = u32(b, inicio + 4);
  let i = inicio + 8;
  for (let k = 0; k < n; k++) {
    if (fim - i < 8) return false;
    const tamanho = u32(b, i);
    if (tamanho < 8 || i + tamanho > fim) return false;
    if (ENTRADAS_DE_METADADO.has(ascii(b, i + 4, 4))) return false;
    i += tamanho;
  }
  return true;
}

function limparMp4(b: Uint8Array, inicio: number, fim: number, nivel: number): boolean {
  if (nivel > 8) return false;
  let i = inicio;
  while (i < fim) {
    if (fim - i < 8) return false;
    let tamanho = u32(b, i);
    const tipo = ascii(b, i + 4, 4);
    let cabeca = 8;
    if (tamanho === 1) {
      if (fim - i < 16) return false;
      const alto = u32(b, i + 8);
      if (alto !== 0) return false; // mais de 4 GB: nada daqui chega perto
      tamanho = u32(b, i + 12);
      cabeca = 16;
    } else if (tamanho === 0) {
      tamanho = fim - i;
    }
    if (tamanho < cabeca || i + tamanho > fim) return false;
    if (CAIXAS_DE_METADADO.has(tipo)) {
      b.set([0x66, 0x72, 0x65, 0x65], i + 4); // "free"
      b.fill(0, i + cabeca, i + tamanho);
    } else if (CAIXAS_COM_DATA.has(tipo)) {
      const dados = i + cabeca;
      const versao = b[dados];
      const n = versao === 1 ? 16 : 8; // criação + mudança, 8 ou 4 bytes cada
      if (tamanho - cabeca < 4 + n) return false;
      b.fill(0, dados + 4, dados + 4 + n);
    } else if (tipo === "hdlr") {
      // versão e marcas (4), pre_defined (4), o tipo da faixa (4)
      if (tamanho - cabeca < 12 || !FAIXAS_ACEITAS.has(ascii(b, i + cabeca + 8, 4))) return false;
    } else if (tipo === "stsd") {
      if (!entradasAceitas(b, i + cabeca, i + tamanho)) return false;
    } else if (CAIXAS_COM_FILHAS.has(tipo)) {
      if (!limparMp4(b, i + cabeca, i + tamanho, nivel + 1)) return false;
    }
    i += tamanho;
  }
  return i === fim;
}

// ── WEBM (EBML) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const ID_EBML = 0x1a45dfa3;
const ID_SEGMENTO = 0x18538067;
const ID_CLUSTER = 0x1f43b675;
const ID_INFO = 0x1549a966;
const ID_FAIXAS = 0x1654ae6b;
const ID_FAIXA = 0xae;
const NO_SEGMENTO = new Set([0x114d9b74, ID_INFO, ID_FAIXAS, ID_CLUSTER, 0x1c53bb6b, 0x1043a770, 0x1254c367, 0x1941a469, 0xec, 0xbf]);
const NEUTRALIZAR_NO_SEGMENTO = new Set([0x1254c367, 0x1941a469, 0x1043a770]); // Tags, Attachments, Chapters
const NEUTRALIZAR_NO_INFO = new Set([0x4461, 0x7ba9]); // DateUTC, Title
const NEUTRALIZAR_NA_FAIXA = new Set([0x536e]); // Name
const ID_TIPO_DA_FAIXA = 0x83; // TrackType: 1 = vídeo, 2 = som; o resto (legenda, metadado, botões) é recusado
const NO_CLUSTER = new Set([0xe7, 0x5854, 0xa7, 0xab, 0xa3, 0xa0, 0xaf]);

interface Elemento {
  id: number;
  /** Onde começam os dados. */
  dados: number;
  /** Tamanho dos dados; nulo = "desconhecido" (o gravador ao vivo escreve assim o segmento e os clusters). */
  tamanho: number | null;
}

function lerElemento(b: Uint8Array, i: number, fim: number): Elemento | null {
  if (i >= fim) return null;
  const p = b[i];
  const nId = p >= 0x80 ? 1 : p >= 0x40 ? 2 : p >= 0x20 ? 3 : p >= 0x10 ? 4 : 0;
  if (!nId || i + nId > fim) return null;
  let id = 0;
  for (let k = 0; k < nId; k++) id = id * 256 + b[i + k];
  const j = i + nId;
  if (j >= fim) return null;
  const q = b[j];
  let nT = 0;
  for (let k = 0; k < 8; k++) {
    if (q & (0x80 >> k)) {
      nT = k + 1;
      break;
    }
  }
  if (!nT || j + nT > fim) return null;
  let tamanho = q & (0xff >> nT);
  let tudoUm = tamanho === 0xff >> nT;
  for (let k = 1; k < nT; k++) {
    tamanho = tamanho * 256 + b[j + k];
    if (b[j + k] !== 0xff) tudoUm = false;
  }
  return { id, dados: j + nT, tamanho: tudoUm ? null : tamanho };
}

/** Troca o elemento [inicio, fim) por um "Void" do mesmo tamanho total, com os dados zerados. */
function virarVazio(b: Uint8Array, inicio: number, fim: number): boolean {
  const total = fim - inicio;
  for (let s = 1; s <= 8; s++) {
    const n = total - 1 - s;
    if (n < 0) return false;
    if (n <= 2 ** (7 * s) - 2) {
      b[inicio] = 0xec;
      let resto = n;
      for (let k = s - 1; k >= 0; k--) {
        b[inicio + 1 + k] = resto & 0xff;
        resto = Math.floor(resto / 256);
      }
      b[inicio + 1] |= 0x80 >> (s - 1);
      b.fill(0, inicio + 1 + s, fim);
      return true;
    }
  }
  return false;
}

/** Os filhos de um elemento de tamanho conhecido: neutraliza os da lista e entra nas faixas (Name de cada uma). */
function limparFilhos(b: Uint8Array, inicio: number, fim: number, neutralizar: ReadonlySet<number>, entrarEm?: number): boolean {
  let i = inicio;
  while (i < fim) {
    const e = lerElemento(b, i, fim);
    if (!e || e.tamanho === null || e.dados + e.tamanho > fim) return false;
    const fimDele = e.dados + e.tamanho;
    if (neutralizar.has(e.id)) {
      if (!virarVazio(b, i, fimDele)) return false;
    } else if (entrarEm !== undefined && e.id === entrarEm) {
      if (!limparFilhos(b, e.dados, fimDele, NEUTRALIZAR_NA_FAIXA)) return false;
    } else if (entrarEm === undefined && neutralizar === NEUTRALIZAR_NA_FAIXA && e.id === ID_TIPO_DA_FAIXA) {
      let tipo = 0;
      for (let k = e.dados; k < fimDele; k++) tipo = tipo * 256 + b[k];
      if (tipo !== 1 && tipo !== 2) return false;
    }
    i = fimDele;
  }
  return i === fim;
}

/** O fim de um cluster de tamanho desconhecido: o primeiro elemento que não é de cluster (ou o fim do arquivo). */
function fimDoCluster(b: Uint8Array, inicio: number, fim: number): number | null {
  let i = inicio;
  while (i < fim) {
    const e = lerElemento(b, i, fim);
    if (!e) return null;
    if (!NO_CLUSTER.has(e.id)) return NO_SEGMENTO.has(e.id) || e.id === ID_SEGMENTO || e.id === ID_EBML ? i : null;
    if (e.tamanho === null || e.dados + e.tamanho > fim) return null;
    i = e.dados + e.tamanho;
  }
  return fim;
}

function limparWebm(b: Uint8Array): boolean {
  const fim = b.length;
  const cabeca = lerElemento(b, 0, fim);
  if (!cabeca || cabeca.id !== ID_EBML || cabeca.tamanho === null) return false;
  let i = cabeca.dados + cabeca.tamanho;
  let segmentos = 0;
  while (i < fim) {
    const seg = lerElemento(b, i, fim);
    if (!seg) return false;
    if (seg.id === 0xec) {
      // Enchimento entre os elementos de cima (raro, mas da norma).
      if (seg.tamanho === null || seg.dados + seg.tamanho > fim) return false;
      i = seg.dados + seg.tamanho;
      continue;
    }
    if (seg.id !== ID_SEGMENTO) return false;
    segmentos++;
    const fimSeg = seg.tamanho === null ? fim : seg.dados + seg.tamanho;
    if (fimSeg > fim) return false;
    let j = seg.dados;
    while (j < fimSeg) {
      const e = lerElemento(b, j, fimSeg);
      if (!e) return false;
      if (e.id === ID_SEGMENTO || e.id === ID_EBML) break; // outro segmento encadeado (o laço de fora segue)
      if (!NO_SEGMENTO.has(e.id)) return false;
      let fimDele: number | null;
      if (e.tamanho === null) {
        if (e.id !== ID_CLUSTER) return false;
        fimDele = fimDoCluster(b, e.dados, fimSeg);
      } else {
        fimDele = e.dados + e.tamanho;
      }
      if (fimDele === null || fimDele > fimSeg) return false;
      if (NEUTRALIZAR_NO_SEGMENTO.has(e.id)) {
        if (!virarVazio(b, j, fimDele)) return false;
      } else if (e.id === ID_INFO) {
        if (!limparFilhos(b, e.dados, fimDele, NEUTRALIZAR_NO_INFO)) return false;
      } else if (e.id === ID_FAIXAS) {
        if (!limparFilhos(b, e.dados, fimDele, new Set(), ID_FAIXA)) return false;
      }
      j = fimDele;
    }
    i = j;
  }
  return segmentos > 0;
}

/**
 * Uma cópia do vídeo com o metadado neutralizado (o original não muda). Nulo = não é MP4/WEBM ou a estrutura não fecha: a rota
 * recusa o arquivo.
 */
export function limparVideo(original: Uint8Array): { bytes: Uint8Array; tipo: VideoIdentificado } | null {
  const tipo = identificarVideo(original);
  if (!tipo) return null;
  const b = new Uint8Array(original);
  const ok = tipo.ext === "mp4" ? limparMp4(b, 0, b.length, 0) : limparWebm(b);
  return ok ? { bytes: b, tipo } : null;
}

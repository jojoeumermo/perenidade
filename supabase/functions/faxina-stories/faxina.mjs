// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A faxina dos stories (PLANO-ALUMIA §5 F5), sem nada do Deno: a Edge Function (index.ts) só entrega as formas de chamar o banco e
// o Storage, e o teste (scripts/testar-alumia-f5.mjs) roda isto direto no Node com dublês.
//
// Uma rodada:
//   1. pergunta ao banco o que fazer (public.rede_story_faxina_lista, só com a chave de serviço);
//   2. CONFERE as imagens novas: baixa, tira o que for metadado (EXIF/GPS, XMP, IPTC, comentários, texto do PNG) e, se mudou,
//      sobe de novo no mesmo caminho. O aparelho já refaz a imagem num canvas (lib/rede/stories/imagem.ts), então isto é a
//      segunda trava, do lado do servidor (LGPD art. 6º, III e art. 46). Arquivo que não é JPEG/PNG/WEBP de verdade: sai do ar;
//   3. APAGA os arquivos dos stories vencidos (fora de prova) e os órfãos, pela API do Storage, e só depois as linhas
//      (public.rede_story_faxina_feito). Apagar só a linha de storage.objects deixaria o arquivo no depósito.
// Nada daqui registra caminho, conteúdo nem quem é a autora: o retorno é só contagem.

const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const be32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));

function juntar(partes) {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const saida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

/** JPEG: fica o APP0 (JFIF), o APP2 (perfil de cor ICC) e o APP14 (Adobe, cor); saem APP1 (EXIF/XMP), APP3–13, APP15 e COM. */
function limparJpeg(b) {
  const partes = [b.subarray(0, 2)];
  let i = 2;
  let mudou = false;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marca = b[i + 1];
    if (marca === 0xff) {
      i++;
      continue;
    }
    if (marca === 0xda || marca === 0xd9) {
      // Começo da imagem comprimida (SOS) ou fim: o resto vai inteiro.
      partes.push(b.subarray(i));
      return { bytes: juntar(partes), mudou };
    }
    if (marca >= 0xd0 && marca <= 0xd7) {
      partes.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const tamanho = (b[i + 2] << 8) | b[i + 3];
    if (tamanho < 2 || i + 2 + tamanho > b.length) return null;
    const metadado = (marca >= 0xe1 && marca <= 0xef && marca !== 0xe2 && marca !== 0xee) || marca === 0xfe;
    if (metadado) mudou = true;
    else partes.push(b.subarray(i, i + 2 + tamanho));
    i += 2 + tamanho;
  }
  return null;
}

/** PNG: saem eXIf, tEXt, zTXt, iTXt e tIME (os blocos ficam inteiros, com o CRC de cada um). */
function limparPng(b) {
  const FORA = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  const partes = [b.subarray(0, 8)];
  let i = 8;
  let mudou = false;
  while (i + 12 <= b.length) {
    const tamanho = be32(b, i);
    const tipo = ascii(b, i + 4, 4);
    const fim = i + 12 + tamanho;
    if (fim > b.length) return null;
    if (FORA.has(tipo)) mudou = true;
    else partes.push(b.subarray(i, fim));
    i = fim;
    if (tipo === "IEND") return { bytes: juntar(partes), mudou };
  }
  return null;
}

/** WEBP: saem os blocos EXIF e "XMP " e o VP8X deixa de anunciá-los; o tamanho do RIFF é refeito. */
function limparWebp(b) {
  const partes = [];
  let i = 12;
  let mudou = false;
  let vp8x = null;
  while (i + 8 <= b.length) {
    const tipo = ascii(b, i, 4);
    const tamanho = u32(b, i + 4);
    const fim = i + 8 + tamanho + (tamanho & 1);
    if (i + 8 + tamanho > b.length) return null;
    const bloco = b.slice(i, Math.min(fim, b.length));
    if (tipo === "EXIF" || tipo === "XMP ") mudou = true;
    else {
      if (tipo === "VP8X") vp8x = bloco;
      partes.push(bloco);
    }
    i = fim;
  }
  if (partes.length === 0) return null;
  if (vp8x && vp8x.length >= 9 && vp8x[8] & 0x0c) {
    vp8x[8] &= ~0x0c;
    mudou = true;
  }
  const corpo = juntar(partes);
  const cab = new Uint8Array(12);
  cab.set(b.subarray(0, 4), 0);
  const tamanhoRiff = corpo.length + 4;
  cab[4] = tamanhoRiff & 0xff;
  cab[5] = (tamanhoRiff >> 8) & 0xff;
  cab[6] = (tamanhoRiff >> 16) & 0xff;
  cab[7] = (tamanhoRiff >>> 24) & 0xff;
  cab.set(b.subarray(8, 12), 8);
  return { bytes: juntar([cab, corpo]), mudou };
}

/**
 * Tira o metadado de uma imagem. Devolve { formato, bytes, mudou } ou null quando os bytes não são JPEG, PNG nem WEBP de verdade
 * (o nome do arquivo não conta: vale o que está dentro).
 */
export function limparMetadados(entrada) {
  const b = entrada instanceof Uint8Array ? entrada : new Uint8Array(entrada);
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const r = limparJpeg(b);
    return r && { formato: "jpeg", ...r };
  }
  if (b.length >= 8 && be32(b, 0) === 0x89504e47 && be32(b, 4) === 0x0d0a1a0a) {
    const r = limparPng(b);
    return r && { formato: "png", ...r };
  }
  if (b.length >= 20 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") {
    const r = limparWebp(b);
    return r && { formato: "webp", ...r };
  }
  return null;
}

/** O tipo que o arquivo deve ter pelo nome (o banco só aceita .webp, .png, .jpg, .mp4 e .webm). */
export function formatoDoCaminho(caminho) {
  const m = /\.(webp|png|jpg|mp4|webm)$/.exec(caminho);
  return m ? (m[1] === "jpg" ? "jpeg" : m[1]) : null;
}

/** As caixas de MP4/MOV que levam lugar ou dono: GPS da Apple (©xyz), "loci" (3GPP), metadado livre (udta/meta com texto, XMP). */
const CAIXAS_DE_LUGAR = ["\u00a9xyz", "loci", "XMP_"];
/** A caixa "uuid" do XMP (Adobe): BE7ACFCB-97A9-42E8-9C71-999491E3AFAC. */
const UUID_DO_XMP = "be7acfcb97a942e89c71999491e3afac";

/** Percorre as caixas de um MP4 (e as de dentro de moov/trak/udta/meta) e diz se alguma leva lugar ou XMP. */
function mp4TemLugar(b) {
  const pilha = [[0, b.length, 0]];
  const CONTEINERES = new Set(["moov", "trak", "udta", "mdia", "minf", "stbl", "edts", "moof", "traf", "meta", "ilst"]);
  let caixas = 0;
  while (pilha.length > 0) {
    const [ini, fim, fundo] = pilha.pop();
    let i = ini;
    while (i + 8 <= fim) {
      let tamanho = be32(b, i);
      const tipo = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
      let cab = 8;
      if (tamanho === 1 && i + 16 <= fim) {
        tamanho = be32(b, i + 8) * 2 ** 32 + be32(b, i + 12);
        cab = 16;
      } else if (tamanho === 0) tamanho = fim - i;
      if (tamanho < cab || i + tamanho > fim) return true; // estrutura estranha: não confia
      if (++caixas > 20000) return true;
      if (CAIXAS_DE_LUGAR.includes(tipo)) return true;
      if (tipo === "uuid" && i + cab + 16 <= fim && Array.from(b.subarray(i + cab, i + cab + 16), (x) => x.toString(16).padStart(2, "0")).join("") === UUID_DO_XMP) return true;
      if (CONTEINERES.has(tipo) && fundo < 8) pilha.push([i + cab + (tipo === "meta" ? 4 : 0), i + tamanho, fundo + 1]);
      i += tamanho;
    }
  }
  return false;
}

/**
 * Confere um vídeo: precisa ser MP4 (caixa ftyp no começo) ou WEBM (EBML) de verdade e, no MP4, sem caixa de lugar. O aparelho
 * regrava o vídeo num gravador (que não escreve lugar nenhum); se algo assim aparecer, o arquivo não veio da tela: sai do ar.
 * Devolve "mp4", "webm" ou nulo (ruim).
 */
export function conferirVideo(entrada) {
  const b = entrada instanceof Uint8Array ? entrada : new Uint8Array(entrada);
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    // WEBM: o gravador do navegador escreve só EBML, Segment, Info, Tracks e Clusters; "Tags" com lugar não sai dele.
    const texto = String.fromCharCode(...b.subarray(0, Math.min(b.length, 4096)));
    return /webm/.test(texto) && !/GPS|location|\u00a9xyz/i.test(texto) ? "webm" : null;
  }
  if (b.length >= 12 && ascii(b, 4, 4) === "ftyp") return mp4TemLugar(b) ? null : "mp4";
  return null;
}

/**
 * Uma rodada da faxina.
 *   chamar(funcao, argumentos) → o JSON da função do banco (chave de serviço);
 *   baixar(caminho) → Uint8Array; subir(caminho, bytes, tipo) → void (sobrescreve); remover(caminhos[]) → void.
 */
export async function rodada({ chamar, baixar, subir, remover, limite = 200 }) {
  const lista = await chamar("rede_story_faxina_lista", { p_limite: limite });
  const conferidos = [];
  const ruins = [];
  let limpos = 0;
  for (const { id, caminho } of lista.conferir ?? []) {
    try {
      const bytes = await baixar(caminho);
      const esperado = formatoDoCaminho(caminho);
      if (esperado === "mp4" || esperado === "webm") {
        if (conferirVideo(bytes) !== esperado) ruins.push(id);
        else conferidos.push(id);
        continue;
      }
      const r = limparMetadados(bytes);
      if (!r || r.formato !== formatoDoCaminho(caminho)) {
        ruins.push(id);
        continue;
      }
      if (r.mudou) {
        await subir(caminho, r.bytes, `image/${r.formato}`);
        limpos++;
      }
      conferidos.push(id);
    } catch {
      // Falhou a ida ao Storage: fica para a próxima rodada (o story continua no ar, como estava).
    }
  }
  const apagar = lista.apagar ?? [];
  const caminhos = [...apagar.map((x) => x.caminho), ...(lista.orfaos ?? [])];
  // O arquivo ruim NÃO sai agora: o story só sai do ar, e o arquivo vai na rodada em que a linha vence (ou fica, se virou prova).
  let apagados = [];
  const todos = caminhos;
  if (todos.length > 0) {
    try {
      for (let i = 0; i < todos.length; i += 100) await remover(todos.slice(i, i + 100));
      apagados = apagar.map((x) => x.id);
    } catch {
      apagados = [];
    }
  }
  const feito = await chamar("rede_story_faxina_feito", { p_apagados: apagados, p_conferidos: conferidos, p_ruins: ruins });
  return { apagados: feito?.apagados ?? 0, conferidos: conferidos.length, limpos, ruins: ruins.length, orfaos: (lista.orfaos ?? []).length };
}

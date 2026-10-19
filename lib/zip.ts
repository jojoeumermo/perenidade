// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/** Arquivos de um projeto: caminho relativo e conteúdo em texto. */
export interface ArquivoDoProjeto {
  nome: string;
  conteudo: string;
}

const TABELA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELA[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const LIMITE_TOTAL = 8 * 1024 * 1024;
const LIMITE_ARQUIVOS = 60;

/** Monta um .zip sem compressão (os projetos são pequenos e assim não precisa de biblioteca). */
export function montarZip(arquivos: ArquivoDoProjeto[]): Blob {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    const dados = enc.encode(a.conteudo);
    const crc = crc32(dados);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(dados.length), ...u32(dados.length), ...u16(nome.length), ...u16(0), ...nome]);
    partes.push(local, dados);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(dados.length), ...u32(dados.length), ...u16(nome.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(deslocamento), ...nome]));
    deslocamento += local.length + dados.length;
  }
  const tamanhoCentral = central.reduce((n, c) => n + c.length, 0);
  const fim = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(arquivos.length), ...u16(arquivos.length), ...u32(tamanhoCentral), ...u32(deslocamento), ...u16(0)]);
  return new Blob([...partes, ...central, fim] as unknown as BlobPart[], { type: "application/zip" });
}

/**
 * Lê um .zip (guardado ou comprimido com deflate) e devolve os arquivos de texto. Nada é executado; caminhos com
 * ".." ou absolutos são recusados, e há teto de quantidade e de tamanho (contra "zip bomb").
 */
export async function abrirZip(arquivo: Blob): Promise<ArquivoDoProjeto[]> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const v = new DataView(bytes.buffer);
  const dec = new TextDecoder();
  const saida: ArquivoDoProjeto[] = [];
  let pos = 0;
  let total = 0;
  while (pos + 30 <= bytes.length && v.getUint32(pos, true) === 0x04034b50) {
    const metodo = v.getUint16(pos + 8, true);
    const tamanhoComprimido = v.getUint32(pos + 18, true);
    const tamanho = v.getUint32(pos + 22, true);
    const nomeLen = v.getUint16(pos + 26, true);
    const extraLen = v.getUint16(pos + 28, true);
    const nome = dec.decode(bytes.subarray(pos + 30, pos + 30 + nomeLen));
    const inicio = pos + 30 + nomeLen + extraLen;
    const corpo = bytes.subarray(inicio, inicio + tamanhoComprimido);
    pos = inicio + tamanhoComprimido;
    if (nome.endsWith("/")) continue;
    if (nome.startsWith("/") || nome.includes("..") || nome.includes("\\")) throw new Error("caminho");
    if (tamanho > 2 * 1024 * 1024) throw new Error("grande");
    total += tamanho;
    if (total > LIMITE_TOTAL || saida.length >= LIMITE_ARQUIVOS) throw new Error("grande");
    let dados: Uint8Array;
    if (metodo === 0) dados = corpo;
    else if (metodo === 8) {
      const fluxo = new Blob([corpo]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      dados = new Uint8Array(await new Response(fluxo).arrayBuffer());
      if (dados.length > 2 * 1024 * 1024) throw new Error("grande");
    } else throw new Error("metodo");
    saida.push({ nome, conteudo: dec.decode(dados) });
  }
  if (saida.length === 0) throw new Error("vazio");
  return saida;
}

/** Monta um .zip sem compressão com arquivos binários (imagens já comprimidas): a mesma arte em vários formatos. */
export async function ziparBinarios(arquivos: { nome: string; dados: Blob | Uint8Array }[]): Promise<Blob> {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    const dados = a.dados instanceof Uint8Array ? a.dados : new Uint8Array(await a.dados.arrayBuffer());
    const crc = crc32(dados);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(dados.length), ...u32(dados.length), ...u16(nome.length), ...u16(0), ...nome]);
    partes.push(local, dados);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(dados.length), ...u32(dados.length), ...u16(nome.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(deslocamento), ...nome]));
    deslocamento += local.length + dados.length;
  }
  const tamanhoCentral = central.reduce((n, c) => n + c.length, 0);
  const fim = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(arquivos.length), ...u16(arquivos.length), ...u32(tamanhoCentral), ...u32(deslocamento), ...u16(0)]);
  return new Blob([...partes, ...central, fim] as unknown as BlobPart[], { type: "application/zip" });
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Um .zip na memória, para a cópia de "Meus dados" (app/api/rede/exportar). O formato é o do arquivo ZIP comum (APPNOTE da
// PKWARE): cabeçalho local + dados de cada arquivo, o diretório central e o fim do diretório. Texto (JSON, HTML) vai comprimido
// pelo zlib do próprio Node (deflate cru); imagem, áudio e vídeo, que já vêm comprimidos, vão guardados como estão. Nada aqui é
// cifra: é só embrulho. Nomes em UTF-8 (bit 11). Sem ZIP64: a rota limita o tamanho bem abaixo dos 4 GB. Só roda no servidor.
// Sem "@/" de propósito (o teste roda no Node).
import { crc32 as crc32DoNode, deflateRawSync } from "node:zlib";

export interface ArquivoDoZip {
  /** O caminho dentro do .zip, com "/" ("midias/foto.webp"). */
  nome: string;
  dados: Uint8Array;
  /** Guardar sem comprimir (o que já vem comprimido: imagem, áudio, vídeo). */
  guardado?: boolean;
}

// O crc32 do zlib entrou no Node 22.2; antes disso, a tabela de sempre.
let tabela: Uint32Array | null = null;
function crc32(dados: Uint8Array): number {
  if (typeof crc32DoNode === "function") return crc32DoNode(dados) >>> 0;
  if (!tabela) {
    tabela = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabela[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = tabela[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Data e hora no formato do MS-DOS que o ZIP usa (resolução de 2 segundos). */
function horaDoDos(d: Date): { hora: number; dia: number } {
  const ano = Math.max(1980, d.getFullYear());
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    dia: ((ano - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Um nome seguro dentro do .zip: sem barra no começo, sem "..", sem barra invertida. */
export function nomeSeguro(nome: string): string {
  const partes = nome.replace(/\\/g, "/").split("/").filter((p) => p && p !== "." && p !== "..");
  return partes.join("/").slice(0, 240) || "arquivo";
}

/** Monta o .zip. */
export function zipar(arquivos: ArquivoDoZip[], quando = new Date()): Uint8Array {
  const { hora, dia } = horaDoDos(quando);
  const codificar = new TextEncoder();
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let deslocamento = 0;
  const vistos = new Set<string>();

  for (const arquivo of arquivos) {
    let nome = nomeSeguro(arquivo.nome);
    for (let i = 2; vistos.has(nome); i++) nome = nomeSeguro(arquivo.nome).replace(/(\.[^./]+)?$/, `-${i}$1`);
    vistos.add(nome);
    const nomeBytes = codificar.encode(nome);
    const crc = crc32(arquivo.dados);
    const comprimido = arquivo.guardado ? arquivo.dados : new Uint8Array(deflateRawSync(arquivo.dados, { level: 9 }));
    // Se comprimir não ajudou, guarda como está.
    const usarDeflate = !arquivo.guardado && comprimido.length < arquivo.dados.length;
    const corpo = usarDeflate ? comprimido : arquivo.dados;
    const metodo = usarDeflate ? 8 : 0;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, metodo, true);
    local.setUint16(10, hora, true);
    local.setUint16(12, dia, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, corpo.length, true);
    local.setUint32(22, arquivo.dados.length, true);
    local.setUint16(26, nomeBytes.length, true);
    local.setUint16(28, 0, true);
    locais.push(new Uint8Array(local.buffer), nomeBytes, corpo);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, metodo, true);
    central.setUint16(12, hora, true);
    central.setUint16(14, dia, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, corpo.length, true);
    central.setUint32(24, arquivo.dados.length, true);
    central.setUint16(28, nomeBytes.length, true);
    central.setUint32(38, 0, true);
    central.setUint32(42, deslocamento, true);
    centrais.push(new Uint8Array(central.buffer), nomeBytes);

    deslocamento += 30 + nomeBytes.length + corpo.length;
  }

  const tamanhoCentral = centrais.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, vistos.size, true);
  fim.setUint16(10, vistos.size, true);
  fim.setUint32(12, tamanhoCentral, true);
  fim.setUint32(16, deslocamento, true);

  const partes = [...locais, ...centrais, new Uint8Array(fim.buffer)];
  const saida = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of partes) {
    saida.set(p, o);
    o += p.length;
  }
  return saida;
}

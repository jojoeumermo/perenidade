// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O anexo cifrado do chat da Alumia (Prompt 4, itens 137 e 138: áudio e vídeo curto, na conversa a dois e no grupo). Documento:
// docs/rede/CHAT-PRIVADO.md ("Áudio e vídeo").
//
// O caminho:
//   1. no aparelho, o arquivo é conferido (tipo pelos primeiros bytes, tamanho e duração) e cifrado com uma chave AES-256-GCM só
//      dele, sorteada na hora, com iv sorteado (a cifra de arquivo do painel: lib/anexos.ts, cifrarArquivo, presa à conversa pelo
//      AAD). O resumo do aberto vem de lá; aqui entra também o resumo do CIFRADO, conferido antes de abrir;
//   2. só o cifrado sobe ao depósito (app/api/alumia/anexo), que devolve um endereço sorteado de 128 bits;
//   3. a chave, o iv, os dois resumos, o endereço, o tipo, o tamanho e a duração viajam num CORPO DE ANEXO, que vai dentro do que o
//      chat já cifra: o bloco do tipo "anexo" (3) na conversa a dois (lib/rede/chat/r2/bloco.ts) e a aplicação "anexo" dentro da
//      mensagem MLS no grupo (lib/rede/membros/grupo.ts). Nenhum formato de envelope ou protocolo muda;
//   4. quem recebe baixa pelo endereço, confere o resumo do cifrado, abre e confere o resumo do aberto; mexido, não abre.
//
// Prompt 4, item 13 (lote da conversa, atrás de "alumia-p4-conversa"): a FOTO de ver uma vez. Vai pelo mesmo caminho, com o tipo 3;
// só existe como "ver uma vez" (o corpo de foto sem a marca não é lido) e só sai daqui sem nenhum metadado (a tela refaz a foto no
// canvas, e aqui a conferência recusa o arquivo que ainda tiver EXIF, XMP ou sobra).
//
// O corpo de anexo em bytes (versão 1, 141 bytes + o tipo MIME):
//   versão (1) = 1 | marcas (1: 1 = ver uma vez) | tipo (1: 1 = áudio, 2 = vídeo, 3 = foto) | endereço (16) | chave (32) | iv (12)
//   | resumo do cifrado (32) | resumo do aberto (32) | tamanho do cifrado (4) | tamanho do arquivo (4) | duração em ms (4) | dias (1)
//   | n (1) | MIME (n, ASCII)
//
// O tamanho que o servidor vê é ARREDONDADO: antes de cifrar, o arquivo ganha zeros até o próximo múltiplo de 64 KiB (PASSO); o
// tamanho de verdade vai só dentro do corpo, e quem abre corta os zeros. Assim o depósito vê "entre 64 e 128 KiB", e não o número
// exato de bytes de um áudio. A mensagem do chat leva só o corpo (uns 150 bytes), que cabe no envelope de tamanho fixo de sempre:
// o tamanho do arquivo não aparece no envelope nem muda o ritmo dos depósitos (lib/rede/caixas/ritmo.ts).
//
// Sem navegador obrigatório e sem "@/": roda no Node (scripts/testar-p4-anexo-cifrado.mjs). A ida e a volta pelo depósito estão em
// lib/rede/chat/anexo-deposito.ts.
import { cifrarArquivo, decifrarArquivo, deBase64, identificar, paraBase64 } from "../../anexos";
import { temMetadado } from "../publicar/midia";

export type TipoDoAnexo = "audio" | "video" | "imagem";
export type DiasDoAnexo = 1 | 7 | 30;

/** Os tetos, conferidos no aparelho antes de cifrar (e o do tamanho, de novo no servidor e no depósito). */
export const TETOS = {
  /** Áudio: o mesmo minuto do áudio do post (LIMITES_PUBLICAR.audioSegundos) e o tamanho do depósito de áudio do post. */
  audio: { segundos: 60, bytes: 3 * 1024 * 1024 },
  /**
   * Vídeo curto: um minuto e 159 degraus de 64 KiB (9,9 MiB). O cifrado (com a marca do GCM) fica abaixo dos 10 MiB que o Next deixa
   * passar pelo proxy.ts (proxyClientMaxBodySize, o padrão): acima disso o corpo chegaria cortado à rota.
   */
  video: { segundos: 60, bytes: 159 * 64 * 1024 },
  /** Foto de ver uma vez (item 13): o tamanho da imagem do story e do post (3 MB), sem duração. */
  imagem: { segundos: 0, bytes: 3 * 1024 * 1024 },
} as const;
/** A marca do AES-GCM (16 bytes) vem a mais no cifrado. */
export const MARCA_DO_GCM = 16;
/** O degrau do enchimento: o arquivo aberto vira múltiplo disto antes de cifrar. */
export const PASSO = 64 * 1024;
/** O tamanho do arquivo com o enchimento (o menor múltiplo de PASSO que cabe o arquivo, pelo menos um PASSO). */
export const comEnchimento = (n: number): number => Math.max(1, Math.ceil(n / PASSO)) * PASSO;
/** O maior cifrado que o depósito aceita (o teto do vídeo já é múltiplo de PASSO). */
export const MAIOR_CIFRADO = comEnchimento(TETOS.video.bytes) + MARCA_DO_GCM;
/** O tamanho de um cifrado que o depósito aceita: um múltiplo de PASSO mais a marca do GCM, até MAIOR_CIFRADO. */
export const tamanhoDoDepositoOk = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n > MARCA_DO_GCM && n <= MAIOR_CIFRADO && (n - MARCA_DO_GCM) % PASSO === 0;

const MIMES: Record<TipoDoAnexo, readonly string[]> = {
  audio: ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"],
  video: ["video/webm", "video/mp4"],
  imagem: ["image/jpeg", "image/png", "image/webp"],
};
const TIPO_EM_BYTE: Record<TipoDoAnexo, number> = { audio: 1, video: 2, imagem: 3 };
const VERSAO = 1;
const UMA_VEZ = 1;
const FIXO = 1 + 1 + 1 + 16 + 32 + 12 + 32 + 32 + 4 + 4 + 4 + 1 + 1;
const DIAS: readonly number[] = [1, 7, 30];

/** O que vai dentro do bloco cifrado do chat. Nada disto chega ao servidor. */
export interface CorpoDeAnexo {
  tipo: TipoDoAnexo;
  mime: string;
  /** O endereço sorteado no depósito (32 letras hexadecimais, 128 bits). */
  endereco: string;
  /** Chave (32 bytes), iv (12 bytes) e os resumos SHA-256 do cifrado e do aberto, em base64url. */
  chave: string;
  iv: string;
  resumoDoCifrado: string;
  resumoDoAberto: string;
  /** Tamanho do cifrado em bytes, com o enchimento (o único número que o servidor também vê, arredondado a PASSO). */
  tamanho: number;
  /** Tamanho do arquivo de verdade (só aqui dentro): quem abre corta o enchimento. */
  aberto: number;
  /** Duração em milissegundos. */
  duracaoMs: number;
  /** Quantos dias o arquivo fica no depósito (o prazo da mensagem). */
  dias: DiasDoAnexo;
  /** "Ver uma vez": quem abre pede ao depósito que apague. */
  umaVez?: boolean;
}

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
/** O cifrado tem o tamanho que o depósito aceita, e o arquivo de verdade cabe nele sem sobrar um PASSO inteiro de enchimento. */
function tamanhosConferem(tipo: TipoDoAnexo, tamanho: number, aberto: number): boolean {
  if (!tamanhoDoDepositoOk(tamanho) || !Number.isInteger(aberto) || aberto < 1 || aberto > TETOS[tipo].bytes) return false;
  return comEnchimento(aberto) + MARCA_DO_GCM === tamanho;
}
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const deHex = (s: string) => new Uint8Array(s.match(/../g)!.map((x) => parseInt(x, 16)));
export const enderecoValido = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{32}$/.test(s);

function bytesDe(b64: string, tamanho: number): Uint8Array {
  const b = deBase64(b64);
  if (b.length !== tamanho) throw erro("anexo_invalido");
  return b;
}
const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
};

/** O corpo em base64url, como fica guardado no histórico do aparelho (cifrado com o resto da mensagem). */
export const corpoParaGuardar = (b: Uint8Array): string => paraBase64(b);
/** O corpo guardado no histórico, de volta (null se não for um corpo de anexo válido). */
export function corpoGuardado(s: unknown): CorpoDeAnexo | null {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]{150,400}$/.test(s)) return null;
  return lerCorpoDeAnexo(deBase64(s));
}

/** O corpo em bytes (o que entra no bloco "anexo" ou na aplicação "anexo" do grupo). */
export function montarCorpoDeAnexo(c: CorpoDeAnexo): Uint8Array<ArrayBuffer> {
  if (!MIMES[c.tipo]?.includes(c.mime) || !enderecoValido(c.endereco) || !DIAS.includes(c.dias)) throw erro("anexo_invalido");
  if (c.tipo === "imagem" && !c.umaVez) throw erro("anexo_invalido");
  if (!tamanhosConferem(c.tipo, c.tamanho, c.aberto)) throw erro("anexo_grande");
  if (!Number.isInteger(c.duracaoMs) || c.duracaoMs < 0 || c.duracaoMs > TETOS[c.tipo].segundos * 1000) throw erro("anexo_longo");
  const mime = new TextEncoder().encode(c.mime);
  const saida = new Uint8Array(new ArrayBuffer(FIXO + mime.length));
  let i = 0;
  const por = (b: Uint8Array) => {
    saida.set(b, i);
    i += b.length;
  };
  por(new Uint8Array([VERSAO, c.umaVez ? UMA_VEZ : 0, TIPO_EM_BYTE[c.tipo]]));
  por(deHex(c.endereco));
  por(bytesDe(c.chave, 32));
  por(bytesDe(c.iv, 12));
  por(bytesDe(c.resumoDoCifrado, 32));
  por(bytesDe(c.resumoDoAberto, 32));
  por(u32(c.tamanho));
  por(u32(c.aberto));
  por(u32(c.duracaoMs));
  por(new Uint8Array([c.dias, mime.length]));
  por(mime);
  return saida;
}

/** Lê um corpo de anexo; null em qualquer coisa fora do formato (versão, marcas, tipo, tetos, MIME, sobra). */
export function lerCorpoDeAnexo(b: Uint8Array): CorpoDeAnexo | null {
  if (b.length < FIXO || b[0] !== VERSAO || b[1] & ~UMA_VEZ) return null;
  const tipo = (Object.keys(TIPO_EM_BYTE) as TipoDoAnexo[]).find((t) => TIPO_EM_BYTE[t] === b[2]);
  if (!tipo) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tamanho = v.getUint32(127);
  const aberto = v.getUint32(131);
  const duracaoMs = v.getUint32(135);
  const dias = b[139];
  const n = b[140];
  if (FIXO + n !== b.length || !DIAS.includes(dias)) return null;
  const mime = String.fromCharCode(...b.subarray(FIXO));
  if (!MIMES[tipo].includes(mime)) return null;
  if (!tamanhosConferem(tipo, tamanho, aberto) || duracaoMs > TETOS[tipo].segundos * 1000) return null;
  // A foto só existe como "ver uma vez" (item 13): um corpo de foto sem a marca, vindo de um aparelho alterado, não é lido.
  if (tipo === "imagem" && !(b[1] & UMA_VEZ)) return null;
  return {
    tipo,
    mime,
    endereco: hex(b.subarray(3, 19)),
    chave: paraBase64(b.subarray(19, 51)),
    iv: paraBase64(b.subarray(51, 63)),
    resumoDoCifrado: paraBase64(b.subarray(63, 95)),
    resumoDoAberto: paraBase64(b.subarray(95, 127)),
    tamanho,
    aberto,
    duracaoMs,
    dias: dias as DiasDoAnexo,
    ...(b[1] & UMA_VEZ ? { umaVez: true } : {}),
  };
}

async function sha256(b: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", b));
}

/**
 * Confere e cifra no aparelho. `mimeInformado` é o que o gravador ou o sistema diz (só desempata áudio de vídeo no WebM e no MP4);
 * o tipo vale pelos primeiros bytes. `duracaoMs` é medida no aparelho (o relógio do gravador, ou os metadados do vídeo).
 * Devolve o cifrado (o único que sai daqui) e o corpo, faltando o endereço que o depósito sortear.
 */
export async function prepararAnexo(
  aberto: Uint8Array<ArrayBuffer>,
  mimeInformado: string,
  duracaoMs: number,
  conversa: string,
  opcoes: { dias: DiasDoAnexo; umaVez?: boolean },
): Promise<{ cifrado: Uint8Array<ArrayBuffer>; corpo: Omit<CorpoDeAnexo, "endereco"> }> {
  const achado = identificar(aberto, mimeInformado);
  const tipo = achado?.tipo === "audio" || achado?.tipo === "video" || achado?.tipo === "imagem" ? achado.tipo : null;
  if (!tipo || !achado || !MIMES[tipo].includes(achado.mime)) throw erro("anexo_tipo");
  if (tipo === "imagem") {
    // A foto (item 13): só de ver uma vez, e sem nenhum metadado (lugar, câmera, data). A tela já a refez no canvas; esta é a trava.
    if (!opcoes.umaVez) throw erro("anexo_invalido");
    if (temMetadado(aberto)) throw erro("anexo_metadado");
  }
  if (aberto.length > TETOS[tipo].bytes) throw erro("anexo_grande");
  const ms = Math.round(duracaoMs);
  if (!Number.isFinite(ms) || ms < 0 || ms > TETOS[tipo].segundos * 1000) throw erro("anexo_longo");
  if (!DIAS.includes(opcoes.dias)) throw erro("anexo_invalido");
  // O enchimento: zeros até o próximo múltiplo de PASSO, dentro do cifrado (o resumo do aberto cobre o arquivo com os zeros).
  const cheio = new Uint8Array(new ArrayBuffer(comEnchimento(aberto.length)));
  cheio.set(aberto);
  const c = await cifrarArquivo(cheio, conversa);
  const resumoDoCifrado = paraBase64(await sha256(c.cifrado));
  return {
    cifrado: c.cifrado,
    corpo: {
      tipo, mime: achado.mime, chave: c.chave, iv: c.iv, resumoDoCifrado, resumoDoAberto: c.hash, tamanho: c.cifrado.length, aberto: aberto.length, duracaoMs: ms,
      dias: opcoes.dias, ...(opcoes.umaVez ? { umaVez: true } : {}),
    },
  };
}

/** Abre o que veio do depósito: confere o tamanho e o resumo do cifrado, decifra e confere o resumo do aberto. null se não bater. */
export async function abrirAnexo(cifrado: Uint8Array<ArrayBuffer>, corpo: CorpoDeAnexo, conversa: string): Promise<Uint8Array<ArrayBuffer> | null> {
  if (cifrado.length !== corpo.tamanho) return null;
  if (paraBase64(await sha256(cifrado)) !== corpo.resumoDoCifrado) return null;
  const cheio = await decifrarArquivo(cifrado, { chave: corpo.chave, iv: corpo.iv, hash: corpo.resumoDoAberto }, conversa);
  // Corta o enchimento (que tem de ser só zeros: o resumo já conferiu, isto é só a forma).
  if (!cheio || cheio.length < corpo.aberto || cheio.subarray(corpo.aberto).some((x) => x !== 0)) return null;
  return cheio.slice(0, corpo.aberto);
}

/** O contexto (AAD) do arquivo: preso à conversa a dois ou ao grupo, para um arquivo não passar de uma conversa a outra. */
export const contextoDaConversa = (lugar: "r2" | "grupo", id: string) => `${lugar}:${id}`;

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// Arquivos nas conversas (foto, vídeo, áudio, PDF, DOCX): cada arquivo é cifrado no aparelho com uma chave só dele
// (AES-GCM-256, WebCrypto) antes de subir; a chave, o vetor e o resumo do conteúdo viajam dentro da mensagem, que por
// sua vez é assinada e cifrada com a chave da conversa (lib/mensagem.ts, lib/chaveiro.ts). O banco guarda só o cifrado.
// O tipo do arquivo é conferido pelos primeiros bytes, não pela extensão nem pelo que o sistema diz.
//
// Este arquivo não depende do navegador, para poder ser testado no Node (scripts/testar-anexos.mjs).

export type TipoDeAnexo = "imagem" | "video" | "audio" | "pdf" | "docx";

export interface Anexo {
  /** A linha em interno.conversa_anexos. */
  id: string;
  tipo: TipoDeAnexo;
  mime: string;
  /** O nome que a pessoa vê (o arquivo no banco tem só o número). */
  nome: string;
  /** Tamanho do conteúdo aberto, em bytes. */
  tamanho: number;
  /** Chave e vetor do AES-GCM, e o SHA-256 do conteúdo aberto, todos em base64url. */
  chave: string;
  iv: string;
  hash: string;
  largura?: number;
  altura?: number;
  /** Áudio e vídeo: segundos. */
  duracao?: number;
  /** Áudio: a forma de onda, 0–100, para desenhar sem decodificar. */
  picos?: number[];
  /** Ver uma vez: cada pessoa abre uma única vez e o banco apaga depois. */
  uma_vez?: boolean;
}

/** Tamanho máximo do conteúdo aberto. Acima disso o aparelho recusa antes de cifrar, e o banco recusa o cifrado. */
export const LIMITE_BYTES = 12 * 1024 * 1024;
/** Quantos arquivos numa mensagem só. */
export const LIMITE_POR_MENSAGEM = 6;
/** Quantos picos a forma de onda de um áudio guarda. */
export const PICOS = 48;

const mimes: Record<TipoDeAnexo, string[]> = {
  imagem: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a", "audio/aac"],
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

const texto = (bytes: Uint8Array, de: number, ate: number) => String.fromCharCode(...bytes.subarray(de, ate));

/**
 * Descobre o tipo pelos primeiros bytes do arquivo. Devolve nulo para o que a conversa não aceita.
 * O MIME que o sistema informa só desempata o que a assinatura não distingue (um .m4a e um .mp4 começam igual).
 */
export function identificar(bytes: Uint8Array, mimeInformado = ""): { tipo: TipoDeAnexo; mime: string } | null {
  if (bytes.length < 12) return null;
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { tipo: "imagem", mime: "image/jpeg" };
  if (b[0] === 0x89 && texto(b, 1, 4) === "PNG") return { tipo: "imagem", mime: "image/png" };
  if (texto(b, 0, 4) === "RIFF" && texto(b, 8, 12) === "WEBP") return { tipo: "imagem", mime: "image/webp" };
  if (texto(b, 0, 4) === "GIF8") return { tipo: "imagem", mime: "image/gif" };
  if (texto(b, 0, 4) === "RIFF" && texto(b, 8, 12) === "WAVE") return { tipo: "audio", mime: "audio/wav" };
  if (texto(b, 0, 5) === "%PDF-") return { tipo: "pdf", mime: "application/pdf" };
  if (texto(b, 0, 4) === "OggS") return { tipo: "audio", mime: "audio/ogg" };
  if (texto(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe6) === 0xe2)) return { tipo: "audio", mime: "audio/mpeg" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    // Matroska/WebM: o gravador do navegador produz "audio/webm" ou "video/webm"; sem pista, fica como vídeo.
    return mimeInformado.startsWith("audio/") ? { tipo: "audio", mime: "audio/webm" } : { tipo: "video", mime: "video/webm" };
  }
  if (texto(b, 4, 8) === "ftyp") {
    const marca = texto(b, 8, 12);
    if (marca.startsWith("M4A") || mimeInformado.startsWith("audio/")) return { tipo: "audio", mime: "audio/mp4" };
    if (marca.startsWith("qt")) return { tipo: "video", mime: "video/quicktime" };
    return { tipo: "video", mime: "video/mp4" };
  }
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 && mimeInformado === mimes.docx[0]) return { tipo: "docx", mime: mimes.docx[0] };
  return null;
}

export const extensaoDe = (mime: string) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "application/pdf": "pdf", [mimes.docx[0]]: "docx" })[mime] ?? "bin";

export const mimeAceito = (tipo: TipoDeAnexo, mime: string) => mimes[tipo].includes(mime);

// ───────────────────────────── Base64url ─────────────────────────────

export function paraBase64(bytes: Uint8Array): string {
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deBase64(valor: string): Uint8Array<ArrayBuffer> {
  const binario = atob(valor.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** O banco guarda base64 comum (com + e /); o aparelho fala base64url. */
export function paraBase64Comum(bytes: Uint8Array): string {
  const semFim = paraBase64(bytes).replace(/-/g, "+").replace(/_/g, "/");
  // O banco (decode base64 do Postgres) exige o "=" do fim.
  return semFim + "=".repeat((4 - (semFim.length % 4)) % 4);
}
export const deBase64Comum = (valor: string) => deBase64(valor.replace(/\s+/g, ""));

// ───────────────────────────── Cifra do arquivo ─────────────────────────────

const contexto = (conversa: string) => new TextEncoder().encode(`anexo:${conversa}:v1`);

/** Cifra o arquivo com uma chave nova, presa à conversa (AAD). Devolve o cifrado e o que vai dentro da mensagem. */
export async function cifrarArquivo(bytes: Uint8Array<ArrayBuffer>, conversa: string): Promise<{ cifrado: Uint8Array<ArrayBuffer>; chave: string; iv: string; hash: string }> {
  if (bytes.length > LIMITE_BYTES) throw new Error("tamanho");
  const chave = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32)));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const aes = await crypto.subtle.importKey("raw", chave, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: contexto(conversa) }, aes, bytes));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return { cifrado, chave: paraBase64(chave), iv: paraBase64(iv), hash: paraBase64(hash) };
}

/** Abre o arquivo e confere o resumo contra o que veio na mensagem assinada. Nulo se não bater. */
export async function decifrarArquivo(cifrado: Uint8Array<ArrayBuffer>, anexo: Pick<Anexo, "chave" | "iv" | "hash">, conversa: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const aes = await crypto.subtle.importKey("raw", deBase64(anexo.chave), "AES-GCM", false, ["decrypt"]);
    const aberto = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(anexo.iv), additionalData: contexto(conversa) }, aes, cifrado));
    const hash = paraBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", aberto)));
    return hash === anexo.hash ? aberto : null;
  } catch {
    return null;
  }
}

// ───────────────────────────── Forma de onda ─────────────────────────────

/** Reduz as amostras de um áudio a alguns picos (0–100), para desenhar a forma de onda. */
export function picosDe(amostras: Float32Array | number[], quantidade = PICOS): number[] {
  if (amostras.length === 0) return Array.from({ length: quantidade }, () => 0);
  const passo = amostras.length / quantidade;
  const picos: number[] = [];
  for (let i = 0; i < quantidade; i++) {
    const de = Math.floor(i * passo);
    const ate = Math.max(de + 1, Math.floor((i + 1) * passo));
    let maior = 0;
    for (let j = de; j < ate && j < amostras.length; j++) maior = Math.max(maior, Math.abs(amostras[j]));
    picos.push(maior);
  }
  const teto = Math.max(...picos, 0.01);
  return picos.map((pico) => Math.round((pico / teto) * 100));
}

/** Confere o que chegou dentro de uma mensagem: campos e tamanhos, sem confiar em nada. */
export function anexoValido(valor: unknown): Anexo | null {
  if (!valor || typeof valor !== "object") return null;
  const a = valor as Record<string, unknown>;
  const id = typeof a.id === "string" && /^[0-9a-f-]{36}$/.test(a.id) ? a.id : null;
  const tipo = typeof a.tipo === "string" && a.tipo in mimes ? (a.tipo as TipoDeAnexo) : null;
  const mime = typeof a.mime === "string" ? a.mime : "";
  const b64 = (campo: unknown, tamanho: number) => (typeof campo === "string" && new RegExp(`^[A-Za-z0-9_-]{${tamanho}}$`).test(campo) ? campo : null);
  const chave = b64(a.chave, 43);
  const iv = b64(a.iv, 16);
  const hash = b64(a.hash, 43);
  const tamanho = typeof a.tamanho === "number" && Number.isInteger(a.tamanho) && a.tamanho > 0 && a.tamanho <= LIMITE_BYTES ? a.tamanho : null;
  if (!id || !tipo || !mimeAceito(tipo, mime) || !chave || !iv || !hash || !tamanho) return null;
  const numero = (campo: unknown, maximo: number) => (typeof campo === "number" && campo >= 0 && campo <= maximo ? Math.round(campo * 100) / 100 : undefined);
  const anexo: Anexo = { id, tipo, mime, nome: typeof a.nome === "string" ? a.nome.slice(0, 120) : `arquivo.${extensaoDe(mime)}`, tamanho, chave, iv, hash };
  const largura = numero(a.largura, 20000);
  const altura = numero(a.altura, 20000);
  if (largura && altura) Object.assign(anexo, { largura, altura });
  const duracao = numero(a.duracao, 36000);
  if (duracao !== undefined) anexo.duracao = duracao;
  if (Array.isArray(a.picos) && a.picos.length <= 120 && a.picos.every((pico) => typeof pico === "number")) anexo.picos = a.picos.map((pico) => Math.max(0, Math.min(100, Math.round(pico))));
  if (a.uma_vez === true) anexo.uma_vez = true;
  return anexo;
}

export const tamanhoLegivel = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

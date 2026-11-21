// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Peças de bytes da conversa a dois da onda R2 (lib/rede/chat/r2/). Nada de cifra aqui: só juntar, cortar, codificar e o texto
// canônico que vai assinado ou resumido. O resumo (SHA-256) e o HMAC vêm da @noble/hashes (auditada).
//
// O texto canônico: rótulo em UTF-8, um byte zero, e cada campo com o comprimento na frente (4 bytes). Assim dois conjuntos de
// campos diferentes nunca dão os mesmos bytes ("ab" | "c" e "a" | "bc" ficam diferentes), e um rótulo nunca vira o de outro uso.
// Sem navegador obrigatório: roda no Node nos testes (scripts/testar-r2-dupla.mjs).
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

export type Bytes = Uint8Array<ArrayBuffer>;

const codificador = new TextEncoder();
const decodificador = new TextDecoder("utf-8", { fatal: true });

export const texto = (s: string): Bytes => codificador.encode(s) as Bytes;
export const deTexto = (b: Uint8Array): string => decodificador.decode(b);

/** Uma cópia com o próprio ArrayBuffer (as bibliotecas pedem `Uint8Array<ArrayBuffer>`). */
export function copia(b: Uint8Array): Bytes {
  const saida = new Uint8Array(new ArrayBuffer(b.length));
  saida.set(b);
  return saida;
}

export function juntar(...partes: Uint8Array[]): Bytes {
  const saida = new Uint8Array(new ArrayBuffer(partes.reduce((n, p) => n + p.length, 0)));
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

export function u32(n: number): Bytes {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff_ffff) throw new Error("numero_invalido");
  const b = new Uint8Array(new ArrayBuffer(4));
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

export function lerU32(b: Uint8Array, em: number): number {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(em);
}

/** Bytes sorteados pelo gerador do sistema (crypto.getRandomValues). Nunca Math.random. */
export function sortear(n: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));
}

/** O texto canônico de um rótulo com os seus campos (veja o começo do arquivo). */
export function canonico(rotulo: string, ...campos: Uint8Array[]): Bytes {
  return juntar(texto(rotulo), new Uint8Array([0]), ...campos.flatMap((c) => [u32(c.length), c]));
}

export const resumo = (dados: Uint8Array): Bytes => copia(sha256(dados));
export const resumoRotulado = (rotulo: string, ...campos: Uint8Array[]): Bytes => resumo(canonico(rotulo, ...campos));
export const autenticar = (chave: Uint8Array, dados: Uint8Array): Bytes => copia(hmac(sha256, chave, dados));

/** Compara dois blocos de bytes sem parar no primeiro diferente (tempo que só depende do tamanho). */
export function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i];
  return diferenca === 0;
}

export function paraB64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deB64Url(texto64: string): Bytes {
  if (!/^[A-Za-z0-9_-]*$/.test(texto64)) throw new Error("base64_invalido");
  const s = atob(texto64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (texto64.length % 4)) % 4));
  const saida = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) saida[i] = s.charCodeAt(i);
  return saida;
}

export const paraHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/**
 * Completa `conteudo` até o menor dos `tamanhos` em que ele cabe: [4 bytes de comprimento][conteúdo][zeros]. Ao tirar, confere
 * tudo: tamanho da lista, o menor possível, e o resto só zero (comparado inteiro, sem parar no primeiro diferente).
 */
export function completar(conteudo: Uint8Array, tamanhos: readonly number[]): Bytes {
  const tamanho = tamanhos.find((t) => t >= conteudo.length + 4);
  if (!tamanho) throw new Error("conteudo_grande");
  const bloco = new Uint8Array(new ArrayBuffer(tamanho));
  new DataView(bloco.buffer).setUint32(0, conteudo.length);
  bloco.set(conteudo, 4);
  return bloco;
}

export function tirarCompleto(bloco: Uint8Array, tamanhos: readonly number[]): Bytes | null {
  if (!tamanhos.includes(bloco.length)) return null;
  const n = lerU32(bloco, 0);
  if (n + 4 > bloco.length) return null;
  if (tamanhos.find((t) => t >= n + 4) !== bloco.length) return null;
  let sobra = 0;
  for (let i = 4 + n; i < bloco.length; i++) sobra |= bloco[i];
  if (sobra !== 0) return null;
  return copia(bloco.subarray(4, 4 + n));
}

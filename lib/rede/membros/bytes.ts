// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Peças de bytes dos grupos com membros escondidos (lib/rede/membros). Nada de cifra aqui: só juntar, medir, comparar em tempo
// constante e escrever os textos canônicos que vão ser assinados (rótulo, depois cada campo com o comprimento na frente; nunca
// JSON solto, que muda de ordem e de espaço).
//
// Sem "@/" e sem navegador: roda no Node nos testes (scripts/testar-r2-membros.mjs).
import { sha256 } from "@noble/hashes/sha2.js";

const codificador = new TextEncoder();

export function texto(t: string): Uint8Array {
  return codificador.encode(t);
}

export function juntar(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const saida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

export function u32(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error("numero_invalido");
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

export function u64(n: bigint): Uint8Array {
  if (n < BigInt(0) || n > BigInt("0xffffffffffffffff")) throw new Error("numero_invalido");
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n);
  return b;
}

export function lerU32(b: Uint8Array, em: number): number {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(em);
}

export function lerU64(b: Uint8Array, em: number): bigint {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getBigUint64(em);
}

/** O texto canônico de uma assinatura: rótulo, um zero, e cada campo com o comprimento (4 bytes) na frente. */
export function canonico(rotulo: string, ...campos: Uint8Array[]): Uint8Array {
  return juntar(texto(rotulo), new Uint8Array([0]), ...campos.flatMap((c) => [u32(c.length), c]));
}

/** Compara sem sair mais cedo no primeiro byte diferente (marcas, passes e resumos). */
export function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export function resumo(...partes: Uint8Array[]): Uint8Array {
  return sha256(juntar(...partes));
}

export function paraB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deB64(t: string): Uint8Array {
  if (typeof t !== "string" || !/^[A-Za-z0-9_-]*$/.test(t)) throw new Error("base64_invalido");
  const s = atob(t.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (t.length % 4)) % 4));
  const saida = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) saida[i] = s.charCodeAt(i);
  return saida;
}

export function sorteados(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/**
 * Completa o conteúdo até o menor tamanho da lista que couber: [4 bytes de comprimento][conteúdo][zeros]. Ao tirar, confere que
 * o tamanho é da lista, que é o menor que cabia e que o resto é só zero (qualquer outra coisa é recusada).
 */
export function completar(conteudo: Uint8Array, tamanhos: readonly number[]): Uint8Array {
  const tamanho = tamanhos.find((t) => t >= 4 + conteudo.length);
  if (!tamanho) throw new Error("conteudo_grande");
  const bloco = new Uint8Array(tamanho);
  bloco.set(u32(conteudo.length), 0);
  bloco.set(conteudo, 4);
  return bloco;
}

export function tirarCompleto(bloco: Uint8Array, tamanhos: readonly number[]): Uint8Array | null {
  if (!tamanhos.includes(bloco.length) || bloco.length < 4) return null;
  const n = lerU32(bloco, 0);
  if (4 + n > bloco.length || tamanhos.find((t) => t >= 4 + n) !== bloco.length) return null;
  let resto = 0;
  for (let i = 4 + n; i < bloco.length; i++) resto |= bloco[i];
  return resto === 0 ? bloco.slice(4, 4 + n) : null;
}

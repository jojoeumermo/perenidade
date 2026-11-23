// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o aparelho e o servidor dividem nas caixas anônimas da R2 (supabase/migracoes/20261124-r2-caixas.sql): os rótulos de cada
// finalidade, o resumo com rótulo (SHA-256 da @noble/hashes, auditada), base64 de endereço e o sorteio de bytes. Nada de cifra feita
// à mão aqui: só resumo, HMAC e conversão de formato.
// Sem "@/" de propósito: roda no Node nos testes.
import { sha256 } from "@noble/hashes/sha2.js";

/** Os rótulos do módulo das caixas (um por finalidade; lib/rede/cifra/rotulos.ts junta os de todas e confere que não se repetem). */
export const ROTULOS = {
  caixa: "alumia/r2/caixa",
  passeDeposito: "alumia/r2/passe-deposito",
  passeLeitura: "alumia/r2/passe-leitura",
  franquia: "alumia/r2/franquia/v1",
  marca: "alumia/r2/marca/v2",
  marcaChave: "alumia/r2/marca/chave/v1",
  passes: "alumia/r2/passes/v1",
  passeGasto: "alumia/r2/passes/gasto/v1",
  passesDoDia: "alumia/r2/passes/emitidos/v1",
  pedido: "alumia/r2/pedido/v1",
  pedidoDesafio: "alumia/r2/pedido/desafio/v1",
  pedidoGasto: "alumia/r2/pedido/gasto/v1",
} as const;

const texto = new TextEncoder();

/** Junta pedaços de bytes. */
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

/** SHA-256(rótulo ‖ valor): o resumo que o banco guarda no lugar do segredo. */
export const resumo = (rotulo: string, valor: Uint8Array): Uint8Array => sha256(juntar(texto.encode(rotulo), valor));

/** `n` bytes do sorteio do sistema (crypto.getRandomValues). Nunca Math.random. */
export function sortear(n: number): Uint8Array {
  const saida = new Uint8Array(n);
  globalThis.crypto.getRandomValues(saida);
  return saida;
}

/** Bytes para base64 de endereço (sem "="). */
export function paraB64u(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Base64 (de endereço ou padrão) para bytes; nulo se não for base64. `tamanho` confere o comprimento, quando dado. */
export function deB64u(texto64: unknown, tamanho?: number): Uint8Array | null {
  if (typeof texto64 !== "string" || !/^[A-Za-z0-9_\-+/]*={0,2}$/.test(texto64) || texto64.length === 0) return null;
  try {
    const padrao = texto64.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    const bin = atob(padrao + "=".repeat((4 - (padrao.length % 4)) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (tamanho !== undefined && bytes.length !== tamanho) return null;
    return bytes;
  } catch {
    return null;
  }
}

/** Base64 padrão (o que o banco lê em jsonb). */
export const paraB64 = (bytes: Uint8Array): string => paraB64u(bytes).replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (Math.ceil((bytes.length * 4) / 3) % 4)) % 4);

/** Bytes no formato de entrada do bytea pelo PostgREST ("\x" + hexadecimal). */
export const paraBytea = (bytes: Uint8Array): string => `\\x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

/** Comparação de bytes em tempo constante (para o mesmo comprimento). */
export function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/** O dia de hoje (ou de `ms`) em UTC, "AAAA-MM-DD": o único momento que as caixas guardam. */
export const diaUtc = (ms: number = Date.now()): string => new Date(ms).toISOString().slice(0, 10);

/** Texto para bytes (UTF-8). */
export const bytesDe = (t: string): Uint8Array => texto.encode(t);

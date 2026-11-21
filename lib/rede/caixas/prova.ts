// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A prova de trabalho do pedido de conversa (onda R2, item 2.5): o aparelho acha um `nonce` tal que SHA-256(desafio ‖ nonce) comece por
// BITS bits zero (~1 milhão de tentativas, alguns segundos). Junto com o passe anônimo, encarece a enxurrada de pedidos sem que o
// servidor saiba quem pede. O desafio vem do servidor (lib/rede/caixas/prova-servidor.ts) e vale 10 minutos, uma vez só.
// Sem "@/" de propósito.
import { sha256 } from "@noble/hashes/sha2.js";
import { juntar } from "./base";

/** Quantos bits zero no começo do resumo. */
export const BITS = 20;
/** O tamanho do desafio: minuto (4) ‖ sorteio (16) ‖ HMAC (32). */
export const TAMANHO_DO_DESAFIO = 52;
export const TAMANHO_DO_NONCE = 8;

/** Os primeiros `bits` bits de `h` são zero? */
export function zerosNoComeco(h: Uint8Array, bits: number): boolean {
  const inteiros = Math.floor(bits / 8);
  for (let i = 0; i < inteiros; i++) if (h[i] !== 0) return false;
  const resto = bits % 8;
  return resto === 0 || h[inteiros] >> (8 - resto) === 0;
}

/** A resposta confere? (Usada pelo servidor; o aparelho usa para parar de procurar.) */
export function provaConfere(desafio: Uint8Array, nonce: Uint8Array, bits: number = BITS): boolean {
  return nonce.length === TAMANHO_DO_NONCE && zerosNoComeco(sha256(juntar(desafio, nonce)), bits);
}

/**
 * Procura a resposta. Devolve o controle à tela a cada 4096 tentativas (não trava a página). `limite` de tentativas para não rodar
 * para sempre (o esperado é 2^BITS; o limite é 64 vezes isso).
 */
export async function resolverProva(desafio: Uint8Array, bits: number = BITS, limite: number = 2 ** (bits + 6)): Promise<Uint8Array> {
  const nonce = new Uint8Array(TAMANHO_DO_NONCE);
  const visao = new DataView(nonce.buffer);
  const entrada = new Uint8Array(desafio.length + TAMANHO_DO_NONCE);
  entrada.set(desafio, 0);
  for (let n = 0; n < limite; n++) {
    visao.setUint32(0, Math.floor(n / 2 ** 32));
    visao.setUint32(4, n >>> 0);
    entrada.set(nonce, desafio.length);
    if (zerosNoComeco(sha256(entrada), bits)) return nonce.slice();
    if ((n & 4095) === 4095) await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("prova_nao_achada");
}

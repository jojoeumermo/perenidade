// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O desafio da prova de trabalho do pedido de conversa, sem estado: minuto (u32) ‖ 16 bytes sorteados ‖ HMAC-SHA-256 (chave tirada de
// ALUMIA_PASSES_SEGREDO) sobre os dois. Vale 10 minutos; o resumo do desafio usado vai para interno.passes_gastos no mesmo lote do
// pedido (usado de novo, recusado). Nada é gravado ao emitir. Só no servidor do site.
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesDe, iguais, juntar, resumo, ROTULOS, sortear } from "./base";
import { BITS, provaConfere, TAMANHO_DO_DESAFIO } from "./prova";

const VALIDADE_MIN = 10;

const chaveDoDesafio = (segredo: string) => hkdf(sha256, bytesDe(segredo), undefined, bytesDe(ROTULOS.pedidoDesafio), 32);

/** Um desafio novo (o minuto de agora). */
export function emitirDesafioDoPedido(segredo: string, agora: number = Date.now()): { desafio: Uint8Array; bits: number } {
  const cabeca = new Uint8Array(4);
  new DataView(cabeca.buffer).setUint32(0, Math.floor(agora / 60_000));
  const corpo = juntar(cabeca, sortear(16));
  return { desafio: juntar(corpo, hmac(sha256, chaveDoDesafio(segredo), juntar(bytesDe(ROTULOS.pedido), corpo))), bits: BITS };
}

/**
 * Confere desafio e resposta: é nosso (HMAC, comparação em tempo constante), está no prazo e a resposta tem os bits zero. Devolve o
 * resumo a gastar (o banco recusa o repetido), ou nulo.
 */
export function conferirDesafioDoPedido(segredo: string, desafio: Uint8Array, nonce: Uint8Array, agora: number = Date.now()): Uint8Array | null {
  if (desafio.length !== TAMANHO_DO_DESAFIO) return null;
  const corpo = desafio.subarray(0, 20);
  const esperado = hmac(sha256, chaveDoDesafio(segredo), juntar(bytesDe(ROTULOS.pedido), corpo));
  if (!iguais(esperado, desafio.subarray(20))) return null;
  const minuto = new DataView(desafio.buffer, desafio.byteOffset, 4).getUint32(0);
  const idade = Math.floor(agora / 60_000) - minuto;
  if (idade < 0 || idade > VALIDADE_MIN) return null;
  if (!provaConfere(desafio, nonce)) return null;
  return resumo(ROTULOS.pedidoGasto, desafio);
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que a tela do chat a dois usa do protocolo (onda R2): o tamanho do texto e o código de segurança. A cifra mesmo está em
// lib/rede/chat/r2/ (Proteus do @wireapp/core-crypto dentro do envelope X-Wing, desenho em docs/rede/CHAT-PRIVADO.md). O formato
// "c2"/"c3" e a chave por conversa do chat do beta saíram com ele (supabase/migracoes/20261124-r2-dupla.sql).
//
// A "identidade" que a tela passa de um lado para o outro é o texto "<conta>:<identidade Ed25519 da conta em base64url>": o código
// de segurança da R2 é da identidade DA CONTA (não muda quando a pessoa liga outro aparelho) e leva a conta junto.
// Sem "@/" e sem navegador: roda no Node nos testes.
import { deB64Url } from "./chat/r2/bytes";
import { codigoDeSeguranca as codigoR2, metadeDoCodigo as metadeR2 } from "./chat/r2/certificados";

export const MAX_CARACTERES = 2000;
const MAX_BYTES = 8000;

/** O texto cabe? (caracteres e bytes; vazio não vai). */
export function textoCabe(texto: string): boolean {
  const limpo = texto.trim();
  return limpo.length > 0 && [...limpo].length <= MAX_CARACTERES && new TextEncoder().encode(limpo).length <= MAX_BYTES;
}

/** "<conta>:<identidade em base64url>", o jeito da tela dizer de quem é uma identidade. */
export const identidadeNaTela = (conta: string, identidade: string) => `${conta}:${identidade}`;
function lerIdentidade(t: string): { conta: string; identidade: Uint8Array } {
  const i = t.indexOf(":");
  const identidade = deB64Url(t.slice(i + 1));
  if (i < 1 || identidade.length !== 32) throw new Error("identidade_invalida");
  return { conta: t.slice(0, i), identidade };
}

/** A metade do código de uma pessoa (30 algarismos). */
export async function metadeDoCodigo(identidade: string): Promise<string> {
  const { conta, identidade: bytes } = lerIdentidade(identidade);
  return metadeR2(conta, bytes);
}

/** O código de segurança de uma conversa (60 algarismos, o mesmo para as duas pessoas). */
export async function codigoDeSeguranca(a: string, b: string): Promise<string> {
  return codigoR2(lerIdentidade(a), lerIdentidade(b));
}

/**
 * Confiar na primeira vez, avisar quando mudar. `conhecida`: a identidade que este aparelho já guardou da pessoa. "nova": guarde;
 * "igual": segue; "mudou": a pessoa trocou de identidade (ou alguém tenta se passar por ela): avisa e nada sai até confirmar.
 */
export function compararIdentidade(conhecida: string | null | undefined, atual: string): "nova" | "igual" | "mudou" {
  if (!conhecida) return "nova";
  return conhecida === atual ? "igual" : "mudou";
}

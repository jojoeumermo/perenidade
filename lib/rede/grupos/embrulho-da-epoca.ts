// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O embrulho de grupo: nada do MLS sai do aparelho sem ele. O commit do MLS sai da biblioteca como "mensagem pública" (quem manda
// e o que muda às claras) e a mensagem privada do MLS traz o grupo e a época no cabeçalho; embrulhado, o servidor vê só um bloco de
// tamanho fixo. Formato:
//
//   0x47 ‖ versão (1) ‖ época (u64, big-endian) ‖ nonce (24) ‖ XChaCha20-Poly1305(k_época, conteúdo completado, aad)
//   conteúdo = tipo (1) ‖ tamanho (u32) ‖ bytes ‖ zeros até 2048, 8192, 32768 ou 131072
//   aad      = amarração do grupo (epoca.ts) ‖ os 10 primeiros bytes (marca, versão, época)
//
// A chave vem do exporter da época (epoca.ts); o nonce é sorteado a cada embrulho (24 bytes: sem risco de repetir sob a mesma
// chave). A cifra é a da libsodium (crypto_aead_xchacha20poly1305_ietf), nada feito à mão. O tipo e a época estão dentro do que a
// cifra autentica: um commit não passa por mensagem, nem um embrulho de uma época por outro.
//
// O mesmo arquivo dá `selar`/`abrirSelado` (XChaCha20-Poly1305 com nonce sorteado) para os posts "p2" e as mensagens "m1".
// Sem "@/": roda no Node nos testes.
import { carregarSodio } from "../cifra/sodio";

export const MARCA = 0x47;
export const VERSAO = 1;
/** Os tamanhos do conteúdo completado. O banco aceita só embrulhos de 34 + n + 16 bytes para estes n. */
export const TAMANHOS_GRUPO = [2048, 8192, 32768, 131072] as const;
export const CABECALHO = 1 + 1 + 8 + 24;
export const MARCA_DA_CIFRA = 16;
/** Os tamanhos de embrulho que existem (o banco confere contra esta lista). */
export const TAMANHOS_DO_EMBRULHO: readonly number[] = TAMANHOS_GRUPO.map((n) => CABECALHO + n + MARCA_DA_CIFRA);

export const TIPO = {
  /** Um commit do MLS (leva o grupo à época seguinte). */
  commit: 1,
  /** Uma mensagem de aplicação do MLS. */
  aplicacao: 2,
} as const;
export type Tipo = (typeof TIPO)[keyof typeof TIPO];
const TIPOS = new Set<number>(Object.values(TIPO));

function cabecalho(epoca: bigint): Uint8Array {
  const c = new Uint8Array(10);
  c[0] = MARCA;
  c[1] = VERSAO;
  new DataView(c.buffer).setBigUint64(2, epoca, false);
  return c;
}
function juntar(...partes: Uint8Array[]): Uint8Array {
  const saida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

/** Embrulha um conteúdo do MLS para o grupo. Lança "grande_demais" acima de 131072 bytes. */
export async function embrulhar(chave: Uint8Array, amarra: Uint8Array, epoca: bigint, tipo: Tipo, bytes: Uint8Array): Promise<Uint8Array> {
  if (chave.length !== 32 || amarra.length !== 32) throw new Error("chave_invalida");
  if (!TIPOS.has(tipo)) throw new Error("tipo_invalido");
  const n = TAMANHOS_GRUPO.find((t) => t >= bytes.length + 5);
  if (!n) throw new Error("grande_demais");
  const S = await carregarSodio();
  const conteudo = new Uint8Array(n);
  conteudo[0] = tipo;
  new DataView(conteudo.buffer).setUint32(1, bytes.length, false);
  conteudo.set(bytes, 5);
  const c = cabecalho(epoca);
  const nonce = S.randombytes_buf(S.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  try {
    const cifrado = S.crypto_aead_xchacha20poly1305_ietf_encrypt(conteudo, juntar(amarra, c), null, nonce, chave);
    return juntar(c, nonce, cifrado);
  } finally {
    conteudo.fill(0);
  }
}

/** A época escrita num embrulho (sem abrir), ou null se não é um embrulho de grupo. */
export function epocaDoEmbrulho(embrulho: Uint8Array): bigint | null {
  if (!TAMANHOS_DO_EMBRULHO.includes(embrulho.length) || embrulho[0] !== MARCA || embrulho[1] !== VERSAO) return null;
  return new DataView(embrulho.buffer, embrulho.byteOffset, embrulho.byteLength).getBigUint64(2, false);
}

/**
 * Abre um embrulho do grupo. Devolve null se não abre (outra chave, outro grupo, outra época, mexido, tamanho fora da
 * lista) ou se o tipo não é o esperado: nunca lança por causa do conteúdo.
 */
export async function desembrulhar(chave: Uint8Array, amarra: Uint8Array, embrulho: Uint8Array, esperado: Tipo): Promise<{ epoca: bigint; bytes: Uint8Array } | null> {
  const epoca = epocaDoEmbrulho(embrulho);
  if (epoca === null || chave.length !== 32 || amarra.length !== 32) return null;
  const S = await carregarSodio();
  let conteudo: Uint8Array;
  try {
    conteudo = S.crypto_aead_xchacha20poly1305_ietf_decrypt(null, embrulho.subarray(CABECALHO), juntar(amarra, embrulho.subarray(0, 10)), embrulho.subarray(10, CABECALHO), chave);
  } catch {
    return null;
  }
  const tamanho = new DataView(conteudo.buffer, conteudo.byteOffset, conteudo.byteLength).getUint32(1, false);
  if (conteudo[0] !== esperado || tamanho > conteudo.length - 5 || conteudo.subarray(5 + tamanho).some((b) => b !== 0)) return null;
  return { epoca, bytes: conteudo.slice(5, 5 + tamanho) };
}

/** Sela dados com uma chave de 32 bytes (XChaCha20-Poly1305, nonce sorteado de 24 bytes): nonce ‖ cifrado. */
export async function selar(chave: Uint8Array, dados: Uint8Array, aad: Uint8Array): Promise<Uint8Array> {
  if (chave.length !== 32) throw new Error("chave_invalida");
  const S = await carregarSodio();
  const nonce = S.randombytes_buf(S.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  return juntar(nonce, S.crypto_aead_xchacha20poly1305_ietf_encrypt(dados, aad, null, nonce, chave));
}

/** Abre o que `selar` fez (null se não abre). */
export async function abrirSelado(chave: Uint8Array, selado: Uint8Array, aad: Uint8Array): Promise<Uint8Array | null> {
  if (chave.length !== 32 || selado.length < 24 + 16) return null;
  const S = await carregarSodio();
  try {
    return S.crypto_aead_xchacha20poly1305_ietf_decrypt(null, selado.subarray(24), aad, selado.subarray(0, 24), chave);
  } catch {
    return null;
  }
}

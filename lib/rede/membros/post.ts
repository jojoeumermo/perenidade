// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os posts restritos (p2) de um grupo: o corpo vai cifrado com a chave de posts da época (lib/rede/membros/segredos.ts), por
// XChaCha20-Poly1305 da libsodium, com nonce sorteado e, como dados associados, o id do grupo e a época. O post viaja como
// mensagem de aplicação do MLS (que diz, só aos membros, qual folha escreveu) na caixa da época: o banco não guarda mais quem
// postou nem em qual grupo. Post de outra época, de outro grupo ou mexido não abre.
import { carregarSodio } from "../cifra/sodio";
import { canonico, completar, juntar, lerU64, sorteados, tirarCompleto, u64 } from "./bytes";
import { ROTULOS } from "./rotulos";
import type { SegredosDaEpoca } from "./segredos";

const MAGICO = 0x50;
const TAMANHOS_DO_POST = [1024, 4096, 16384, 65536] as const;

function dadosAssociados(grupo: Uint8Array, epoca: bigint): Uint8Array {
  return canonico(ROTULOS.postP2, grupo, u64(epoca));
}

export async function cifrarPost(s: SegredosDaEpoca, grupo: Uint8Array, corpo: Uint8Array): Promise<Uint8Array> {
  const S = await carregarSodio();
  const nonce = sorteados(S.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const cifrado = S.crypto_aead_xchacha20poly1305_ietf_encrypt(completar(corpo, TAMANHOS_DO_POST), dadosAssociados(grupo, s.epoca), null, nonce, s.post);
  return juntar(new Uint8Array([MAGICO]), u64(s.epoca), nonce, cifrado);
}

export async function abrirPost(s: SegredosDaEpoca, grupo: Uint8Array, post: Uint8Array): Promise<Uint8Array | null> {
  if (post.length < 1 + 8 + 24 + 16 || post[0] !== MAGICO) return null;
  if (lerU64(post, 1) !== s.epoca) return null;
  const S = await carregarSodio();
  try {
    const aberto = S.crypto_aead_xchacha20poly1305_ietf_decrypt(null, post.subarray(33), dadosAssociados(grupo, s.epoca), post.subarray(9, 33), s.post);
    return tirarCompleto(aberto, TAMANHOS_DO_POST);
  } catch {
    return null;
  }
}

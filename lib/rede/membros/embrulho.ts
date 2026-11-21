// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O embrulho de tudo que um grupo deposita na caixa da época. Nada do MLS vai ao servidor sem ele: o commit sai da biblioteca como
// "mensagem pública" do MLS (quem manda e quem entra às claras), e o embrulho tira isso da vista do servidor.
//
// Formato (bytes):
//   0x47 ‖ versão (1) ‖ época (u64) ‖ nonce (24) ‖ XChaCha20-Poly1305(chave da época, conteúdo completado, aad = id_h ‖ época)
// O conteúdo, por dentro: tipo (1) ‖ bytes; completado com o comprimento na frente até 2048, 8192, 32768 ou 131072 bytes. O
// tamanho no banco é 34 + n + 16. A cifra é a da libsodium (crypto_aead_xchacha20poly1305_ietf), com nonce SORTEADO a cada
// embrulho (24 bytes: sem contador, nada repete nonce depois de restaurar cópia ou ligar outro aparelho).
import { carregarSodio } from "../cifra/sodio";
import { completar, juntar, lerU64, sorteados, tirarCompleto, u64 } from "./bytes";

export const TAMANHOS_GRUPO = [2048, 8192, 32768, 131072] as const;
/** O que o embrulho acrescenta ao conteúdo completado: 34 de cabeçalho e 16 da marca. */
export const SOBRA_DO_EMBRULHO = 34 + 16;
/** Os tamanhos de envelope que o banco aceita para grupos. */
export const ENVELOPES_DE_GRUPO: readonly number[] = TAMANHOS_GRUPO.map((n) => n + SOBRA_DO_EMBRULHO);

const MAGICO = 0x47;
const VERSAO = 1;

/** O que vai dentro do embrulho. */
export const TIPO = {
  /** Mensagem de aplicação do MLS (texto, apresentação, papéis, chave de entrada, combinação de voz, post p2). */
  aplicacao: 1,
  /** Commit do MLS com a autorização assinada na frente. */
  commit: 2,
  /** Pacote de boas-vindas (na caixa de resposta de quem pediu para entrar). */
  boasVindas: 3,
} as const;
export type TipoDoEmbrulho = (typeof TIPO)[keyof typeof TIPO];

export async function embrulhar(chave: Uint8Array, idH: Uint8Array, epoca: bigint, tipo: TipoDoEmbrulho, bytes: Uint8Array): Promise<Uint8Array> {
  const S = await carregarSodio();
  const cabecalho = juntar(new Uint8Array([MAGICO, VERSAO]), u64(epoca));
  const nonce = sorteados(S.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const conteudo = completar(juntar(new Uint8Array([tipo]), bytes), TAMANHOS_GRUPO);
  const cifrado = S.crypto_aead_xchacha20poly1305_ietf_encrypt(conteudo, juntar(idH, u64(epoca)), null, nonce, chave);
  return juntar(cabecalho, nonce, cifrado);
}

/** Abre o embrulho. Qualquer coisa fora do formato, de outra época ou adulterada dá `null` (nunca um erro tratado como sucesso). */
export async function desembrulhar(
  chave: Uint8Array,
  idH: Uint8Array,
  epocaEsperada: bigint,
  envelope: Uint8Array,
): Promise<{ tipo: TipoDoEmbrulho; bytes: Uint8Array } | null> {
  if (!ENVELOPES_DE_GRUPO.includes(envelope.length) || envelope[0] !== MAGICO || envelope[1] !== VERSAO) return null;
  const epoca = lerU64(envelope, 2);
  if (epoca !== epocaEsperada) return null;
  const S = await carregarSodio();
  let conteudo: Uint8Array;
  try {
    conteudo = S.crypto_aead_xchacha20poly1305_ietf_decrypt(null, envelope.subarray(34), juntar(idH, u64(epoca)), envelope.subarray(10, 34), chave);
  } catch {
    return null;
  }
  const dentro = tirarCompleto(conteudo, TAMANHOS_GRUPO);
  if (!dentro || dentro.length < 1) return null;
  const tipo = dentro[0];
  if (tipo !== TIPO.aplicacao && tipo !== TIPO.commit && tipo !== TIPO.boasVindas) return null;
  return { tipo, bytes: dentro.slice(1) };
}

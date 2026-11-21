// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O arquivo cifrado da conta (onda R2, itens 1.5 e 2.2): o formato único da cópia de segurança e da lista de conversas que os
// aparelhos sincronizam. O servidor guarda o arquivo (public.rede_cofre_gravar, supabase/migracoes/20261124-r2-dupla.sql) e não lê
// nada: a chave é a de sincronia (só nos aparelhos da pessoa) ou a da cópia (24 palavras ou Argon2id de uma frase, na cabeça dela).
//
//   cabeçalho (33, em claro) = "ALC1" | modo (1) | Argon2id m, t, p (3 × u32; zeros fora do modo "frase") | sal (16; zeros idem)
//   secretstream XChaCha20-Poly1305 da libsodium (cabeçalho de 24 bytes) em pedaços de 64 KB (+17 cada); o cabeçalho em claro e o
//   rótulo da finalidade são o dado associado do primeiro pedaço, e o último leva a marca FINAL (corte no fim é recusado).
//
// O conteúdo é completado até 64 KB, 256 KB, 1 MB ou 4 MB: o servidor só sabe a faixa do tamanho (o banco recusa outra), e não quantas
// conversas a pessoa tem. Nada de cifra feita à mão: tudo é chamada da libsodium.
import { carregarSodio } from "../cifra/sodio";
import { canonico, completar, copia, deTexto, juntar, lerU32, texto, tirarCompleto, u32, type Bytes } from "../chat/r2/bytes";

/** As faixas do conteúdo (antes da cifra). O banco aceita só os tamanhos cifrados delas (interno.rede_cofre_tamanho_ok). */
export const FAIXAS_DO_ARQUIVO = [64 * 1024, 256 * 1024, 1024 * 1024, 4 * 1024 * 1024] as const;
const PEDACO = 64 * 1024;
const MAGICO = "ALC1";
export const TAMANHO_DO_CABECALHO = 4 + 1 + 12 + 16;
const MODOS = { palavras: 1, frase: 2, sincronia: 3 } as const;
export type ModoDoArquivo = keyof typeof MODOS;

/** Os tamanhos que o banco aceita: cabeçalho + 24 do secretstream + a faixa + 17 por pedaço de 64 KB. */
export const TAMANHOS_DO_ARQUIVO: readonly number[] = FAIXAS_DO_ARQUIVO.map((f) => TAMANHO_DO_CABECALHO + 24 + f + 17 * (f / PEDACO));

export interface CabecalhoA2id {
  m: number;
  t: number;
  p: number;
  sal: Bytes;
}

function cabecalhoDoArquivo(modo: ModoDoArquivo, a2: CabecalhoA2id | null): Bytes {
  return juntar(texto(MAGICO), new Uint8Array([MODOS[modo]]), u32(a2?.m ?? 0), u32(a2?.t ?? 0), u32(a2?.p ?? 0), a2?.sal ?? new Uint8Array(16));
}

/** Lê o modo e os parâmetros do Argon2id (para pedir as palavras ou a frase certa). null se não é um arquivo deste formato. */
export function modoDoArquivo(arquivo: Uint8Array): { modo: ModoDoArquivo; argon2id: CabecalhoA2id | null } | null {
  if (arquivo.length < TAMANHO_DO_CABECALHO || deTexto(arquivo.subarray(0, 4)) !== MAGICO) return null;
  const modo = (Object.keys(MODOS) as ModoDoArquivo[]).find((k) => MODOS[k] === arquivo[4]);
  if (!modo) return null;
  if (modo !== "frase") return { modo, argon2id: null };
  return { modo, argon2id: { m: lerU32(arquivo, 5), t: lerU32(arquivo, 9), p: lerU32(arquivo, 13), sal: copia(arquivo.subarray(17, 33)) } };
}

/** Cifra `claro` (JSON, bytes) para o servidor guardar. `rotulo`: a finalidade (a cópia não abre como lista, nem o contrário). */
export async function cifrarArquivo(chave: Uint8Array, rotulo: string, modo: ModoDoArquivo, argon2id: CabecalhoA2id | null, conteudo: Uint8Array): Promise<Bytes> {
  if (chave.length !== 32) throw new Error("chave_invalida");
  if ((modo === "frase") !== !!argon2id) throw new Error("modo_invalido");
  const sodio = await carregarSodio();
  const cab = cabecalhoDoArquivo(modo, argon2id);
  const claro = completar(conteudo, FAIXAS_DO_ARQUIVO);
  const { state, header } = sodio.crypto_secretstream_xchacha20poly1305_init_push(chave);
  const partes: Uint8Array[] = [cab, header];
  for (let i = 0; i < claro.length; i += PEDACO) {
    const ultimo = i + PEDACO >= claro.length;
    const tag = ultimo ? sodio.crypto_secretstream_xchacha20poly1305_TAG_FINAL : sodio.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
    partes.push(sodio.crypto_secretstream_xchacha20poly1305_push(state, claro.subarray(i, i + PEDACO), i === 0 ? canonico(rotulo, cab) : null, tag));
  }
  claro.fill(0);
  return juntar(...partes);
}

/** Abre o arquivo; null se a chave ou a finalidade estiverem erradas, ou se algo foi mexido, cortado ou acrescentado. */
export async function abrirArquivo(chave: Uint8Array, rotulo: string, arquivo: Uint8Array): Promise<Bytes | null> {
  if (chave.length !== 32 || !modoDoArquivo(arquivo) || !TAMANHOS_DO_ARQUIVO.includes(arquivo.length)) return null;
  const sodio = await carregarSodio();
  const cab = copia(arquivo.subarray(0, TAMANHO_DO_CABECALHO));
  const inicio = TAMANHO_DO_CABECALHO + sodio.crypto_secretstream_xchacha20poly1305_HEADERBYTES;
  try {
    const estado = sodio.crypto_secretstream_xchacha20poly1305_init_pull(arquivo.subarray(TAMANHO_DO_CABECALHO, inicio), chave);
    const pedacoCifrado = PEDACO + sodio.crypto_secretstream_xchacha20poly1305_ABYTES;
    const partes: Uint8Array[] = [];
    let final = false;
    for (let i = inicio; i < arquivo.length; i += pedacoCifrado) {
      if (final) return null; // nada depois da marca final
      const r = sodio.crypto_secretstream_xchacha20poly1305_pull(estado, arquivo.subarray(i, i + pedacoCifrado), i === inicio ? canonico(rotulo, cab) : null);
      if (r === false) return null;
      partes.push(r.message);
      final = r.tag === sodio.crypto_secretstream_xchacha20poly1305_TAG_FINAL;
    }
    if (!final) return null; // cortado no fim
    return tirarCompleto(juntar(...partes), FAIXAS_DO_ARQUIVO);
  } catch {
    return null;
  }
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Preenchimento em blocos do chat privado da Alumia (formato "c3"). Antes de cifrar, o conteúdo da mensagem é completado até
// um de poucos tamanhos fixos. Assim o cifrado guardado no banco não conta o tamanho do que foi escrito: um "ok" e um parágrafo
// curto ficam do mesmo tamanho. Documento: docs/rede/CHAT-PRIVADO.md.
//
// O bloco, por dentro:
//   [4 bytes: comprimento do conteúdo, do mais alto para o mais baixo][conteúdo][zeros até o fim do bloco]
// Ao abrir, tudo é conferido: o bloco tem um dos tamanhos permitidos, é o MENOR bloco em que o conteúdo cabe, e o que sobra é
// só zero. Qualquer coisa diferente é erro ("preenchimento_invalido").
//
// Sem navegador e sem dependência: roda no Node nos testes (scripts/testar-rede-chat.mjs).

/** Os blocos pequenos, em bytes. Acima do maior, o bloco cresce de PASSO em PASSO até TETO. */
export const BLOCOS = [256, 512, 1024, 2048] as const;
export const PASSO = 2048;
/** O maior bloco: cabe a maior mensagem que o chat aceita (2000 caracteres de 4 bytes, mais os campos de dentro). */
export const TETO = 8192;
/** Os bytes do comprimento, no começo do bloco. */
export const CABECALHO = 4;
/** O que o AES-GCM acrescenta ao bloco (a marca de autenticação). */
export const MARCA = 16;

/** Todos os tamanhos de bloco que existem: 256, 512, 1024, 2048, 4096, 6144 e 8192 bytes. */
export const TAMANHOS_DO_BLOCO: readonly number[] = (() => {
  const lista: number[] = [...BLOCOS];
  for (let n = BLOCOS[BLOCOS.length - 1] + PASSO; n <= TETO; n += PASSO) lista.push(n);
  return lista;
})();

/** Quantos caracteres de base64url (sem "=") dão `bytes` bytes. */
export const caracteresDe = (bytes: number) => Math.floor(bytes / 3) * 4 + (bytes % 3 === 0 ? 0 : (bytes % 3) + 1);

/**
 * Os tamanhos, em caracteres, da última parte de um corpo "c3" (bloco + marca, em base64url): 363, 704, 1387, 2752, 5483, 8214
 * e 10944. O banco só aceita estes (supabase/migracoes/20261110-chat-blocos.sql).
 */
export const TAMANHOS_DO_CIFRADO: readonly number[] = TAMANHOS_DO_BLOCO.map((n) => caracteresDe(n + MARCA));

/** O menor bloco em que cabe um conteúdo de `bytes` bytes. */
export function tamanhoDoBloco(bytes: number): number {
  if (!Number.isInteger(bytes) || bytes < 0) throw new Error("conteudo_invalido");
  const bloco = TAMANHOS_DO_BLOCO.find((n) => bytes + CABECALHO <= n);
  if (!bloco) throw new Error("conteudo_grande");
  return bloco;
}

/** Completa o conteúdo até o bloco. */
export function preencher(conteudo: Uint8Array): Uint8Array<ArrayBuffer> {
  const bloco = new Uint8Array(new ArrayBuffer(tamanhoDoBloco(conteudo.length)));
  new DataView(bloco.buffer).setUint32(0, conteudo.length);
  bloco.set(conteudo, CABECALHO);
  return bloco;
}

/** Devolve o conteúdo, conferindo o bloco inteiro. Lança "preenchimento_invalido" se algo não bate. */
export function tirarPreenchimento(bloco: Uint8Array): Uint8Array<ArrayBuffer> {
  if (!TAMANHOS_DO_BLOCO.includes(bloco.length)) throw new Error("preenchimento_invalido");
  const comprimento = new DataView(bloco.buffer, bloco.byteOffset, bloco.byteLength).getUint32(0);
  if (comprimento + CABECALHO > bloco.length) throw new Error("preenchimento_invalido");
  // O bloco precisa ser o menor possível: o mesmo conteúdo não pode aparecer em dois tamanhos.
  if (tamanhoDoBloco(comprimento) !== bloco.length) throw new Error("preenchimento_invalido");
  // Confere todos os bytes que sobram, sem parar no primeiro diferente.
  let sobra = 0;
  for (let i = CABECALHO + comprimento; i < bloco.length; i++) sobra |= bloco[i];
  if (sobra !== 0) throw new Error("preenchimento_invalido");
  const conteudo = new Uint8Array(new ArrayBuffer(comprimento));
  conteudo.set(bloco.subarray(CABECALHO, CABECALHO + comprimento));
  return conteudo;
}

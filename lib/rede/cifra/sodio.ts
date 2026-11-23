// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A libsodium (libsodium-wrappers-sumo, a libsodium 1.0.22 compilada para WebAssembly), carregada uma vez e só quando é usada. Dela
// saem o Argon2id das senhas digitadas no aparelho (crypto_pwhash) e o X-Wing das cédulas da votação (crypto_kem_xwing_*). Nada de
// cifra feita à mão aqui.

type Sodio = (typeof import("libsodium-wrappers-sumo"))["default"];

let carregado: Promise<Sodio> | null = null;

export function carregarSodio(): Promise<Sodio> {
  carregado ??= import("libsodium-wrappers-sumo")
    .then(async (m) => {
      const sodio = m.default;
      await sodio.ready;
      return sodio;
    })
    .catch((erro: unknown) => {
      carregado = null;
      throw erro;
    });
  return carregado;
}

/**
 * Os parâmetros do Argon2id de toda senha digitada no aparelho: 64 MiB de memória, 3 passadas, 1 linha (o mínimo pedido; o
 * "segundo perfil" do RFC 9106 usa 64 MiB e 3 passadas). Rodam num Worker, para a tela não travar em computador fraco; se o
 * aparelho não tiver a memória, a derivação falha com erro dito na tela, nunca cai para um valor menor. Os valores vão gravados
 * junto do sal em cada cofre (`a2id.v1`), para poderem subir depois sem perder o que já foi guardado.
 */
export const ARGON2ID = { memoria: 64 * 1024 * 1024, passadas: 3, linhas: 1, sal: 16, saida: 32 } as const;

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O núcleo do Argon2id (lib/rede/cofre/argon.ts): a chamada da libsodium e mais nada. Fica num arquivo próprio para o Worker
// (argon.worker.ts) importar só isto, sem o código que cria o Worker.
// Sem os atalhos "@/" de propósito: os testes rodam este arquivo direto no Node.
import { ARGON2ID, carregarSodio } from "../cifra/sodio";

/** A derivação em si, onde quer que rode (na tela ou no Worker). Zera a cópia da senha. Sem memória: "sem_memoria". */
export async function derivarAqui(senha: Uint8Array, sal: Uint8Array, m: number, t: number): Promise<Uint8Array> {
  const S = await carregarSodio();
  try {
    return S.crypto_pwhash(ARGON2ID.saida, senha, sal, t, m * 1024, S.crypto_pwhash_ALG_ARGON2ID13);
  } catch {
    throw Object.assign(new Error("sem_memoria"), { code: "sem_memoria" });
  } finally {
    S.memzero(senha);
  }
}

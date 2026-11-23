// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O aparelho no MLS: uma instância do motor (@wireapp/core-crypto, o OpenMLS em WebAssembly; lib/rede/cifra/motor.ts) com UM nome
// de membro (ClientId "<conta>:<aparelho>@alumia.invalid") e UMA credencial básica na suíte híbrida ML-KEM-768 + X25519 (SUITE_MLS).
// A credencial (a chave de assinatura da folha) fica na loja do motor: no navegador, a loja cifrada do próprio motor; nos testes, a
// memória. O nome usa a conta de propósito: neste desenho o servidor já sabe quem é de cada grupo (núcleo, comunidade fechada,
// conversa da equipe) e os commits saem embrulhados (embrulho-da-epoca.ts), então o nome não conta nada novo a ele. A onda R2 pede
// um nome sorteado por grupo quando a filiação sair do servidor: fica para essa troca.
//
// O motor manda cada commit por um "transporte" fixo, dado uma vez (mlsInit). Aqui o transporte só repassa para a `rota` da operação
// em curso: as operações deste aparelho passam uma de cada vez (fila), e cada uma diz por onde o commit dela vai. Sem rota, o commit
// é recusado (nunca sai por engano). Sem "@/": roda no Node nos testes.
import { SUITE_MLS } from "../cifra/motor";
import { DOMINIO, lerNome, type Membro, novoDispositivo } from "./pacote";
import type { CommitBundle, CoreCrypto, CoreCryptoContext as Contexto, CredentialRef } from "@wireapp/core-crypto";

export type Motor = typeof import("@wireapp/core-crypto");
export type { Contexto };

export interface AparelhoMls {
  M: Motor;
  cc: CoreCrypto;
  ref: CredentialRef;
  eu: Membro;
  /** Roda uma operação deste aparelho (uma por vez), com a rota dos commits que ela fizer. */
  operar<T>(rota: ((pacote: CommitBundle) => Promise<void>) | null, fazer: (c: Contexto) => Promise<T>): Promise<T>;
}

/**
 * Prepara o aparelho no motor: reaproveita a credencial guardada (a da suíte, deste usuário) ou cria um nome novo, com um número de
 * aparelho sorteado. `cc` é a instância do motor (com a loja já aberta). Uma por instância.
 */
export async function prepararAparelho(M: Motor, cc: CoreCrypto, usuario: string): Promise<AparelhoMls> {
  const suite = M.cipherSuiteFromU16(SUITE_MLS);
  let rota: ((pacote: CommitBundle) => Promise<void>) | null = null;
  const transporte = {
    async sendCommitBundle(pacote: CommitBundle) {
      if (!rota) throw new M.MlsTransportError.MessageRejected({ reason: "sem_rota" });
      await rota(pacote);
    },
    async prepareForTransport(): Promise<Uint8Array> {
      // O "histórico compartilhado" do Wire não é usado: nada sai por aqui.
      throw new M.MlsTransportError.MessageRejected({ reason: "historico_desligado" });
    },
  };
  const guardadas = (await cc.findCredentials({ cipherSuite: suite })).filter((r) => lerNome(new TextDecoder().decode(r.clientId().copyBytes()))?.usuario === usuario);
  let ref: CredentialRef;
  if (guardadas.length) {
    ref = guardadas[0];
    await cc.transaction((c) => c.mlsInit(ref.clientId(), transporte));
  } else {
    const nome = new M.ClientId(new M.Uuid(usuario), new M.DeviceId(novoDispositivo()), DOMINIO);
    ref = await cc.transaction(async (c) => {
      await c.mlsInit(nome, transporte);
      return c.addCredential(M.Credential.basic(suite, nome));
    });
  }
  const eu = lerNome(new TextDecoder().decode(ref.clientId().copyBytes()));
  if (!eu) throw new Error("aparelho_invalido");
  let fila: Promise<unknown> = Promise.resolve();
  return {
    M,
    cc,
    ref,
    eu,
    operar(rotaDaVez, fazer) {
      const vez = fila.then(async () => {
        rota = rotaDaVez;
        try {
          return await cc.transaction(fazer);
        } finally {
          rota = null;
        }
      });
      fila = vez.catch(() => undefined);
      return vez;
    },
  };
}

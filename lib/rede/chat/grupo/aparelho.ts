// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O aparelho do MLS da conversa em grupo (recurso "alumia-chat-grupo"): a instância do motor (@wireapp/core-crypto, com a loja deste
// aparelho), UMA credencial básica na suíte híbrida ML-KEM-768 + X25519 (SUITE_MLS) com nome SORTEADO (o Uuid não é a conta: o
// desenho dos membros escondidos, lib/rede/membros/papeis.ts), o transporte do motor que o grupo comanda (TransporteDoMotor) e a
// identidade da conta, que só assina os textos do grupo (lib/rede/chat/r2/certificados.ts, assinarTextoDoGrupo). Reaproveita a
// credencial guardada na loja; sem ela, cria. Nada de cifra nova: são as peças que já existiam, montadas. Sem "@/": roda no Node.
import type { CoreCrypto, CredentialRef } from "@wireapp/core-crypto";
import { SUITE_MLS } from "../../cifra/motor";
import { type Aparelho, TransporteDoMotor } from "../../membros/grupo";
import type { Identidade, Transporte } from "../../membros/tipos";

type Motor = typeof import("@wireapp/core-crypto");

export async function prepararAparelhoDoGrupo(M: Motor, cc: CoreCrypto, identidade: Identidade, transporte: Transporte): Promise<Aparelho> {
  const transporteDoMotor = new TransporteDoMotor(M);
  const suite = M.cipherSuiteFromU16(SUITE_MLS);
  const guardadas = await cc.findCredentials({ cipherSuite: suite });
  let ref: CredentialRef;
  if (guardadas.length) {
    ref = guardadas[0];
    await cc.transaction((c) => c.mlsInit(ref.clientId(), transporteDoMotor));
  } else {
    const cliente = new M.ClientId(new M.Uuid(crypto.randomUUID()), new M.DeviceId(BigInt(1)), "alumia.invalid");
    ref = await cc.transaction(async (c) => {
      await c.mlsInit(cliente, transporteDoMotor);
      return c.addCredential(M.Credential.basic(suite, cliente));
    });
  }
  return { M, cc, ref, cliente: ref.clientId(), transporteDoMotor, identidade, transporte };
}

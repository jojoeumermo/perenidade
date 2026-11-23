// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O motor de cifra do chat da Alumia: a biblioteca @wireapp/core-crypto (a do aplicativo Wire), que traz o OpenMLS (MLS, RFC 9420)
// e o Proteus (Double Ratchet) compilados para WebAssembly. Grupos, núcleos, posts restritos, voz e o chat da equipe usam o MLS com a
// suíte híbrida ML-KEM-768 + X25519; a conversa a dois usa o Proteus por dentro do envelope X-Wing. Nada de cifra feita à mão aqui:
// este arquivo só carrega a biblioteca, uma vez, e confere a versão.
//
// O WebAssembly vem do próprio site (`public/cifra/`, copiado por scripts/preparar.mjs), com a versão no nome. A biblioteca é feita
// para o navegador; nos testes do Node, o script põe `globalThis.window` e passa o arquivo como endereço `data:` (veja
// scripts/cifra-no-node.mjs).

type Motor = typeof import("@wireapp/core-crypto");

/** A versão do motor que este código conhece. Outra versão não carrega: trocar de versão é decisão revisada, não atualização solta. */
export const VERSAO_DO_MOTOR = "11.0.1";
/** Onde o site serve o WebAssembly do motor. */
export const CAMINHO_DO_MOTOR = `/cifra/core-crypto-${VERSAO_DO_MOTOR}.wasm`;
/**
 * A suíte MLS de todos os grupos: troca de chaves híbrida ML-KEM-768 + X25519, AES-256-GCM, SHA-384, assinatura Ed25519
 * (`CipherSuite.Mls128Mlkem768x25519Aes256gcmSha384Ed25519` na biblioteca). O número é o da biblioteca (0xF002, faixa privada do
 * registro do MLS): a suíte ainda não tem número oficial da IANA.
 */
export const SUITE_MLS = 61442;

let carregado: Promise<Motor> | null = null;

/** Carrega o motor (uma vez por página). `caminho` só muda nos testes. */
export function carregarMotor(caminho: string = CAMINHO_DO_MOTOR): Promise<Motor> {
  carregado ??= import("@wireapp/core-crypto")
    .then(async (M) => {
      await M.initWasmModule(caminho);
      if (M.version() !== VERSAO_DO_MOTOR) throw new Error("motor_versao");
      if (M.cipherSuiteFromU16(SUITE_MLS) !== M.CipherSuite.Mls128Mlkem768x25519Aes256gcmSha384Ed25519) throw new Error("motor_suite");
      return M;
    })
    .catch((erro: unknown) => {
      carregado = null;
      throw erro;
    });
  return carregado;
}

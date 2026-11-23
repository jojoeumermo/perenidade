// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (14): o certificado de cada folha dos grupos MLS da rede (núcleos e comunidades fechadas). Antes, o
// aparelho aceitava a primeira chave de qualquer folha que o servidor listasse para uma conta do grupo ("confiar na primeira vez", só
// com aviso): o servidor podia inventar um aparelho-fantasma de uma conta listada (com uma chave dele) e ler os posts do grupo dali
// em diante. Agora a IDENTIDADE da conta (a Ed25519 do chat, a mesma do registro público de chaves) assina cada folha dela:
//
//   texto      = canonico("alumia/r3/folha-pacote/v1", conta, nome da folha (ClientId), impressão da chave de assinatura da folha)
//   certificado = identidade(32) ‖ assinatura Ed25519(64)        (96 bytes; vai ao banco junto da folha, rede_grupo_folhas)
//
// Quem põe alguém no grupo (e quem confere a árvore) só aceita a folha se: o certificado confere com a identidade que vem nele, e
// essa identidade é a que o registro público mostra para a conta (conferida pelo aparelho, lib/rede/chat/transparencia.ts). A
// impressão é a da biblioteca (RFC 7638, pacote.ts): a mesma no pacote de chave e na árvore; todos os pacotes de uma folha têm a
// mesma chave de assinatura, então um certificado por folha cobre todos. Assinatura e conferência pela @noble/curves (auditada),
// conferência estrita (sem assinatura maleável). Nada de cifra própria aqui: só o texto canônico com o rótulo da finalidade.
// Sem "@/": roda no Node nos testes.
import { ed25519 } from "@noble/curves/ed25519.js";
import { canonico, texto } from "../chat/r2/bytes";

export const ROTULOS = { folha: "alumia/r3/folha-pacote/v1" } as const;

/** O tamanho do certificado (identidade + assinatura). */
export const TAMANHO_DO_CERTIFICADO = 96;

/** O texto que a identidade assina (começa com o rótulo: a identidade só assina textos de finalidade conhecida). */
export function textoDaFolha(conta: string, nome: string, impressao: string): Uint8Array {
  return canonico(ROTULOS.folha, texto(conta), texto(nome), texto(impressao));
}

export interface CertificadoDaFolha {
  identidade: Uint8Array;
  assinatura: Uint8Array;
}

/** Monta o certificado (identidade ‖ assinatura). */
export function montarCertificado(identidade: Uint8Array, assinatura: Uint8Array): Uint8Array {
  if (identidade.length !== 32 || assinatura.length !== 64) throw new Error("certificado_invalido");
  const c = new Uint8Array(TAMANHO_DO_CERTIFICADO);
  c.set(identidade, 0);
  c.set(assinatura, 32);
  return c;
}

/** Separa o certificado (null se não tem o tamanho). */
export function lerCertificado(bytes: Uint8Array | null | undefined): CertificadoDaFolha | null {
  if (!bytes || bytes.length !== TAMANHO_DO_CERTIFICADO) return null;
  return { identidade: bytes.slice(0, 32), assinatura: bytes.slice(32) };
}

/** A assinatura do certificado confere para esta conta, esta folha e esta impressão? (Não diz se a identidade é a do registro.) */
export function certificadoDaFolhaConfere(c: CertificadoDaFolha, conta: string, nome: string, impressao: string): boolean {
  try {
    return ed25519.verify(c.assinatura, textoDaFolha(conta, nome, impressao), c.identidade, { zip215: false });
  } catch {
    return false;
  }
}

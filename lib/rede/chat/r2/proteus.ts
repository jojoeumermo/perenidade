// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O Double Ratchet da conversa a dois (onda R2, item 1.1): o Proteus do motor @wireapp/core-crypto (lib/rede/cifra/motor.ts), o
// mesmo desenho do Signal (Axolotl), com a chave mudando a cada ida e volta (troca de DH) e segurança depois do comprometimento.
// Nada de cifra aqui: este arquivo só chama a biblioteca e faz as conferências que ela deixa para quem usa:
//
// - uma sessão por APARELHO da outra pessoa (o id da sessão é a chave Ed25519 do aparelho, em hexadecimal);
// - a pré-chave que o servidor entrega só vale com a assinatura da chave do aparelho (o Proteus não assina pré-chave);
// - depois de abrir uma sessão (pela pré-chave, ou pela primeira mensagem de quem começou), a identidade Proteus do outro lado
//   tem de ser a do certificado do aparelho; se não for, a transação inteira volta atrás (a sessão não fica e a pré-chave não se
//   gasta) e a mensagem não é mostrada;
// - mensagem repetida, adulterada ou de sessão desconhecida: a biblioteca recusa, e aqui vira `null` (nunca "sucesso").
import type { CoreCrypto } from "@wireapp/core-crypto";
import { copia, paraHex, type Bytes } from "./bytes";
import { assinarPreChave, type ParEd25519, preChaveConfere } from "./certificados";

export type Motor = CoreCrypto;

/** O id da sessão com um aparelho: a chave Ed25519 dele em hexadecimal. */
export const sessaoCom = (aparelho: Uint8Array) => {
  if (aparelho.length !== 32) throw new Error("aparelho_invalido");
  return paraHex(aparelho);
};

/** Liga o Proteus no motor deste aparelho (cria a identidade Proteus na primeira vez) e devolve a impressão dela. */
export async function ligarProteus(motor: Motor): Promise<string> {
  return motor.transaction(async (c) => {
    await c.proteusInit();
    return c.proteusFingerprint();
  });
}

/**
 * Liga o Proteus de novo num motor REABERTO (a página recarregada, outra aba): o @wireapp/core-crypto só carrega a identidade Proteus
 * da loja para a memória no proteusInit, uma vez por instância; sem isto, toda cifra e decifra da instância nova falha (era o "F5
 * quebra a conversa"). Confere que a identidade carregada é a do estado deste aparelho: loja do motor perdida ou trocada (o OPFS
 * apagado, outra loja) cria uma identidade nova, e aí o aparelho não serve mais ("motor_trocado").
 */
export async function reabrirProteus(motor: Motor, impressaoEsperada: string): Promise<void> {
  const impressao = await ligarProteus(motor);
  if (impressao !== impressaoEsperada) throw erro("motor_trocado");
}

export interface PreChaveAssinada {
  id: number;
  pkb: Bytes;
  assinatura: Bytes;
}

/** `n` pré-chaves novas, assinadas pela chave do aparelho (vão ao diretório; cada uma é entregue uma vez). */
export async function novasPreChaves(motor: Motor, aparelho: ParEd25519, n: number): Promise<PreChaveAssinada[]> {
  const lista = await motor.transaction(async (c) => {
    const saida: { id: number; pkb: Uint8Array }[] = [];
    for (let i = 0; i < n; i++) saida.push(await c.proteusNewPrekeyAuto());
    return saida;
  });
  return lista.map((p) => ({ id: p.id, pkb: copia(p.pkb), assinatura: assinarPreChave(aparelho, p.id, p.pkb) }));
}

/** A pré-chave "de último recurso" (a que o diretório entrega quando as outras acabaram), assinada. */
export async function preChaveDeUltimoRecurso(motor: Motor, aparelho: ParEd25519, idDoUltimoRecurso: number): Promise<PreChaveAssinada> {
  const pkb = copia(await motor.transaction((c) => c.proteusLastResortPrekey()));
  return { id: idDoUltimoRecurso, pkb, assinatura: assinarPreChave(aparelho, idDoUltimoRecurso, pkb) };
}

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

/**
 * Abre a sessão com um aparelho da outra pessoa a partir de uma pré-chave do diretório. Recusa ("pre_chave_sem_assinatura") a
 * pré-chave sem a assinatura do aparelho, e ("identidade_trocada") a que leva outra identidade Proteus que não a do certificado.
 */
export async function sessaoPelaPreChave(motor: Motor, aparelho: Uint8Array, impressaoCertificada: string, pre: PreChaveAssinada): Promise<void> {
  if (!preChaveConfere(aparelho, pre.id, pre.pkb, pre.assinatura)) throw erro("pre_chave_sem_assinatura");
  const sid = sessaoCom(aparelho);
  await motor.transaction(async (c) => {
    await c.proteusSessionFromPrekey(sid, copia(pre.pkb));
    if ((await c.proteusFingerprintRemote(sid)) !== impressaoCertificada) throw erro("identidade_trocada");
    await c.proteusSessionSave(sid);
  });
}

export const temSessao = (motor: Motor, aparelho: Uint8Array) => motor.transaction((c) => c.proteusSessionExists(sessaoCom(aparelho)));

export async function cifrar(motor: Motor, aparelho: Uint8Array, conteudo: Uint8Array): Promise<Bytes> {
  return copia(await motor.transaction((c) => c.proteusEncrypt(sessaoCom(aparelho), copia(conteudo))));
}

/**
 * Decifra o que veio de um aparelho. null se a biblioteca recusar (repetida, adulterada, sessão que não existe) ou se a identidade
 * Proteus do outro lado não for a do certificado (nada fica gravado).
 */
export async function decifrar(motor: Motor, aparelho: Uint8Array, impressaoCertificada: string, cifrado: Uint8Array): Promise<Bytes | null> {
  const sid = sessaoCom(aparelho);
  try {
    return await motor.transaction(async (c) => {
      const aberto = await c.proteusDecryptSafe(sid, copia(cifrado));
      if ((await c.proteusFingerprintRemote(sid)) !== impressaoCertificada) throw erro("identidade_trocada");
      return copia(aberto);
    });
  } catch {
    return null;
  }
}

/** Esquece a sessão com um aparelho (aparelho tirado, ou sessão refeita com pré-chave nova). */
export async function esquecerSessao(motor: Motor, aparelho: Uint8Array): Promise<void> {
  const sid = sessaoCom(aparelho);
  await motor.transaction(async (c) => {
    if (await c.proteusSessionExists(sid)) await c.proteusSessionDelete(sid);
  });
}

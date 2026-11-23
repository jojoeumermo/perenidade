// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chaves da conta e de cada aparelho (onda R2, item 1.5). Documento: docs/rede/CHAT-PRIVADO.md.
//
// - Da CONTA (iguais em todos os aparelhos da pessoa; vão de um aparelho a outro só pelo QR de ligar ou pela cópia de segurança):
//   a identidade Ed25519, a chave de pedidos (X-Wing) e a chave de sincronia (32 bytes).
// - De cada APARELHO (nunca saem dele, nunca vão na cópia): a chave Ed25519 do aparelho, a identidade Proteus (no motor), a chave
//   X-Wing da semana (troca toda semana; a privada some 5 semanas depois) e as pré-chaves.
// Ligar um aparelho ou restaurar a cópia cria SEMPRE um aparelho novo: chaves de aparelho novas, certificado novo, e os contatos
// refazem as sessões. Nada de chave de sessão velha volta à vida.
import { XWing } from "@noble/post-quantum/hybrid.js";
import { copia, deB64Url, paraB64Url, sortear, type Bytes } from "../chat/r2/bytes";
import { assinarChaveDaSemana, assinarChaveDePedidos, certificarAparelho, novoParEd25519, semanaDoCertificado, type ParEd25519, parDaSemente } from "../chat/r2/certificados";
import type { AparelhoPublico } from "../chat/r2/conversa";
import { novoParXWing, semanaDe, SEMANAS_ACEITAS } from "../chat/r2/envelope";
import { ligarProteus, type Motor } from "../chat/r2/proteus";

export interface ChavesDaConta {
  conta: string;
  identidade: ParEd25519;
  pedidos: { publica: Bytes; privada: Bytes; assinatura: Bytes };
  sincronia: Bytes;
}

/** O primeiro aparelho da pessoa cria as chaves da conta. */
export async function novasChavesDaConta(conta: string): Promise<ChavesDaConta> {
  const identidade = novoParEd25519();
  const par = await novoParXWing();
  return { conta, identidade, pedidos: { ...par, assinatura: assinarChaveDePedidos(identidade, conta, par.publica) }, sincronia: sortear(32) };
}

/** As chaves da conta a partir do que veio pelo QR ou pela cópia (as públicas são recalculadas das privadas). */
export function chavesDaContaDe(p: { conta: string; identidade: string; pedidos: string; sincronia: string }): ChavesDaConta {
  const identidade = parDaSemente(deB64Url(p.identidade));
  const privada = deB64Url(p.pedidos);
  const publica = copia(XWing.getPublicKey(privada));
  const sincronia = deB64Url(p.sincronia);
  if (identidade.privada.length !== 32 || privada.length !== 32 || sincronia.length !== 32) throw new Error("chaves_invalidas");
  return { conta: p.conta, identidade, pedidos: { publica, privada, assinatura: assinarChaveDePedidos(identidade, p.conta, publica) }, sincronia };
}

/** Só as chaves da conta, em texto, para o QR e para a cópia. */
export const chavesDaContaParaLevar = (c: ChavesDaConta) => ({ conta: c.conta, identidade: paraB64Url(c.identidade.privada), pedidos: paraB64Url(c.pedidos.privada), sincronia: paraB64Url(c.sincronia) });

export interface ChavesDoAparelho {
  chave: ParEd25519;
  impressao: string;
  /** Semana → privada X-Wing (só neste aparelho). */
  semanas: Map<number, Bytes>;
  publico: AparelhoPublico;
}

/** Um aparelho novo desta conta: chave própria, Proteus ligado no motor, chave da semana e certificado assinado pela identidade. */
export async function novoAparelho(conta: ChavesDaConta, motor: Motor, agora = Date.now()): Promise<ChavesDoAparelho> {
  const chave = novoParEd25519();
  const impressao = await ligarProteus(motor);
  const semana = semanaDe(agora);
  const xw = await novoParXWing();
  return {
    chave,
    impressao,
    semanas: new Map([[semana, xw.privada]]),
    publico: {
      aparelho: chave.publica,
      certificado: certificarAparelho(conta.identidade, conta.conta, chave.publica, impressao, semanaDoCertificado(agora)),
      xwing: xw.publica,
      semana,
      xwingAssinatura: assinarChaveDaSemana(chave, xw.publica, semana),
    },
  };
}

/**
 * A troca semanal: se a chave publicada não é da semana atual, cria a nova (e devolve o público novo para publicar), e apaga as
 * privadas de mais de SEMANAS_ACEITAS semanas atrás (envelope tão velho não abre mais: o pacote vive 30 dias).
 */
export async function trocarChaveDaSemana(a: ChavesDoAparelho, agora = Date.now()): Promise<{ publico: AparelhoPublico; trocou: boolean; apagadas: number[] }> {
  const semana = semanaDe(agora);
  const apagadas: number[] = [];
  for (const [s, privada] of a.semanas) {
    if (s < semana - SEMANAS_ACEITAS) {
      privada.fill(0);
      a.semanas.delete(s);
      apagadas.push(s);
    }
  }
  if (a.publico.semana === semana) return { publico: a.publico, trocou: false, apagadas };
  const xw = await novoParXWing();
  a.semanas.set(semana, xw.privada);
  a.publico = { ...a.publico, xwing: xw.publica, semana, xwingAssinatura: assinarChaveDaSemana(a.chave, xw.publica, semana) };
  return { publico: a.publico, trocou: true, apagadas };
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A conferência da sala das aulas ao vivo: quem conduz assina; quem assiste confere. Fica separada de lib/aovivo.ts para
// os roteiros de conferência (scripts/testar-aovivo.mjs) a importarem direto do Node.
import { assinar, FORMATO_PUBLICA, paraBase64, verificar } from "./sigilo";
import type { Presente } from "./tempo-real";

/**
 * A chave de quem conduz, só nesta aba: a parte privada nasce no navegador e não pode ser exportada; a pública vai para o
 * banco (aula_ao_vivo_sala_chave). Com ela, quem conduz assina a própria presença e cada sinal de vídeo. O canal da sala é
 * aberto (quem assiste nem precisa de conta), então é a assinatura que separa quem conduz de qualquer um que entre.
 */
export class Credencial {
  private readonly privada: CryptoKey;
  readonly publica: string;

  private constructor(privada: CryptoKey, publica: string) {
    this.privada = privada;
    this.publica = publica;
  }

  static async nova(): Promise<Credencial> {
    const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    return new Credencial(par.privateKey, paraBase64(new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey))));
  }

  assinar(texto: string): Promise<string> {
    return assinar(this.privada, texto);
  }
}

/** O que a assinatura da presença amarra: esta aula e esta chave de navegador (não serve em outra sala nem para outra aba). */
export const provaDaPresenca = (aula: string, chave: string) => `aovivo:presenca:${aula}:${chave}`;
/** O que a assinatura de um sinal amarra: a aula, quem manda, para quem e o conteúdo exato. */
export const amarraDoSinal = (aula: string, de: string, para: string, dados: Record<string, unknown>) => `aovivo:sinal:${aula}:${de}:${para}:${JSON.stringify(dados)}`;

/**
 * Quem, entre os presentes que dizem conduzir, conduz mesmo: a chave pública está na lista do banco e a prova de presença
 * confere. Devolve chave do navegador → chave pública. Sem a lista (banco antigo), vale o que cada um diz, como antes.
 */
export async function conferirEducadores(aula: string, presentes: Presente[], chaves: string[] | undefined): Promise<Map<string, string>> {
  const conferidos = new Map<string, string>();
  for (const p of presentes) {
    if (p.papel !== "educador") continue;
    if (!chaves) {
      conferidos.set(p.chave, "");
      continue;
    }
    if (!p.publica || !p.prova || !FORMATO_PUBLICA.test(p.publica) || !chaves.includes(p.publica)) continue;
    if (await verificar(p.publica, p.prova, provaDaPresenca(aula, p.chave))) conferidos.set(p.chave, p.publica);
  }
  return conferidos;
}

/**
 * Este sinal pode ser aceito? Com a conferência ligada: oferta só de quem conduz (assinada); qualquer sinal que diga vir de
 * quem conduz precisa da assinatura dele; de quem só assiste, quem conduz aceita o pedido de vídeo e a resposta e os
 * candidatos de rede de uma ligação que ele mesmo abriu. Quem só assiste não aceita nada de quem não conduz.
 */
export async function sinalAceito(o: {
  exigir: boolean;
  aula: string;
  eu: Presente;
  de: string;
  dados: Record<string, unknown>;
  assinatura: string;
  educadores: Map<string, string>;
  temLigacao: boolean;
}): Promise<boolean> {
  if (!o.exigir) return true;
  const publica = o.educadores.get(o.de);
  if (publica) return verificar(publica, o.assinatura, amarraDoSinal(o.aula, o.de, o.eu.chave, o.dados));
  if (o.eu.papel !== "educador") return false;
  if (o.dados.t === "pedir") return true;
  return (o.dados.t === "resposta" || o.dados.t === "ice") && o.temLigacao;
}

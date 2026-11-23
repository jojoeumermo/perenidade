// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Entrar num núcleo sem o servidor saber quem pediu nem quem aceitou.
//
// O núcleo publica no perfil público (banco) a sua caixa de entrada: o id e o passe de depósito (públicos de propósito) e a chave
// pública X-Wing da entrada. A privada, o passe de leitura da caixa e o passe de gestão ficam só nos aparelhos da mediação.
//
// 1. Quem quer entrar cria uma caixa de resposta (id, passes) e sorteia uma chave `kr` de 32 bytes; manda, num envelope HPKE (RFC
//    9180, modo base, KEM X-Wing = X25519 + ML-KEM-768, pela biblioteca @hpke) para a chave de entrada: a identidade da conta, um
//    pacote de chave do MLS (KeyPackage) deste aparelho, a caixa de resposta e `kr`. O envelope é completado a 4096 bytes por dentro.
// 2. A mediação abre, decide no aparelho, põe a pessoa no grupo pelo MLS e manda o pacote de boas-vindas (Welcome, cadeia de papéis,
//    apresentações), assinado, embrulhado com `kr` na caixa de resposta.
// Na mesma peça: o repasse da chave de entrada a quem vira mediação, num envelope HPKE para a chave X-Wing que a pessoa pôs na
// apresentação (só aquele aparelho abre, mesmo indo pela caixa do grupo).
import type { CipherSuite } from "@hpke/core";
import { ed25519 } from "@noble/curves/ed25519.js";
import { canonico, completar, deB64, juntar, lerU32, paraB64, resumo, texto, tirarCompleto, u32 } from "./bytes";
import { ROTULOS } from "./rotulos";

let suite: Promise<CipherSuite> | null = null;
function suiteDaEntrada(): Promise<CipherSuite> {
  suite ??= (async () => {
    const [{ CipherSuite: Suite, HkdfSha256, Aes256Gcm }, { XWing }] = await Promise.all([import("@hpke/core"), import("@hpke/hybridkem-x-wing")]);
    return new Suite({ kem: new XWing(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
  })();
  return suite;
}

/** O tamanho do pedido por dentro (o mesmo dos pedidos de conversa); por fora: 1120 (enc) + 4096 + 16. */
export const TAMANHO_DO_PEDIDO = 4096;
export const ENVELOPE_DO_PEDIDO = 1120 + TAMANHO_DO_PEDIDO + 16;
/** O texto curto que acompanha o pedido, em bytes. */
export const TEXTO_DO_PEDIDO = 600;
const TAMANHOS_DO_REPASSE = [2048] as const;

export interface ParXWing {
  publica: Uint8Array;
  privada: Uint8Array;
}

export async function novoParXWing(): Promise<ParXWing> {
  const s = await suiteDaEntrada();
  const par = await s.kem.generateKeyPair();
  return {
    publica: new Uint8Array(await s.kem.serializePublicKey(par.publicKey)),
    privada: new Uint8Array(await s.kem.serializePrivateKey(par.privateKey)),
  };
}

async function selar(publica: Uint8Array, rotulo: string, bloco: Uint8Array): Promise<Uint8Array> {
  const s = await suiteDaEntrada();
  const chave = await s.kem.deserializePublicKey(publica as Uint8Array<ArrayBuffer>);
  try {
    const { ct, enc } = await s.seal({ recipientPublicKey: chave, info: texto(rotulo) as Uint8Array<ArrayBuffer> }, bloco as Uint8Array<ArrayBuffer>);
    return juntar(new Uint8Array(enc), new Uint8Array(ct));
  } finally {
    bloco.fill(0);
  }
}

async function abrir(privada: Uint8Array, rotulo: string, envelope: Uint8Array): Promise<Uint8Array | null> {
  try {
    const s = await suiteDaEntrada();
    const chave = await s.kem.deserializePrivateKey(privada as Uint8Array<ArrayBuffer>);
    const aberto = await s.open(
      { recipientKey: chave, enc: envelope.slice(0, 1120) as Uint8Array<ArrayBuffer>, info: texto(rotulo) as Uint8Array<ArrayBuffer> },
      envelope.slice(1120) as Uint8Array<ArrayBuffer>,
    );
    return new Uint8Array(aberto);
  } catch {
    return null;
  }
}

// ── Pedido de entrada ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface PedidoDeEntrada {
  identidade: Uint8Array; // 32
  kr: Uint8Array; // 32: a chave do embrulho da resposta
  resposta: { id: Uint8Array; pd: Uint8Array }; // a caixa de resposta (32 + 32)
  pacote: Uint8Array; // KeyPackage do MLS
  texto: string;
}

const VERSAO_DO_PEDIDO = 1;

export async function selarPedido(chaveDeEntrada: Uint8Array, p: PedidoDeEntrada): Promise<Uint8Array> {
  const t = texto(p.texto);
  if (t.length > TEXTO_DO_PEDIDO) throw new Error("texto_grande");
  if (p.identidade.length !== 32 || p.kr.length !== 32 || p.resposta.id.length !== 32 || p.resposta.pd.length !== 32) throw new Error("pedido_invalido");
  const dentro = juntar(new Uint8Array([VERSAO_DO_PEDIDO]), p.identidade, p.kr, p.resposta.id, p.resposta.pd, u32(p.pacote.length), p.pacote, u32(t.length), t);
  return selar(chaveDeEntrada, ROTULOS.entrada, completar(dentro, [TAMANHO_DO_PEDIDO]));
}

export async function abrirPedido(privadaDeEntrada: Uint8Array, envelope: Uint8Array): Promise<PedidoDeEntrada | null> {
  if (envelope.length !== ENVELOPE_DO_PEDIDO) return null;
  const aberto = await abrir(privadaDeEntrada, ROTULOS.entrada, envelope);
  const d = aberto && tirarCompleto(aberto, [TAMANHO_DO_PEDIDO]);
  if (!d || d.length < 1 + 128 + 8 || d[0] !== VERSAO_DO_PEDIDO) return null;
  let i = 1;
  const pegar = (n: number) => {
    if (i + n > d.length) throw new Error("curto");
    const b = d.slice(i, i + n);
    i += n;
    return b;
  };
  try {
    const identidade = pegar(32);
    const kr = pegar(32);
    const id = pegar(32);
    const pd = pegar(32);
    const pacote = pegar(lerU32(pegar(4), 0));
    const t = pegar(lerU32(pegar(4), 0));
    if (i !== d.length || t.length > TEXTO_DO_PEDIDO) return null;
    return { identidade, kr, resposta: { id, pd }, pacote, texto: new TextDecoder("utf-8", { fatal: true }).decode(t) };
  } catch {
    return null;
  }
}

// ── A chave de entrada do núcleo (só nos aparelhos da mediação) ──────────────────────────────────────────────────────────

export interface EntradaDoNucleo {
  publica: string; // X-Wing (b64url)
  privada: string;
  caixa: { id: string; pd: string; pl: string };
  /** O passe de gestão: troca a caixa e a chave de entrada no perfil público do núcleo sem dizer quem é. */
  gestao: string;
  /** A semente Ed25519 da chave de gestão do núcleo: assina a entrada pública (o aparelho de quem pede confere). */
  assinante: string;
}

// ── A entrada pública (no perfil do núcleo, no banco) ────────────────────────────────────────────────────────────────────

/** O que o banco guarda e devolve em public.rede_com_nucleo (tudo em base64url). */
export interface EntradaPublica {
  caixa: string;
  pd: string;
  xwing: string;
  chave: string; // a chave pública de gestão do núcleo (Ed25519): não é de conta nenhuma
  assinatura: string;
}

function textoDaEntrada(nucleo: string, e: Pick<EntradaPublica, "caixa" | "pd" | "xwing">): Uint8Array {
  return canonico(ROTULOS.entradaPublica, texto(nucleo), deB64(e.caixa), deB64(e.pd), deB64(e.xwing));
}

/** O resumo do passe de gestão, como o banco guarda (interno.rede_nucleo_gestao_h). */
export function resumoDaGestao(gestao: Uint8Array): Uint8Array {
  return resumo(texto(ROTULOS.gestao), gestao);
}

/** Monta a entrada pública assinada, mais o resumo do passe de gestão (para public.rede_nucleo_entrada_iniciar). */
export function publicarEntrada(nucleo: string, e: EntradaDoNucleo): EntradaPublica & { gestao_h: string } {
  const base = { caixa: e.caixa.id, pd: e.caixa.pd, xwing: e.publica };
  const semente = deB64(e.assinante);
  const assinatura = ed25519.sign(textoDaEntrada(nucleo, base), semente);
  return { ...base, chave: paraB64(ed25519.getPublicKey(semente)), assinatura: paraB64(assinatura), gestao_h: paraB64(resumoDaGestao(deB64(e.gestao))) };
}

/**
 * Confere a entrada pública antes de pedir para entrar: assinatura da chave de gestão do núcleo, tamanhos, e — quando o aparelho
 * já viu a chave de gestão deste núcleo antes — que ela não mudou (o servidor trocando a chave para ler os pedidos é recusado).
 */
export function conferirEntrada(nucleo: string, e: EntradaPublica, chaveConhecida?: string): boolean {
  try {
    const chave = deB64(e.chave);
    const assinatura = deB64(e.assinatura);
    if (chave.length !== 32 || assinatura.length !== 64 || deB64(e.caixa).length !== 32 || deB64(e.pd).length !== 32 || deB64(e.xwing).length !== 1216) return false;
    if (chaveConhecida !== undefined && chaveConhecida !== e.chave) return false;
    return ed25519.verify(assinatura, textoDaEntrada(nucleo, e), chave);
  } catch {
    return false;
  }
}

/** Repasse da chave de entrada a quem vira mediação: HPKE para a chave X-Wing da apresentação dessa pessoa. */
export async function selarChaveDeEntrada(xwingDaFolha: Uint8Array, entrada: EntradaDoNucleo): Promise<Uint8Array> {
  return selar(xwingDaFolha, ROTULOS.chaveDeEntrada, completar(texto(JSON.stringify(entrada)), TAMANHOS_DO_REPASSE));
}

export async function abrirChaveDeEntrada(privadaDaFolha: Uint8Array, envelope: Uint8Array): Promise<EntradaDoNucleo | null> {
  const aberto = await abrir(privadaDaFolha, ROTULOS.chaveDeEntrada, envelope);
  const d = aberto && tirarCompleto(aberto, TAMANHOS_DO_REPASSE);
  if (!d) return null;
  try {
    const e = JSON.parse(new TextDecoder().decode(d)) as EntradaDoNucleo;
    for (const campo of [e.publica, e.privada, e.caixa?.id, e.caixa?.pd, e.caixa?.pl, e.gestao, e.assinante]) deB64(campo);
    return e;
  } catch {
    return null;
  }
}

export function entradaParaB64(publica: Uint8Array): string {
  return paraB64(publica);
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O envelope selado do chat privado da Alumia ("remetente selado", como o do Signal). Documento: docs/rede/CHAT-PRIVADO.md
// ("Remetente selado").
//
// A mensagem já vai cifrada por Olm só para o aparelho da outra pessoa (lib/rede/chat/olm.ts, cifrarParaAparelho). Este arquivo
// põe essa mensagem, junto com QUEM mandou, dentro de um envelope que só a pessoa que recebe abre: HPKE (RFC 9180) com a troca de
// chaves híbrida X-Wing (X25519 + ML-KEM-768), pela biblioteca @hpke (nada feito à mão). O banco recebe só "para quem" e o
// envelope: não sabe quem mandou, nem de qual conversa é. O envelope é completado até um de seis tamanhos fixos.
//
// A chave pública do envelope de cada pessoa não fica no banco: ela vai, junto com a "senha de entrega" da caixa, num recado Olm
// já autenticado pelo aparelho confiável da pessoa (o "aperto de mão" da conversa). Assim o servidor não consegue trocar a chave
// do envelope por uma dele.
//
// Sem "@/" e sem navegador obrigatório: roda no Node nos testes (scripts/testar-chat-selado.mjs).
import type { CipherSuite } from "@hpke/core";

let suite: Promise<CipherSuite> | null = null;
function suiteDoEnvelope(): Promise<CipherSuite> {
  suite ??= (async () => {
    const [{ CipherSuite: Suite, HkdfSha256, Aes256Gcm }, { XWing }] = await Promise.all([import("@hpke/core"), import("@hpke/hybridkem-x-wing")]);
    return new Suite({ kem: new XWing(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
  })();
  return suite;
}

const INFO = new TextEncoder().encode("alumia-selado:1");
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function paraB64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deB64Url(texto: string): Uint8Array {
  const s = atob(texto.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (texto.length % 4)) % 4));
  const saida = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) saida[i] = s.charCodeAt(i);
  return saida;
}

/**
 * Os tamanhos do envelope por dentro (antes do HPKE). O cifrado Olm varia um pouco (a primeira mensagem de uma sessão leva as
 * chaves da sessão), então o conteúdo é completado até o menor destes que couber.
 */
export const TAMANHOS_DO_ENVELOPE = [2048, 4096, 8192, 16384, 24576, 32768] as const;
/** O tamanho do envelope no banco ("s1." + vetor X-Wing + cifrado), em caracteres, para cada tamanho de dentro. */
export const CARACTERES_DO_ENVELOPE = TAMANHOS_DO_ENVELOPE.map((n) => 3 + 1494 + 1 + Math.ceil(((n + 16) * 4) / 3));

function completar(conteudo: Uint8Array): Uint8Array {
  const total = 4 + conteudo.length;
  const tamanho = TAMANHOS_DO_ENVELOPE.find((t) => t >= total);
  if (!tamanho) throw new Error("conteudo_grande");
  const bloco = new Uint8Array(new ArrayBuffer(tamanho));
  new DataView(bloco.buffer).setUint32(0, conteudo.length);
  bloco.set(conteudo, 4);
  return bloco;
}
function tirarCompleto(bloco: Uint8Array): Uint8Array | null {
  if (!(TAMANHOS_DO_ENVELOPE as readonly number[]).includes(bloco.length)) return null;
  const n = new DataView(bloco.buffer, bloco.byteOffset, bloco.byteLength).getUint32(0);
  if (n > bloco.length - 4) return null;
  if (bloco.subarray(4 + n).some((b) => b !== 0)) return null;
  return bloco.slice(4, 4 + n);
}

/** Um par de chaves do envelope (X-Wing). A pública (1216 bytes) vai no aperto de mão; a privada (32 bytes) fica no aparelho. */
export async function novoParDoEnvelope(): Promise<{ publica: string; privada: string }> {
  const s = await suiteDoEnvelope();
  const par = await s.kem.generateKeyPair();
  return {
    publica: paraB64Url(new Uint8Array(await s.kem.serializePublicKey(par.publicKey))),
    privada: paraB64Url(new Uint8Array(await s.kem.serializePrivateKey(par.privateKey))),
  };
}

/** O que vai dentro do envelope: quem mandou (o aparelho confere com o Olm), e a mensagem cifrada por Olm. */
export interface DentroDoEnvelope {
  de: string;
  cifrado: Record<string, unknown>;
}

const FORMATO = /^s1\.([A-Za-z0-9_-]{1494})\.([A-Za-z0-9_-]+)$/;

/** Fecha o envelope para a chave pública do envelope de quem recebe. */
export async function selar(publicaDoDestino: string, dentro: DentroDoEnvelope): Promise<string> {
  const s = await suiteDoEnvelope();
  const chave = await s.kem.deserializePublicKey(deB64Url(publicaDoDestino) as Uint8Array<ArrayBuffer>);
  const bloco = completar(encoder.encode(JSON.stringify(dentro)));
  try {
    const { ct, enc } = await s.seal({ recipientPublicKey: chave, info: INFO }, bloco as Uint8Array<ArrayBuffer>);
    return `s1.${paraB64Url(new Uint8Array(enc))}.${paraB64Url(new Uint8Array(ct))}`;
  } finally {
    bloco.fill(0);
  }
}

/** Abre um envelope com a chave privada do envelope deste aparelho. null em qualquer dúvida. */
export async function abrirEnvelope(privada: string, envelope: string): Promise<DentroDoEnvelope | null> {
  const partes = FORMATO.exec(envelope);
  if (!partes) return null;
  try {
    const s = await suiteDoEnvelope();
    const chave = await s.kem.deserializePrivateKey(deB64Url(privada) as Uint8Array<ArrayBuffer>);
    const aberto = await s.open({ recipientKey: chave, enc: deB64Url(partes[1]) as Uint8Array<ArrayBuffer>, info: INFO }, deB64Url(partes[2]) as Uint8Array<ArrayBuffer>);
    const conteudo = tirarCompleto(new Uint8Array(aberto));
    if (!conteudo) return null;
    const dentro = JSON.parse(decoder.decode(conteudo));
    if (typeof dentro?.de !== "string" || typeof dentro?.cifrado !== "object" || dentro.cifrado === null) return null;
    return { de: dentro.de, cifrado: dentro.cifrado };
  } catch {
    return null;
  }
}

/** Uma senha de entrega nova (32 bytes sorteados) e o resumo dela (SHA-256, base64 padrão), que é o que o banco guarda. */
export async function novaSenhaDeEntrega(): Promise<{ senha: string; resumo: string }> {
  const senha = paraB64Url(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32))));
  return { senha, resumo: await resumoDaSenha(senha) };
}
export async function resumoDaSenha(senha: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(senha)));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

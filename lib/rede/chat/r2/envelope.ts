// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O envelope pós-quântico de cada mensagem da conversa a dois (onda R2, itens 1.1 e 1.2). Documento:
// docs/rede/CHAT-PRIVADO.md.
//
// A mensagem já cifrada pelo Proteus (Double Ratchet, lib/rede/chat/r2/proteus.ts) vai, junto com QUAL aparelho mandou, dentro de
// um envelope HPKE (RFC 9180, modo base) com o KEM híbrido X-Wing (X25519 + ML-KEM-768), feito para a chave X-Wing DA SEMANA do
// aparelho de destino. Bibliotecas: @hpke/core e @hpke/hybridkem-x-wing (nada feito à mão).
//
//   dentro  = 0x03 | tipo (1) | aparelho que manda (32) | início (1: 0 ou 1) | [auth_key do SPQR (32) se início = 1] | comprimento (4) |
//             camada pós-quântica (lib/rede/chat/r3/camada-pq.ts: o Proteus dentro de uma cifra com chave do SPQR)  → completado a 2048 … 32768
//   pacote  = enc (1120) ‖ HPKE.Seal(pk = X-Wing da semana, info = "alumia/r2/envelope/v1", aad = id_h ‖ c ‖ semana, dentro)
//
// Onda R3 (item 1.1): a versão de dentro passou a 0x03, com a camada pós-quântica do SPQR por cima do Proteus. A 0x02 (só Proteus) é
// recusada: não há como "negociar para baixo". A auth_key do SPQR vai só nos pacotes de quem começou a sessão SPQR, até a outra ponta
// responder; por estar aqui dentro, ela é confidencial contra o computador quântico (o ML-KEM-768 do X-Wing).
//
// - remetente selado: o servidor vê só a caixa; quem mandou vai dentro;
// - tamanhos fixos: o servidor vê um de seis tamanhos;
// - pós-quântico: quem gravou o tráfego e quebrar só o X25519 (o do Proteus e o do X-Wing) continua sem o segredo do ML-KEM-768 de
//   cada envelope, e não vê nem a primeira mensagem do Proteus (a que leva a pré-chave e a chave inicial);
// - aad: o envelope só abre na caixa (id_h) para a qual foi feito, com o compromisso da franquia (c) que o servidor guardou, e com a
//   semana dita; outra caixa, outro c ou outra semana não abrem;
// - semana: o aparelho aceita a da semana atual e as 5 anteriores (e uma à frente, pelo relógio); fora disso, recusa, e a privada
//   de mais de 5 semanas é apagada (lib/rede/chat/r2/aparelho.ts). Não dá para forçar a volta a uma chave velha.
import type { CipherSuite } from "@hpke/core";
import { copia, juntar, lerU32, u32, completar, tirarCompleto, texto, type Bytes } from "./bytes";
import { ROTULOS } from "./rotulos";

/** Os tamanhos de dentro do envelope (antes da marca de 16 bytes do AES-GCM). */
export const TAMANHOS_DO_ENVELOPE = [2048, 4096, 8192, 16384, 24576, 32768] as const;
/** O `enc` do X-Wing: 1088 do ML-KEM-768 + 32 do X25519. */
export const BYTES_DO_ENC = 1120;
/** Os tamanhos do pacote inteiro, que o banco aceita (1120 + n + 16). */
export const TAMANHOS_DO_PACOTE: readonly number[] = TAMANHOS_DO_ENVELOPE.map((n) => BYTES_DO_ENC + n + 16);
export const ENVELOPE_TIPOS = { mensagem: 1, sincronia: 2 } as const;
export type TipoDoEnvelope = keyof typeof ENVELOPE_TIPOS;
const VERSAO = 0x03;
/** A versão da R2 (só o Proteus, sem a camada pós-quântica): recusada. */
export const VERSAO_VELHA = 0x02;
/** Quantas semanas para trás o aparelho aceita (35 dias: 30 de vida do pacote + 5 de folga). */
export const SEMANAS_ACEITAS = 5;
const SEMANA_MS = 7 * 86_400_000;

/** O número da semana (semanas desde 1970, em UTC). */
export const semanaDe = (agora = Date.now()) => Math.floor(agora / SEMANA_MS);
/** A semana do envelope está na janela que este aparelho aceita? */
export const semanaAceita = (semana: number, agora = Date.now()) => Number.isInteger(semana) && semana >= semanaDe(agora) - SEMANAS_ACEITAS && semana <= semanaDe(agora) + 1;

let suite: Promise<CipherSuite> | null = null;
function suiteDoEnvelope(): Promise<CipherSuite> {
  suite ??= (async () => {
    const [{ CipherSuite: Suite, HkdfSha256, Aes256Gcm }, { XWing }] = await Promise.all([import("@hpke/core"), import("@hpke/hybridkem-x-wing")]);
    return new Suite({ kem: new XWing(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
  })().catch((erro: unknown) => {
    suite = null;
    throw erro;
  });
  return suite;
}

/** Um par X-Wing novo: a pública (1216 bytes) vai ao diretório, assinada; a privada (32 bytes) fica só no aparelho. */
export async function novoParXWing(): Promise<{ publica: Bytes; privada: Bytes }> {
  const s = await suiteDoEnvelope();
  const par = await s.kem.generateKeyPair();
  return { publica: copia(new Uint8Array(await s.kem.serializePublicKey(par.publicKey))), privada: copia(new Uint8Array(await s.kem.serializePrivateKey(par.privateKey))) };
}

export interface Dentro {
  tipo: TipoDoEnvelope;
  /** A chave Ed25519 do aparelho que manda (32 bytes). */
  aparelho: Bytes;
  /** A auth_key do SPQR (32 bytes) enquanto quem manda começou a sessão SPQR e ainda não teve resposta; null nos outros pacotes. */
  inicio: Bytes | null;
  /** A camada pós-quântica, com o cifrado do Proteus dentro. */
  camada: Bytes;
}

const aadDe = (idH: Uint8Array, c: Uint8Array, semana: number) => {
  if (idH.length !== 32 || c.length !== 32) throw new Error("aad_invalido");
  return juntar(idH, c, u32(semana));
};

/** Fecha o envelope para a chave X-Wing da semana do aparelho de destino. */
export async function selar(publica: Uint8Array, semana: number, idH: Uint8Array, c: Uint8Array, d: Dentro): Promise<Bytes> {
  if (d.aparelho.length !== 32) throw new Error("aparelho_invalido");
  if ((d.inicio && d.inicio.length !== 32) || !d.camada.length) throw new Error("dentro_invalido");
  const s = await suiteDoEnvelope();
  const chave = await s.kem.deserializePublicKey(copia(publica));
  const inicio = d.inicio ? juntar(new Uint8Array([1]), d.inicio) : new Uint8Array([0]);
  const bloco = completar(juntar(new Uint8Array([VERSAO, ENVELOPE_TIPOS[d.tipo]]), d.aparelho, inicio, u32(d.camada.length), d.camada), TAMANHOS_DO_ENVELOPE);
  try {
    const { ct, enc } = await s.seal({ recipientPublicKey: chave, info: texto(ROTULOS.envelope) }, bloco, aadDe(idH, c, semana));
    return juntar(new Uint8Array(enc), new Uint8Array(ct));
  } finally {
    bloco.fill(0);
  }
}

/**
 * Abre um envelope com a privada X-Wing da semana dita. null em qualquer dúvida (tamanho, semana fora da janela, aad, formato):
 * nunca diz por quê, para o servidor não usar o aparelho como oráculo.
 */
export async function abrir(privada: Uint8Array, semana: number, idH: Uint8Array, c: Uint8Array, pacote: Uint8Array, agora = Date.now()): Promise<Dentro | null> {
  if (!TAMANHOS_DO_PACOTE.includes(pacote.length) || !semanaAceita(semana, agora)) return null;
  try {
    const s = await suiteDoEnvelope();
    const chave = await s.kem.deserializePrivateKey(copia(privada));
    const aberto = new Uint8Array(
      await s.open({ recipientKey: chave, enc: copia(pacote.subarray(0, BYTES_DO_ENC)), info: texto(ROTULOS.envelope) }, copia(pacote.subarray(BYTES_DO_ENC)), aadDe(idH, c, semana)),
    );
    const dentro = tirarCompleto(aberto, TAMANHOS_DO_ENVELOPE);
    aberto.fill(0);
    if (!dentro || dentro.length < 40 || dentro[0] !== VERSAO) return null;
    const tipo = (Object.keys(ENVELOPE_TIPOS) as TipoDoEnvelope[]).find((t) => ENVELOPE_TIPOS[t] === dentro[1]);
    if (!tipo || (dentro[34] !== 0 && dentro[34] !== 1)) return null;
    const comInicio = dentro[34] === 1;
    const i = comInicio ? 67 : 35;
    if (dentro.length < i + 4) return null;
    const n = lerU32(dentro, i);
    if (n === 0 || i + 4 + n !== dentro.length) return null;
    return { tipo, aparelho: copia(dentro.subarray(2, 34)), inicio: comInicio ? copia(dentro.subarray(35, 67)) : null, camada: copia(dentro.subarray(i + 4)) };
  } catch {
    return null;
  }
}

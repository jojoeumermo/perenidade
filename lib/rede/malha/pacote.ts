// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O pacote das mensagens sem internet (onda R3, item 2.2; documento público: docs/rede/SEM-INTERNET.md). Celulares próximos guardam e
// repassam pacotes de TAMANHO FIXO que EXPIRAM; quem repassa não sabe de quem é nem para quem vai. Nada de cifra feita à mão: HMAC e
// HKDF da @noble/hashes (auditada), HPKE (RFC 9180) com o KEM híbrido X-Wing da @hpke/core e @hpke/hybridkem-x-wing, as mesmas da
// conversa a dois.
//
//   pacote (3254 bytes, sempre) = 0x4D ‖ versão(1)=1 ‖ validade u32 (hora UTC desde 1970) ‖ nonce(16) ‖ etiqueta(16) ‖ corpo(3216)
//   corpo = XChaCha20(kc, nonce ‖ 0⁸) ⊕ (c(32) ‖ envelope(3184))
//
// - a camada da malha (achado da auditoria interna da R3): sem ela, o corpo que passa por qualquer aparelho por perto era, byte a
//   byte, o MESMO c e envelope que o aparelho também deposita na caixa quando tem internet; quem repassa E tem o banco (a polícia num
//   ato, com o servidor tomado ou intimado) ligava o depósito da caixa a um lugar e a uma hora. Agora o corpo vai cifrado com uma chave
//   kc = HKDF(id da caixa, ou k_ato no farol; rótulo próprio de corpo) e o nonce do pacote; quem não tem o id vê bytes sorteados, que não
//   batem com nada do servidor. A integridade continua com a etiqueta (HMAC sobre o corpo CIFRADO: cifra-e-depois-autentica). A
//   cobertura vira 3216 bytes sorteados (o corpo de verdade, cifrado, é indistinguível disso).
//
// - etiqueta = HMAC-SHA-256(k, rótulo ‖ nonce ‖ validade ‖ SHA-256(corpo))[0..16]. Só quem tem k reconhece; muda a cada pacote (nonce
//   sorteado), então dois pacotes para a mesma caixa não se ligam; e prende a validade E o corpo: quem repassa não emenda o cabeçalho
//   de um pacote novo no corpo de um velho para fazer o velho durar mais (o ataque que o modelo formal achou na primeira versão, que
//   não tinha o resumo do corpo: provas/controles/sem-internet-etiqueta-sem-corpo.pv).
// - mensagem: o MESMO depósito que iria à caixa (c = o compromisso da franquia; envelope = o X-Wing + Proteus da conversa a dois, no
//   bloco de 2048). k = HKDF(id da caixa de entrada de quem recebe).
// - farol do ato: k sai da chave do ato (k_ato, que só quem confirmou presença recebeu, com internet); o corpo é um envelope HPKE
//   X-Wing para a chave do ato (derivada de k_ato), com os 22 primeiros bytes do cabeçalho (marca, versão, validade, nonce) como dados
//   associados. O MESMO formato da mensagem: quem repassa não distingue farol de mensagem nem de cobertura (veja "Por que o farol vai
//   em HPKE" no documento).
// - cobertura: etiqueta e corpo sorteados. Antes da camada da malha era um envelope X-Wing de verdade (para imitar o bit alto da chave
//   X25519 dentro do `enc`); com o corpo cifrado, mensagem e farol já são indistinguíveis de bytes sorteados.
//
// Sem contador de saltos (diria a distância até a origem). A validade é de 1 a 24 horas, arredondada à hora.
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-r3-malha.mjs).
import type { CipherSuite } from "@hpke/core";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { xchacha20 } from "@noble/ciphers/chacha.js";
import { completar, copia, iguais, juntar, lerU32, sortear, texto, tirarCompleto, u32, type Bytes } from "../chat/r2/bytes";

/** Os rótulos da malha (um por finalidade; a junção os acrescenta em lib/rede/cifra/rotulos.ts). */
export const ROTULOS = {
  /** HMAC da etiqueta de destino (mensagem e farol). */
  etiqueta: "alumia/r3/malha/etiqueta/v1",
  /** HKDF: do id da caixa de entrada para a chave da etiqueta. */
  chave: "alumia/r3/malha/chave/v1",
  /** O farol do ato: o começo do conteúdo assinado (farol.ts). */
  farol: "alumia/r3/farol/v1",
  /** O `info` do HPKE do farol. */
  farolEnvelope: "alumia/r3/farol/envelope/v1",
  /** HKDF: de k_ato para a semente X-Wing do ato e para a chave da etiqueta do ato (separadas: uma chave, um uso). */
  farolXwing: "alumia/r3/farol/xwing/v1",
  farolEtiqueta: "alumia/r3/farol/etiqueta/v1",
  /** HKDF: do id da caixa (mensagem) e de k_ato (farol) para a chave da camada da malha sobre o corpo (uma chave, um uso). */
  corpo: "alumia/r3/malha/corpo/v1",
  farolCorpo: "alumia/r3/farol/corpo/v1",
} as const;

export const MARCA = 0x4d;
export const VERSAO = 1;
export const TAMANHO_DO_PACOTE = 3254;
export const CABECALHO = 38;
/** Marca, versão, validade e nonce: os dados associados do farol (a etiqueta vem depois e depende do corpo). */
const ANTES_DA_ETIQUETA = 22;
export const TAMANHO_DO_CORPO = TAMANHO_DO_PACOTE - CABECALHO;
/** O envelope da conversa a dois no menor bloco (1120 do `enc` + 2048 + 16 da marca do AES-GCM). */
export const TAMANHO_DO_ENVELOPE = 3184;
const BLOCO = 2048;
export const VALIDADE_MAXIMA_HORAS = 24;
/** A validade de todo pacote que a Alumia faz (mensagem, farol e cobertura): a mesma para todos, para a validade não separar tipos. */
export const VALIDADE_PADRAO = 24;
const HORA_MS = 3_600_000;

/** A hora (horas desde 1970, UTC) de `agora`. */
export const horaDe = (agora: number): number => Math.floor(agora / HORA_MS);

/** A chave da etiqueta de uma caixa de entrada (o id de 32 bytes que só quem manda e quem recebe têm). */
export function chaveDeDestino(idDaCaixa: Uint8Array): Bytes {
  if (idDaCaixa.length !== 32) throw new Error("caixa_invalida");
  return copia(hkdf(sha256, idDaCaixa, undefined, texto(ROTULOS.chave), 32));
}

/** A chave da etiqueta do ato (de k_ato; o farol nunca usa k_ato direto). */
export function chaveDaEtiquetaDoAto(kAto: Uint8Array): Bytes {
  if (kAto.length !== 32) throw new Error("chave_do_ato_invalida");
  return copia(hkdf(sha256, kAto, undefined, texto(ROTULOS.farolEtiqueta), 32));
}

function etiqueta(k: Uint8Array, nonce: Uint8Array, validade: number, resumoDoCorpo: Uint8Array): Bytes {
  return copia(hmac(sha256, k, juntar(texto(ROTULOS.etiqueta), nonce, u32(validade), resumoDoCorpo)).subarray(0, 16));
}

function validadeDe(validadeHoras: number, agora: number): number {
  if (!Number.isInteger(validadeHoras) || validadeHoras < 1 || validadeHoras > VALIDADE_MAXIMA_HORAS) throw new Error("validade_invalida");
  return horaDe(agora) + validadeHoras;
}

const inicio = (validade: number, nonce: Uint8Array): Bytes => juntar(new Uint8Array([MARCA, VERSAO]), u32(validade), nonce);

/** A chave da camada da malha sobre o corpo: do id da caixa (mensagem) ou de k_ato (farol), com rótulo próprio. */
function chaveDoCorpo(segredo: Uint8Array, rotulo: string): Bytes {
  if (segredo.length !== 32) throw new Error("chave_invalida");
  return copia(hkdf(sha256, segredo, undefined, texto(rotulo), 32));
}

/** A camada da malha (XChaCha20 da @noble/ciphers; o nonce de 16 bytes do pacote, sorteado, completado com 8 zeros). Cifra e decifra. */
const camada = (kc: Uint8Array, nonce: Uint8Array, dados: Uint8Array): Bytes => copia(xchacha20(kc, juntar(nonce, new Uint8Array(8)), dados));

/** O pacote inteiro: o início, a etiqueta (de k, sobre o início e o resumo do corpo CIFRADO) e o corpo cifrado com kc. */
function pacote(k: Uint8Array, kc: Uint8Array, validade: number, nonce: Uint8Array, claro: Uint8Array): Bytes {
  const corpo = camada(kc, nonce, claro);
  return juntar(inicio(validade, nonce), etiqueta(k, nonce, validade, sha256(corpo)), corpo);
}

let suite: Promise<CipherSuite> | null = null;
function suiteDaMalha(): Promise<CipherSuite> {
  suite ??= (async () => {
    const [{ CipherSuite: Suite, HkdfSha256, Aes256Gcm }, { XWing }] = await Promise.all([import("@hpke/core"), import("@hpke/hybridkem-x-wing")]);
    return new Suite({ kem: new XWing(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
  })().catch((erro: unknown) => {
    suite = null;
    throw erro;
  });
  return suite;
}

/** O envelope de uma mensagem curta da conversa a dois cabe no pacote? (Só o bloco de 2048 vai sem internet.) */
export const cabeNaMalha = (envelope: Uint8Array, c: Uint8Array | null): boolean => envelope.length === TAMANHO_DO_ENVELOPE && c?.length === 32;

/**
 * O pacote de uma mensagem: o depósito que iria à caixa `idDaCaixaDeDestino` (c e envelope da conversa a dois), com a etiqueta que só
 * quem tem o id da caixa reconhece.
 */
export function montarMensagem(idDaCaixaDeDestino: Uint8Array, c: Uint8Array, envelope: Uint8Array, validadeHoras: number, agora = Date.now()): Bytes {
  if (!cabeNaMalha(envelope, c)) throw new Error("nao_cabe_na_malha");
  return pacote(chaveDeDestino(idDaCaixaDeDestino), chaveDoCorpo(idDaCaixaDeDestino, ROTULOS.corpo), validadeDe(validadeHoras, agora), sortear(16), juntar(c, envelope));
}

/** O par X-Wing do ato, derivado de k_ato (todos que confirmaram presença têm o mesmo). */
async function parDoAto(kAto: Uint8Array) {
  if (kAto.length !== 32) throw new Error("chave_do_ato_invalida");
  const s = await suiteDaMalha();
  return { s, par: await s.kem.deriveKeyPair(copia(hkdf(sha256, kAto, undefined, texto(ROTULOS.farolXwing), 32))) };
}

/** O pacote do farol do ato: `farol` (o conteúdo já assinado, farol.ts) num envelope para a chave do ato. */
export async function montarFarol(kAto: Uint8Array, farol: Uint8Array, validadeHoras: number, agora = Date.now()): Promise<Bytes> {
  const validade = validadeDe(validadeHoras, agora);
  const nonce = sortear(16);
  const { s, par } = await parDoAto(kAto);
  const dentro = completar(farol, [BLOCO]);
  try {
    const { ct, enc } = await s.seal({ recipientPublicKey: par.publicKey, info: texto(ROTULOS.farolEnvelope) }, dentro, inicio(validade, nonce));
    return pacote(chaveDaEtiquetaDoAto(kAto), chaveDoCorpo(kAto, ROTULOS.farolCorpo), validade, nonce, juntar(sortear(32), new Uint8Array(enc), new Uint8Array(ct)));
  } finally {
    dentro.fill(0);
  }
}

/** Abre o corpo de um pacote de farol já reconhecido (eParaMim com a chave do ato). null em qualquer dúvida. */
export async function abrirFarol(kAto: Uint8Array, p: PacoteLido): Promise<Bytes | null> {
  try {
    const { s, par } = await parDoAto(kAto);
    const env = camada(chaveDoCorpo(kAto, ROTULOS.farolCorpo), p.nonce, p.corpo).subarray(32);
    const aberto = new Uint8Array(await s.open({ recipientKey: par.privateKey, enc: copia(env.subarray(0, 1120)), info: texto(ROTULOS.farolEnvelope) }, copia(env.subarray(1120)), p.cabecalho.subarray(0, ANTES_DA_ETIQUETA)));
    const farol = tirarCompleto(aberto, [BLOCO]);
    aberto.fill(0);
    return farol;
  } catch {
    return null;
  }
}

/**
 * Um pacote de cobertura: igual a uma mensagem de verdade para quem não tem a chave. Com a camada da malha, o corpo de verdade é
 * XChaCha20 sobre o depósito, indistinguível de bytes sorteados: a cobertura é etiqueta e corpo sorteados (assíncrona como antes).
 */
export async function montarCobertura(validadeHoras = VALIDADE_PADRAO, agora = Date.now()): Promise<Bytes> {
  const validade = validadeDe(validadeHoras, agora);
  return juntar(inicio(validade, sortear(16)), sortear(16), sortear(TAMANHO_DO_CORPO));
}

export interface PacoteLido {
  validade: number;
  nonce: Bytes;
  etiqueta: Bytes;
  /** O corpo CIFRADO pela camada da malha (c(32) ‖ envelope(3184) depois de decifrado com a chave do destino). */
  corpo: Bytes;
  /** Os 38 bytes do cabeçalho (os 22 primeiros são os dados associados do farol). */
  cabecalho: Bytes;
}

/**
 * Lê um pacote recebido. null para tamanho, marca ou versão errados e para validade vencida ou além de 24 horas à frente. Nunca
 * lança: um pacote malformado não derruba o aparelho.
 */
export function ler(p: unknown, agora = Date.now()): PacoteLido | null {
  if (!(p instanceof Uint8Array) || p.length !== TAMANHO_DO_PACOTE) return null;
  if (p[0] !== MARCA || p[1] !== VERSAO) return null;
  const validade = lerU32(p, 2);
  const hora = horaDe(agora);
  if (validade < hora || validade > hora + VALIDADE_MAXIMA_HORAS) return null;
  return { validade, nonce: copia(p.subarray(6, 22)), etiqueta: copia(p.subarray(22, 38)), corpo: copia(p.subarray(CABECALHO)), cabecalho: copia(p.subarray(0, CABECALHO)) };
}

/** O pacote é para uma destas chaves de etiqueta (chaveDeDestino ou chaveDaEtiquetaDoAto)? Devolve o índice, ou -1. */
export function eParaMim(p: PacoteLido, chaves: readonly Uint8Array[]): number {
  let achado = -1;
  const r = sha256(p.corpo);
  // Testa todas, sem parar na primeira (o tempo não diz qual).
  for (let i = 0; i < chaves.length; i++) if (iguais(etiqueta(chaves[i], p.nonce, p.validade, r), p.etiqueta) && achado < 0) achado = i;
  return achado;
}

/** O que a caixa receberia: o compromisso da franquia e o envelope (de um pacote de mensagem reconhecido para a caixa `idDaCaixa`). */
export function depositoDe(p: PacoteLido, idDaCaixa: Uint8Array): { c: Bytes; envelope: Bytes } {
  const claro = camada(chaveDoCorpo(idDaCaixa, ROTULOS.corpo), p.nonce, p.corpo);
  return { c: copia(claro.subarray(0, 32)), envelope: copia(claro.subarray(32)) };
}

/** O resumo que diz "este pacote eu já vi" (do corpo: mudar o cabeçalho não faz um pacote repetido passar por novo). */
export const resumoDoPacote = (p: PacoteLido): Bytes => copia(sha256(p.corpo));


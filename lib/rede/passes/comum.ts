// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o aparelho e os servidores dividem nos passes anônimos (Privacy Pass, RFC 9576/9578, tipo 0x0002 "Blind RSA (2048)", RSABSSA-
// SHA384-PSS-Deterministic do RFC 9474, pela biblioteca @cloudflare/privacypass-ts): o nome do emissor, o desafio, a semana da chave,
// o contexto da urna e o tamanho do lote do dia.
//
// Onda R3 (item 3.1): os passes passam de VOPRF (verificação privada: só quem tem o segredo confere) para RSA CEGO (verificação
// pública: qualquer um confere com a chave pública). Quem emite continua sendo o servidor do site (com a sessão da conta aprovada);
// quem confere pode ser o servidor do chat separado, que só tem a chave PÚBLICA da semana, tirada do registro de transparência.
// Sem "@/" de propósito.
import { TokenChallenge, publicVerif } from "@cloudflare/privacypass-ts";
import { sha256 } from "@noble/hashes/sha2.js";

/** O nome do emissor (não é um endereço: o passe só vale aqui). */
export const EMISSOR = "alumia.invalid";

/** O tipo do passe: Blind RSA 2048, PSS com sal de 48 bytes (o 0x0002 do RFC 9578). */
export const TIPO = publicVerif.BLIND_RSA;
export const MODO = publicVerif.BlindRSAMode.PSS;

/** Os rótulos dos passes da R3 (um por finalidade; lib/rede/cifra/rotulos.ts junta os de todas e confere que não se repetem). */
export const ROTULOS_DOS_PASSES = {
  /** A chave que sela a chave privada da semana no banco (HKDF do segredo dos passes do servidor do site). */
  selo: "alumia/r3/passes/selo/v1",
  /** O contexto do passe da urna anônima: SHA-256(rótulo ‖ "<tipo>:<alvo>"). */
  urna: "alumia/r3/urna/passe/v1",
  /** A marca "esta conta já pegou o passe deste contexto" (HMAC do servidor do site; o banco não sabe de quem é). */
  contextoEmitido: "alumia/r3/passes/contexto-emitido/v1",
} as const;

const texto = new TextEncoder();

/**
 * O desafio de um passe: tipo Blind RSA, este emissor, o contexto de resgate (vazio nos passes de uso geral; 32 bytes no passe da
 * urna) e esta origem. Sem contexto por pessoa, todos os passes gerais são iguais entre si (o resumo do desafio vai dentro do passe e
 * quem confere exige que seja este).
 */
export const desafio = (contexto: Uint8Array = new Uint8Array(0)) => new TokenChallenge(TIPO.value, EMISSOR, contexto, [EMISSOR]);

/** O resumo do desafio (o "challenge_digest" de dentro do passe). */
export const resumoDoDesafio = (contexto?: Uint8Array): Uint8Array => sha256(desafio(contexto).serialize());

/** Quantos passes gerais cada conta aprovada recebe por dia. */
export const PASSES_POR_DIA = 30;

/** O comprimento de um passe serializado: tipo(2) ‖ nonce(32) ‖ resumo do desafio(32) ‖ id da chave(32) ‖ assinatura RSA(256). */
export const TAMANHO_DO_PASSE = 2 + 32 + 32 + 32 + TIPO.Nk;

/** O cabeçalho de quem gasta um passe (RFC 9577). */
export const cabecalhoDoPasse = (passeB64u: string) => `PrivateToken token="${passeB64u}"`;

const SEMANA_MS = 7 * 86_400_000;

/** A semana (semanas inteiras desde 1970-01-01, em UTC): a mesma conta de interno.passes_semana_hoje(). */
export const semanaDe = (ms: number = Date.now()): number => Math.floor(ms / SEMANA_MS);

/** Os tipos de votação que têm urna anônima (os mesmos de interno.voto_situacao). */
export type TipoDaUrna = "consulta" | "decisao" | "equipe";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** O contexto do passe da urna de uma votação: SHA-256("alumia/r3/urna/passe/v1" ‖ "<tipo>:<alvo>"). Nulo se o alvo não é um uuid. */
export function contextoDaUrna(tipo: TipoDaUrna, alvo: string): Uint8Array | null {
  if (!["consulta", "decisao", "equipe"].includes(tipo) || !UUID.test(alvo)) return null;
  const a = texto.encode(ROTULOS_DOS_PASSES.urna), b = texto.encode(`${tipo}:${alvo}`);
  const junto = new Uint8Array(a.length + b.length);
  junto.set(a);
  junto.set(b, a.length);
  return sha256(junto);
}

/** Base64 padrão (o que o banco usa em interno.caixa_b64). */
function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * O texto da linha do registro de transparência de uma chave de passes: "p3:<semana>:<contexto em base64>:<SPKI em base64>" (o mesmo
 * de interno.passes_identidade). Contexto vazio = "" (a chave geral da semana); com contexto, a semana é 0.
 */
export const identidadeNoRegistro = (semana: number, contexto: Uint8Array, publica: Uint8Array): string =>
  `p3:${semana}:${contexto.length ? b64(contexto) : ""}:${b64(publica)}`;

/** O nome da chave na vista do registro: "s<semana>" (geral) ou "c<contexto em base64>" (urna). */
export const nomeNaVista = (semana: number, contexto: Uint8Array): string => (contexto.length ? `c${b64(contexto)}` : `s${semana}`);

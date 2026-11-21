// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do servidor do site dos passes anônimos (Privacy Pass, RFC 9578, tipo 0x0002 Blind RSA 2048, @cloudflare/privacypass-ts):
// a chave da semana, a emissão do lote do dia para quem tem conta aprovada, o passe da urna (um por votação e por conta) e a
// conferência do passe gasto nas rotas anônimas que ainda moram no site.
//
// Onda R3 (item 3.1). A chave do emissor é RSA e é da SEMANA (semanas desde 1970, lib/rede/passes/comum.ts): nasce aqui, na primeira
// emissão da semana (WebCrypto, RSA-PSS 2048, SHA-384), e vai ao banco (public.rede_passes_chave_guardar) com a parte PRIVADA SELADA
// (XChaCha20-Poly1305 da @noble/ciphers, chave tirada de ALUMIA_PASSES_SEGREDO por HKDF): quem copia o banco não emite passe. A
// pública entra no registro de transparência (linha 'passes-rsa', uma por semana): o aparelho só pede passes com a chave anotada lá, e
// o servidor não consegue dar uma chave a cada pessoa sem que o registro mostre. Se dois processos do site criam a chave ao mesmo
// tempo, o banco guarda a primeira e devolve a mesma aos dois.
//
// Conferir um passe pede só a chave PÚBLICA (a da semana ou a da anterior): é o que o servidor do chat separado faz sem segredo
// nenhum da rede social (nativo/servidor-chat).
//
// O passe da urna (frente resto-r2) tem contexto: uma chave por votação ("semana" 0), porque na emissão cega o servidor não vê o
// desafio. Com a chave da semana, quem tem 30 passes gerais faria 30 passes "da urna".
//
// A assinatura cega é a operação RSA crua do RFC 9474 (RSASP1 seguida da conferência RSAVP1), feita pelo OpenSSL do Node
// (crypto.privateDecrypt sem enchimento: tempo constante e cegamento interno do OpenSSL), e NÃO pela aritmética de inteiros em
// JavaScript da @cloudflare/blindrsa-ts, que não é de tempo constante e exigiria a chave privada exportável. O formato (pedido,
// resposta, passe) continua todo da biblioteca. Só no servidor (runtime nodejs).
//
// O que fica: a marca "já pegou hoje" (HMAC da conta com uma chave tirada de ALUMIA_PASSES_SEGREDO e do dia) vai ao banco e some
// amanhã; a marca "já pegou o passe desta votação" é HMAC da conta e do contexto com o mesmo segredo. O banco SOZINHO não liga a marca
// à conta; quem opera a rede tem o segredo e o banco, recalcula a marca de cada conta e sabe quem pegou passes (usou o chat) em cada
// dia (dito na lista pública do que o servidor guarda, interno.passes_emitidos). Nas votações a marca nem esconde isso: quem pegou a
// cédula fica com a conta às claras (interno.voto_cedula_tomada), de propósito, para contar quem votou (auditoria interna da R3).
import { constants, createPrivateKey, createPublicKey, privateDecrypt, publicEncrypt, type KeyObject } from "node:crypto";
import { Token, genericBatched, publicVerif } from "@cloudflare/privacypass-ts";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesDe, deB64u, diaUtc, iguais, juntar, resumo, ROTULOS, sortear } from "../caixas/base";
import { MODO, PASSES_POR_DIA, ROTULOS_DOS_PASSES, TAMANHO_DO_PASSE, TIPO, identidadeNoRegistro, resumoDoDesafio, semanaDe } from "./comum";

/** O segredo dos passes (32 letras ou mais), ou nulo: sem ele, as rotas que emitem respondem "sem_servico". */
export function segredoDosPasses(): string | null {
  const s = (process.env.ALUMIA_PASSES_SEGREDO ?? "").trim();
  return s.length >= 32 ? s : null;
}

/**
 * O segredo dos passes de ANTES da última troca (item 2.6, rotação): durante a troca, a chave da semana selada com ele ainda abre (sem
 * isso, trocar o segredo pararia a emissão até a semana seguinte). Só abre: chave nova é sempre selada com o segredo atual. Tira-se da
 * configuração quando a semana da troca passa.
 */
export function segredoAnteriorDosPasses(): string | null {
  const s = (process.env.ALUMIA_PASSES_SEGREDO_ANTERIOR ?? "").trim();
  return s.length >= 32 ? s : null;
}

// ── O banco das chaves ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Uma chave como o banco guarda: a pública (SPKI RSASSA-PSS), a privada selada (nula depois da limpeza) e a linha do registro. */
export interface ChaveGuardada {
  publica: Uint8Array;
  privadaSelada: Uint8Array | null;
  seq: number | null;
}

/** Quem guarda as chaves (o banco, pela chave de serviço; nos testes, um falso). */
export interface BancoDasChaves {
  ler(semana: number, contexto: Uint8Array): Promise<ChaveGuardada | null>;
  /** Guarda se ainda não há; devolve a que ficou (a de quem chegou antes, se outro processo ganhou). */
  guardar(semana: number, contexto: Uint8Array, publica: Uint8Array, privadaSelada: Uint8Array): Promise<ChaveGuardada>;
}

const paraHexDoBanco = (b: Uint8Array) => `\\x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;

function chaveDoBanco(v: unknown): ChaveGuardada | null {
  const x = v as { publica?: unknown; privada_selada?: unknown; seq?: unknown } | null;
  if (!x || typeof x !== "object") return null;
  const publica = deB64u(x.publica);
  const privadaSelada = x.privada_selada == null ? null : deB64u(x.privada_selada);
  if (!publica || (x.privada_selada != null && !privadaSelada)) return null;
  return { publica, privadaSelada, seq: Number.isInteger(x.seq) ? (x.seq as number) : null };
}

/** O banco de verdade (só no servidor do site). */
export async function bancoDoSite(): Promise<BancoDasChaves> {
  const { rpcDeServico } = await import("../convites/servidor");
  return {
    async ler(semana, contexto) {
      const r = await rpcDeServico<unknown>("rede_passes_chave_ler", { p_semana: semana, p_contexto: paraHexDoBanco(contexto) });
      if (!r.ok) throw new Error(r.codigo === "sem_servico" ? "sem_servico" : "rede");
      return r.dado == null ? null : chaveDoBanco(r.dado);
    },
    async guardar(semana, contexto, publica, privadaSelada) {
      const r = await rpcDeServico<unknown>("rede_passes_chave_guardar", {
        p_semana: semana, p_contexto: paraHexDoBanco(contexto), p_publica: paraHexDoBanco(publica), p_privada_selada: paraHexDoBanco(privadaSelada),
      });
      const c = r.ok ? chaveDoBanco(r.dado) : null;
      if (!c) throw new Error(r.ok ? "rede" : r.codigo === "sem_servico" ? "sem_servico" : "rede");
      return c;
    },
  };
}

// ── O selo da chave privada ───────────────────────────────────────────────────────────────────────────────────────────────

const VERSAO_DO_SELO = 1;

const chaveDoSelo = (segredo: string) => hkdf(sha256, bytesDe(segredo), undefined, bytesDe(ROTULOS_DOS_PASSES.selo), 32);

/** O que o selo prende (a chave selada de uma semana não abre como a de outra, nem como a de um contexto). */
const aadDoSelo = (semana: number, contexto: Uint8Array, publica: Uint8Array) => bytesDe(identidadeNoRegistro(semana, contexto, publica));

/** Sela a chave privada (PKCS#8): versão(1) ‖ nonce(24) ‖ XChaCha20-Poly1305. */
export function selarPrivada(segredo: string, semana: number, contexto: Uint8Array, publica: Uint8Array, pkcs8: Uint8Array): Uint8Array {
  const nonce = sortear(24);
  return juntar(Uint8Array.of(VERSAO_DO_SELO), nonce, xchacha20poly1305(chaveDoSelo(segredo), nonce, aadDoSelo(semana, contexto, publica)).encrypt(pkcs8));
}

/** Abre o selo; nulo se não abre (outro segredo, outra semana, adulterado). */
export function abrirPrivada(segredo: string, semana: number, contexto: Uint8Array, publica: Uint8Array, selada: Uint8Array): Uint8Array | null {
  if (selada.length < 1 + 24 + 16 || selada[0] !== VERSAO_DO_SELO) return null;
  try {
    return xchacha20poly1305(chaveDoSelo(segredo), selada.subarray(1, 25), aadDoSelo(semana, contexto, publica)).decrypt(selada.subarray(25));
  } catch {
    return null;
  }
}

// ── As chaves ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Uma chave do emissor pronta para uso. */
export interface ChaveDoEmissor {
  semana: number;
  contexto: Uint8Array;
  /** SPKI RSASSA-PSS (o formato do RFC 9578). */
  publica: Uint8Array;
  /** SHA-256 da pública: o "token_key_id". */
  id: Uint8Array;
  seq: number | null;
  /** A privada no OpenSSL do Node (nula em quem só confere). */
  privada: KeyObject | null;
  publicaCk: CryptoKey;
}

const PARAMETROS_RSA = TIPO.rsaParams;

/** Importa a pública do formato do RFC 9578 (a biblioteca troca o OID do RSASSA-PSS pelo de RSA, que o WebCrypto aceita). */
async function importarPublica(publica: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", publicVerif.convertRSASSAPSSToEnc(publica) as BufferSource, PARAMETROS_RSA, true, ["verify"]);
}

const guardadas = new Map<string, Promise<ChaveDoEmissor | null>>();
const nomeDaGuardada = (semana: number, contexto: Uint8Array, segredo: string | null) =>
  `${semana}|${Array.from(contexto).join(",")}|${segredo ? Array.from(sha256(bytesDe(segredo)).subarray(0, 8)).join(",") : "-"}`;

/** Esquece as chaves na memória (testes). */
export function _esquecerChaves(): void {
  guardadas.clear();
}

async function montar(semana: number, contexto: Uint8Array, g: ChaveGuardada, segredo: string | null): Promise<ChaveDoEmissor> {
  if (g.publica.length < 290 || g.publica.length > 600) throw new Error("chave_invalida");
  const publicaCk = await importarPublica(g.publica);
  let privada: KeyObject | null = null;
  if (segredo && g.privadaSelada) {
    const anterior = segredoAnteriorDosPasses();
    const pkcs8 = abrirPrivada(segredo, semana, contexto, g.publica, g.privadaSelada)
      ?? (anterior && anterior !== segredo ? abrirPrivada(anterior, semana, contexto, g.publica, g.privadaSelada) : null);
    // O selo não abre: o segredo dos passes mudou e a chave guardada é de antes. Não emite com ela (nem cria outra para a semana).
    if (!pkcs8) throw new Error("selo_nao_abre");
    privada = createPrivateKey({ key: Buffer.from(pkcs8), format: "der", type: "pkcs8" });
    pkcs8.fill(0);
    // A privada tem de ser a da pública guardada (um banco adulterado não troca uma pela outra).
    const daPrivada = createPublicKey(privada).export({ format: "jwk" }).n;
    const daPublica = (await crypto.subtle.exportKey("jwk", publicaCk)).n;
    if (!daPrivada || daPrivada !== daPublica) throw new Error("selo_nao_abre");
  }
  return { semana, contexto, publica: g.publica, id: sha256(g.publica), seq: g.seq, privada, publicaCk };
}

/**
 * A chave de uma semana (contexto vazio) ou de um contexto (semana 0). `criar`: se o banco ainda não tem, sorteia uma (RSA 2048) e
 * guarda; quem chega depois recebe a que ficou. Sem `criar` (quem só confere), devolve nula se não há. Com `segredo` nulo, a chave
 * vem sem a parte privada (só confere).
 */
export function chaveDoEmissor(
  semana: number, contexto: Uint8Array, banco: BancoDasChaves, segredo: string | null, criar: boolean,
): Promise<ChaveDoEmissor | null> {
  if (!Number.isInteger(semana) || semana < 0 || (contexto.length !== 0 && contexto.length !== 32) || (contexto.length === 32) !== (semana === 0)) {
    return Promise.reject(new Error("invalido:chave"));
  }
  const nome = nomeDaGuardada(semana, contexto, segredo);
  const ja = guardadas.get(nome);
  if (ja) return ja;
  const p = (async () => {
    const lida = await banco.ler(semana, contexto);
    if (lida) return montar(semana, contexto, lida, segredo);
    if (!criar || !segredo) return null;
    const par = (await publicVerif.Issuer.generateKey(MODO, { modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1) })) as CryptoKeyPair;
    const publica = await publicVerif.getPublicKeyBytes(par.publicKey);
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", par.privateKey));
    const ficou = await banco.guardar(semana, contexto, publica, selarPrivada(segredo, semana, contexto, publica, pkcs8));
    pkcs8.fill(0);
    return montar(semana, contexto, ficou, segredo);
  })();
  guardadas.set(nome, p);
  // Erro não fica na memória (a próxima chamada tenta de novo); a chave sem linha no registro também não (a linha pode chegar).
  p.then((c) => (!c || c.seq === null) && guardadas.get(nome) === p && guardadas.delete(nome), () => guardadas.get(nome) === p && guardadas.delete(nome));
  if (guardadas.size > 64) guardadas.delete(guardadas.keys().next().value as string);
  return p;
}

// ── A emissão ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A marca "esta conta já pegou o lote de hoje": HMAC(segredo do dia, conta). O banco guarda só a marca, e só até amanhã. */
export function marcaDoDia(usuario: string, dia: string = diaUtc(), segredo: string | null = segredoDosPasses()): Uint8Array {
  if (!segredo) throw new Error("sem_servico");
  const chave = hkdf(sha256, bytesDe(segredo), undefined, bytesDe(`${ROTULOS.passesDoDia}|${dia}`), 32);
  return hmac(sha256, chave, bytesDe(usuario));
}

/** A marca "esta conta já pegou o passe deste contexto": HMAC(segredo, conta ‖ contexto). Só a marca vai ao banco. */
export function marcaDoContexto(usuario: string, contexto: Uint8Array, segredo: string | null = segredoDosPasses()): Uint8Array {
  if (!segredo) throw new Error("sem_servico");
  const chave = hkdf(sha256, bytesDe(segredo), undefined, bytesDe(ROTULOS_DOS_PASSES.contextoEmitido), 32);
  return hmac(sha256, chave, juntar(bytesDe(`${usuario}|`), contexto));
}

/** O lote, se for exatamente 30 pedidos Blind RSA para a chave de id `id`, sem nada a mais; nulo se não. */
export function loteConferido(pedido: Uint8Array, id: Uint8Array): genericBatched.BatchedTokenRequest | null {
  if (pedido.length > 12 * 1024) return null;
  let lote: genericBatched.BatchedTokenRequest;
  try {
    lote = genericBatched.BatchedTokenRequest.deserialize(pedido);
  } catch {
    return null;
  }
  if (lote.tokenRequests.length !== PASSES_POR_DIA) return null;
  if (!iguais(lote.serialize(), pedido)) return null;
  for (const p of lote.tokenRequests) {
    if (p.tokenType !== TIPO.value || p.truncatedTokenKeyId !== id[id.length - 1]) return null;
  }
  return lote;
}

/** Um pedido só (o passe da urna), Blind RSA, para a chave de id `id`; nulo se não. */
export function pedidoConferido(pedido: Uint8Array, id: Uint8Array): publicVerif.TokenRequest | null {
  if (pedido.length !== 3 + TIPO.Nk) return null;
  let p: publicVerif.TokenRequest;
  try {
    p = publicVerif.TokenRequest.deserialize(TIPO, pedido);
  } catch {
    return null;
  }
  if (p.tokenType !== TIPO.value || p.truncatedTokenKeyId !== id[id.length - 1] || !iguais(p.serialize(), pedido)) return null;
  return p;
}

/**
 * A assinatura cega do RFC 9474 (BlindSign): s = RSASP1(sk, m), conferida com RSAVP1(pk, s) = m. O OpenSSL recusa m ≥ n. Lança
 * "invalido" em qualquer falha (nada de assinatura parcial sai daqui).
 */
function assinarCego(privada: KeyObject, mensagem: Uint8Array): Uint8Array {
  if (mensagem.length !== TIPO.Nk) throw new Error("invalido");
  let s: Buffer;
  try {
    s = privateDecrypt({ key: privada, padding: constants.RSA_NO_PADDING }, mensagem);
    const volta = publicEncrypt({ key: createPublicKey(privada), padding: constants.RSA_NO_PADDING }, s);
    if (s.length !== TIPO.Nk || !iguais(new Uint8Array(volta), mensagem)) throw new Error("falha");
  } catch {
    throw new Error("invalido");
  }
  return new Uint8Array(s);
}

/** Emite o lote do dia com a chave da semana. Qualquer outro formato: "invalido". */
export async function emitirLote(pedido: Uint8Array, chave: ChaveDoEmissor): Promise<Uint8Array> {
  if (!chave.privada || chave.contexto.length !== 0) throw new Error("sem_servico");
  const lote = loteConferido(pedido, chave.id);
  if (!lote) throw new Error("invalido");
  const privada = chave.privada;
  const respostas = lote.tokenRequests.map((p) => new genericBatched.OptionalTokenResponse(new publicVerif.TokenResponse(assinarCego(privada, p.blindMsg))));
  return new genericBatched.GenericBatchTokenResponse(respostas).serialize();
}

/** Emite UM passe com a chave de um contexto (o passe da urna). */
export async function emitirUm(pedido: Uint8Array, chave: ChaveDoEmissor): Promise<Uint8Array> {
  if (!chave.privada || chave.contexto.length !== 32) throw new Error("sem_servico");
  const p = pedidoConferido(pedido, chave.id);
  if (!p) throw new Error("invalido");
  return new publicVerif.TokenResponse(assinarCego(chave.privada, p.blindedMsg)).serialize();
}

// ── A conferência ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type PasseConferido = { ok: true; resumo: Uint8Array } | { ok: false; motivo: "sem_passe" | "invalido" | "sem_servico" };

/** Lê o passe do cabeçalho `Authorization: PrivateToken token="…"` (RFC 9577); nulo se não é um passe deste tipo e tamanho. */
export function lerPasse(cabecalho: string | null): Token | "sem_passe" | null {
  const m = /^PrivateToken token="?([A-Za-z0-9_-]{400,520}={0,2})"?$/.exec((cabecalho ?? "").trim());
  if (!m) return /^PrivateToken\s/.test((cabecalho ?? "").trim()) ? null : "sem_passe";
  const bytes = deB64u(m[1], TAMANHO_DO_PASSE);
  if (!bytes) return null;
  try {
    const t = Token.deserialize(TIPO, bytes);
    return iguais(t.serialize(), bytes) ? t : null;
  } catch {
    return null;
  }
}

/**
 * Confere o passe do cabeçalho com a chave PÚBLICA. Sem `contexto`: um passe geral, com a chave desta semana ou da anterior. Com
 * `contexto` (32 bytes): o passe da urna daquele contexto, com a chave do contexto. Confere o tipo, o comprimento exato, o resumo do
 * desafio (é o nosso, com este contexto), o id da chave e a assinatura RSA-PSS. Devolve o resumo do passe (a gravar em
 * interno.passes_gastos no MESMO lote da ação: repetido é recusado lá). NÃO grava nada.
 */
export async function conferirPasse(
  cabecalho: string | null,
  opcoes: { contexto?: Uint8Array; agora?: number; banco?: BancoDasChaves } = {},
): Promise<PasseConferido> {
  const contexto = opcoes.contexto ?? new Uint8Array(0);
  if (contexto.length !== 0 && contexto.length !== 32) return { ok: false, motivo: "invalido" };
  const passe = lerPasse(cabecalho);
  if (passe === "sem_passe") return { ok: false, motivo: "sem_passe" };
  if (!passe) return { ok: false, motivo: "invalido" };
  const entrada = passe.authInput;
  if (entrada.tokenType !== TIPO.value || !iguais(entrada.challengeDigest, resumoDoDesafio(contexto))) return { ok: false, motivo: "invalido" };
  let banco: BancoDasChaves;
  try {
    banco = opcoes.banco ?? (await bancoDoSite());
  } catch {
    return { ok: false, motivo: "sem_servico" };
  }
  const semanas = contexto.length ? [0] : [semanaDe(opcoes.agora), semanaDe(opcoes.agora) - 1];
  for (const semana of semanas) {
    let chave: ChaveDoEmissor | null;
    try {
      chave = await chaveDoEmissor(semana, contexto, banco, null, false);
    } catch (e) {
      if ((e as Error).message === "sem_servico") return { ok: false, motivo: "sem_servico" };
      continue;
    }
    if (!chave || !iguais(entrada.tokenKeyId, chave.id)) continue;
    let valido = false;
    try {
      valido = await new publicVerif.Origin(MODO, ["alumia.invalid"]).verify(passe, chave.publicaCk);
    } catch {
      valido = false;
    }
    if (valido !== true) return { ok: false, motivo: "invalido" };
    return { ok: true, resumo: resumo(ROTULOS.passeGasto, entrada.nonce) };
  }
  return { ok: false, motivo: "invalido" };
}

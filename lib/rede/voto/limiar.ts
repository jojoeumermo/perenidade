// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O voto secreto sem confiar no servidor (onda R2, item 1.7): decifração em limiar. Vale para a consulta à base das
// organizações (e as eleições, que são consultas), a votação secreta das comunidades e a votação secreta da equipe.
//
// Nada feito à mão: só peças de bibliotecas consagradas, combinadas como diz docs/rede/VOTO-SECRETO.md:
//   - a chave da votação é um par X-Wing (X25519 + ML-KEM-768) da libsodium, gerado de uma semente de 32 bytes sorteada
//     (crypto_kem_xwing_seed_keypair). A cédula fica pós-quântica;
//   - a semente é dividida em N partes, K delas refazem (Shamir, `shamir-secret-sharing`, auditada pela Cure53 e pela Zellic).
//     Cada parte vai cifrada para a chave de voto de uma guardiã (KEM-DEM: X-Wing + BLAKE2b com chave + XChaCha20-Poly1305,
//     tudo da libsodium). O servidor guarda as partes cifradas e não abre nenhuma;
//   - a chave de voto de cada guardiã é assinada pela identidade da conta dela (Ed25519, `@noble/curves`), e o registro da chave
//     da votação é assinado pela identidade de quem a criou. O aparelho que vota confere as assinaturas antes de cifrar;
//   - abrir: cada guardiã abre a sua parte e a cifra de novo para a abridora (uma das guardiãs); com K partes, a abridora refaz a
//     semente, confere que ela dá a chave pública publicada (se não der, nada abre) e abre as cédulas no aparelho dela.
// O servidor, com o banco e todos os segredos dele, não tem a semente nem parte nenhuma: não abre cédula.
//
// Formatos (bytes; em texto, base64url sem "="):
//   cédula          "v2." + ct_kem(1120) ‖ nonce(24) ‖ XChaCha20-Poly1305(512 + 16)       → 1672 bytes, 2230 letras
//   parte cifrada   ct_kem(1120) ‖ nonce(24) ‖ XChaCha20-Poly1305(33 + 16)                → 1193 bytes
// Cada cifra leva o rótulo da finalidade, o tipo, a votação e (nas partes) o número da guardiã como dado autenticado: uma parte não
// serve noutra votação nem no lugar de outra guardiã, e uma cédula não serve noutra votação.
// Sem os atalhos "@/" de propósito: os testes rodam este arquivo direto no Node.
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { combine, split } from "shamir-secret-sharing";
import { carregarSodio } from "../cifra/sodio";

export type TipoDaVotacao = "consulta" | "decisao" | "equipe";
export const TIPOS_DA_VOTACAO: readonly TipoDaVotacao[] = ["consulta", "decisao", "equipe"];

/** Os rótulos desta frente (um por finalidade; o teste da junção confere que não se repetem com os das outras). */
export const ROTULOS = {
  parte: "alumia/r2/voto/parte/v1",
  repasse: "alumia/r2/voto/repasse/v1",
  cedula: "alumia/r2/voto/cedula/v1",
  guardia: "alumia/r2/voto/guardia/v1",
  chave: "alumia/r2/voto/chave/v1",
  impressao: "alumia/r2/voto/impressao/v1",
} as const;

export const TAMANHOS = {
  publica: 1216,
  privada: 32,
  ctKem: 1120,
  nonce: 24,
  etiqueta: 16,
  conteudo: 512,
  parte: 33,
  identidade: 32,
  assinatura: 64,
  cedula: 1120 + 24 + 512 + 16,
  parteCifrada: 1120 + 24 + 33 + 16,
} as const;

/** N guardiãs (3 a 7), K delas abrem (2 a N). */
export const LIMITES = { nMinimo: 3, nMaximo: 7, kMinimo: 2 } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const utf8 = new TextEncoder();

export function juntar(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

export function paraBase64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function deBase64url(texto: string): Uint8Array | null {
  if (typeof texto !== "string" || !/^[A-Za-z0-9_-]*$/.test(texto)) return null;
  try {
    const b = texto.replace(/-/g, "+").replace(/_/g, "/");
    const s = atob(b + "=".repeat((4 - (b.length % 4)) % 4));
    const saida = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) saida[i] = s.charCodeAt(i);
    return saida;
  } catch {
    return null;
  }
}
/** Base64 comum (o que o banco devolve com encode(..., 'base64')), sem quebras de linha. */
export function paraBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
export function deBase64(texto: unknown): Uint8Array | null {
  if (typeof texto !== "string") return null;
  const limpo = texto.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(limpo)) return null;
  try {
    const s = atob(limpo);
    const saida = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) saida[i] = s.charCodeAt(i);
    return saida;
  } catch {
    return null;
  }
}

/** O contexto de cada cifra: rótulo, tipo, votação e (se houver) o número da guardiã. Sem ambiguidade: os campos não têm "\n". */
function contexto(rotulo: string, tipo: TipoDaVotacao, alvo: string, indice?: number): Uint8Array {
  if (!TIPOS_DA_VOTACAO.includes(tipo) || !UUID.test(alvo)) throw new Error("invalido");
  if (indice !== undefined && (!Number.isInteger(indice) || indice < 1 || indice > LIMITES.nMaximo)) throw new Error("invalido");
  return utf8.encode(`${rotulo}\n${tipo}\n${alvo}${indice === undefined ? "" : `\n${indice}`}`);
}

/** KEM-DEM para uma chave pública X-Wing: ct_kem ‖ nonce ‖ cifra. A chave da cifra sai do segredo do KEM e do contexto. */
async function selarPara(publica: Uint8Array, ctx: Uint8Array, dados: Uint8Array): Promise<Uint8Array> {
  const S = await carregarSodio();
  if (publica.length !== TAMANHOS.publica) throw new Error("chave_invalida");
  const { ciphertext, sharedSecret } = S.crypto_kem_xwing_enc(publica);
  const k = S.crypto_generichash(32, ctx, sharedSecret);
  const nonce = S.randombytes_buf(TAMANHOS.nonce);
  const cifra = S.crypto_aead_xchacha20poly1305_ietf_encrypt(dados, ctx, null, nonce, k);
  S.memzero(k);
  S.memzero(sharedSecret);
  return juntar(ciphertext, nonce, cifra);
}

/** O contrário de selarPara. Chave errada, contexto errado ou bytes mexidos: nulo (nunca lança). */
async function abrirDe(privada: Uint8Array, ctx: Uint8Array, selado: Uint8Array, tamanhoClaro: number): Promise<Uint8Array | null> {
  try {
    const S = await carregarSodio();
    if (privada.length !== TAMANHOS.privada || selado.length !== TAMANHOS.ctKem + TAMANHOS.nonce + tamanhoClaro + TAMANHOS.etiqueta) return null;
    const ss = S.crypto_kem_xwing_dec(selado.subarray(0, TAMANHOS.ctKem), privada);
    const k = S.crypto_generichash(32, ctx, ss);
    S.memzero(ss);
    const nonce = selado.subarray(TAMANHOS.ctKem, TAMANHOS.ctKem + TAMANHOS.nonce);
    try {
      return S.crypto_aead_xchacha20poly1305_ietf_decrypt(null, selado.subarray(TAMANHOS.ctKem + TAMANHOS.nonce), ctx, nonce, k);
    } finally {
      S.memzero(k);
    }
  } catch {
    return null;
  }
}

// ───────────────────────── A chave de voto de cada guardiã ─────────────────────────

/** Um par X-Wing novo, de uma semente sorteada pela libsodium. A privada (32 bytes) fica só no aparelho da guardiã. */
export async function novaChaveDeGuardia(): Promise<{ publica: Uint8Array; privada: Uint8Array }> {
  const S = await carregarSodio();
  const par = S.crypto_kem_xwing_keypair();
  return { publica: par.publicKey, privada: par.privateKey };
}

/** O texto assinado pela identidade da guardiã: rótulo, a conta e a chave de voto. */
export function textoDaGuardia(usuario: string, publica: Uint8Array): Uint8Array {
  if (!UUID.test(usuario) || publica.length !== TAMANHOS.publica) throw new Error("invalido");
  return juntar(utf8.encode(`${ROTULOS.guardia}\n${usuario}\n`), publica);
}

/** Confere a assinatura da chave de voto pela identidade (Ed25519). Qualquer coisa torta: falso. */
export function conferirGuardia(identidade: Uint8Array, usuario: string, publica: Uint8Array, assinatura: Uint8Array): boolean {
  try {
    if (identidade.length !== TAMANHOS.identidade || assinatura.length !== TAMANHOS.assinatura) return false;
    return ed25519.verify(assinatura, textoDaGuardia(usuario, publica), identidade);
  } catch {
    return false;
  }
}

// ───────────────────────── A chave da votação ─────────────────────────

export interface GuardiaDaChave {
  /** 1 a N: a ordem no registro (é o número que entra no contexto da parte dela). */
  indice: number;
  usuario: string;
  /** A chave de voto dela (X-Wing, 1216 bytes). */
  voto: Uint8Array;
  /** A identidade da conta dela (Ed25519, 32 bytes). */
  identidade: Uint8Array;
  /** A assinatura da chave de voto pela identidade dela. */
  assinatura: Uint8Array;
}

export interface ChaveDaVotacao {
  tipo: TipoDaVotacao;
  alvo: string;
  /** A chave pública da votação (X-Wing, 1216 bytes). */
  publica: Uint8Array;
  n: number;
  k: number;
  guardias: GuardiaDaChave[];
  criador: string;
  criadorIdentidade: Uint8Array;
  /** A assinatura de quem criou sobre tudo isto (textoDaChave). */
  assinatura: Uint8Array;
}

/** O texto canônico assinado por quem cria: campos de tamanho fixo, guardiãs em ordem do número. */
export function textoDaChave(c: Omit<ChaveDaVotacao, "assinatura">): Uint8Array {
  if (!TIPOS_DA_VOTACAO.includes(c.tipo) || !UUID.test(c.alvo) || !UUID.test(c.criador)) throw new Error("invalido");
  if (c.publica.length !== TAMANHOS.publica || c.criadorIdentidade.length !== TAMANHOS.identidade) throw new Error("invalido");
  const guardias = [...c.guardias].sort((a, b) => a.indice - b.indice);
  const partes: Uint8Array[] = [utf8.encode(`${ROTULOS.chave}\n${c.tipo}\n${c.alvo}\n${c.n}\n${c.k}\n${c.criador}\n`), c.criadorIdentidade, c.publica];
  for (const g of guardias) {
    if (!UUID.test(g.usuario) || g.voto.length !== TAMANHOS.publica || g.identidade.length !== TAMANHOS.identidade) throw new Error("invalido");
    partes.push(utf8.encode(`\n${g.indice}\n${g.usuario}\n`), g.identidade, g.voto);
  }
  return juntar(...partes);
}

export type ConferenciaDaChave = "ok" | "formato" | "guardia" | "assinatura";

/**
 * Confere o registro da chave da votação, como veio do servidor: formato (N, K, números 1..N, contas sem repetir), a assinatura de
 * cada chave de guardiã e a de quem criou. Quem conferir também a identidade de quem criou e das guardiãs (registro de
 * transparência) faz isso por fora, com `identidadesDaChave`.
 */
export function conferirChave(c: ChaveDaVotacao): ConferenciaDaChave {
  try {
    if (!Number.isInteger(c.n) || !Number.isInteger(c.k) || c.n < LIMITES.nMinimo || c.n > LIMITES.nMaximo || c.k < LIMITES.kMinimo || c.k > c.n) return "formato";
    if (c.guardias.length !== c.n || c.assinatura.length !== TAMANHOS.assinatura) return "formato";
    const indices = new Set(c.guardias.map((g) => g.indice));
    const contas = new Set(c.guardias.map((g) => g.usuario));
    if (indices.size !== c.n || contas.size !== c.n || [...indices].some((i) => i < 1 || i > c.n)) return "formato";
    for (const g of c.guardias) if (!conferirGuardia(g.identidade, g.usuario, g.voto, g.assinatura)) return "guardia";
    return ed25519.verify(c.assinatura, textoDaChave(c), c.criadorIdentidade) ? "ok" : "assinatura";
  } catch {
    return "formato";
  }
}

/** As identidades que a tela confere no registro de transparência: quem criou e cada guardiã. */
export function identidadesDaChave(c: ChaveDaVotacao): { usuario: string; identidade: Uint8Array }[] {
  return [{ usuario: c.criador, identidade: c.criadorIdentidade }, ...c.guardias.map((g) => ({ usuario: g.usuario, identidade: g.identidade }))];
}

/**
 * A impressão da chave da votação: 12 algarismos em 3 grupos, de SHA-256 do registro assinado. A mesma para todo mundo que recebeu
 * o mesmo registro: guardiãs e quem vota podem comparar por fora (o servidor não consegue mostrar um registro a uns e outro a outros
 * sem a impressão mudar).
 */
export function impressaoDaChave(c: ChaveDaVotacao): string {
  const h = sha256(juntar(utf8.encode(`${ROTULOS.impressao}\n`), textoDaChave(c), c.assinatura));
  let n = BigInt(0);
  for (let i = 0; i < 8; i++) n = (n << BigInt(8)) | BigInt(h[i]);
  const d = (n % BigInt(1_000_000_000_000)).toString().padStart(12, "0");
  return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8, 12)}`;
}

export interface CandidataAGuardia {
  usuario: string;
  voto: Uint8Array;
  identidade: Uint8Array;
  assinatura: Uint8Array;
}

/**
 * Cria a chave de uma votação, no aparelho de quem cria: sorteia a semente, faz o par X-Wing, divide a semente em N partes (K
 * refazem), cifra cada parte para a chave de voto de uma guardiã, assina o registro e apaga da memória a semente, a privada e as
 * partes. Recusa guardiã cuja chave não confere com a identidade dela ("guardia_sem_assinatura").
 */
export async function criarChaveDaVotacao(p: {
  tipo: TipoDaVotacao;
  alvo: string;
  k: number;
  guardias: CandidataAGuardia[];
  criador: string;
  criadorIdentidade: Uint8Array;
  assinar: (texto: Uint8Array) => Promise<Uint8Array> | Uint8Array;
}): Promise<{ chave: ChaveDaVotacao; partes: { indice: number; cifrada: Uint8Array }[] }> {
  const n = p.guardias.length;
  if (n < LIMITES.nMinimo || n > LIMITES.nMaximo || !Number.isInteger(p.k) || p.k < LIMITES.kMinimo || p.k > n) throw new Error("invalido:guardias");
  if (new Set(p.guardias.map((g) => g.usuario)).size !== n) throw new Error("invalido:guardias");
  for (const g of p.guardias) if (!conferirGuardia(g.identidade, g.usuario, g.voto, g.assinatura)) throw new Error("guardia_sem_assinatura");

  const S = await carregarSodio();
  const semente = S.randombytes_buf(32);
  const par = S.crypto_kem_xwing_seed_keypair(semente);
  let fatias: Uint8Array[] = [];
  try {
    fatias = await split(semente, n, p.k);
    const guardias: GuardiaDaChave[] = p.guardias.map((g, i) => ({ indice: i + 1, usuario: g.usuario, voto: g.voto, identidade: g.identidade, assinatura: g.assinatura }));
    const partes: { indice: number; cifrada: Uint8Array }[] = [];
    for (const g of guardias) {
      partes.push({ indice: g.indice, cifrada: await selarPara(g.voto, contexto(ROTULOS.parte, p.tipo, p.alvo, g.indice), fatias[g.indice - 1]) });
    }
    const semAssinatura = { tipo: p.tipo, alvo: p.alvo, publica: par.publicKey, n, k: p.k, guardias, criador: p.criador, criadorIdentidade: p.criadorIdentidade };
    const assinatura = await p.assinar(textoDaChave(semAssinatura));
    const chave: ChaveDaVotacao = { ...semAssinatura, assinatura };
    if (conferirChave(chave) !== "ok") throw new Error("assinatura_invalida");
    return { chave, partes };
  } finally {
    S.memzero(semente);
    S.memzero(par.privateKey);
    for (const f of fatias) S.memzero(f);
  }
}

// ───────────────────────── Votar ─────────────────────────

/** Cifra a escolha (qualquer JSON de até 511 bytes) para a chave da votação. Devolve "v2.<base64url>". */
export async function cifrarCedula(c: Pick<ChaveDaVotacao, "tipo" | "alvo" | "publica">, escolha: unknown): Promise<string> {
  const S = await carregarSodio();
  const claro = utf8.encode(JSON.stringify(escolha));
  if (claro.length >= TAMANHOS.conteudo) throw new Error("invalido:escolha");
  const completo = S.pad(claro, TAMANHOS.conteudo);
  if (completo.length !== TAMANHOS.conteudo) throw new Error("invalido:escolha");
  const selado = await selarPara(c.publica, contexto(ROTULOS.cedula, c.tipo, c.alvo), completo);
  return `v2.${paraBase64url(selado)}`;
}

/** Os bytes de uma cédula "v2.", ou nulo se o formato não for exatamente o esperado. */
export function bytesDaCedula(cedula: unknown): Uint8Array | null {
  if (typeof cedula !== "string" || !cedula.startsWith("v2.")) return null;
  const b = deBase64url(cedula.slice(3));
  return b && b.length === TAMANHOS.cedula ? b : null;
}

/** O tamanho exato da cédula em texto (o banco confere com a mesma conta). */
export const LETRAS_DA_CEDULA = 3 + Math.ceil((TAMANHOS.cedula * 4) / 3);

/** Abre uma cédula com a privada da votação (só no aparelho da abridora). Devolve a escolha ou nulo. */
export async function abrirCedula(privada: Uint8Array, c: Pick<ChaveDaVotacao, "tipo" | "alvo">, cedula: unknown): Promise<unknown | null> {
  const b = bytesDaCedula(cedula);
  if (!b) return null;
  const completo = await abrirDe(privada, contexto(ROTULOS.cedula, c.tipo, c.alvo), b, TAMANHOS.conteudo);
  if (!completo) return null;
  try {
    const S = await carregarSodio();
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(S.unpad(completo, TAMANHOS.conteudo))) as unknown;
  } catch {
    return null;
  }
}

// ───────────────────────── Abrir a urna ─────────────────────────

/** A guardiã abre a parte dela (a privada da chave de voto dela). Nulo se não for dela, de outra votação ou mexida. */
export async function abrirParte(privada: Uint8Array, c: Pick<ChaveDaVotacao, "tipo" | "alvo">, indice: number, cifrada: Uint8Array): Promise<Uint8Array | null> {
  const parte = await abrirDe(privada, contexto(ROTULOS.parte, c.tipo, c.alvo, indice), cifrada, TAMANHOS.parte);
  return parte && parte.length === TAMANHOS.parte ? parte : null;
}

/** A guardiã cifra a parte dela para a abridora (outro rótulo: uma parte repassada não passa por parte original). */
export async function repassarParte(abridora: Uint8Array, c: Pick<ChaveDaVotacao, "tipo" | "alvo">, indice: number, parte: Uint8Array): Promise<Uint8Array> {
  if (parte.length !== TAMANHOS.parte) throw new Error("invalido");
  return selarPara(abridora, contexto(ROTULOS.repasse, c.tipo, c.alvo, indice), parte);
}

/** A abridora abre uma parte repassada. Nulo se não abrir. */
export async function abrirRepasse(privada: Uint8Array, c: Pick<ChaveDaVotacao, "tipo" | "alvo">, indice: number, cifrada: Uint8Array): Promise<Uint8Array | null> {
  const parte = await abrirDe(privada, contexto(ROTULOS.repasse, c.tipo, c.alvo, indice), cifrada, TAMANHOS.parte);
  return parte && parte.length === TAMANHOS.parte ? parte : null;
}

/** As combinações de `k` itens de `lista`, em ordem (C(7,3) = 35 no máximo). */
function combinacoes<T>(lista: T[], k: number): T[][] {
  const saida: T[][] = [];
  const atual: T[] = [];
  const andar = (i: number) => {
    if (atual.length === k) {
      saida.push([...atual]);
      return;
    }
    for (let j = i; j < lista.length; j++) {
      atual.push(lista[j]);
      andar(j + 1);
      atual.pop();
    }
  };
  andar(0);
  return saida;
}

/**
 * Refaz a privada da votação com as partes (no aparelho da abridora). Tenta cada grupo de K partes até achar um que dê a chave
 * pública publicada: uma parte torta (de guardiã que errou ou mentiu) não impede abrir com as outras. Nenhum grupo confere: nulo
 * (alarme na tela; nada abre). Quem recebe a privada a zera depois de abrir as cédulas.
 */
export async function refazerChave(c: Pick<ChaveDaVotacao, "publica" | "k">, partes: { indice: number; parte: Uint8Array }[]): Promise<{ privada: Uint8Array; usadas: number[] } | null> {
  const S = await carregarSodio();
  const validas = partes.filter((p) => p.parte.length === TAMANHOS.parte);
  if (validas.length < c.k || c.k < LIMITES.kMinimo) return null;
  for (const grupo of combinacoes(validas, c.k)) {
    let semente: Uint8Array | null = null;
    try {
      semente = await combine(grupo.map((g) => g.parte));
      if (semente.length !== 32) continue;
      const par = S.crypto_kem_xwing_seed_keypair(semente);
      if (par.publicKey.length === c.publica.length && S.memcmp(par.publicKey, c.publica)) {
        return { privada: par.privateKey, usadas: grupo.map((g) => g.indice).sort((a, b) => a - b) };
      }
      S.memzero(par.privateKey);
    } catch {
      // grupo que não combina: tenta o próximo
    } finally {
      if (semente) S.memzero(semente);
    }
  }
  return null;
}

/** Um número sorteado em [0, n), sem viés (rejeição), com o sorteio forte do aparelho. */
export function sortear(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new Error("invalido");
  const limite = Math.floor(2 ** 32 / n) * n;
  const caixa = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(caixa);
    if (caixa[0] < limite) return caixa[0] % n;
  }
}

/** Embaralha (Fisher–Yates com o sorteio forte): a ordem das cédulas abertas não diz a ordem em que estavam. */
export function embaralhar<T>(lista: T[]): T[] {
  const saida = lista.slice();
  for (let i = saida.length - 1; i > 0; i--) {
    const j = sortear(i + 1);
    [saida[i], saida[j]] = [saida[j], saida[i]];
  }
  return saida;
}

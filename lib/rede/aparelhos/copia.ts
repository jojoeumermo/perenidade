// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A cópia de segurança do chat (onda R2, item 1.5): opcional, cifrada NO APARELHO, e o servidor guarda só o arquivo cifrado
// (public.rede_cofre_gravar, tipo "copia"). Documento: docs/rede/CHAT-PRIVADO.md.
//
// A chave da cópia (32 bytes) vem de um de dois jeitos:
//   - 24 PALAVRAS (padrão): 32 bytes sorteados, mostrados como 24 palavras da lista BIP39 em português (@scure/bip39, auditada).
//     Quem tem as palavras e a conta abre a cópia; quem perdeu as palavras perdeu a cópia;
//   - FRASE da pessoa: Argon2id da libsodium (64 MiB, 3 passadas, 1 linha, sal de 16 bytes sorteado; os valores vão no cabeçalho
//     do arquivo). Mais fraca que as 24 palavras se a frase for curta: a tela diz.
// O arquivo: o formato único de lib/rede/aparelhos/arquivo.ts (cabeçalho em claro com o modo e os parâmetros do Argon2id, e o
// secretstream XChaCha20-Poly1305 da libsodium), completado até 64 KB, 256 KB, 1 MB ou 4 MB: o servidor só sabe a faixa do tamanho.
//
// O que a cópia LEVA: a identidade da conta, a chave de pedidos, a chave de sincronia, a lista de conversas (caixas e passes), os
// códigos comparados e, se a pessoa quiser, o histórico guardado. O que NÃO leva (nunca, conferido por lista fechada): sessão
// Proteus, estado MLS, chave X-Wing da semana, pré-chave, chave do aparelho. Restaurar = aparelho NOVO (chaves novas), os contatos
// refazem as sessões, os grupos se reentram, o histórico volta só para leitura. Assim a cópia não ressuscita chave velha.
import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from "@scure/bip39";
import { wordlist as portugues } from "@scure/bip39/wordlists/portuguese.js";
import { ARGON2ID, carregarSodio } from "../cifra/sodio";
import { copia, deTexto, sortear, texto, type Bytes } from "../chat/r2/bytes";
import { abrirArquivo, type CabecalhoA2id, cifrarArquivo, FAIXAS_DO_ARQUIVO, modoDoArquivo } from "./arquivo";
import { ROTULOS } from "../chat/r2/rotulos";

export const FAIXAS_DA_COPIA = FAIXAS_DO_ARQUIVO;
export type ModoDaCopia = "palavras" | "frase";

/** O que pode ir na cópia. Lista FECHADA: o que não está aqui não entra (nem sai ao restaurar). */
export interface ConteudoDaCopia {
  v: 1;
  conta: string;
  /** A semente Ed25519 da identidade da conta (base64url). */
  identidade: string;
  /** A privada X-Wing da chave de pedidos (base64url). */
  pedidos: string;
  /** A chave de sincronia entre aparelhos (base64url). */
  sincronia: string;
  /** A lista de conversas (caixas e passes de cada uma), como o aparelho guarda. */
  lista: unknown;
  /** Os códigos de segurança já comparados: conta → código. */
  codigos: Record<string, string>;
  /** O histórico guardado, se a pessoa escolheu levar. */
  historico?: unknown;
  /** Dias desde 1970 em que a cópia foi feita. */
  feitaDia: number;
}
const CAMPOS: readonly (keyof ConteudoDaCopia)[] = ["v", "conta", "identidade", "pedidos", "sincronia", "lista", "codigos", "historico", "feitaDia"];

/** Só os campos da lista fechada: uma sessão, um estado MLS ou uma chave de aparelho que alguém ponha no objeto ficam de fora. */
export function soOQueVai(c: ConteudoDaCopia): ConteudoDaCopia {
  const saida: Record<string, unknown> = {};
  for (const k of CAMPOS) if (c[k] !== undefined) saida[k] = c[k];
  return saida as unknown as ConteudoDaCopia;
}

// ── A chave ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Uma chave nova e as 24 palavras dela (mostradas uma vez; o aparelho não guarda as palavras). */
export function novaChaveDaCopia(): { chave: Bytes; palavras: string[] } {
  const chave = sortear(32);
  return { chave, palavras: entropyToMnemonic(chave, portugues).split(" ") };
}

/** A chave das 24 palavras; null se não forem 24 palavras válidas da lista (com a soma de conferência do BIP39). */
export function chaveDasPalavras(palavras: string): Bytes | null {
  const limpa = palavras.normalize("NFKD").toLowerCase().trim().split(/\s+/).join(" ");
  if (limpa.split(" ").length !== 24 || !validateMnemonic(limpa, portugues)) return null;
  return copia(mnemonicToEntropy(limpa, portugues));
}

/** A chave de uma frase, pelo Argon2id (nunca com valores menores que os de ARGON2ID). */
export async function chaveDaFrase(frase: string, cab?: CabecalhoA2id): Promise<{ chave: Bytes; cabecalho: CabecalhoA2id }> {
  const sodio = await carregarSodio();
  const cabecalho = cab ?? { m: ARGON2ID.memoria, t: ARGON2ID.passadas, p: ARGON2ID.linhas, sal: sortear(ARGON2ID.sal) };
  if (cabecalho.m < ARGON2ID.memoria || cabecalho.t < ARGON2ID.passadas || cabecalho.p !== 1 || cabecalho.sal.length !== ARGON2ID.sal) throw new Error("argon2id_fraco");
  const chave = sodio.crypto_pwhash(ARGON2ID.saida, texto(frase.normalize("NFKC")), cabecalho.sal, cabecalho.t, cabecalho.m, sodio.crypto_pwhash_ALG_ARGON2ID13);
  return { chave: copia(chave), cabecalho };
}

// ── O arquivo (formato de lib/rede/aparelhos/arquivo.ts) ─────────────────────────────────────────────────────────────────
/** Lê o modo e os parâmetros do Argon2id do arquivo (para pedir as palavras ou a frase certa). */
export function modoDaCopia(arquivo: Uint8Array): { modo: ModoDaCopia; argon2id: CabecalhoA2id | null } | null {
  const m = modoDoArquivo(arquivo);
  return m && m.modo !== "sincronia" ? { modo: m.modo, argon2id: m.argon2id } : null;
}

/** Cifra a cópia. `argon2id`: o cabeçalho da frase (modo "frase"), ou null (24 palavras). */
export async function cifrarCopia(chave: Uint8Array, conteudo: ConteudoDaCopia, argon2id: CabecalhoA2id | null): Promise<Bytes> {
  const claro = texto(JSON.stringify(soOQueVai(conteudo)));
  try {
    return await cifrarArquivo(chave, ROTULOS.copia, argon2id ? "frase" : "palavras", argon2id, claro);
  } finally {
    claro.fill(0);
  }
}

/** Abre a cópia; null se a chave estiver errada, se algo foi mexido, cortado ou acrescentado. */
export async function abrirCopia(chave: Uint8Array, arquivo: Uint8Array): Promise<ConteudoDaCopia | null> {
  if (!modoDaCopia(arquivo)) return null;
  const claro = await abrirArquivo(chave, ROTULOS.copia, arquivo);
  if (!claro) return null;
  try {
    const c = JSON.parse(deTexto(claro));
    if (c?.v !== 1 || typeof c.conta !== "string" || typeof c.identidade !== "string" || typeof c.pedidos !== "string" || typeof c.sincronia !== "string") return null;
    return soOQueVai(c);
  } catch {
    return null;
  } finally {
    claro.fill(0);
  }
}

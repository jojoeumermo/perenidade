// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chaves privadas dos atores ficam no banco (interno.rede_fed_atores), mas CIFRADAS aqui, no servidor do site, com AES-256-GCM e
// uma chave derivada do segredo da federação (ALUMIA_FEDIVERSO_SEGREDO, só na Vercel). Quem lê o banco sozinho não consegue assinar
// nada em nome de ninguém. Lógica pura, sem "@/".
//
// Onda R3 (2.6), a troca do segredo: o segredo pode vir com versão ("v<N>:<base64url>", da cerimônia: scripts/segredos/cerimonia.mjs).
// O de antes (sem prefixo) é a versão 1 e deriva a chave como sempre (o que já está cifrado abre igual). Cifrado com a versão N > 1, o
// texto leva a versão: "v1k<N>:" + base64(iv | etiqueta | cifrado) ("v1" é o formato; "k<N>", a versão do segredo). Na troca, o
// servidor tenta o atual e o anterior (ALUMIA_FEDIVERSO_SEGREDO_ANTERIOR) e `ressellar` cifra de novo com o atual: passada a troca,
// o anterior sai do ambiente.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { lerSegredo } from "../painel/impressao";

function chaveDe(segredo: string): { versao: number; chave: Buffer } | null {
  const s = lerSegredo(segredo);
  if (!s) return null;
  return { versao: s.versao, chave: Buffer.from(hkdfSync("sha256", s.chave, Buffer.from("alumia-fediverso", "utf8"), Buffer.from("chaves-privadas-v1", "utf8"), 32)) };
}

/** "v1:" (segredo da versão 1) ou "v1k<N>:" (versão N) + base64(iv | etiqueta | texto cifrado). */
export function cifrar(texto: string, segredo: string): string {
  const k = chaveDe(segredo);
  if (!k) throw new Error("segredo_invalido");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k.chave, iv);
  const corpo = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return `${k.versao === 1 ? "v1" : `v1k${k.versao}`}:${Buffer.concat([iv, c.getAuthTag(), corpo]).toString("base64")}`;
}

/** A versão do segredo com que este texto foi cifrado (1 para o formato de antes), ou nulo. */
export function versaoDoCifrado(cifrado: string | null | undefined): number | null {
  const m = /^v1(?:k([1-9][0-9]{0,4}))?:/.exec(cifrado ?? "");
  return m ? (m[1] ? Number(m[1]) : 1) : null;
}

/** Decifra; nulo se o texto não é desta forma ou o segredo é outro (ou de outra versão). */
export function decifrar(cifrado: string | null | undefined, segredo: string): string | null {
  const versao = versaoDoCifrado(cifrado);
  const k = chaveDe(segredo);
  if (!cifrado || versao === null || !k || k.versao !== versao) return null;
  try {
    const tudo = Buffer.from(cifrado.slice(cifrado.indexOf(":") + 1), "base64");
    if (tudo.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", k.chave, tudo.subarray(0, 12));
    d.setAuthTag(tudo.subarray(12, 28));
    return Buffer.concat([d.update(tudo.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Decifra com o segredo atual ou, na troca, com o anterior. */
export function decifrarNaTroca(cifrado: string | null | undefined, atual: string, anterior?: string | null): string | null {
  return decifrar(cifrado, atual) ?? (anterior ? decifrar(cifrado, anterior) : null);
}

/**
 * Na troca: o texto cifrado com o anterior volta cifrado com o atual (o mesmo conteúdo); já no atual, volta igual. Nulo se não abre
 * com nenhum dos dois (aí não há o que fazer: a chave do ator se perdeu e ele é recriado).
 */
export function ressellar(cifrado: string | null | undefined, atual: string, anterior?: string | null): string | null {
  const k = chaveDe(atual);
  if (!cifrado || !k) return null;
  if (versaoDoCifrado(cifrado) === k.versao && decifrar(cifrado, atual) !== null) return cifrado;
  const aberto = anterior ? decifrar(cifrado, anterior) : null;
  return aberto === null ? null : cifrar(aberto, atual);
}

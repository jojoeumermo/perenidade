// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chaves privadas dos atores ficam no banco (interno.rede_fed_atores), mas CIFRADAS aqui, no servidor do site, com AES-256-GCM e
// uma chave derivada do segredo da federação (ALUMIA_FEDIVERSO_SEGREDO, só na Vercel). Quem lê o banco sozinho não consegue assinar
// nada em nome de ninguém. Lógica pura, sem "@/".
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function chaveDe(segredo: string): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(segredo, "utf8"), Buffer.from("alumia-fediverso", "utf8"), Buffer.from("chaves-privadas-v1", "utf8"), 32));
}

/** "v1:" + base64(iv | etiqueta | texto cifrado). */
export function cifrar(texto: string, segredo: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chaveDe(segredo), iv);
  const corpo = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return `v1:${Buffer.concat([iv, c.getAuthTag(), corpo]).toString("base64")}`;
}

/** Decifra; nulo se o texto não é desta forma ou o segredo é outro. */
export function decifrar(cifrado: string | null | undefined, segredo: string): string | null {
  if (!cifrado || !cifrado.startsWith("v1:")) return null;
  try {
    const tudo = Buffer.from(cifrado.slice(3), "base64");
    if (tudo.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", chaveDe(segredo), tudo.subarray(0, 12));
    d.setAuthTag(tudo.subarray(12, 28));
    return Buffer.concat([d.update(tudo.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

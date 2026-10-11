// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// Cifra da conversa da equipe. A chave nasce de uma frase combinada fora do site e nunca sai do aparelho:
// o que vai para o banco é só "c1.<vetor>.<texto cifrado>" (AES-GCM de 256 bits; a chave é derivada da
// frase com PBKDF2-SHA-256). Quem ler o banco não lê as conversas.

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const STORED = "lucia.equipe.chave";
/** Texto conhecido que, cifrado com a chave certa, deixa o navegador reconhecer uma frase errada. */
export const PROOF = "instituto-lucia";

const toBase64 = (bytes: Uint8Array) => {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromBase64 = (text: string) => {
  const raw = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

export async function deriveKey(phrase: string, salt: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(phrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: encoder.encode(`lucia:${salt}`), iterations: 310000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function seal(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  return `c1.${toBase64(iv)}.${toBase64(new Uint8Array(sealed))}`;
}

/** Devolve o texto aberto, ou null quando a chave não é a certa (ou o texto foi adulterado). */
export async function unseal(key: CryptoKey, sealed: string): Promise<string | null> {
  const [version, iv, body] = sealed.split(".");
  if (version !== "c1" || !iv || !body) return null;
  try {
    return decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(body)));
  } catch {
    return null;
  }
}

/** A chave fica só na memória desta aba: fechou a aba, precisa digitar a frase de novo. */
export async function rememberKey(key: CryptoKey | null) {
  try {
    if (key) sessionStorage.setItem(STORED, toBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key))));
    else sessionStorage.removeItem(STORED);
  } catch {
    // sem armazenamento de sessão, a frase será pedida a cada visita
  }
}

export async function recallKey(): Promise<CryptoKey | null> {
  try {
    const raw = sessionStorage.getItem(STORED);
    return raw ? await crypto.subtle.importKey("raw", fromBase64(raw), "AES-GCM", true, ["encrypt", "decrypt"]) : null;
  } catch {
    return null;
  }
}

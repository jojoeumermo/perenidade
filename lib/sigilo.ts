// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// Cifra de ponta a ponta das conversas da equipe, sem frase combinada.
//
// Cada aparelho tem um par de chaves ECDH (curva P-256). A parte privada é criada no navegador como não exportável:
// nem o próprio site consegue lê-la, só usá-la. Cada conversa tem uma chave AES-GCM de 256 bits, trocada sempre que
// alguém sai; quem cria uma versão da chave a embrulha para cada aparelho de quem participa (ECDH entre os dois
// aparelhos, HKDF-SHA-256, AES-GCM). O banco guarda só a parte pública dos aparelhos, os embrulhos e o texto cifrado.
//
// Formatos (base64url, sem preenchimento):
//   mensagem  "c2.<versão>.<vetor de 12 bytes>.<texto cifrado>"
//   embrulho  "w1.<vetor de 12 bytes>.<chave de 32 bytes cifrada>"
// Cada texto cifrado vai amarrado ao lugar de onde veio (conversa, versão e autor, ou canal do mural): o banco não
// consegue trocar uma mensagem de conversa ou de autor sem que ela pare de abrir.
//
// Este arquivo não depende do navegador além do WebCrypto, para poder ser testado no Node (scripts/testar-sigilo.mjs).

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SAL = encoder.encode("instituto-lucia:conversas:v2");

export const paraBase64 = (bytes: Uint8Array) => {
  let texto = "";
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return btoa(texto).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const deBase64 = (texto: string) => {
  const cru = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(cru.length));
  for (let i = 0; i < cru.length; i++) bytes[i] = cru.charCodeAt(i);
  return bytes;
};

const B64 = "[A-Za-z0-9_-]";
export const FORMATO_PUBLICA = new RegExp(`^B${B64}{86}$`);
const FORMATO_EMBRULHO = new RegExp(`^w1\\.(${B64}{16})\\.(${B64}{64})$`);
const FORMATO_MENSAGEM = new RegExp(`^c2\\.([1-9][0-9]{0,6})\\.(${B64}{16})\\.(${B64}{23,})$`);

const vetor = () => crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));

export interface ParDoAparelho {
  privada: CryptoKey;
  /** Parte pública, em base64url (65 bytes, ponto sem compressão). */
  publica: string;
}

/** Par de chaves de um aparelho novo. A parte privada não sai do navegador. */
export async function novoAparelho(): Promise<ParDoAparelho> {
  const par = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const publica = paraBase64(new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey)));
  return { privada: par.privateKey, publica };
}

/** Lê a parte pública de outro aparelho. O WebCrypto confere se o ponto está mesmo na curva. */
export async function lerPublica(publica: string): Promise<CryptoKey> {
  if (!FORMATO_PUBLICA.test(publica)) throw new Error("publica_invalida");
  return crypto.subtle.importKey("raw", deBase64(publica), { name: "ECDH", namedCurve: "P-256" }, false, []);
}

/** A chave que só estes dois aparelhos calculam, para embrulhar uma versão específica de uma conversa específica. */
async function chaveEntre(minha: CryptoKey, outra: CryptoKey, contexto: string): Promise<CryptoKey> {
  const segredo = await crypto.subtle.deriveBits({ name: "ECDH", public: outra }, minha, 256);
  const base = await crypto.subtle.importKey("raw", segredo, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: SAL, info: encoder.encode(contexto) }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** O que amarra um embrulho: conversa, versão e aparelho de destino. */
export const contextoDoEmbrulho = (conversa: string, versao: number, para: string) => `embrulho:${conversa}:${versao}:${para}`;

/** Chave nova de conversa (fica só na memória; é exportável para poder ser embrulhada para os colegas). */
export function novaChave(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function embrulhar(chave: CryptoKey, minhaPrivada: CryptoKey, publicaDoOutro: string, contexto: string): Promise<string> {
  const entre = await chaveEntre(minhaPrivada, await lerPublica(publicaDoOutro), contexto);
  const iv = vetor();
  const crua = new Uint8Array(await crypto.subtle.exportKey("raw", chave));
  const fechada = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(contexto) }, entre, crua));
  crua.fill(0);
  return `w1.${paraBase64(iv)}.${paraBase64(fechada)}`;
}

/** Devolve a chave da conversa, ou null se o embrulho não foi feito para este aparelho (ou foi adulterado). */
export async function desembrulhar(embrulho: string, minhaPrivada: CryptoKey, publicaDeQuemEmbrulhou: string, contexto: string): Promise<CryptoKey | null> {
  const partes = FORMATO_EMBRULHO.exec(embrulho);
  if (!partes) return null;
  try {
    const entre = await chaveEntre(minhaPrivada, await lerPublica(publicaDeQuemEmbrulhou), contexto);
    const crua = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(partes[1]), additionalData: encoder.encode(contexto) }, entre, deBase64(partes[2])));
    if (crua.length !== 32) return null;
    const chave = await crypto.subtle.importKey("raw", crua, "AES-GCM", true, ["encrypt", "decrypt"]);
    crua.fill(0);
    return chave;
  } catch {
    return null;
  }
}

/** Versão da chave com que uma mensagem foi cifrada; null para o que não está no formato atual. */
export function versaoDe(corpo: string): number | null {
  const partes = FORMATO_MENSAGEM.exec(corpo);
  return partes ? Number(partes[1]) : null;
}

const amarra = (contexto: string, versao: number) => encoder.encode(`${contexto}:v${versao}`);

export async function cifrar(chave: CryptoKey, versao: number, texto: string, contexto: string): Promise<string> {
  const iv = vetor();
  const fechado = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: amarra(contexto, versao) }, chave, encoder.encode(texto));
  return `c2.${versao}.${paraBase64(iv)}.${paraBase64(new Uint8Array(fechado))}`;
}

/** Devolve o texto aberto, ou null se a chave não é a certa ou se a mensagem foi adulterada ou mudada de lugar. */
export async function decifrar(chave: CryptoKey, corpo: string, contexto: string): Promise<string | null> {
  const partes = FORMATO_MENSAGEM.exec(corpo);
  if (!partes) return null;
  try {
    return decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(partes[2]), additionalData: amarra(contexto, Number(partes[1])) }, chave, deBase64(partes[3])));
  } catch {
    return null;
  }
}

/** Onde cada texto cifrado mora. */
export const contextoDaConversa = (conversa: string, autor: string) => `conversa:${conversa}:${autor}`;
export const contextoDoMural = (canal: string, autor: string) => `mural:${canal}:${autor}`;

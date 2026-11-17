// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A cédula cifrada da consulta à base (supabase/migracoes/20261115-alumia-o9-resto8.sql, docs/rede/VOTO-SECRETO.md §2).
// Nada feito à mão: só a Web Crypto do próprio navegador, num esquema padrão de cifra para uma chave pública (o mesmo desenho do
// ECIES): o aparelho gera um par de chaves ECDH P-256 só para esta cédula, combina a chave privada dele com a chave pública da
// consulta (ECDH), deriva a chave de cifra com HKDF-SHA-256 e cifra o ranking com AES-256-GCM. A consulta entra como dado
// autenticado: a cédula de uma consulta não abre em outra. A chave privada da consulta nunca chega ao aparelho nem ao banco: só o
// servidor do site a deriva, do segredo dele (lib/rede/voto/servidor.ts), e só abre com a consulta fechada.
//
// Formato: "c1.<chave pública do aparelho, 65 bytes>.<nonce, 12 bytes>.<cifra com a etiqueta, 16 bytes ou mais>", em base64url.
// Sem os atalhos "@/" de propósito: o teste roda este arquivo direto no Node (que tem a mesma Web Crypto).

export const VERSAO_DA_CEDULA = "c1";
/** O que entra no HKDF além do segredo combinado: muda a chave por consulta e por versão do formato. */
export const infoDaCedula = (consulta: string) => `alumia:voto:cedula:v1:${consulta}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function paraBase64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deBase64url(texto: string): Uint8Array {
  const b = texto.replace(/-/g, "+").replace(/_/g, "/");
  const s = atob(b + "=".repeat((4 - (b.length % 4)) % 4));
  const saida = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) saida[i] = s.charCodeAt(i);
  return saida;
}

/** As partes de uma cédula bem formada, ou nulo. */
export function partesDaCedula(cedula: unknown): { chave: Uint8Array; nonce: Uint8Array; cifra: Uint8Array } | null {
  if (typeof cedula !== "string" || cedula.length > 1600) return null;
  const m = /^c1\.([A-Za-z0-9_-]{87})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22,1400})$/.exec(cedula);
  if (!m) return null;
  try {
    const chave = deBase64url(m[1]);
    const nonce = deBase64url(m[2]);
    const cifra = deBase64url(m[3]);
    if (chave.length !== 65 || chave[0] !== 4 || nonce.length !== 12 || cifra.length < 17) return null;
    return { chave, nonce, cifra };
  } catch {
    return null;
  }
}

const bytesDe = (b: Uint8Array): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

/**
 * Cifra o ranking (os ids das opções, na ordem da preferência) para a chave pública da consulta (65 bytes, base64url). Devolve a
 * cédula pronta para public.rede_org_consulta_votar_cifrada. Lança se o navegador não tem a Web Crypto ou a chave não serve.
 */
export async function cifrarCedula(consulta: string, chavePublica: string, ranking: string[]): Promise<string> {
  const sutil = globalThis.crypto?.subtle;
  if (!sutil) throw new Error("sem_web_crypto");
  if (!UUID.test(consulta) || ranking.length < 1 || ranking.length > 8 || ranking.some((r) => !UUID.test(r))) throw new Error("invalido");
  const daConsulta = deBase64url(chavePublica);
  if (daConsulta.length !== 65 || daConsulta[0] !== 4) throw new Error("chave_invalida");

  const publica = await sutil.importKey("raw", bytesDe(daConsulta), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const doAparelho = await sutil.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const combinado = await sutil.deriveBits({ name: "ECDH", public: publica }, doAparelho.privateKey, 256);
  const minhaPublica = new Uint8Array(await sutil.exportKey("raw", doAparelho.publicKey));
  const base = await sutil.importKey("raw", combinado, "HKDF", false, ["deriveKey"]);
  const codificar = new TextEncoder();
  const chave = await sutil.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: bytesDe(minhaPublica), info: bytesDe(codificar.encode(infoDaCedula(consulta))) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const cifra = new Uint8Array(
    await sutil.encrypt({ name: "AES-GCM", iv: bytesDe(nonce), additionalData: bytesDe(codificar.encode(consulta)) }, chave, bytesDe(codificar.encode(JSON.stringify(ranking)))),
  );
  return `${VERSAO_DA_CEDULA}.${paraBase64url(minhaPublica)}.${paraBase64url(nonce)}.${paraBase64url(cifra)}`;
}

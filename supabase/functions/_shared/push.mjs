// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O envio do aviso no celular da Rede (Web Push): assinatura VAPID (RFC 8292) e cifra do conteúdo (RFC 8291, aes128gcm), só com
// WebCrypto e fetch, para rodar igual no Node (testes) e no Deno (a função enviar-push do Supabase). O conteúdo é sempre o mesmo
// molde pequeno: {"n": quantos avisos, "l": idioma}. Nunca o texto de um post. Veja docs/rede/AVISOS.md.

const TEXTO = new TextEncoder();

/** base64url sem preenchimento, de bytes. */
export function paraBase64Url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Bytes de um base64url (com ou sem preenchimento). */
export function deBase64Url(texto) {
  const limpo = String(texto).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(limpo + "=".repeat((4 - (limpo.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const juntar = (...partes) => {
  const saida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
};

/**
 * O "JWT" VAPID (ES256) para um serviço de entrega: audiência = origem do endereço, validade de 12 horas.
 * chavePublica: 65 bytes (0x04, x, y) em base64url; chavePrivada: 32 bytes (d) em base64url; assunto: "mailto:..." ou "https://...".
 */
export async function assinarVapid({ endpoint, chavePublica, chavePrivada, assunto, agora = Date.now() }) {
  const pub = deBase64Url(chavePublica);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("chave pública VAPID inválida");
  const jwk = { kty: "EC", crv: "P-256", x: paraBase64Url(pub.slice(1, 33)), y: paraBase64Url(pub.slice(33)), d: chavePrivada, ext: true };
  const chave = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const cabeca = paraBase64Url(TEXTO.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = paraBase64Url(TEXTO.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(agora / 1000) + 12 * 3600, sub: assunto })));
  const assinatura = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chave, TEXTO.encode(`${cabeca}.${corpo}`));
  return `${cabeca}.${corpo}.${paraBase64Url(assinatura)}`;
}

const hkdf = async (segredo, sal, info, bits) => {
  const base = await crypto.subtle.importKey("raw", segredo, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sal, info }, base, bits));
};

/**
 * Cifra o conteúdo (bytes) para um aparelho, como o RFC 8291 manda (um só registro de 4096 bytes). p256dh: chave pública do
 * aparelho (65 bytes, base64url); auth: segredo de autenticação (16 bytes, base64url). Devolve o corpo do pedido.
 * `efemera` e `sal` só existem para os testes (por padrão, sorteados a cada envio).
 */
export async function cifrar(conteudo, p256dh, auth, { efemera, sal } = {}) {
  const aparelho = deBase64Url(p256dh);
  const segredoAuth = deBase64Url(auth);
  if (aparelho.length !== 65 || aparelho[0] !== 4) throw new Error("chave do aparelho inválida");
  if (conteudo.length > 3993) throw new Error("conteúdo grande demais para um registro");
  const par = efemera ?? (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]));
  const publicaServidor = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const chaveAparelho = await crypto.subtle.importKey("raw", aparelho, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: chaveAparelho }, par.privateKey, 256));
  const saleiro = sal ?? crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(ecdh, segredoAuth, juntar(TEXTO.encode("WebPush: info\0"), aparelho, publicaServidor), 256);
  const cek = await hkdf(ikm, saleiro, TEXTO.encode("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdf(ikm, saleiro, TEXTO.encode("Content-Encoding: nonce\0"), 96);
  const chaveAes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, chaveAes, juntar(conteudo, Uint8Array.of(2))));
  const cabecalho = new Uint8Array(21);
  cabecalho.set(saleiro, 0);
  new DataView(cabecalho.buffer).setUint32(16, 4096);
  cabecalho[20] = publicaServidor.length;
  return juntar(cabecalho, publicaServidor, cifrado);
}

/** O conteúdo de um aviso: só o número (limitado) e o idioma. Nunca texto de post. */
export function conteudoDoAviso(n, lang) {
  const total = Number.isInteger(n) && n > 0 ? Math.min(n, 99) : 0;
  const l = ["pt", "en", "es", "fr", "ru", "zh"].includes(lang) ? lang : "pt";
  return TEXTO.encode(JSON.stringify({ n: total, l }));
}

/**
 * Envia um aviso a um aparelho. Devolve {ok, gone, status}: gone = o serviço diz que o aparelho não existe mais (404 ou 410).
 * @param {{ assinatura: {endpoint: string, p256dh: string, auth: string, lang?: string}, n: number, vapid: {chavePublica: string, chavePrivada: string, assunto: string}, buscar?: typeof fetch }} o
 */
export async function enviarAviso({ assinatura, n, vapid, buscar = fetch }) {
  const jwt = await assinarVapid({ endpoint: assinatura.endpoint, ...vapid });
  const corpo = await cifrar(conteudoDoAviso(n, assinatura.lang), assinatura.p256dh, assinatura.auth);
  const r = await buscar(assinatura.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.chavePublica}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600",
      Urgency: "normal",
      Topic: "rede-avisos",
    },
    body: corpo,
    signal: AbortSignal.timeout(15_000),
  });
  return { ok: r.ok, gone: r.status === 404 || r.status === 410, status: r.status };
}

/**
 * Uma rodada: pede ao banco quem deve ser avisado (rede_aviso_push_pendentes), envia um por um e devolve o resultado de cada um
 * (rede_aviso_push_resultado). Devolve as contagens; o registro nunca leva endereço nem chave.
 */
export async function rodada({ chamar, vapid, buscar = fetch, limite = 50, pausa = 100 }) {
  const fila = await chamar("rede_aviso_push_pendentes", { p_limite: limite });
  const contagem = { enviados: 0, falhas: 0, removidos: 0 };
  for (const item of Array.isArray(fila) ? fila : []) {
    let resultado = { ok: false, gone: false };
    try {
      resultado = await enviarAviso({ assinatura: item, n: item.n, vapid, buscar });
    } catch {
      resultado = { ok: false, gone: false };
    }
    await chamar("rede_aviso_push_resultado", { p_id: item.id, p_ok: resultado.ok, p_gone: resultado.gone });
    if (resultado.ok) contagem.enviados++;
    else if (resultado.gone) contagem.removidos++;
    else contagem.falhas++;
    if (pausa) await new Promise((fim) => setTimeout(fim, pausa));
  }
  return contagem;
}

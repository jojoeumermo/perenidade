// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A camada pós-quântica da conversa a dois (onda R3, item 1.1). Documento: docs/rede/CHAT-PRIVADO.md ("A camada pós-quântica").
//
// O Signal mistura a chave do Double Ratchet com a do SPQR num KDF só. O Proteus do core-crypto não expõe a chave por mensagem, então
// aqui as duas ficam em CAMADAS: o cifrado do Proteus vai dentro de um XChaCha20-Poly1305 (libsodium) cuja chave sai só do SPQR. Para
// ler é preciso quebrar os dois: o Proteus (X25519, clássico) E o SPQR (ML-KEM-768, pós-quântico). Tudo por dentro do envelope X-Wing.
//
//   (st, m1..m8, k1..k8) = spqr.send × 8
//   k      = HKDF-SHA-256(ikm = k1 ‖ … ‖ k8, sal = 32 zeros, info = "alumia/r3/pq/camada/v1", 32)
//   camada = 0x51 ‖ n(1) = 8 ‖ (comprimento u16 ‖ mᵢ) × 8 ‖ nonce(24) ‖ XChaCha20-Poly1305(k, proteus, aad = "alumia/r3/pq/aad/v1" ‖ aparelho que manda)
//
// Por que 8 mensagens do SPQR por pacote: o SPQR tem fases (a chave ML-KEM vai em pedaços com código de apagamento); com 8 por pacote,
// quem roubou o estado inteiro do aparelho perde a conversa depois de ~9 idas e voltas (com 1 por pacote, ~77). Mandar várias de uma
// vez é uso normal da API: cada `send` avança a cadeia; quem recebe faz `recv` na mesma ordem.
//
// Ao abrir, NADA é gravado: quem chama só guarda o estado novo se o Proteus de dentro abrir e o bloco for válido. Erro em qualquer passo
// = null (sem dizer qual).
//
// Sem "@/" de propósito.
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { carregarSodio } from "../../cifra/sodio";
import { MENSAGENS_POR_PACOTE, type MotorSpqr } from "./spqr";

export const ROTULOS = {
  camada: "alumia/r3/pq/camada/v1",
  aad: "alumia/r3/pq/aad/v1",
} as const;

/** O primeiro byte da camada. */
export const MARCA_DA_CAMADA = 0x51;
const NONCE = 24;
const MARCA_DO_AEAD = 16;
/** O maior pedaço do SPQR que cabe na camada (o maior visto é 37 bytes; o teto é folgado e só serve para recusar lixo). */
const MAIOR_MENSAGEM_SPQR = 2048;

const texto = (t: string) => new TextEncoder().encode(t);
const juntar = (...partes: Uint8Array[]) => {
  const r = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    r.set(p, i);
    i += p.length;
  }
  return r;
};

const chaveDaCamada = (chaves: Uint8Array[]) => {
  const ikm = juntar(...chaves);
  try {
    return hkdf(sha256, ikm, new Uint8Array(32), texto(ROTULOS.camada), 32);
  } finally {
    ikm.fill(0);
  }
};

const aadDe = (aparelho: Uint8Array) => {
  if (aparelho.length !== 32) throw new Error("aparelho_invalido");
  return juntar(texto(ROTULOS.aad), aparelho);
};

/** Fecha o cifrado do Proteus na camada pós-quântica. Devolve o estado novo do SPQR (gravar ANTES de depositar) e a camada. */
export async function selarCamada(m: MotorSpqr, estado: Uint8Array, proteus: Uint8Array<ArrayBuffer>, aparelho: Uint8Array): Promise<{ estado: Uint8Array; camada: Uint8Array<ArrayBuffer> }> {
  const S = await carregarSodio();
  let st = estado;
  const msgs: Uint8Array[] = [];
  const chaves: Uint8Array[] = [];
  for (let i = 0; i < MENSAGENS_POR_PACOTE; i++) {
    const r = m.enviar(st);
    st = r.estado;
    if (r.msg.length > MAIOR_MENSAGEM_SPQR) throw new Error("spqr_mensagem");
    msgs.push(r.msg);
    chaves.push(r.chave);
  }
  const k = chaveDaCamada(chaves);
  chaves.forEach((c) => c.fill(0));
  try {
    const cab: Uint8Array[] = [new Uint8Array([MARCA_DA_CAMADA, MENSAGENS_POR_PACOTE])];
    for (const msg of msgs) cab.push(new Uint8Array([msg.length >> 8, msg.length & 0xff]), msg);
    const nonce = S.randombytes_buf(NONCE);
    const cifrado = S.crypto_aead_xchacha20poly1305_ietf_encrypt(proteus, aadDe(aparelho), null, nonce, k);
    return { estado: st, camada: juntar(...cab, nonce, cifrado) };
  } finally {
    k.fill(0);
  }
}

/** Lê o cabeçalho da camada: as mensagens do SPQR, o nonce e o cifrado. null se o formato não bate. */
export function lerCamada(camada: Uint8Array): { msgs: Uint8Array[]; nonce: Uint8Array; cifrado: Uint8Array } | null {
  if (camada.length < 2 || camada[0] !== MARCA_DA_CAMADA || camada[1] !== MENSAGENS_POR_PACOTE) return null;
  let i = 2;
  const msgs: Uint8Array[] = [];
  for (let j = 0; j < MENSAGENS_POR_PACOTE; j++) {
    if (i + 2 > camada.length) return null;
    const n = (camada[i] << 8) | camada[i + 1];
    i += 2;
    if (n === 0 || n > MAIOR_MENSAGEM_SPQR || i + n > camada.length) return null;
    msgs.push(camada.slice(i, i + n));
    i += n;
  }
  if (i + NONCE + MARCA_DO_AEAD > camada.length) return null;
  return { msgs, nonce: camada.slice(i, i + NONCE), cifrado: camada.slice(i + NONCE) };
}

/**
 * Abre a camada com o estado do SPQR da sessão com o aparelho que manda. Devolve o estado novo (gravar SÓ se o Proteus de dentro abrir)
 * e o cifrado do Proteus. null em qualquer dúvida: mensagem repetida (o SPQR não dá a mesma chave duas vezes), adulterada, de outra
 * sessão, com versão abaixo da mínima, ou AEAD que não confere.
 */
export async function abrirCamada(m: MotorSpqr, estado: Uint8Array, camada: Uint8Array, aparelho: Uint8Array): Promise<{ estado: Uint8Array; proteus: Uint8Array } | null> {
  const lida = lerCamada(camada);
  if (!lida || aparelho.length !== 32) return null;
  const S = await carregarSodio();
  let st = estado;
  const chaves: Uint8Array[] = [];
  try {
    for (const msg of lida.msgs) {
      const r = m.receber(st, msg);
      if (!r) return null;
      st = r.estado;
      chaves.push(r.chave);
    }
    const k = chaveDaCamada(chaves);
    try {
      const proteus = S.crypto_aead_xchacha20poly1305_ietf_decrypt(null, lida.cifrado, aadDe(aparelho), lida.nonce, k);
      return { estado: st, proteus };
    } catch {
      return null;
    } finally {
      k.fill(0);
    }
  } finally {
    chaves.forEach((c) => c.fill(0));
  }
}

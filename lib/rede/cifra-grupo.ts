// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A cifra dos POSTS RESTRITOS da Alumia (C1): o que só um grupo lê (núcleo, comunidade fechada) é cifrado no aparelho de quem
// escreve, com uma chave do grupo, e o servidor guarda só o cifrado. Documento: docs/rede/POSTS-RESTRITOS.md.
//
//   par da pessoa   X25519 + ML-KEM-768 (pós-quântico, FIPS 203), gerado no aparelho; a parte pública vai para o banco
//                   ("g1.<x25519>.<ml-kem>"). Os dois juntos: quem quebrar só um dos dois (um computador quântico quebra o X25519;
//                   uma falha no ML-KEM, que é novo) ainda não abre nada.
//   chave do grupo  32 bytes aleatórios por versão. Troca quando alguém sai do grupo (e a quem escreve cabe criar a seguinte).
//   embrulho        a chave do grupo para UMA pessoa: X25519 efêmero com a dela + encapsulamento ML-KEM na dela; os dois segredos
//                   entram juntos no HKDF-SHA-256, amarrados ao grupo, à versão e a quem recebe; AES-GCM-256 fecha a chave.
//                   "e1.<x25519 efêmero>.<cifrado ML-KEM>.<vetor>.<chave fechada>"
//   post            AES-GCM-256 com a chave do grupo, sobre um bloco de tamanho fixo (lib/rede/chat/padding.ts), amarrado ao
//                   grupo, à versão e ao autor: "p1.<versão>.<vetor>.<cifrado>".
//
// Sem navegador além do WebCrypto (AES-GCM) e das bibliotecas @noble (MIT, versão exata): roda no Node nos testes
// (scripts/testar-cifra-grupo.mjs). Sem "@/".
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { preencher, tirarPreenchimento } from "./chat/padding";

const encoder = new TextEncoder();
const B64 = "[A-Za-z0-9_-]";

const paraB64 = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const deB64 = (t: string): Uint8Array => {
  const s = atob(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4));
  const b = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
};
const juntar = (...partes: Uint8Array[]) => {
  const saida = new Uint8Array(new ArrayBuffer(partes.reduce((n, p) => n + p.length, 0)));
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
};

/** O tamanho das partes, para conferir o formato antes de qualquer conta. */
const BYTES = { x25519: 32, mlkemPublica: 1184, mlkemCifrado: 1088, chave: 32, vetor: 12 } as const;
export const FORMATO_PUBLICA_DE_GRUPO = new RegExp(`^g1\\.(${B64}{43})\\.(${B64}{1579})$`);
const FORMATO_EMBRULHO = new RegExp(`^e1\\.(${B64}{43})\\.(${B64}{1451})\\.(${B64}{16})\\.(${B64}{64})$`);
const FORMATO_POST = new RegExp(`^p1\\.([1-9][0-9]{0,6})\\.(${B64}{16})\\.(${B64}+)$`);

/** O par de uma pessoa para os grupos. As partes privadas ficam só no aparelho dela (lib/rede/grupo-chaveiro.ts as guarda). */
export interface ParDeGrupo {
  x25519: { publica: Uint8Array; privada: Uint8Array };
  mlkem: { publica: Uint8Array; privada: Uint8Array };
}

export function novoParDeGrupo(): ParDeGrupo {
  const xPrivada = x25519.utils.randomSecretKey();
  const k = ml_kem768.keygen();
  return { x25519: { publica: x25519.getPublicKey(xPrivada), privada: xPrivada }, mlkem: { publica: k.publicKey, privada: k.secretKey } };
}

/** A parte pública, como vai para o banco: "g1.<x25519>.<ml-kem>". */
export const publicaDeGrupo = (par: ParDeGrupo) => `g1.${paraB64(par.x25519.publica)}.${paraB64(par.mlkem.publica)}`;

function lerPublica(publica: string): { x: Uint8Array; k: Uint8Array } | null {
  const m = FORMATO_PUBLICA_DE_GRUPO.exec(publica);
  if (!m) return null;
  const x = deB64(m[1]);
  const k = deB64(m[2]);
  return x.length === BYTES.x25519 && k.length === BYTES.mlkemPublica ? { x, k } : null;
}

/** O que amarra um embrulho: o grupo, a versão e quem recebe (um embrulho não serve em outro grupo, versão ou pessoa). */
export const contextoDoEmbrulhoDeGrupo = (grupo: string, versao: number, para: string) => `alumia-grupo:e1:${grupo}:v${versao}:${para}`;
/** O que amarra um post: o grupo, a versão e o autor. */
export const contextoDoPostDeGrupo = (grupo: string, versao: number, autor: string) => `alumia-grupo:p1:${grupo}:v${versao}:${autor}`;

/** Uma chave de grupo nova (32 bytes). */
export const novaChaveDeGrupo = () => crypto.getRandomValues(new Uint8Array(new ArrayBuffer(BYTES.chave)));

const chaveAes = (bytes: Uint8Array, usos: KeyUsage[]) => crypto.subtle.importKey("raw", bytes as Uint8Array<ArrayBuffer>, { name: "AES-GCM" }, false, usos);

/** Os dois segredos (X25519 e ML-KEM) viram a chave que fecha o embrulho, amarrada ao contexto e às partes públicas da troca. */
const chaveDoEmbrulho = (ssX: Uint8Array, ssK: Uint8Array, efemera: Uint8Array, cifradoK: Uint8Array, contexto: string) =>
  hkdf(sha256, juntar(ssX, ssK), sha256(juntar(efemera, cifradoK)), encoder.encode(contexto), 32);

/** Embrulha a chave do grupo para uma pessoa (pela parte pública dela). Lança "publica_invalida". */
export async function embrulharChaveDeGrupo(chave: Uint8Array, publicaDoDestino: string, contexto: string): Promise<string> {
  const destino = lerPublica(publicaDoDestino);
  if (!destino) throw new Error("publica_invalida");
  if (chave.length !== BYTES.chave) throw new Error("chave_invalida");
  const efPrivada = x25519.utils.randomSecretKey();
  const efPublica = x25519.getPublicKey(efPrivada);
  const ssX = x25519.getSharedSecret(efPrivada, destino.x);
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(destino.k);
  const kek = chaveDoEmbrulho(ssX, sharedSecret, efPublica, cipherText, contexto);
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(BYTES.vetor)));
  const fechada = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(contexto) }, await chaveAes(kek, ["encrypt"]), chave as Uint8Array<ArrayBuffer>));
  ssX.fill(0);
  sharedSecret.fill(0);
  kek.fill(0);
  efPrivada.fill(0);
  return `e1.${paraB64(efPublica)}.${paraB64(cipherText)}.${paraB64(iv)}.${paraB64(fechada)}`;
}

/** Abre o embrulho com o par da pessoa. Nulo em qualquer dúvida (formato, outra pessoa, outro grupo ou versão, adulterado). */
export async function desembrulharChaveDeGrupo(embrulho: string, par: ParDeGrupo, contexto: string): Promise<Uint8Array | null> {
  const m = FORMATO_EMBRULHO.exec(embrulho);
  if (!m) return null;
  try {
    const efPublica = deB64(m[1]);
    const cifradoK = deB64(m[2]);
    if (efPublica.length !== BYTES.x25519 || cifradoK.length !== BYTES.mlkemCifrado) return null;
    const ssX = x25519.getSharedSecret(par.x25519.privada, efPublica);
    const ssK = ml_kem768.decapsulate(cifradoK, par.mlkem.privada);
    const kek = chaveDoEmbrulho(ssX, ssK, efPublica, cifradoK, contexto);
    const aberta = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(m[3]) as Uint8Array<ArrayBuffer>, additionalData: encoder.encode(contexto) }, await chaveAes(kek, ["decrypt"]), deB64(m[4]) as Uint8Array<ArrayBuffer>));
    ssX.fill(0);
    ssK.fill(0);
    kek.fill(0);
    return aberta.length === BYTES.chave ? aberta : null;
  } catch {
    return null;
  }
}

/** Cifra o texto de um post do grupo, num bloco de tamanho fixo (o tamanho guardado não conta o tamanho do texto). */
export async function cifrarPostDeGrupo(chave: Uint8Array, versao: number, grupo: string, autor: string, texto: string): Promise<string> {
  if (!Number.isInteger(versao) || versao < 1 || versao > 9_999_999) throw new Error("versao_invalida");
  const bloco = preencher(encoder.encode(texto));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(BYTES.vetor)));
  try {
    const fechado = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(contextoDoPostDeGrupo(grupo, versao, autor)) }, await chaveAes(chave, ["encrypt"]), bloco);
    return `p1.${versao}.${paraB64(iv)}.${paraB64(new Uint8Array(fechado))}`;
  } finally {
    bloco.fill(0);
  }
}

/** A versão da chave com que um post foi cifrado (nulo se não é post de grupo). */
export const versaoDoPostDeGrupo = (corpo: string): number | null => {
  const m = FORMATO_POST.exec(corpo);
  return m ? Number(m[1]) : null;
};

/** Abre um post do grupo. Nulo em qualquer dúvida (chave errada, outro grupo, outra versão, outro autor, adulterado). */
export async function abrirPostDeGrupo(chave: Uint8Array, corpo: string, grupo: string, autor: string): Promise<string | null> {
  const m = FORMATO_POST.exec(corpo);
  if (!m) return null;
  try {
    const versao = Number(m[1]);
    const aberto = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(m[2]) as Uint8Array<ArrayBuffer>, additionalData: encoder.encode(contextoDoPostDeGrupo(grupo, versao, autor)) }, await chaveAes(chave, ["decrypt"]), deB64(m[3]) as Uint8Array<ArrayBuffer>);
    return new TextDecoder("utf-8", { fatal: true }).decode(tirarPreenchimento(new Uint8Array(aberto)));
  } catch {
    return null;
  }
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A chave tirada de uma senha digitada no aparelho (onda R2, item 1.6): Argon2id da libsodium (crypto_pwhash com
// crypto_pwhash_ALG_ARGON2ID13), no lugar do PBKDF2 em todo lugar que deriva chave de senha (trava do histórico, cofre da senha de
// pânico, cofre da Escola, selos por código de lib/sigilo.ts, a ferramenta de cifrar com senha). Nada de primitiva feita à mão.
//
// Os valores (lib/rede/cifra/sodio.ts, ARGON2ID): 64 MiB de memória, 3 passadas, 1 linha, sal de 16 bytes sorteado, saída de 32
// bytes. Medidos na fase de desenho: uns 130 ms num computador comum (Node e Edge). Num computador fraco pode passar de 1 s: por
// isso a derivação roda num Worker (lib/rede/cofre/argon.worker.ts) e a tela não trava; sem Worker (Node, ou o navegador recusou),
// roda aqui mesmo. Sem a memória, a derivação FALHA com "sem_memoria" (a tela diz); nunca cai para um valor menor.
//
// Os valores vão gravados no cabeçalho de cada cofre ("a2id", v1), junto do sal: podem subir depois sem perder o que já foi
// guardado. Um cabeçalho com valor MENOR que o mínimo é recusado (quem mexer no armazenamento não força uma derivação fraca).
//
// selar/abrir: XChaCha20-Poly1305 da libsodium, com nonce SORTEADO de 24 bytes a cada gravação (sem contador: restaurar cópia ou
// abrir em outro aparelho nunca repete nonce sob a mesma chave) e o rótulo da finalidade como dado autenticado.
// Sem os atalhos "@/" de propósito: os testes rodam este arquivo direto no Node.
import { ARGON2ID, carregarSodio } from "../cifra/sodio";
import { derivarAqui } from "./argon-nucleo";

/** Os rótulos desta frente (um por finalidade; o teste da junção confere que não se repetem). */
export const ROTULOS = {
  cofre: (finalidade: string) => `alumia/r2/cofre/${finalidade}/v1`,
  finalidades: ["panico", "escola", "historico", "sigilo-pedido", "ferramenta"] as const,
} as const;

/** O cabeçalho gravado com cada cofre. `m` em KiB (como no RFC 9106), `t` passadas, `p` linhas; `sal` em base64. */
export interface CabecalhoA2id {
  v: 1;
  alg: "argon2id13";
  m: number;
  t: number;
  p: 1;
  sal: string;
}

const MEMORIA_KIB = ARGON2ID.memoria / 1024;
/** O teto aceito num cabeçalho (1 GiB, 16 passadas): acima disso é cabeçalho mexido para travar o aparelho. */
const TETO = { m: 1024 * 1024, t: 16 } as const;

const b64 = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const deB64 = (texto: string): Uint8Array<ArrayBuffer> => {
  const bruto = atob(texto);
  const saida = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
};

/** O cabeçalho é deste formato e não pede menos que o mínimo (nem um absurdo)? */
export function cabecalhoValido(x: unknown): x is CabecalhoA2id {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  if (c.v !== 1 || c.alg !== "argon2id13" || c.p !== 1) return false;
  if (typeof c.m !== "number" || !Number.isInteger(c.m) || c.m < MEMORIA_KIB || c.m > TETO.m) return false;
  if (typeof c.t !== "number" || !Number.isInteger(c.t) || c.t < ARGON2ID.passadas || c.t > TETO.t) return false;
  if (typeof c.sal !== "string" || !/^[A-Za-z0-9+/]{22}==$/.test(c.sal)) return false;
  return true;
}

/** Um cabeçalho novo, com os valores de hoje e sal sorteado. */
export function novoCabecalho(): CabecalhoA2id {
  const sal = crypto.getRandomValues(new Uint8Array(ARGON2ID.sal));
  return { v: 1, alg: "argon2id13", m: MEMORIA_KIB, t: ARGON2ID.passadas, p: 1, sal: b64(sal) };
}

/** A mesma senha escrita de jeitos diferentes (acento composto ou não) vira a mesma sequência de bytes. */
const bytesDaSenha = (senha: string) => new TextEncoder().encode(senha.normalize("NFC"));

// ── O Worker (só no navegador) ──
type Resposta = { id: number; chave?: Uint8Array; erro?: string };
let trabalhador: Worker | null | undefined;
let proximo = 1;
const esperando = new Map<number, (r: Resposta) => void>();

function oTrabalhador(): Worker | null {
  if (trabalhador !== undefined) return trabalhador;
  trabalhador = null;
  if (typeof Worker === "undefined" || typeof window === "undefined") return null;
  try {
    const w = new Worker(new URL("./argon.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<Resposta>) => {
      const fim = esperando.get(e.data?.id);
      if (fim) {
        esperando.delete(e.data.id);
        fim(e.data);
      }
    };
    w.onerror = () => {
      // O Worker caiu (ou nem subiu): quem esperava refaz aqui mesmo; os próximos nem tentam.
      trabalhador = null;
      for (const [id, fim] of esperando) fim({ id, erro: "sem_worker" });
      esperando.clear();
    };
    trabalhador = w;
  } catch {
    trabalhador = null;
  }
  return trabalhador;
}

async function derivarBytes(senha: Uint8Array, sal: Uint8Array, m: number, t: number): Promise<Uint8Array> {
  const w = oTrabalhador();
  if (w) {
    const id = proximo++;
    const copia = senha.slice();
    const r = await new Promise<Resposta>((fim) => {
      esperando.set(id, fim);
      w.postMessage({ id, senha: copia, sal, m, t }, [copia.buffer]);
    });
    if (r.chave instanceof Uint8Array && r.chave.length === ARGON2ID.saida) {
      senha.fill(0);
      return r.chave;
    }
    if (r.erro === "sem_memoria") {
      senha.fill(0);
      throw Object.assign(new Error("sem_memoria"), { code: "sem_memoria" });
    }
    // "sem_worker" ou resposta torta: aqui mesmo.
  }
  return derivarAqui(senha, sal, m, t);
}

/**
 * A chave de 32 bytes desta senha. Sem cabeçalho, cria um novo (valores de hoje, sal sorteado); com cabeçalho, refaz a mesma
 * chave com os valores e o sal dele. Cabeçalho inválido ou fraco: lança "cabecalho_invalido". Sem memória: "sem_memoria".
 * Quem recebe a chave a zera quando não precisar mais (`chave.fill(0)`).
 */
export async function derivar(senha: string, cabecalho?: CabecalhoA2id): Promise<{ chave: Uint8Array; cabecalho: CabecalhoA2id }> {
  const c = cabecalho ?? novoCabecalho();
  if (!cabecalhoValido(c)) throw Object.assign(new Error("cabecalho_invalido"), { code: "cabecalho_invalido" });
  const chave = await derivarBytes(bytesDaSenha(senha), deB64(c.sal), c.m, c.t);
  return { chave, cabecalho: { v: 1, alg: "argon2id13", m: c.m, t: c.t, p: 1, sal: c.sal } };
}

const FINALIDADE = /^[a-z0-9-]{1,40}$/;

/** Cifra `dados` com a chave (XChaCha20-Poly1305, nonce sorteado de 24 bytes). Devolve nonce ‖ cifrado. */
export async function selar(chave: Uint8Array, finalidade: string, dados: Uint8Array): Promise<Uint8Array> {
  if (!FINALIDADE.test(finalidade) || chave.length !== 32) throw new Error("invalido");
  const S = await carregarSodio();
  const nonce = S.randombytes_buf(S.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const cifrado = S.crypto_aead_xchacha20poly1305_ietf_encrypt(dados, ROTULOS.cofre(finalidade), null, nonce, chave);
  const saida = new Uint8Array(nonce.length + cifrado.length);
  saida.set(nonce, 0);
  saida.set(cifrado, nonce.length);
  return saida;
}

/** Abre o que `selar` fechou. Chave errada, finalidade errada ou bytes mexidos: nulo (nunca lança). */
export async function abrir(chave: Uint8Array, finalidade: string, selado: Uint8Array): Promise<Uint8Array | null> {
  if (!FINALIDADE.test(finalidade) || chave.length !== 32) return null;
  try {
    const S = await carregarSodio();
    const n = S.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
    if (selado.length < n + S.crypto_aead_xchacha20poly1305_ietf_ABYTES) return null;
    return S.crypto_aead_xchacha20poly1305_ietf_decrypt(null, selado.subarray(n), ROTULOS.cofre(finalidade), selado.subarray(0, n), chave);
  } catch {
    return null;
  }
}

/** Base64 dos cofres (o mesmo dos outros arquivos guardados no aparelho). */
export const paraBase64 = b64;
export const deBase64 = deB64;

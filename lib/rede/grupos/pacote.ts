// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Leitura dos pacotes de chave (KeyPackage, RFC 9420, seção 10) e dos nomes de membro (ClientId) do MLS, ANTES de pôr alguém num
// grupo. A biblioteca (OpenMLS, pelo core-crypto) só devolve o pacote em bytes; para conferir a quem ele pertence (o servidor
// entrega o pacote e diz de quem é, e pode mentir), o aparelho lê do próprio pacote a suíte, o nome (ClientId) e a chave de
// assinatura da folha. É só leitura do formato TLS do RFC (comprimentos em "varint", seção 2.1.2): nenhuma cifra aqui. A
// assinatura do pacote quem confere é a biblioteca, ao pôr no grupo.
//
// A "impressão" de uma chave de assinatura é a que a biblioteca devolve em getDeviceIdentities (thumbprint): o resumo SHA-256 da
// chave Ed25519 em JWK (RFC 7638). Calculada aqui do pacote, ela permite comparar o pacote com a folha que entrou na árvore.
// Sem "@/": roda no Node nos testes.
import { sha256 } from "@noble/hashes/sha2.js";

/** O domínio de todo nome de membro da Alumia (nunca resolve: não é endereço de nada). */
export const DOMINIO = "alumia.invalid";
const NOME = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([0-9a-f]{1,16})@alumia\.invalid$/;

export interface Membro {
  /** O texto do ClientId ("<uuid>:<aparelho>@alumia.invalid"). */
  nome: string;
  /** A conta (o uuid do ClientId). */
  usuario: string;
  /** O aparelho (hexadecimal do DeviceId). */
  dispositivo: string;
}

/** Lê um ClientId em texto (null se não é um nome da Alumia). */
export function lerNome(texto: string): Membro | null {
  const m = NOME.exec(texto);
  return m ? { nome: texto, usuario: m[1], dispositivo: m[2] } : null;
}

export interface PacoteLido extends Membro {
  /** O número da suíte do pacote. */
  suite: number;
  /** A chave pública de assinatura da folha (Ed25519, 32 bytes). */
  assinatura: Uint8Array;
  /** A impressão da chave de assinatura (a mesma que a biblioteca dá depois, na árvore). */
  impressao: string;
}

const paraB64Url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** A impressão (RFC 7638) de uma chave Ed25519: SHA-256 do JWK canônico, em base64url. */
export function impressaoDaChave(assinatura: Uint8Array): string {
  if (assinatura.length !== 32) throw new Error("chave_invalida");
  return paraB64Url(sha256(new TextEncoder().encode(`{"crv":"Ed25519","kty":"OKP","x":"${paraB64Url(assinatura)}"}`)));
}

/** Lê um pacote de chave em bytes. Null se não é um pacote MLS 1.0 de credencial básica com um nome da Alumia. */
export function lerPacote(bytes: Uint8Array): PacoteLido | null {
  let i = 0;
  const falta = (n: number) => i + n > bytes.length;
  const u16 = () => {
    if (falta(2)) throw new Error("curto");
    const v = (bytes[i] << 8) | bytes[i + 1];
    i += 2;
    return v;
  };
  const vetor = () => {
    if (falta(1)) throw new Error("curto");
    const prefixo = bytes[i] >> 6;
    if (prefixo === 3) throw new Error("varint");
    const n = 1 << prefixo;
    if (falta(n)) throw new Error("curto");
    let tamanho = bytes[i] & 0x3f;
    for (let k = 1; k < n; k++) tamanho = tamanho * 256 + bytes[i + k];
    i += n;
    if (falta(tamanho)) throw new Error("curto");
    const saida = bytes.slice(i, i + tamanho);
    i += tamanho;
    return saida;
  };
  try {
    if (u16() !== 1) return null; // mls10
    const suite = u16();
    vetor(); // init_key
    vetor(); // encryption_key (da folha)
    const assinatura = vetor(); // signature_key
    if (u16() !== 1) return null; // credencial básica
    const nome = lerNome(new TextDecoder("utf-8", { fatal: true }).decode(vetor()));
    if (!nome || assinatura.length !== 32) return null;
    return { ...nome, suite, assinatura, impressao: impressaoDaChave(assinatura) };
  } catch {
    return null;
  }
}

/** Um número de aparelho sorteado (u64 em hexadecimal, sem zeros à esquerda, nunca zero). */
export function novoDispositivo(): bigint {
  const b = crypto.getRandomValues(new Uint8Array(8));
  let n = BigInt(0);
  for (const x of b) n = (n << BigInt(8)) | BigInt(x);
  return n === BigInt(0) ? BigInt(1) : n;
}

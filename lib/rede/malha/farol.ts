// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O Farol do ato sem internet (onda R3, item 2.2; documento público: docs/rede/SEM-INTERNET.md). Com internet, o farol só muda quando
// DUAS pessoas da coordenação pedem o mesmo estado (supabase/migracoes/20261110-alumia-atos.sql). Sem internet não há servidor para
// contar as duas: cada pessoa da coordenação tem uma chave Ed25519 do farol deste ato (publicada com internet pela sessão de quem
// coordena, SEM assinatura da identidade, com iscas: supabase/migracoes/20261125-r3-sem-internet-formal.sql), e o farol só vale
// com DUAS assinaturas de chaves diferentes da lista do ato. Assinaturas da @noble/curves (auditada), RFC 8032 estrito.
//
//   farol = "alumia/r3/farol/v1" ‖ ato(16) ‖ estado(1) ‖ len u16 ‖ texto(≤ 280 bytes) ‖ quando u32 ‖ n(1) ‖ (chave(32) ‖ assinatura(64))×n
//   cada assinatura é sobre tudo antes de `n` (o mesmo texto para as duas)
//
// Com uma assinatura só, é um PEDIDO: viaja do mesmo jeito (pacote do farol), e só quem coordena faz algo com ele (assina também, se
// pedir o mesmo estado). Quem confirmou presença só mostra o farol com as duas.
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-r3-malha.mjs).
import { ed25519 } from "@noble/curves/ed25519.js";
import { copia, deTexto, iguais, juntar, lerU32, sortear, texto, u32, type Bytes } from "../chat/r2/bytes";
import { ROTULOS } from "./pacote";

export type EstadoDoFarol = "tranquilo" | "atencao" | "dispersar" | "ponto2";
const ESTADOS: readonly EstadoDoFarol[] = ["tranquilo", "atencao", "dispersar", "ponto2"];
const TEXTO_MAXIMO = 280;

export interface ConteudoDoFarol {
  /** O id do ato (o uuid do post, 16 bytes). */
  ato: Bytes;
  estado: EstadoDoFarol;
  /** O novo ponto (só em "ponto2"). */
  texto: string;
  /** Quando a coordenação pediu (segundos desde 1970). */
  quando: number;
}

export interface FarolAssinado extends ConteudoDoFarol {
  assinaturas: { chave: Bytes; assinatura: Bytes }[];
}

/** O uuid "xxxxxxxx-xxxx-…" em 16 bytes. */
export function bytesDoUuid(uuid: string): Bytes {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error("ato_invalido");
  const b = new Uint8Array(new ArrayBuffer(16));
  for (let i = 0; i < 16; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

function semAssinaturas(c: ConteudoDoFarol): Bytes {
  if (c.ato.length !== 16) throw new Error("ato_invalido");
  const i = ESTADOS.indexOf(c.estado);
  if (i < 0) throw new Error("estado_invalido");
  const t = texto(c.estado === "ponto2" ? c.texto.normalize("NFC").trim() : "");
  if (t.length > TEXTO_MAXIMO || (c.estado === "ponto2" && t.length < 3)) throw new Error("texto_invalido");
  if (!Number.isInteger(c.quando) || c.quando < 0 || c.quando > 0xffff_ffff) throw new Error("quando_invalido");
  const len = new Uint8Array([t.length >> 8, t.length & 0xff]);
  return juntar(texto(ROTULOS.farol), c.ato, new Uint8Array([i + 1]), len, t, u32(c.quando));
}

/** Assina o conteúdo com a chave do farol (semente de 32 bytes) e devolve o farol com mais esta assinatura. */
export function assinarFarol(f: ConteudoDoFarol & { assinaturas?: FarolAssinado["assinaturas"] }, semente: Uint8Array): FarolAssinado {
  const chave = copia(ed25519.getPublicKey(semente));
  const ja = f.assinaturas ?? [];
  if (ja.some((a) => iguais(a.chave, chave))) throw new Error("ja_assinado");
  if (ja.length >= 2) throw new Error("ja_tem_duas");
  return { ato: f.ato, estado: f.estado, texto: f.estado === "ponto2" ? f.texto.normalize("NFC").trim() : "", quando: f.quando, assinaturas: [...ja, { chave, assinatura: copia(ed25519.sign(semAssinaturas(f), semente)) }] };
}

export function codificarFarol(f: FarolAssinado): Bytes {
  if (f.assinaturas.length < 1 || f.assinaturas.length > 2) throw new Error("assinaturas_invalidas");
  return juntar(semAssinaturas(f), new Uint8Array([f.assinaturas.length]), ...f.assinaturas.flatMap((a) => [a.chave, a.assinatura]));
}

/** Lê o farol de dentro do pacote. null para qualquer formato errado (nunca lança). Não confere assinatura: veja conferirFarol. */
export function lerFarol(b: Uint8Array): FarolAssinado | null {
  try {
    const r = texto(ROTULOS.farol);
    if (b.length < r.length + 16 + 1 + 2 + 4 + 1 || !iguais(b.subarray(0, r.length), r)) return null;
    let i = r.length;
    const ato = copia(b.subarray(i, i + 16));
    i += 16;
    const estado = ESTADOS[b[i] - 1];
    i += 1;
    if (!estado) return null;
    const n = (b[i] << 8) | b[i + 1];
    i += 2;
    if (n > TEXTO_MAXIMO || i + n + 5 > b.length) return null;
    const t = deTexto(b.subarray(i, i + n));
    i += n;
    const quando = lerU32(b, i);
    i += 4;
    const k = b[i];
    i += 1;
    if ((k !== 1 && k !== 2) || b.length !== i + k * 96) return null;
    const assinaturas = [];
    for (let j = 0; j < k; j++, i += 96) assinaturas.push({ chave: copia(b.subarray(i, i + 32)), assinatura: copia(b.subarray(i + 32, i + 96)) });
    const f: FarolAssinado = { ato, estado, texto: t, quando, assinaturas };
    // O texto canônico refeito tem de dar os mesmos bytes (nada de dois jeitos de escrever o mesmo farol).
    if (!iguais(codificarFarol(f), b)) return null;
    return f;
  } catch {
    return null;
  }
}

function confere(chave: Uint8Array, mensagem: Uint8Array, assinatura: Uint8Array): boolean {
  if (chave.length !== 32 || assinatura.length !== 64) return false;
  try {
    return ed25519.verify(assinatura, mensagem, chave, { zip215: false });
  } catch {
    return false;
  }
}

/**
 * Quantas assinaturas VÁLIDAS, de chaves DIFERENTES e da lista do ato (`autorizadas`), o farol tem, e se é deste ato. O farol só vale
 * para quem confirmou presença com 2; quem coordena usa 1 como pedido.
 */
export function conferirFarol(f: FarolAssinado, ato: Uint8Array, autorizadas: readonly Uint8Array[]): number {
  if (!iguais(f.ato, ato)) return 0;
  let msg: Bytes;
  try {
    msg = semAssinaturas(f);
  } catch {
    return 0;
  }
  const vistas: Bytes[] = [];
  for (const a of f.assinaturas) {
    if (!autorizadas.some((k) => iguais(k, a.chave))) continue;
    if (vistas.some((k) => iguais(k, a.chave))) continue;
    if (confere(a.chave, msg, a.assinatura)) vistas.push(a.chave);
  }
  return vistas.length;
}


/** A chave pública de uma semente do farol. */
export const chaveDoFarol = (semente: Uint8Array): Bytes => copia(ed25519.getPublicKey(semente));

/**
 * As iscas que vão junto quando quem coordena publica a chave do farol (public.rede_ato_farol_chave_publicar, p_iscas): chaves
 * Ed25519 válidas cuja semente é jogada fora aqui mesmo. Elas tomam o lugar das linhas falsas da lista do ato, para quem recebe não
 * contar as verdadeiras pelo teste "é ponto da curva?". A chave do farol NÃO leva assinatura da identidade da conta: conferida contra
 * o diretório, ela diria a quem confirmou presença QUEM coordena.
 */
export function iscasDoFarol(n = 7): Bytes[] {
  if (!Number.isInteger(n) || n < 0 || n > 7) throw new Error("iscas_invalidas");
  return Array.from({ length: n }, () => chaveDoFarol(sortear(32)));
}

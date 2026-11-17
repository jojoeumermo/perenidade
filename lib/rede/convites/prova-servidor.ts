// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do servidor da prova de trabalho (lib/rede/convites/prova.ts). Só no servidor: usa o node:crypto (HMAC-SHA-256 e
// SHA-256 da biblioteca do Node; nada feito à mão).
//
// O desafio é "p1.<momento>.<dificuldade>.<vence>.<sorteio>.<assinatura>": a assinatura é HMAC-SHA-256 do resto com uma chave
// derivada de ALUMIA_IMPRESSAO_SEGREDO (a mesma variável da impressão de rede, com outro rótulo; o segredo nunca vai ao banco).
// Sem a variável, a chave é sorteada quando o processo sobe (vale enquanto o servidor não reinicia; o site roda num processo só).
// O desafio não guarda nada de quem pediu: só o momento, a dificuldade e o prazo. O banco recebe só o resumo do desafio, para
// que o mesmo desafio resolvido não sirva duas vezes.
// Sem os atalhos "@/" de propósito: `npm run testar:alumia-o8-porta` roda este arquivo direto no Node.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  DIFICULDADE_BASE,
  DIFICULDADE_MAXIMA,
  MOMENTOS,
  type MomentoDaPorta,
  PRAZO_DO_DESAFIO_MS,
  respostaBemFormada,
  textoDaTentativa,
  zerosIniciais,
} from "./prova";

const TAMANHO_MINIMO_DO_SEGREDO = 32;
let chaveSorteada: Buffer | null = null;

/** A chave que assina os desafios: derivada do segredo do servidor, ou sorteada quando o processo sobe. */
export function chaveDosDesafios(segredo: string | undefined = process.env.ALUMIA_IMPRESSAO_SEGREDO): Buffer {
  if (segredo && segredo.length >= TAMANHO_MINIMO_DO_SEGREDO) return createHmac("sha256", segredo).update("alumia:porta:desafio").digest();
  chaveSorteada ??= randomBytes(32);
  return chaveSorteada;
}

const b64 = (b: Buffer) => b.toString("base64url");
const assinar = (corpo: string, chave: Buffer) => b64(createHmac("sha256", chave).update(corpo).digest());

export interface DesafioEmitido {
  desafio: string;
  dificuldade: number;
  vence: number;
}

/** Emite um desafio para o momento, com a dificuldade dada (entre a base e o teto), que vence em 10 minutos. */
export function emitirDesafio(momento: MomentoDaPorta, dificuldade: number, chave: Buffer = chaveDosDesafios(), agora: number = Date.now()): DesafioEmitido {
  const d = Math.max(DIFICULDADE_BASE, Math.min(DIFICULDADE_MAXIMA, Math.floor(dificuldade)));
  const vence = agora + PRAZO_DO_DESAFIO_MS;
  const corpo = `p1.${momento}.${d}.${vence}.${b64(randomBytes(16))}`;
  return { desafio: `${corpo}.${assinar(corpo, chave)}`, dificuldade: d, vence };
}

export type ConferenciaDoDesafio =
  | { ok: true; selo: string; vence: number; dificuldade: number }
  | { ok: false; motivo: "desafio_invalido" | "desafio_vencido" | "resposta_errada" };

/**
 * Confere o desafio e a resposta: a assinatura (comparação em tempo constante), o momento, o prazo e os bits zero do SHA-256.
 * Devolve o selo (SHA-256 do desafio, em hexadecimal), que o banco guarda até o prazo para o desafio não valer duas vezes.
 */
export function conferirDesafio(desafio: unknown, resposta: unknown, momento: MomentoDaPorta, chave: Buffer = chaveDosDesafios(), agora: number = Date.now()): ConferenciaDoDesafio {
  if (typeof desafio !== "string" || desafio.length > 200) return { ok: false, motivo: "desafio_invalido" };
  const partes = desafio.split(".");
  if (partes.length !== 6 || partes[0] !== "p1") return { ok: false, motivo: "desafio_invalido" };
  const [, m, dTexto, venceTexto, sorteio, assinatura] = partes;
  if (!(MOMENTOS as readonly string[]).includes(m) || m !== momento || !/^\d{1,2}$/.test(dTexto) || !/^\d{13}$/.test(venceTexto) || !/^[A-Za-z0-9_-]{22}$/.test(sorteio)) {
    return { ok: false, motivo: "desafio_invalido" };
  }
  const esperada = Buffer.from(assinar(partes.slice(0, 5).join("."), chave));
  const veio = Buffer.from(assinatura);
  if (esperada.length !== veio.length || !timingSafeEqual(esperada, veio)) return { ok: false, motivo: "desafio_invalido" };
  const dificuldade = Number(dTexto);
  const vence = Number(venceTexto);
  if (dificuldade < DIFICULDADE_BASE || dificuldade > DIFICULDADE_MAXIMA) return { ok: false, motivo: "desafio_invalido" };
  if (vence < agora || vence > agora + PRAZO_DO_DESAFIO_MS + 60_000) return { ok: false, motivo: "desafio_vencido" };
  if (!respostaBemFormada(resposta)) return { ok: false, motivo: "resposta_errada" };
  const resumo = createHash("sha256").update(textoDaTentativa(desafio, resposta)).digest();
  if (zerosIniciais(resumo) < dificuldade) return { ok: false, motivo: "resposta_errada" };
  return { ok: true, selo: createHash("sha256").update(desafio).digest("hex"), vence, dificuldade };
}

/**
 * O resumo do freio por rede: SHA-256 de "momento + hora + impressão". Muda a cada hora e não volta à impressão do painel: o
 * banco conta quantas vezes a mesma rede passou nesta hora sem poder ligar uma hora à outra. Sem impressão, nulo.
 */
export function chaveDoFreio(impressao: string | null, momento: MomentoDaPorta, agora: number = Date.now()): string | null {
  if (!impressao || !/^[0-9a-f]{64}$/.test(impressao)) return null;
  const hora = new Date(Math.floor(agora / 3_600_000) * 3_600_000).toISOString();
  return createHash("sha256").update(`alumia:porta:freio:${momento}:${hora}:${impressao}`).digest("hex");
}

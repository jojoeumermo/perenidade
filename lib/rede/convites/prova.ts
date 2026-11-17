// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A prova de trabalho da porta de entrada da Alumia: o que o servidor e o aparelho combinam (supabase/migracoes/
// 20261114-alumia-o8-porta.sql). Nada de captcha de fora: o servidor emite um desafio assinado e com prazo; o aparelho procura um
// número que, junto do desafio, dê um SHA-256 começando com N bits zero. Para quem pede uma vez, é um segundo; para quem quer
// criar mil contas, são mil vezes o trabalho, e N sobe com a pressão (a mesma rede de novo, a casa perto do teto da hora).
// Sem os atalhos "@/" de propósito: `npm run testar:alumia-o8-porta` roda este arquivo direto no Node.

/**
 * O momento em que a porta confere: antes de criar a conta, antes do pedido de entrada, antes de entrar com a senha e antes de
 * mandar um e-mail (a confirmação de novo ou o link de senha nova). Os dois últimos são da onda 9 (sem o desafio de terceiros).
 */
export type MomentoDaPorta = "conta" | "pedido" | "entrar" | "aviso";

export const MOMENTOS: readonly MomentoDaPorta[] = ["conta", "pedido", "entrar", "aviso"];

/** Os momentos que contam no freio próprio (public.alumia_porta_passar), fora do teto da casa. */
export const MOMENTOS_SEM_TETO: readonly MomentoDaPorta[] = ["entrar", "aviso"];

/** A dificuldade de quem chega sem pressão nenhuma (2^16 tentativas em média: perto de um segundo num aparelho comum). */
export const DIFICULDADE_BASE = 16;
/** A dificuldade quando o servidor não consegue medir a pressão (banco fora do ar): mais alta, por cautela. */
export const DIFICULDADE_SEM_MEDIDA = 18;
/** O teto: 2^22 tentativas em média (de dez segundos a um minuto). Mais que isso cansaria quem só quer entrar. */
export const DIFICULDADE_MAXIMA = 22;
/** Quanto tempo o desafio vale depois de emitido. */
export const PRAZO_DO_DESAFIO_MS = 10 * 60_000;

/** A pressão que o banco devolve (public.alumia_cadastro_pressao). */
export interface PressaoDaPorta {
  /** Quantas vezes esta rede passou nesta hora, neste momento. */
  rede: number;
  rede_teto: number;
  /** Quantas contas (ou pedidos) a casa recebeu nesta hora. */
  casa: number;
  casa_teto: number;
}

/**
 * A dificuldade para a pressão de agora. Cada passagem anterior da mesma rede nesta hora soma 1 (até 4); a casa acima de metade
 * do teto da hora soma 1, acima de três quartos soma 2, acima de 90% soma 3. Sem medida, DIFICULDADE_SEM_MEDIDA.
 */
export function dificuldadeDaPressao(p: PressaoDaPorta | null | undefined): number {
  if (!p) return DIFICULDADE_SEM_MEDIDA;
  const rede = Math.max(0, Math.min(4, Math.floor(Number(p.rede) || 0)));
  const teto = Math.max(1, Number(p.casa_teto) || 1);
  const fracao = Math.max(0, Number(p.casa) || 0) / teto;
  const casa = fracao >= 0.9 ? 3 : fracao >= 0.75 ? 2 : fracao >= 0.5 ? 1 : 0;
  return Math.min(DIFICULDADE_MAXIMA, DIFICULDADE_BASE + rede + casa);
}

/** Quantos bits zero há no começo do resumo. */
export function zerosIniciais(bytes: Uint8Array): number {
  let n = 0;
  for (const b of bytes) {
    if (b === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(b) - 24;
  }
  return n;
}

/** O texto que entra no SHA-256: o desafio inteiro, dois-pontos, a resposta (um número em base 36). */
export function textoDaTentativa(desafio: string, resposta: string): string {
  return `${desafio}:${resposta}`;
}

/** A resposta tem a forma certa? (um número em base 36, de 1 a 12 letras) */
export function respostaBemFormada(resposta: unknown): resposta is string {
  return typeof resposta === "string" && /^[0-9a-z]{1,12}$/.test(resposta);
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Volta para casa" (Prompt 4, item 8): a pessoa marca "me avise se eu não chegar em 40 min". O CRONÔMETRO FICA NO APARELHO: o servidor
// não sabe que ele existe. Se o prazo vence sem "Cheguei", o aparelho mostra um último aviso (2 min para confirmar) e, sem resposta,
// manda o pedido de ajuda do item 7 (a posição cifrada para o círculo de confiança). "Cheguei" pode mandar o "Estou bem" do modo ato
// (public.alumia_ato_estou_bem, o recado fixo que já existe para os contatos de segurança).
//
// Limite honesto: o aparelho só manda se a Alumia estiver aberta (ou for aberta de novo) depois do prazo. Quando ela abre depois do
// prazo, o último aviso aparece na hora, com os mesmos 2 min.
// Sem "@/": roda no Node nos testes.

/** O que fica guardado neste aparelho (o localStorage, numa chave "lucia-…", que o Sair rápido apaga). Nada de posição. */
export interface Volta {
  /** Quando começou e quando vence (relógio deste aparelho). */
  comecou: number;
  ate: number;
}

/** As escolhas prontas da tela (minutos). */
export const MINUTOS_DA_VOLTA: readonly number[] = [20, 40, 60, 90];
export const MENOR_VOLTA_MIN = 5;
export const MAIOR_VOLTA_MIN = 12 * 60;
/** Depois do prazo, quanto tempo o último aviso espera o "Cheguei" antes de mandar o pedido de ajuda. */
export const ULTIMO_AVISO_MS = 2 * 60_000;
export const CHAVE_DA_VOLTA = "lucia-alumia-perto-volta";

const minutosOk = (m: number) => Number.isInteger(m) && m >= MENOR_VOLTA_MIN && m <= MAIOR_VOLTA_MIN;

export function comecarVolta(minutos: number, agora: number): Volta {
  if (!minutosOk(minutos)) throw new Error("volta_invalida");
  return { comecou: agora, ate: agora + minutos * 60_000 };
}

/** Mais tempo ("ainda não cheguei"): conta a partir de agora, nunca passa de 12 h desde o começo. */
export function maisTempo(v: Volta, minutos: number, agora: number): Volta {
  if (!minutosOk(minutos)) throw new Error("volta_invalida");
  return { comecou: v.comecou, ate: Math.min(Math.max(v.ate, agora) + minutos * 60_000, v.comecou + MAIOR_VOLTA_MIN * 60_000 + ULTIMO_AVISO_MS) };
}

export type FaseDaVolta =
  /** Contando: falta tanto para vencer. */
  | { fase: "contando"; faltaMs: number }
  /** Venceu: o último aviso, com tanto para mandar o pedido de ajuda. */
  | { fase: "ultimo_aviso"; faltaMs: number }
  /** Hora de mandar o pedido de ajuda. */
  | { fase: "mandar" };

export function faseDaVolta(v: Volta, agora: number): FaseDaVolta {
  if (agora < v.ate) return { fase: "contando", faltaMs: v.ate - agora };
  const manda = v.ate + ULTIMO_AVISO_MS;
  if (agora < manda) return { fase: "ultimo_aviso", faltaMs: manda - agora };
  return { fase: "mandar" };
}

/**
 * Lê o que estava guardado. null em qualquer dúvida. Um prazo que venceu há mais de 12 h (o aparelho ficou desligado) também volta
 * null e é descartado: quem abre a Alumia agora está mexendo no aparelho, e um pedido de ajuda de tanto tempo atrás só assustaria.
 * Vencido há menos que isso, a fase é o último aviso (ou "mandar"), e a tela pergunta antes de mandar.
 */
export function lerVolta(texto: string | null, agora: number): Volta | null {
  if (!texto) return null;
  try {
    const v = JSON.parse(texto) as Partial<Volta>;
    if (!v || typeof v !== "object" || Object.keys(v).some((k) => k !== "comecou" && k !== "ate")) return null;
    if (typeof v.comecou !== "number" || typeof v.ate !== "number" || !Number.isFinite(v.comecou) || !Number.isFinite(v.ate)) return null;
    if (v.ate <= v.comecou || v.ate - v.comecou > 2 * MAIOR_VOLTA_MIN * 60_000 + ULTIMO_AVISO_MS + 60_000) return null;
    if (agora - v.ate > MAIOR_VOLTA_MIN * 60_000) return null;
    return { comecou: v.comecou, ate: v.ate };
  } catch {
    return null;
  }
}

/**
 * Ao abrir a Alumia de novo (a aba fechou ou o aparelho dormiu): se o prazo já venceu, o último aviso começa AGORA, com os 2 min
 * inteiros (o pedido de ajuda nunca sai sem a pessoa ter tido a chance de dizer "Cheguei" com a tela na frente).
 */
export function retomarVolta(v: Volta, agora: number): Volta {
  return agora >= v.ate ? { comecou: v.comecou, ate: agora } : v;
}

export const guardarVolta =(v: Volta): string => JSON.stringify({ comecou: v.comecou, ate: v.ate });

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras do Farol do ato e da Corrente de solidariedade (ALUMIA-FUNCOES-E-IDEIAS §2.1, ideias 1 e 7). As mesmas do banco
// (supabase/migracoes/20261110-alumia-atos.sql); o teste scripts/testar-alumia-atos-banco.mjs compara as duas. Sem "@/".
import { MINIMO_PARA_ACENDER } from "../mosaico";
import type { Corrente, EstadoDoFarol, FarolDoAto } from "../tipos-atos";
import { ESTADOS_DO_FAROL } from "../tipos-atos";

/**
 * Os elos fechados da corrente: nula abaixo de 3 respostas (agregado só a partir de 3); senão respostas ÷ meta, PARA BAIXO em
 * passos de 10 %, entre 10 % e 100 %. A mesma conta de interno.rede_corrente_elos.
 */
export function elosDaCorrente(respostas: number | null | undefined, meta: number): number | null {
  if (respostas == null || !Number.isFinite(respostas) || respostas < MINIMO_PARA_ACENDER) return null;
  const passos = Math.min(10, Math.max(1, Math.floor((respostas * 10) / Math.max(3, meta || 3))));
  return passos / 10;
}

/** Desconfia do servidor: só passos de 10 % (um número de pessoas vira nulo). */
export function elosValidos(e: unknown): number | null {
  if (typeof e !== "number" || !Number.isFinite(e)) return null;
  const passos = Math.round(e * 10);
  return passos >= 1 && passos <= 10 && Math.abs(e * 10 - passos) < 1e-6 ? passos / 10 : null;
}

/** Limpa a corrente que veio do servidor: elos em passos, total só se for número, texto e cidade curtos. */
export function limparCorrente(k: Corrente): Corrente {
  return {
    ...k,
    texto: String(k.texto ?? "").slice(0, 140),
    cidade: String(k.cidade ?? "").slice(0, 80),
    meta: Number.isFinite(k.meta) ? Math.max(3, Math.floor(k.meta)) : 3,
    elos: elosValidos(k.elos),
    fechada: !!k.fechada,
    vou_eu: !!k.vou_eu,
    total: typeof k.total === "number" ? k.total : null,
    org: { handle: k.org?.handle ?? null, nome: String(k.org?.nome ?? "") },
  };
}

export const estadoValido = (e: unknown): e is EstadoDoFarol => typeof e === "string" && (ESTADOS_DO_FAROL as readonly string[]).includes(e);

/** Limpa o farol que veio do servidor (estado desconhecido vira tranquilo; texto só no ponto 2). */
export function limparFarol(f: FarolDoAto | null): FarolDoAto | null {
  if (!f || typeof f !== "object") return null;
  const estado = estadoValido(f.estado) ? f.estado : "tranquilo";
  const pendente = f.pendente && estadoValido(f.pendente.estado)
    ? { estado: f.pendente.estado, texto: String(f.pendente.texto ?? "").slice(0, 140), meu: !!f.pendente.meu, expira_em: String(f.pendente.expira_em ?? "") }
    : null;
  return { estado, texto: estado === "ponto2" ? String(f.texto ?? "").slice(0, 140) : "", mudado_em: f.mudado_em ?? null, coordena: !!f.coordena, pendente };
}

/** Quantos elos desenhar fechados (de `total` elos) para uma proporção. */
export function elosFechados(elos: number | null, total = 10): number {
  return elos === null ? 0 : Math.round(elos * total);
}

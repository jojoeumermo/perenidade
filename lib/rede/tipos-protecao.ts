// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos da proteção contra ataque (onda 9, frente 9A; supabase/migracoes/20261115-alumia-o9-protecao.sql). Sem "@/" de propósito
// (os testes do banco também leem daqui).

/** Quanto tempo a blindagem dura: 24 horas ou 7 dias. */
export const HORAS_DA_BLINDAGEM = [24, 168] as const;
export type HorasDaBlindagem = (typeof HORAS_DA_BLINDAGEM)[number];

/** Quem pode mencionar ou marcar: todos, quem eu sigo ou ninguém. */
export const MENCAO = ["todos", "seguindo", "ninguem"] as const;
export type QuemPode = (typeof MENCAO)[number];

/** A situação da proteção da própria pessoa (rede_o9_protecao). */
export interface SituacaoDaProtecao {
  /** Até quando a blindagem vale; nulo quando está desligada. */
  blindagem_ate: string | null;
  mencao_quem: QuemPode;
  marcar_quem: QuemPode;
  marcar_aprovar: boolean;
  /** Quantas pessoas ela restringiu (só ela vê). */
  restritos: number;
  marcacoes_pendentes: number;
}

/** Uma pessoa que a própria pessoa restringiu. */
export interface Restrita {
  handle: string;
  codinome: string;
  desde: string;
}

/** Uma marcação esperando o aceite. */
export interface MarcacaoPendente {
  post: string;
  codinome: string;
  handle: string | null;
  trecho: string;
  criado_em: string;
}

/** O que o cartão precisa saber de um post (rede_o9_cartoes). */
export interface ProtecaoDoCartao {
  /** A resposta está recolhida para alguém: o carimbo "aguardando" que todos veem. */
  aguardando: boolean;
  /** Recolhida para quem está vendo. */
  recolhida: boolean;
  /** Quem está vendo restringiu a autora e é dona da conversa: abre e libera. */
  dona: boolean;
  liberada: boolean;
  /** O post cita um post de quem está vendo: pode desvincular. */
  citacao_minha: boolean;
  /** A citação foi desvinculada por quem foi citada. */
  solta: boolean;
  /** Quem está vendo restringiu a autora. */
  restringi: boolean;
  marcacoes: { handle: string; codinome: string }[];
  minha_marcacao: "pendente" | "aprovada" | null;
}

export const CARTAO_VAZIO: ProtecaoDoCartao = {
  aguardando: false, recolhida: false, dona: false, liberada: false, citacao_minha: false, solta: false, restringi: false, marcacoes: [], minha_marcacao: null,
};

/** Até quando a blindagem vai, ligada agora por estas horas. */
export function ateQuando(horas: number, agora: Date = new Date()): Date {
  return new Date(agora.getTime() + horas * 3600_000);
}

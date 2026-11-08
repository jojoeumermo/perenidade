// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As contas puras da tela A Frente (F6 da Escola de Formação, prancha Frente): os 7 botões das frentes de atuação (a do
// militante em destaque), o número de cada uma (só a soma do banco, public.escola_frentes_somadas, que já esconde frente
// com menos de 3 pessoas) e a situação do cartão da Assembleia do semestre.
// Puro e sem "@/" de propósito: scripts/testar-escola-frente.mjs roda este arquivo direto no Node.

import { FRENTES_DE_ATUACAO, type FrenteDeAtuacao, type FrentesSomadas } from "../../../lib/escola/contratos";

export interface FrenteNaTela {
  frente: FrenteDeAtuacao;
  sua: boolean;
  /** Quantos militantes atuam nela, ou null (sem soma, ou menos de 3: o banco não conta). */
  conta: number | null;
}

/** As 7 frentes na ordem do contrato, com a sua marcada e a soma de cada uma (só número inteiro positivo vale). */
export function frentesNaTela(sua: FrenteDeAtuacao | null, somadas: FrentesSomadas | null): FrenteNaTela[] {
  return FRENTES_DE_ATUACAO.map((frente) => {
    const n = somadas?.[frente];
    return { frente, sua: frente === sua, conta: typeof n === "number" && Number.isInteger(n) && n >= 3 ? n : null };
  });
}

/** Tocar numa frente: escolhe essa; tocar na que já é a sua tira a escolha (null). */
export const proximaEscolha = (sua: FrenteDeAtuacao | null, tocada: FrenteDeAtuacao): FrenteDeAtuacao | null => (sua === tocada ? null : tocada);

/** O que a leitura de escola_eu (F1) trouxe para esta tela: null enquanto carrega. */
export type EuLido = null | { ok: true; dados: { militante: boolean; frente?: FrenteDeAtuacao | null } } | { ok: false };

/**
 * Qual frente aparece como "a sua" e se já dá para tocar. A casca (escola_eu lido UMA vez por aba) fica velha depois de
 * uma escolha: ao voltar à tela, ela ainda diz a frente de antes. Por isso: o que foi escolhido nesta montagem vale
 * primeiro; depois, o escola_eu lido de novo ao montar; a casca é só o que se mostra enquanto ele não chega (e o reserva se
 * a leitura falhar). Enquanto carrega, "pronta" é false: um toque agora mandaria a troca errada (proximaEscolha).
 */
export function frenteMarcada(escolhidaAqui: FrenteDeAtuacao | null | undefined, doBanco: EuLido, daCasca: FrenteDeAtuacao | null): { frente: FrenteDeAtuacao | null; pronta: boolean } {
  if (escolhidaAqui !== undefined) return { frente: escolhidaAqui, pronta: true };
  if (doBanco === null) return { frente: daCasca, pronta: false };
  if (doBanco.ok && doBanco.dados.militante) return { frente: doBanco.dados.frente ?? null, pronta: true };
  return { frente: daCasca, pronta: true };
}

/** O código de recusa do banco vira a chave do texto (i18n/escola/biblioteca, "frente"). */
export function avisoDaEscolha(codigo: string): "ausente" | "semPermissao" | "falha" {
  if (codigo === "banco_desatualizado" || codigo === "ausente") return "ausente";
  if (codigo === "sem_permissao" || codigo === "sem_militancia" || codigo === "entre_primeiro") return "semPermissao";
  return "falha";
}

// ───────────── Assembleia ─────────────

/** O mesmo formato de lib/escola/organizacao.ts (SituacaoDaAssembleia), repetido aqui para este arquivo seguir puro. */
export type SituacaoDaVotacao = "aberta" | "fechada" | "sem-pauta" | "outro-semestre";

export interface CartaoDaAssembleia {
  situacao: "aberta" | "fechada" | "semPauta";
  /** AAAA-MM-DD do último dia da votação, quando aberta. */
  ate: string | null;
  /** A pauta ainda não foi confirmada pela coordenação. */
  aConfirmar: boolean;
}

/** O que o cartão diz, a partir da situação calculada por assembleiaAberta (lib/escola/organizacao.ts). */
export function cartaoDaAssembleia(situacao: SituacaoDaVotacao, pauta: { confirmado: boolean; fechaEm?: string } | null, fimDoSemestre: string | null): CartaoDaAssembleia {
  if (situacao === "sem-pauta" || !pauta) return { situacao: "semPauta", ate: null, aConfirmar: false };
  if (situacao !== "aberta") return { situacao: "fechada", ate: null, aConfirmar: false };
  return { situacao: "aberta", ate: pauta.fechaEm ?? fimDoSemestre, aConfirmar: !pauta.confirmado };
}

/** "domingo, 15 de novembro" no idioma da página (o dia é uma data, sem hora: lido em UTC para não trocar de dia). */
export function diaPorExtenso(lang: string, dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dia;
  const local = lang === "pt" ? "pt-BR" : lang;
  return new Intl.DateTimeFormat(local, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
}

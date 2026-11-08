// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conta do Quadro da semana e do percurso (tela Hoje), pura: recebe os cadernos (cadernos-do-quadro.ts) e as aulas
// concluídas NESTE aparelho (o mesmo progresso de /trilhas) e devolve o que mostrar. Sem rede e sem servidor.

export interface AulaParaConta {
  id: string;
}
export interface CadernoParaConta<A extends AulaParaConta = AulaParaConta> {
  numero: number;
  aulas: A[];
}

export type SituacaoDoCaderno = "feito" | "aberto" | "preparacao";

/** Caderno sem aula escrita ainda está "em preparação" e não prende o percurso. */
export function situacoes(cadernos: readonly CadernoParaConta[], feitas: ReadonlySet<string>): SituacaoDoCaderno[] {
  return cadernos.map((c) => (c.aulas.length === 0 ? "preparacao" : c.aulas.every((a) => feitas.has(a.id)) ? "feito" : "aberto"));
}

/** O caderno de agora: o primeiro com aula por fazer. -1 quando todas as aulas escritas estão feitas. */
export const cadernoAtual = (s: readonly SituacaoDoCaderno[]) => s.indexOf("aberto");

export interface LinhaDoQuadro<A> {
  aula: A;
  feita: boolean;
  agora: boolean;
}

/**
 * As linhas de aula do quadro: até 2 feitas logo antes da primeira por fazer (riscadas), a de agora e as seguintes,
 * até "vagas" linhas no total.
 */
export function linhasDoQuadro<A extends AulaParaConta>(caderno: CadernoParaConta<A>, feitas: ReadonlySet<string>, vagas: number): LinhaDoQuadro<A>[] {
  const primeira = caderno.aulas.findIndex((a) => !feitas.has(a.id));
  if (primeira < 0) return [];
  const inicio = Math.max(0, primeira - 2);
  return caderno.aulas.slice(inicio, inicio + Math.max(1, vagas)).map((aula, i) => ({ aula, feita: feitas.has(aula.id), agora: inicio + i === primeira }));
}

/** Quanto da linha do percurso fica vermelha (0 a 1): até o posto do caderno atual. */
export function fracaoDoPercurso(total: number, atual: number, s: readonly SituacaoDoCaderno[]): number {
  if (total < 2) return 0;
  const ate = atual >= 0 ? atual : s.lastIndexOf("feito");
  return Math.max(0, ate) / (total - 1);
}

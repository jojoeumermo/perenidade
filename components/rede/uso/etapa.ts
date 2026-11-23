// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A situação do pedido de entrada em passos (R1), sem tela: a ordem e o passo de agora. Sem "@/" de propósito: roda no Node
// nos testes (scripts/testar-r1-uso-telas.mjs).

export type EtapaDoPedido = "na_fila" | "em_analise" | "aprovada" | "recusada";

/** A ordem dos passos: o último é "aprovado" ou "recusado", conforme o caso (os dois nunca aparecem juntos como feitos). */
export function passosDoPedido(etapa: EtapaDoPedido): { nome: EtapaDoPedido; estado: "feito" | "agora" | "falta" }[] {
  const fim: EtapaDoPedido = etapa === "recusada" ? "recusada" : "aprovada";
  const ordem: EtapaDoPedido[] = ["na_fila", "em_analise", fim];
  const agora = ordem.indexOf(etapa);
  return ordem.map((nome, i) => ({ nome, estado: i < agora ? "feito" : i === agora ? "agora" : "falta" }));
}

/** A etapa que a tela mostra: a do banco, ou, num banco de antes do R1 (sem "etapa"), "em análise". */
export function etapaDe(eu: { situacao?: string; etapa?: string | null }): EtapaDoPedido | null {
  const e = eu.etapa ?? eu.situacao;
  return e === "na_fila" || e === "em_analise" || e === "aprovada" || e === "recusada" ? e : null;
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

/**
 * O painel da Escola de Formação, para a coordenação (PLANO-ESCOLA.md, F4): militantes pelo codinome, núcleos,
 * acompanhantes, bancas de passagem, a pergunta geradora da semana e os recados. A F1 só cria este ESBOÇO e a entrada
 * "Escola de Formação" no painel (components/painel/casca/Dentro.tsx, carregada com next/dynamic); a F4 preenche, contra
 * as funções de lib/escola/contratos.ts (escola_militantes_listar, escola_militante_ajustar, escola_acompanhar,
 * escola_banca_marcar, escola_banca_decidir, escola_pergunta_definir, escola_recado_salvar).
 */
export function PainelDaEscola() {
  return (
    <p role="status" data-painel-da-escola="esboco">
      Esta seção está sendo montada. Por enquanto, quem entra na Escola é decidido em Pessoas: pôr a pessoa no departamento Revolucionários abre a Escola para ela.
    </p>
  );
}

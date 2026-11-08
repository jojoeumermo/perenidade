// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// ESBOÇO da F2 (PLANO-ESCOLA.md, seção 6, "Slot da F3 na F2"): a "Aula gravada" de uma aula do caderno. A aula da Escola
// (components/escola/aula/AulaDaEscola.tsx) importa este arquivo com next/dynamic; a F3 SUBSTITUI este arquivo inteiro
// pelo de verdade (lê public.escola_gravacoes pelo contrato em lib/escola/contratos.ts e mostra o tocador do YouTube sem
// cookies, depois do clique, só para militante). É o único arquivo combinado entre as duas frentes. Mantenha a
// exportação padrão e as propriedades abaixo.

import type { Locale } from "@/i18n/config";

export interface PropsDaGravacao {
  lang: Locale;
  /** O slug do caderno (/escola/formacao/[caderno]). */
  caderno: string;
  /** O lessonId da aula ("trilha/aula", o mesmo de /trilhas). */
  aula: string;
  /** "caderno/aula", no formato de interno.aulas_ao_vivo.caderno_aula (migração da F3). */
  cadernoAula: string;
}

/** Enquanto a F3 não chega, não há gravação nenhuma: nada aparece. */
export default function GravacaoDaAula(props: PropsDaGravacao): null {
  void props;
  return null;
}

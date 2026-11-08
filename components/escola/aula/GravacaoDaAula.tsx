// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { GravadaNaAula } from "@/components/escola/aovivo/GravadaNaAula";
import { cadernoPorSlug, pedacoDaAula } from "@/lib/escola/contratos";
import { textosDoAoVivo } from "@/i18n/escola/aovivo";
import type { Locale } from "@/i18n/config";

/** O contrato do esboço da F2 (a página da aula chama `<GravacaoDaAula lang caderno aula cadernoAula />`). */
export interface PropsDaGravacao {
  lang: Locale;
  /** O slug do caderno (/escola/formacao/[caderno]). */
  caderno: string;
  /** O lessonId da aula ("trilha/aula", o mesmo de /trilhas). */
  aula: string;
  /**
   * "caderno/aula", no formato de interno.aulas_ao_vivo.caderno_aula. Opcional e só conferido: a chave é sempre
   * remontada aqui a partir do caderno e do lessonId, do mesmo jeito que o painel grava (lib/escola/aovivo.ts, cadernoAulaDe; aqui sem importar aquele arquivo, que fala com o banco).
   */
  cadernoAula?: string;
}

/** O mesmo formato do check de interno.aulas_ao_vivo.caderno_aula (migração 20261108-escola-aovivo.sql). */
const CADERNO_AULA = /^[a-z0-9-]{2,80}\/[a-z0-9-]{2,120}$/;

/**
 * O lugar da "Aula gravada" na aula do caderno (/escola/formacao/[caderno]/[aula]). Combinado no PLANO-ESCOLA.md
 * (seção 6, "Slot da F3 na F2"). A F3 preenche: as aulas ao vivo da Escola ligadas a esta aula
 * (aulas_ao_vivo.caderno_aula = "<caderno>/<pedaço do endereço>") que terminaram com vídeo, lidas no navegador pela
 * função escola_gravacoes (só militante). Sem gravação, não aparece nada.
 *
 * Componente de servidor: só escolhe os textos (públicos, de interface). O id do vídeo nunca passa pelo servidor.
 */
export function GravacaoDaAula({ lang, caderno, aula }: PropsDaGravacao) {
  const doCaderno = cadernoPorSlug(caderno);
  if (!doCaderno || !/^[^/]+\/[^/]+$/.test(aula)) return null;
  const chave = `${caderno}/${pedacoDaAula(doCaderno, aula)}`;
  if (!CADERNO_AULA.test(chave)) return null;
  const t = textosDoAoVivo(lang);
  return <GravadaNaAula cadernoAula={chave} lang={lang} t={{ ...t.gravacao, assistir: t.sala.assistirGravada, aviso: t.sala.avisoTocador }} />;
}

export default GravacaoDaAula;

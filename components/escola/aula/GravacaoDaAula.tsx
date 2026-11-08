// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { GravadaNaAula } from "@/components/escola/aovivo/GravadaNaAula";
import { textosDoAoVivo } from "@/i18n/escola/aovivo";
import type { Locale } from "@/i18n/config";

/**
 * O lugar da "Aula gravada" na aula do caderno (/escola/formacao/[caderno]/[aula]). Combinado no PLANO-ESCOLA.md
 * (seção 6, "Slot da F3 na F2"): a página da aula da F2 importa este componente (com dynamic) e passa o idioma, o slug
 * do caderno e o pedaço da aula no endereço. A F3 preenche: as aulas ao vivo da Escola ligadas a esta aula
 * (aulas_ao_vivo.caderno_aula = "caderno/aula") que terminaram com vídeo, lidas no navegador pela função
 * escola_gravacoes (só militante). Sem gravação, não aparece nada.
 *
 * Componente de servidor: só escolhe os textos (públicos, de interface). O id do vídeo nunca passa pelo servidor.
 */
export function GravacaoDaAula({ lang, caderno, aula }: { lang: Locale; caderno: string; aula: string }) {
  if (!/^[a-z0-9-]{2,80}$/.test(caderno) || !/^[a-z0-9-]{2,120}$/.test(aula)) return null;
  const t = textosDoAoVivo(lang);
  return <GravadaNaAula cadernoAula={`${caderno}/${aula}`} lang={lang} t={{ ...t.gravacao, assistir: t.sala.assistirGravada, aviso: t.sala.avisoTocador }} />;
}

export default GravacaoDaAula;

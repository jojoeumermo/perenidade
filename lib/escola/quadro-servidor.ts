// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O quadro de avisos da página inicial (E4-09), separado de lib/escola/campus-servidor.ts: a turma do mês
// (lib/turma-do-mes.ts) lê o disco e as trilhas, e o campus entra no layout raiz. Junto dele, o rastreio de arquivos da
// Vercel levava a pasta content/ inteira em quase todas as funções (scripts/conferir-rastreio.mjs).
import type { Locale } from "@/i18n/config";
import { AVISOS, eventosParaOQuadro, textosDoCampus } from "@/lib/escola/campus-servidor";
import { textosDaPresenca } from "@/lib/escola/textos-da-presenca";
import { mesesDaTurma, turmaDoMes } from "@/lib/turma-do-mes";

/**
 * O que o quadro de avisos da página inicial recebe do servidor (E4-09, D1-4): os avisos da coordenação, os eventos do
 * calendário, a turma do mês deste mês e do seguinte e os textos do idioma. O navegador escolhe o que vale hoje.
 */
export function quadroDaInicial(lang: Locale) {
  const c = textosDoCampus(lang);
  const turmas = mesesDaTurma()
    .map((mes) => turmaDoMes(lang, mes))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((t) => ({ mes: t.mes, titulo: t.titulo }));
  return { avisos: AVISOS, eventos: eventosParaOQuadro(lang), turmas, s: c.quadro, sCal: c.calendario, sPresenca: textosDaPresenca(lang), lang };
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do servidor do campus e do calendário (E4-09; docs/escola/campus.md): os textos dos 6 idiomas (o navegador
// recebe só o do idioma, por props), o mapa montado sobre a lista do "Mais" e os semestres do calendário com as datas
// já escritas no idioma (para o HTML do servidor e o do navegador serem iguais na hidratação).
// Só para o servidor: importa os seis JSON de textos e lib/secoes-do-site.ts.

import en from "@/i18n/escola/campus/en.json";
import es from "@/i18n/escola/campus/es.json";
import fr from "@/i18n/escola/campus/fr.json";
import pt from "@/i18n/escola/campus/pt.json";
import ru from "@/i18n/escola/campus/ru.json";
import zh from "@/i18n/escola/campus/zh.json";
import { htmlLang, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { FERIADOS, eventosDoSemestre, type Evento, janelaDoSemestre, semestrePorId, semestresDoCalendario } from "@/lib/escola/calendario";
import { montarCampus, type PredioDoMapa } from "@/lib/escola/campus";
import { type Dicionarios, escolher, preencher } from "@/lib/escola/textos";
import { textosDaPresenca } from "@/lib/escola/matricula-servidor";
import { hojeEmBrasilia, type Semestre } from "@/lib/escola/tempo";
import { mesesDaTurma, turmaDoMes } from "@/lib/turma-do-mes";
import { secoesDoSite } from "@/lib/secoes-do-site";
import avisosPadrao from "@/content/escola/avisos.json";

export type TextosDoCampus = typeof pt;
const TEXTOS: Dicionarios<TextosDoCampus> = { pt, en, es, fr, ru, zh };
export const textosDoCampus = (lang: string): TextosDoCampus => escolher(TEXTOS, lang);

/** Os prédios com os itens do "Mais" desta montagem, no idioma. */
export function campusDoSite(lang: Locale, t: Dict): PredioDoMapa[] {
  const itens = secoesDoSite(lang, t).flatMap((s) => s.items);
  return montarCampus(itens, textosDoCampus(lang).predios);
}

/** "1º semestre de 2027" no idioma. */
export function nomeDoSemestre(id: string, s: TextosDoCampus["calendario"]): string {
  const [ano, n] = id.split(".");
  return preencher(n === "2" ? s.semestre2 : s.semestre1, { ano });
}

export interface EventoNaTela extends Evento {
  dataTexto: string;
  ateTexto?: string;
  consultadoTexto?: string;
}

export interface SemestreNaTela {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  /** A janela do calendário (do dia seguinte ao fim do anterior até o fim deste). */
  de: string;
  meses: { mes: string; titulo: string; eventos: EventoNaTela[] }[];
  temAulaMagna: boolean;
}

const formatoDoDia = (lang: Locale) => new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "long", weekday: "short", timeZone: "UTC" });
const formatoDoMes = (lang: Locale) => new Intl.DateTimeFormat(htmlLang[lang], { month: "long", year: "numeric", timeZone: "UTC" });
const formatoCurto = (lang: Locale) => new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const emData = (dia: string) => new Date(`${dia}T12:00:00Z`);

/** Um semestre pronto para a tela: eventos agrupados por mês e datas escritas no idioma (o .ics nasce no clique). */
export function semestreNaTela(semestre: Semestre, lang: Locale, s: TextosDoCampus["calendario"]): SemestreNaTela {
  const eventos = eventosDoSemestre(semestre, undefined, { inicio: s.inicio, fim: s.fim, provas: s.provas });
  const dia = formatoDoDia(lang);
  const mes = formatoDoMes(lang);
  const curto = formatoCurto(lang);
  const meses: SemestreNaTela["meses"] = [];
  for (const e of eventos) {
    const chave = e.data ? e.data.slice(0, 7) : "sem-data";
    let grupo = meses.find((m) => m.mes === chave);
    if (!grupo) {
      grupo = { mes: chave, titulo: e.data ? mes.format(emData(e.data)) : s.aMarcar, eventos: [] };
      meses.push(grupo);
    }
    grupo.eventos.push({
      ...e,
      dataTexto: e.data ? dia.format(emData(e.data)) : s.aMarcar,
      ateTexto: e.ate ? preencher(s.ate, { data: dia.format(emData(e.ate)) }) : undefined,
      consultadoTexto: e.consultadoEm ? curto.format(emData(e.consultadoEm)) : undefined,
    });
  }
  const { de } = janelaDoSemestre(semestre);
  return { id: semestre.id, nome: nomeDoSemestre(semestre.id, s), inicio: semestre.inicio, fim: semestre.fim, de, meses, temAulaMagna: eventos.some((e) => e.tipo === "aula-magna") };
}

/**
 * Os três semestres que a página manda: os dois do calendário no dia da montagem e o seguinte. O navegador escolhe os
 * dois que valem no dia em que a página é aberta (a página é feita uma vez e servida pronta por semanas).
 */
export function semestresNaTela(lang: Locale, hoje: string = hojeEmBrasilia()): SemestreNaTela[] {
  const s = textosDoCampus(lang).calendario;
  const [a, b] = semestresDoCalendario(hoje);
  return [a, b, semestrePorId(b.proximo.id)].map((sem) => semestreNaTela(sem, lang, s));
}

/** Os eventos (sem formatação) do semestre do dia e dos dois seguintes, para o quadro de avisos achar o próximo. */
export function eventosParaOQuadro(lang: Locale, hoje: string = hojeEmBrasilia()): Evento[] {
  const s = textosDoCampus(lang).calendario;
  const [a, b] = semestresDoCalendario(hoje);
  return [a, b, semestrePorId(b.proximo.id)].flatMap((sem) => eventosDoSemestre(sem, undefined, { inicio: s.inicio, fim: s.fim, provas: s.provas }));
}

export interface Aviso {
  id: string;
  texto: string;
  link?: string;
  desde: string;
  ate: string;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
/** Os avisos da coordenação com a forma certa (os que não têm são ignorados, e o teste avisa). */
export const AVISOS: Aviso[] = ((avisosPadrao as { avisos: unknown[] }).avisos ?? []).filter(
  (a): a is Aviso => Boolean(a) && typeof a === "object" && typeof (a as Aviso).id === "string" && typeof (a as Aviso).texto === "string" && DATA.test((a as Aviso).desde) && DATA.test((a as Aviso).ate),
);

export { FERIADOS };

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

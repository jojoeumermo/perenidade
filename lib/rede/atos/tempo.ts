// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As datas dos atos como as pranchas escrevem ("Sexta, 15/11 · 18h", "sex 15/11, 18h", "15 NOV", "era 12/11"), em cada idioma,
// pelo Intl do próprio aparelho. Puro (os testes passam o fuso); sem "@/" de propósito.

export interface OpcoesDeData {
  /** O fuso (IANA). Sem ele, o do aparelho. */
  timeZone?: string;
}

/** As partes de uma data num fuso: dia, mês, ano, hora, minuto e dia da semana (0 = domingo). */
export function partes(iso: string | Date, o: OpcoesDeData = {}) {
  const d = iso instanceof Date ? iso : new Date(iso);
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: o.timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  const semana = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { dia: Number(p.day), mes: Number(p.month), ano: Number(p.year), hora: Number(p.hour) % 24, minuto: Number(p.minute), semana };
}

/** A data é válida? */
export function dataOk(iso: string | null | undefined): iso is string {
  return typeof iso === "string" && iso.length > 0 && Number.isFinite(new Date(iso).getTime());
}

const LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", fr: "fr-FR", ru: "ru-RU", zh: "zh-CN" };
const loc = (lang: string) => LOCALE[lang] ?? "pt-BR";

/** A hora como as pranchas: "18h", "6h", "18h30" (pt, es, fr); "6 PM" (en); "18:00" (ru, zh). */
export function hora(iso: string | Date, lang: string, o: OpcoesDeData = {}): string {
  const p = partes(iso, o);
  if (lang === "pt" || lang === "es" || lang === "fr" || !LOCALE[lang]) return p.minuto ? `${p.hora}h${String(p.minuto).padStart(2, "0")}` : `${p.hora}h`;
  return new Intl.DateTimeFormat(loc(lang), { timeZone: o.timeZone, hour: "numeric", minute: p.minuto || lang !== "en" ? "2-digit" : undefined }).format(new Date(iso));
}

/** O dia da semana: curto ("sex") ou longo ("Sexta"); em português, sem o "-feira" e com a primeira maiúscula no longo. */
export function diaDaSemana(iso: string | Date, lang: string, tamanho: "curto" | "longo", o: OpcoesDeData = {}): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  let t = new Intl.DateTimeFormat(loc(lang), { timeZone: o.timeZone, weekday: tamanho === "curto" ? "short" : "long" }).format(d);
  t = t.replace(/\.$/, "").replace(/-feira$/i, "");
  return tamanho === "longo" ? t.charAt(0).toLocaleUpperCase(loc(lang)) + t.slice(1) : t.toLocaleLowerCase(loc(lang));
}

/** "15/11" (pt, es, fr, ru, zh) ou "11/15" (en). */
export function diaMes(iso: string | Date, lang: string, o: OpcoesDeData = {}): string {
  const p = partes(iso, o);
  const dd = String(p.dia).padStart(2, "0");
  const mm = String(p.mes).padStart(2, "0");
  return lang === "en" ? `${mm}/${dd}` : `${dd}/${mm}`;
}

/** O bloco de data das listas ("15" em cima, "NOV" embaixo). */
export function blocoDaData(iso: string | Date, lang: string, o: OpcoesDeData = {}): { dia: string; mes: string } {
  const p = partes(iso, o);
  const mes = new Intl.DateTimeFormat(loc(lang), { timeZone: o.timeZone, month: "short" })
    .format(iso instanceof Date ? iso : new Date(iso))
    .replace(/\.$/, "")
    .toLocaleUpperCase(loc(lang));
  return { dia: String(p.dia).padStart(2, "0"), mes };
}

/** "sex 15/11, 18h" (cartão do ato na linha). */
export function dataCurta(iso: string, lang: string, o: OpcoesDeData = {}): string {
  return `${diaDaSemana(iso, lang, "curto", o)} ${diaMes(iso, lang, o)}, ${hora(iso, lang, o)}`;
}

/** "Sexta, 15/11 · 18h" (tela dos atos e página do ato). */
export function dataLonga(iso: string, lang: string, o: OpcoesDeData = {}): string {
  return `${diaDaSemana(iso, lang, "longo", o)}, ${diaMes(iso, lang, o)} · ${hora(iso, lang, o)}`;
}

/**
 * A data longa no MEIO de uma frase ("até sexta, 15/11 · 18h"): o dia da semana com minúscula, menos em inglês, que escreve o dia
 * da semana sempre com maiúscula.
 */
export function dataLongaNaFrase(iso: string, lang: string, o: OpcoesDeData = {}): string {
  const t = dataLonga(iso, lang, o);
  return lang === "en" ? t : t.charAt(0).toLocaleLowerCase(loc(lang)) + t.slice(1);
}

/**
 * A hora de saída de uma carona: `hhmm` ("06:30") no DIA DO ATO, no fuso `o.timeZone` (o mesmo em que a tela mostra o ato; sem
 * ele, o do aparelho, como o resto da tela). Se a hora cai depois do começo do ato, é a véspera (o servidor aceita até 24 h antes).
 * Nulo se `hhmm` não serve. Conta o deslocamento do fuso no próprio instante (vale também na troca de horário de verão).
 */
export function horaNoDiaDoAto(inicio: string, hhmm: string, o: OpcoesDeData = {}): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m || !dataOk(inicio)) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const comeco = Date.parse(inicio);
  const dia = partes(inicio, o);
  const noFuso = (ano: number, mes: number, d: number): number => {
    // Chuta como se o fuso fosse UTC e corrige pelo deslocamento visto no chute (duas voltas bastam).
    let t = Date.UTC(ano, mes - 1, d, h, min);
    for (let i = 0; i < 2; i++) {
      const p = partes(new Date(t), o);
      t -= Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto) - Date.UTC(ano, mes - 1, d, h, min);
    }
    return t;
  };
  let t = noFuso(dia.ano, dia.mes, dia.dia);
  if (t > comeco) t = noFuso(dia.ano, dia.mes, dia.dia - 1);
  return new Date(t).toISOString();
}

/** "Sexta, 15 de novembro, 18h" (cartão do ato no computador). */
export function dataPorExtenso(iso: string, lang: string, o: OpcoesDeData = {}): string {
  const dia = new Intl.DateTimeFormat(loc(lang), { timeZone: o.timeZone, day: "numeric", month: "long" }).format(new Date(iso));
  return `${diaDaSemana(iso, lang, "longo", o)}, ${dia}, ${hora(iso, lang, o)}`;
}

/** "sex 18h" (faixa do próximo ato e listas: o dia da semana basta quando é nos próximos dias). */
export function diaEHora(iso: string, lang: string, o: OpcoesDeData = {}): string {
  return `${diaDaSemana(iso, lang, "curto", o)} ${hora(iso, lang, o)}`;
}

/** Quantos dias de calendário (no fuso) de `agora` até `iso`: 0 = hoje, 1 = amanhã, negativo = já foi. */
export function diasAte(iso: string, agora: Date, o: OpcoesDeData = {}): number {
  const a = partes(agora, o);
  const b = partes(iso, o);
  return Math.round((Date.UTC(b.ano, b.mes - 1, b.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)) / 86_400_000);
}

/** O ato ainda está por vir (ou começou há menos de 6 horas, como a aba de chamados de hoje)? */
export function aindaVale(iso: string, agora: number = Date.now()): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > agora - 6 * 3_600_000;
}

/** O valor de um <input type="datetime-local"> a partir de um ISO, no fuso do aparelho ("2026-11-19T06:00"). */
export function paraCampoLocal(iso: string | null): string {
  if (!dataOk(iso)) return "";
  const d = new Date(iso);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** O ISO a partir do valor de um <input type="datetime-local"> (lido no fuso do aparelho); vazio ou inválido dá nulo. */
export function doCampoLocal(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const d = new Date(valor);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

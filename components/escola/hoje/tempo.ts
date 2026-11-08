// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Datas da tela Hoje, sempre no horário de Brasília e no idioma da página. Funções puras (o teste roda no Node).

const LOCALES: Record<string, string> = { pt: "pt-BR", en: "en-GB", es: "es", fr: "fr-FR", ru: "ru-RU", zh: "zh-CN" };
const FUSO = "America/Sao_Paulo";

const local = (lang: string) => LOCALES[lang] ?? "pt-BR";
/** "segunda-feira" vira "segunda", como na prancha (só no português). */
const semFeira = (lang: string, texto: string) => (lang === "pt" ? texto.replace(/-feira/g, "") : texto);

/** "terça, 12 de novembro". */
export function dataDeHoje(lang: string, agora = new Date()): string {
  return semFeira(lang, new Intl.DateTimeFormat(local(lang), { weekday: "long", day: "numeric", month: "long", timeZone: FUSO }).format(agora));
}

/** "terça, 12/11" (a data curta do celular). */
export function dataCurta(lang: string, agora = new Date()): string {
  return semFeira(lang, new Intl.DateTimeFormat(local(lang), { weekday: "long", day: "2-digit", month: "2-digit", timeZone: FUSO }).format(agora));
}

/** A hora em Brasília (0 a 23). */
export function horaEmBrasilia(agora = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: FUSO }).format(agora)) % 24;
}

export type Periodo = "manha" | "tarde" | "noite";
export function periodoDoDia(agora = new Date()): Periodo {
  const h = horaEmBrasilia(agora);
  return h >= 5 && h < 12 ? "manha" : h >= 12 && h < 18 ? "tarde" : "noite";
}

/** A hora curta: "19h" (ou "19h30") no português; "19:00" nos outros idiomas. */
export function horaCurta(lang: string, iso: string): string {
  const d = new Date(iso);
  const [h, m] = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: FUSO }).format(d).split(":");
  if (lang === "pt") return `${Number(h)}h${m === "00" ? "" : m}`;
  return `${h}:${m}`;
}

/** "segunda, 19h": o dia da semana e a hora de um encontro. */
export function diaEHora(lang: string, iso: string): string {
  const dia = semFeira(lang, new Intl.DateTimeFormat(local(lang), { weekday: "long", timeZone: FUSO }).format(new Date(iso)));
  return `${dia}, ${horaCurta(lang, iso)}`;
}

/** AAAA-MM-DD de hoje em Brasília. */
export function hojeISO(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: FUSO }).format(agora);
}

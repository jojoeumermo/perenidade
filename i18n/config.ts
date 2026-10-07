export const locales = ["pt", "en", "es", "zh", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt";

export const isLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value);

/** Nome de cada idioma escrito nele mesmo, para o seletor. */
export const localeNames: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
  zh: "中文",
  ru: "Русский",
};

/** Código usado no atributo lang do HTML e na leitura em voz alta. */
export const htmlLang: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en",
  es: "es",
  zh: "zh-Hans",
  ru: "ru",
};

/** Caminho com o prefixo do idioma. */
export function localePath(lang: string, path: string): string {
  return `/${lang}${path === "/" ? "" : path}`;
}

/** Escolhe a forma certa de plural ("1 aula", "2 aulas", e as três formas do russo). */
export type Forms = { one?: string; few?: string; many?: string; other: string };

export function plural(lang: string, count: number, forms: Forms): string {
  // A regra oficial do português trata o zero como singular ("0 aula"); no uso brasileiro é "0 aulas".
  const rule = count === 0 && lang === "pt" ? "other" : (new Intl.PluralRules(lang).select(count) as keyof Forms);
  return `${count} ${forms[rule] ?? forms.other}`;
}

/** Troca {chave} pelos valores: fill("aula {i} de {n}", { i: 1, n: 4 }). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

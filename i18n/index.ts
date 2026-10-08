import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";
import en from "./en.json";
import es from "./es.json";
import pt from "./pt.json";
import ru from "./ru.json";
import type { Dict } from "./types";
import zh from "./zh.json";

// As formas de plural variam por idioma (o russo tem quatro, o chinês uma), então os tipos
// dos arquivos não são idênticos; a paridade de chaves é conferida por scripts/conferir-i18n.mjs.
const dictionaries = { pt, en, es, zh, ru } as unknown as Record<Locale, Dict>;

export function getDict(lang: Locale): Dict {
  return dictionaries[lang];
}

/** Lê o idioma dos parâmetros da rota; idioma desconhecido vira 404. */
export async function loadLang(params: Promise<{ lang: string }>): Promise<{ lang: Locale; t: Dict }> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { lang, t: dictionaries[lang] };
}

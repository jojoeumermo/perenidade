import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";
import { en } from "./en";
import { es } from "./es";
import { pt, type Dict } from "./pt";
import { ru } from "./ru";
import { zh } from "./zh";

const dictionaries: Record<Locale, Dict> = { pt, en, es, zh, ru };

export function getDict(lang: Locale): Dict {
  return dictionaries[lang];
}

/** Lê o idioma dos parâmetros da rota; idioma desconhecido vira 404. */
export async function loadLang(params: Promise<{ lang: string }>): Promise<{ lang: Locale; t: Dict }> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { lang, t: dictionaries[lang] };
}

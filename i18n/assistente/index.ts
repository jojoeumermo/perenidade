// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Locale } from "@/i18n/config";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos do assistente que fica em todas as páginas (components/assistente/BotaoDoAssistente.tsx), nos 6 idiomas.
// Só o servidor importa este arquivo: o layout passa ao navegador só os textos do idioma da página.

export type TextosDoAssistente = typeof pt;

const TEXTOS: Record<Locale, TextosDoAssistente> = { pt, en, es, fr, zh, ru };

export function textosDoAssistente(lang: Locale): TextosDoAssistente {
  return TEXTOS[lang] ?? pt;
}

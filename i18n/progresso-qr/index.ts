// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Locale } from "@/i18n/config";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos da tela "Levar o progresso para outro aparelho" (components/progresso/LevarProgresso.tsx), nos 6 idiomas.
// Só o servidor importa este arquivo e passa o idioma certo para a tela; os textos são estáticos (nada lê disco).

export type TextosDoProgressoQr = typeof pt;

const TEXTOS: Record<Locale, TextosDoProgressoQr> = { pt, en, es, fr, zh, ru };

export function textosDoProgressoQr(lang: Locale): TextosDoProgressoQr {
  return TEXTOS[lang] ?? pt;
}

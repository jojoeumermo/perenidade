// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// As contagens de "O que já fizemos" (página de Apoie) e do texto para a Benfeitoria: lidas do conteúdo publicado, no build.
import { defaultLocale, type Locale, locales } from "@/i18n/config";
import type { NumerosDoSite } from "./apoio";
import { getBooks, getTracks } from "./content";

export function numerosDoSite(): NumerosDoSite {
  const aulasEm = (lang: Locale, soTraduzidas = false) => getTracks(lang).reduce((n, t) => n + t.lessons.filter((l) => !soTraduzidas || l.translated).length, 0);
  return {
    obras: getBooks(defaultLocale).length,
    aulas: aulasEm(defaultLocale),
    traducoes: locales.filter((l) => l !== defaultLocale).reduce((n, l) => n + aulasEm(l, true), 0),
    idiomas: locales.length,
  };
}

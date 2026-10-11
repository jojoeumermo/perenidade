// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { locales } from "@/i18n/config";

/** Combina cada item com cada idioma, para o generateStaticParams das rotas abaixo de [lang]. */
export function withLangs<T extends object>(items: T[]): (T & { lang: string })[] {
  return locales.flatMap((lang) => items.map((item) => ({ ...item, lang })));
}

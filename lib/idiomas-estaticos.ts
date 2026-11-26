// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { locales } from "@/i18n/config";

/**
 * Combina cada item com cada idioma, para o generateStaticParams das rotas abaixo de [lang]. Mora aqui (sem importar
 * lib/content.ts) para que uma rota que só precisa disto não leve content/ inteiro no rastreio de arquivos da função.
 * lib/params.ts a reexporta: quem já importava de lá continua igual.
 */
export function withLangs<T extends object>(items: T[]): (T & { lang: string })[] {
  return locales.flatMap((lang) => items.map((item) => ({ ...item, lang })));
}

// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import { locales } from "@/i18n/config";

/** Combina cada item com cada idioma, para o generateStaticParams das rotas abaixo de [lang]. */
export function withLangs<T extends object>(items: T[]): (T & { lang: string })[] {
  return locales.flatMap((lang) => items.map((item) => ({ ...item, lang })));
}

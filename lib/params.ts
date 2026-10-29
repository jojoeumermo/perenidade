// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { locales } from "@/i18n/config";
import { idiomasDe } from "./content";

/** Combina cada item com cada idioma, para o generateStaticParams das rotas abaixo de [lang]. */
export function withLangs<T extends object>(items: T[]): (T & { lang: string })[] {
  return locales.flatMap((lang) => items.map((item) => ({ ...item, lang })));
}

/**
 * Os parâmetros só nos idiomas em que o texto existe de fato (o português sempre). As outras versões da mesma página
 * (o texto em português com os menus noutro idioma, que já apontam o português como canônico) saem na primeira visita
 * e ficam guardadas até a próxima publicação. Montar todas no build passava de 26 mil páginas e chegou a estourar os
 * 45 minutos que a Vercel dá para cada publicação. A rota que usa isto precisa de dynamicParams = true e do conteúdo
 * no rastreio de arquivos (outputFileTracingIncludes no next.config.ts).
 */
export function nosIdiomasDoTexto<T extends object>(items: { params: T; file: string }[]): (T & { lang: string })[] {
  return items.flatMap(({ params, file }) => idiomasDe(file).map((lang) => ({ ...params, lang })));
}

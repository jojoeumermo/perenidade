// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { locales } from "@/i18n/config";
import { idiomasDe } from "./content";

/** Combina cada item com cada idioma, para o generateStaticParams das rotas abaixo de [lang]. */
export function withLangs<T extends object>(items: T[]): (T & { lang: string })[] {
  return locales.flatMap((lang) => items.map((item) => ({ ...item, lang })));
}

/**
 * Os parâmetros só nos idiomas em que o texto existe de fato (o português sempre). Nos outros idiomas a página não é
 * copiada: a aula, o texto puro, a zine e a ficha da obra redirecionam (308) para a versão em português, e a interface
 * continua nos 6 idiomas no resto do site (o seletor de idioma não muda). Antes, cada robô que pedia /en, /es, /zh, /ru
 * ou /fr de uma aula gerava e guardava mais uma cópia (mais de 30 mil possíveis); montar todas no build passava de 26
 * mil páginas e estourava os 45 minutos da Vercel. A rota que usa isto precisa de dynamicParams = true (para o
 * redirecionamento e as traduções novas) e do conteúdo no rastreio de arquivos (outputFileTracingIncludes no next.config.ts).
 */
export function nosIdiomasDoTexto<T extends object>(items: { params: T; file: string }[]): (T & { lang: string })[] {
  return items.flatMap(({ params, file }) => idiomasDe(file).map((lang) => ({ ...params, lang })));
}

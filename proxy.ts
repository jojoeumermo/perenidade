// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";

// Endereços que só robôs de invasão procuram (painéis de outros sistemas, cópias de segurança, arquivos
// de configuração). Nada disso existe aqui: a resposta é um "não encontrado" seco, sem redirecionar
// nem montar página, para não gastar nada com eles. O bloqueio de quem insiste fica com a rede de
// proteção na frente do site, que enxerga o tráfego inteiro.
const bait = /^\/(wp-[^/]*|wordpress|administrator|admin|phpmyadmin|pma|mysql|cgi-bin|vendor|backup|backups|bkp|old|config|credentials|secrets?|server-status|actuator|console|debug|telescope|laravel|drupal|joomla|magento|xmlrpc|autodiscover|owa|ecp|boaform|hnap1|shell|cmd|eval|solr|jenkins|_profiler|api\/v\d)(\/|$)/i;

// O idioma principal é o português: todo endereço sem prefixo de idioma ("/", "/trilhas")
// abre em português, seja qual for o idioma do navegador. Os outros idiomas são escolhidos
// pela pessoa no seletor do cabeçalho.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (locales.some((code) => pathname === `/${code}` || pathname.startsWith(`/${code}/`))) return;
  if (bait.test(pathname) || pathname.length > 300) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=86400" } });
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Ignora arquivos internos do Next e qualquer caminho com extensão (ícone, sitemap, robots, .well-known).
  matcher: ["/((?!_next|\\.well-known|.*\\..*).*)"],
};

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";

// Endereços que só robôs de invasão procuram (painéis de outros sistemas, cópias de segurança, arquivos
// de configuração e de senha). Nada disso existe aqui: a resposta é um "não encontrado" seco, sem redirecionar
// nem montar página, para não gastar nada com eles, e a visita fica anotada no registro de atividades do painel
// (só o caminho pedido e o programa usado, sem endereço de rede). O bloqueio de quem insiste fica com a rede
// de proteção na frente do site, que enxerga o tráfego inteiro.
const bait = /^\/(wp-[^/]*|wordpress|administrator|admin|adminer|phpmyadmin|pma|mysql|cgi-bin|vendor|backup|backups|bkp|old|config|credentials|secrets?|server-status|server-info|actuator|console|debug|telescope|horizon|laravel|drupal|joomla|magento|xmlrpc|autodiscover|owa|ecp|boaform|hnap1|shell|cmd|eval|solr|jenkins|_profiler|_ignition|graphql|swagger|api-docs|api\/v\d|\.env[^/]*|\.git|\.svn|\.hg|\.aws|\.ssh|\.docker|\.vscode|\.idea|\.ds_store|\.htaccess|\.htpasswd)(\/|$)/i;
const baitFile = /\.(php\d?|phtml|asp|aspx|jsp|jspx|cgi|pl|env|sql|sqlite|db|bak|old|orig|swp|ini|conf|cfg|ya?ml|log|pem|key|p12|pfx|tar|tgz|gz|rar|7z)$/i;

const backend = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function note(request: NextRequest, event: NextFetchEvent) {
  if (!backend || !key) return;
  event.waitUntil(
    fetch(`${backend}/rest/v1/rpc/isca`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_caminho: request.nextUrl.pathname.slice(0, 200), p_agente: (request.headers.get("user-agent") ?? "").slice(0, 200) }),
    }).catch(() => undefined),
  );
}

// O idioma principal é o português: todo endereço sem prefixo de idioma ("/", "/trilhas")
// abre em português, seja qual for o idioma do navegador. Os outros idiomas são escolhidos
// pela pessoa no seletor do cabeçalho.
export function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  if (bait.test(pathname) || baitFile.test(pathname) || pathname.length > 300) {
    note(request, event);
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" } });
  }
  if (locales.some((code) => pathname === `/${code}` || pathname.startsWith(`/${code}/`))) return;
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // As páginas: ignora os arquivos internos e qualquer caminho com extensão (ícone, sitemap, robots, .well-known).
    "/((?!_next|api/|\\.well-known|.*\\..*).*)",
    // As iscas com cara de arquivo, fora das pastas onde o site guarda arquivos de verdade.
    "/((?!_next|pyodide|php|workers|arquivos|imagens)(?:.*\\.(?:php\\d?|phtml|asp|aspx|jsp|jspx|cgi|pl|env|sql|sqlite|db|bak|old|orig|swp|ini|conf|cfg|yml|yaml|log|pem|key|p12|pfx|tar|tgz|gz|rar|7z)|\\.(?:env|git|svn|hg|aws|ssh|docker|vscode|idea|ds_store|htaccess|htpasswd).*))",
  ],
};

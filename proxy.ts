// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";
import { type EstadoDaInterdicao, fechado, lerEstado, semIdioma, semInterdicao } from "@/lib/interdicao";

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

// Interdição: a coordenação pode tirar o site inteiro (ou uma área) do ar pelo painel. O estado vem da função
// pública site(), guardado aqui por meio minuto para não consultar o banco a cada página. Se o banco não responder,
// o site abre normalmente: o banco é um apoio, e uma falha dele nunca derruba o acervo.
const GUARDA = 30_000;
let guardado: { estado: EstadoDaInterdicao; ate: number } | null = null;

async function interdicao(): Promise<EstadoDaInterdicao> {
  if (!backend || !key) return semInterdicao;
  if (guardado && guardado.ate > Date.now()) return guardado.estado;
  let estado = semInterdicao;
  try {
    const resposta = await fetch(`${backend}/rest/v1/rpc/site`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(1500),
    });
    if (resposta.ok) estado = lerEstado(await resposta.json());
  } catch {
    // sem resposta: vale o site aberto
  }
  guardado = { estado, ate: Date.now() + GUARDA };
  return estado;
}

// O idioma principal é o português: todo endereço sem prefixo de idioma ("/", "/trilhas")
// abre em português, seja qual for o idioma do navegador. Os outros idiomas são escolhidos
// pela pessoa no seletor do cabeçalho.
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  if (bait.test(pathname) || baitFile.test(pathname) || pathname.length > 300) {
    note(request, event);
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" } });
  }
  const estado = await interdicao();
  // Os serviços do próprio site (dicionário, frases, checagens…) também param quando o site inteiro sai do ar.
  if (pathname.startsWith("/api/")) {
    if (estado.geral) return NextResponse.json({ erro: "area_interditada" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "600" } });
    return;
  }
  const area = fechado(pathname, estado);
  if (area) {
    // Reescreve (o endereço continua o mesmo) para a página fantasma, que responde 503 e nunca vai para o cache.
    const [lang] = semIdioma(pathname);
    const destino = request.nextUrl.clone();
    destino.pathname = `/${lang}/fora-do-ar`;
    destino.search = "";
    const cabecalhos = new Headers(request.headers);
    cabecalhos.set("x-lucia-area", area);
    cabecalhos.set("x-lucia-recado", encodeURIComponent(estado.mensagem));
    return NextResponse.rewrite(destino, { request: { headers: cabecalhos } });
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
    // Os serviços do próprio site, só para pararem junto com o site inteiro.
    "/api/:path*",
    // As iscas com cara de arquivo, fora das pastas onde o site guarda arquivos de verdade.
    "/((?!_next|pyodide|php|workers|arquivos|imagens)(?:.*\\.(?:php\\d?|phtml|asp|aspx|jsp|jspx|cgi|pl|env|sql|sqlite|db|bak|old|orig|swp|ini|conf|cfg|yml|yaml|log|pem|key|p12|pfx|tar|tgz|gz|rar|7z)|\\.(?:env|git|svn|hg|aws|ssh|docker|vscode|idea|ds_store|htaccess|htpasswd).*))",
  ],
};

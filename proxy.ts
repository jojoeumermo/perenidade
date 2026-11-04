// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";
import { type EstadoDaInterdicao, fechado, lerEstado, semIdioma, semInterdicao } from "@/lib/interdicao";
import { destinoDireto, destinoNovo, pedidoAntigo } from "@/lib/rede/antigos";
import { ligado } from "@/lib/recursos";
import { site } from "@/lib/site";

// Endereços que só robôs de invasão procuram (painéis de outros sistemas, cópias de segurança, arquivos
// de configuração e de senha). Nada disso existe aqui: a resposta é um "não encontrado" seco, sem redirecionar
// nem montar página, para não gastar nada com eles, e a visita fica anotada no registro de atividades do painel
// (só o caminho pedido e o programa usado, sem endereço de rede). O bloqueio de quem insiste fica com a rede
// de proteção na frente do site, que enxerga o tráfego inteiro.
const bait = /^\/(wp-[^/]*|wordpress|administrator|admin|adminer|phpmyadmin|pma|mysql|cgi-bin|vendor|backup|backups|bkp|old|config|credentials|secrets?|server-status|server-info|actuator|console|debug|telescope|horizon|laravel|drupal|joomla|magento|xmlrpc|autodiscover|owa|ecp|boaform|hnap1|shell|cmd|eval|solr|jenkins|_profiler|_ignition|graphql|swagger|api-docs|cpanel|webmail|plesk|manager|hudson|zabbix|grafana|kibana|elmah|trace\.axd|latest\/meta-data|computeMetadata|owncloud|nextcloud|remote|webdav|api\/v\d|\+cscoe\+|global-protect|dana-na|dana-cached|sslvpn|ssl-vpn|geoserver|druid|nacos|jolokia|struts2?|reportserver|aspnet_client|typo3|umbraco|bitrix|wls-wsat|_wpeprivate|sftp-config\.json|\.env[^/]*|\.git|\.svn|\.hg|\.aws|\.ssh|\.docker|\.vscode|\.idea|\.ds_store|\.htaccess|\.htpasswd)(\/|$)/i;
const baitFile = /\.(php\d?|phtml|asp|aspx|ashx|asmx|axd|jsp|jspx|jsf|action|do|cgi|pl|env|sql|sqlite|db|bak|old|orig|swp|ini|conf|cfg|ya?ml|log|pem|key|p12|pfx|tar|tgz|gz|rar|7z)$/i;

// Ponto ou barra invertida codificados, byte nulo ou ";" depois de "..": é tentativa de sair da pasta (travessia de
// diretório). O navegador já transforma "\" em "/" e resolve os ".." à vista; o que sobra codificado não é de gente.
// O site não serve nada assim: vai para o mesmo 404 das iscas.
const estranho = /%2e|%00|%5c|\.\.;/i;

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

// Rede Lúcia v2 (recurso "rede-v2", só liga pelo nome): os endereços do Fórum antigo (?t=<tópico>, ?sala=<disciplina>) e o ?post= da Rede
// de hoje vão (301) para /comunidade/p/[id] e /comunidade/c/[slug]. O mapa antigo → novo está no banco (rede_antigo, só devolve o par de
// endereços, nunca conteúdo). Sem resposta do banco, o endereço segue como está e a própria página faz o redirecionamento no navegador.
// Desligado, esta função não faz nada: o endereço de hoje continua exatamente como era.
async function enderecoAntigoDaRede(request: NextRequest): Promise<NextResponse | null> {
  if (!ligado("rede-v2")) return null;
  const pedido = pedidoAntigo(request.nextUrl.pathname, request.nextUrl.search);
  if (!pedido) return null;
  let destino = destinoDireto(pedido);
  if (!destino && backend && key && pedido.tipo !== "post") {
    try {
      const resposta = await fetch(`${backend}/rest/v1/rpc/rede_antigo`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_tipo: pedido.tipo, p_antigo: pedido.antigo }),
        signal: AbortSignal.timeout(1500),
      });
      if (resposta.ok) destino = destinoNovo(pedido.lang, (await resposta.json()) as Parameters<typeof destinoNovo>[1]);
    } catch {
      // sem resposta: o endereço segue como está
    }
  }
  if (!destino) return null;
  const url = request.nextUrl.clone();
  url.pathname = destino;
  url.search = "";
  return NextResponse.redirect(url, 301);
}

// O endereço *.vercel.app da produção não fica atrás do Cloudflare: robôs que o descobrem (pelos registros públicos de
// certificados, por exemplo) rastreavam o site inteiro direto na Vercel, sem o cache da borda, e gastavam a cota.
// Em produção, qualquer pedido nesse endereço vai (308, permanente) para o mesmo caminho no domínio do instituto.
// Só vale com VERCEL_ENV=production: as prévias e o servidor próprio (onde a variável não existe) ficam como estão.
const dominio = new URL(site.url);
function foraDoDominio(request: NextRequest): NextResponse | null {
  if (process.env.VERCEL_ENV !== "production") return null;
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (!host.endsWith(".vercel.app") || host === dominio.host) return null;
  const destino = new URL(request.nextUrl.pathname + request.nextUrl.search, dominio);
  return NextResponse.redirect(destino, 308);
}

// O idioma principal é o português: todo endereço sem prefixo de idioma ("/", "/trilhas")
// abre em português, seja qual for o idioma do navegador. Os outros idiomas são escolhidos
// pela pessoa no seletor do cabeçalho. O redirecionamento é permanente (308): o navegador e a borda guardam a resposta,
// e a próxima visita a "/" nem chega à Vercel.
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const outroHost = foraDoDominio(request);
  if (outroHost) return outroHost;
  const { pathname } = request.nextUrl;
  if (bait.test(pathname) || baitFile.test(pathname) || estranho.test(pathname) || pathname.length > 300) {
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
  const antigo = await enderecoAntigoDaRede(request);
  if (antigo) return antigo;
  if (locales.some((code) => pathname === `/${code}` || pathname.startsWith(`/${code}/`))) return;
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: [
    // As páginas: ignora os arquivos internos e qualquer caminho com extensão (ícone, sitemap, robots, .well-known).
    "/((?!_next|api/|\\.well-known|.*\\..*).*)",
    // Os serviços do próprio site, só para pararem junto com o site inteiro.
    "/api/:path*",
    // As iscas com cara de arquivo, fora das pastas onde o site guarda arquivos de verdade.
    "/((?!_next|pyodide|php|workers|arquivos|imagens)(?:.*\\.(?:php\\d?|phtml|asp|aspx|ashx|asmx|axd|jsp|jspx|jsf|action|do|cgi|pl|env|sql|sqlite|db|bak|old|orig|swp|ini|conf|cfg|yml|yaml|log|pem|key|p12|pfx|tar|tgz|gz|rar|7z)|\\.(?:env|git|svn|hg|aws|ssh|docker|vscode|idea|ds_store|htaccess|htpasswd).*))",
  ],
};

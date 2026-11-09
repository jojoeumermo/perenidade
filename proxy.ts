// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";
import { type EstadoDaInterdicao, fechado, lerEstado, semIdioma, semInterdicao } from "@/lib/interdicao";
import { caminhoDoSiteParaEscola, ESCOLA_URL, escolaComEndereco, hostDaEscola, rotaNaEscola, siteVistoDaEscola } from "@/lib/escola/endereco";
import { caminhoDoSiteParaAlumia, hostDaAlumia, rotaNaAlumia } from "@/lib/rede/alumia";
import { destinoDireto, destinoNovo, pedidoAntigo } from "@/lib/rede/antigos";
import { caminhoNovoDaAlumia } from "@/lib/rede/rota-alumia";
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
// de hoje vão (301) para /alumia/p/[id] e /alumia/c/[slug]. O mapa antigo → novo está no banco (rede_antigo, só devolve o par de
// endereços, nunca conteúdo). Sem resposta do banco, o endereço segue como está e a própria página faz o redirecionamento no navegador.
// Desligado, esta função não faz nada: o endereço de hoje continua exatamente como era.
async function enderecoAntigoDaRede(request: NextRequest, caminho: string): Promise<NextResponse | null> {
  if (!ligado("rede-v2")) return null;
  const pedido = pedidoAntigo(caminho, request.nextUrl.search);
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

// Alumia, a rede social do instituto (lib/rede/alumia.ts, docs/rede/ALUMIA-DOMINIO.md). No host dela (alumia.institutolucia.org;
// alumia.localhost para testar), o endereço é reescrito para as rotas /[lang]/alumia/** sem a URL mudar; o resto do site vai
// (307) para o endereço do instituto. No endereço do instituto, com NEXT_PUBLIC_ALUMIA_URL ligada, /[lang]/alumia/** (e o antigo /[lang]/comunidade/**) vai (307,
// temporário de propósito: desligar a variável volta tudo como era) para o endereço próprio. Sem a variável, nada muda aqui.
function siteVistoDaAlumia(request: NextRequest): URL {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  // alumia.institutolucia.org → institutolucia.org (e alumia.localhost:3107 → localhost:3107, para testar sem configurar nada).
  if (host.startsWith("alumia.")) return new URL(`${request.nextUrl.protocol}//${host.slice("alumia.".length)}`);
  return dominio;
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
  // Escola no endereço próprio (lib/escola/endereco.ts): no host dela só abre a Escola (e entrar e as regras); no site do
  // instituto, com NEXT_PUBLIC_ESCOLA_URL ligada, a Escola fechada vai para lá. Sem a variável, nada muda.
  // Na VPS, o Cloudflare entrega os pedidos de escola.institutolucia.org com o host do instituto (regra de origem, para a
  // Caddy servir os dois) e conta o host pedido de verdade em x-lucia-host. A regra de transformação do Cloudflare
  // ESCREVE esse cabeçalho em todo pedido (sobrescreve o que vier de fora), e a VPS só aceita o Cloudflare: não se forja.
  const hostDoPedido = (request.headers.get("host") ?? "").toLowerCase();
  const hostMarcado = (request.headers.get("x-lucia-host") ?? "").toLowerCase();
  const pelaMarca = hostDaEscola(hostMarcado);
  if (pelaMarca || hostDaEscola(hostDoPedido)) {
    const decisao = rotaNaEscola(pathname);
    if (decisao.tipo === "site") return NextResponse.redirect(new URL(decisao.destino + request.nextUrl.search, pelaMarca ? dominio : siteVistoDaEscola(request.nextUrl.protocol, hostDoPedido, dominio)), 307);
    if (decisao.tipo === "redirecionar") {
      const url = pelaMarca ? new URL(decisao.destino, escolaComEndereco ? ESCOLA_URL : `https://${hostMarcado}`) : request.nextUrl.clone();
      url.pathname = decisao.destino;
      url.search = "";
      return NextResponse.redirect(url, 307);
    }
  } else if (hostDoPedido === dominio.host) {
    const paraEscola = caminhoDoSiteParaEscola(pathname, request.nextUrl.search);
    if (paraEscola) return NextResponse.redirect(paraEscola, 307);
  }
  // Alumia: o caminho de verdade (alvo) de um pedido no host dela; fora dele, a Alumia vai para o endereço próprio.
  let alvo = pathname;
  let reescrever = false;
  if (hostDaAlumia(request.headers.get("host"))) {
    const decisao = rotaNaAlumia(pathname, request.headers.get("accept") ?? "");
    if (decisao.tipo === "site") return NextResponse.redirect(new URL(decisao.destino + request.nextUrl.search, siteVistoDaAlumia(request)), 307);
    if (decisao.tipo === "redirecionar") {
      const url = request.nextUrl.clone();
      url.pathname = decisao.destino;
      url.search = "";
      return NextResponse.redirect(url, 307);
    }
    // O endereço antigo (/pt/comunidade/…) no host da Alumia: 308 para o caminho curto (/, /p/<id>), com a busca. Um endereço
    // antigo do Fórum (?t=, ?sala=, ?post=) vai direto ao destino final, como no domínio do instituto: um salto só.
    if (decisao.tipo === "mover") {
      const antigoDoForum = await enderecoAntigoDaRede(request, decisao.completo);
      if (antigoDoForum) return antigoDoForum;
      const url = request.nextUrl.clone();
      url.pathname = decisao.destino;
      return NextResponse.redirect(url, 308);
    }
    if (decisao.tipo === "reescrever") {
      alvo = decisao.destino;
      reescrever = true;
      // O perfil e o post pedidos em ActivityPub vão direto ao documento da federação.
      if (alvo.startsWith("/api/")) {
        if (estado.geral) return NextResponse.json({ erro: "area_interditada" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "600" } });
        const url = request.nextUrl.clone();
        url.pathname = alvo;
        return NextResponse.rewrite(url);
      }
    }
  } else {
    if ((request.headers.get("host") ?? "").toLowerCase() === dominio.host) {
      const fora = caminhoDoSiteParaAlumia(pathname, request.nextUrl.search);
      if (fora) return NextResponse.redirect(fora, 307);
    }
    // A rota mudou: /<idioma>/comunidade/… (e /comunidade/… sem idioma) vai com 308 para /<idioma>/alumia/…, com a busca
    // (lib/rede/rota-alumia.ts). Um endereço antigo do Fórum (?t=, ?sala=, ?post=) vai direto ao destino final: um salto só.
    const novo = caminhoNovoDaAlumia(pathname);
    if (novo !== null) {
      const antigoDoForum = await enderecoAntigoDaRede(request, novo);
      if (antigoDoForum) return antigoDoForum;
      const url = request.nextUrl.clone();
      url.pathname = novo;
      return NextResponse.redirect(url, 308);
    }
  }
  const area = fechado(alvo, estado);
  if (area) {
    // Reescreve (o endereço continua o mesmo) para a página fantasma, que responde 503 e nunca vai para o cache.
    const [lang] = semIdioma(alvo);
    const destino = request.nextUrl.clone();
    destino.pathname = `/${lang}/fora-do-ar`;
    destino.search = "";
    const cabecalhos = new Headers(request.headers);
    cabecalhos.set("x-lucia-area", area);
    cabecalhos.set("x-lucia-recado", encodeURIComponent(estado.mensagem));
    return NextResponse.rewrite(destino, { request: { headers: cabecalhos } });
  }
  const antigo = await enderecoAntigoDaRede(request, alvo);
  if (antigo) return antigo;
  if (reescrever) {
    const url = request.nextUrl.clone();
    url.pathname = alvo;
    return NextResponse.rewrite(url);
  }
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

// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// O site em si: está no ar? quanto demora? os cabeçalhos de segurança continuam lá? o conteúdo mudou?
// que domínios de terceiros a página carrega? Tudo a partir de um GET como o de um visitante.
import type { Evento, Verificacao } from "../tipos.ts";
import { impressao, limpo, pegar, sha256 } from "../util.ts";

/** Cabeçalhos que interessam, em minúsculas. */
const CABECALHOS = ["strict-transport-security", "content-security-policy", "content-security-policy-report-only", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "cross-origin-opener-policy", "cross-origin-resource-policy", "x-permitted-cross-domain-policies", "server", "x-powered-by", "reporting-endpoints", "cache-control", "content-type"];

export interface ResultadoDaPagina {
  verificacao: Verificacao;
  terceiros: { pagina: string; tipo: string; host: string; url: string }[];
  html: string;
}

/**
 * Antes de calcular a impressão, tira o que muda a cada deploy sem mudar o conteúdo: nomes de pacotes do Next,
 * identificador do build e valores aleatórios de hidratação. Assim a impressão só muda quando a página muda de verdade.
 */
export function normalizar(html: string): string {
  return html
    .replace(/\/_next\/static\/[A-Za-z0-9_-]+\//g, "/_next/static/X/")
    .replace(/"buildId":"[^"]*"/g, '"buildId":"X"')
    .replace(/\?v=[A-Za-z0-9_-]+/g, "?v=X")
    .replace(/nonce="[^"]*"/g, 'nonce="X"')
    .replace(/<script[^>]*>self\.__next_f\.push\([\s\S]*?<\/script>/g, "<script>__next_f</script>")
    .replace(/\s+/g, " ");
}

/** Domínios de fora que a página manda o navegador buscar: script, iframe, link, imagem. */
export function terceirosDe(html: string, pagina: string, hostDoSite: string): { pagina: string; tipo: string; host: string; url: string }[] {
  const achados = new Map<string, { pagina: string; tipo: string; host: string; url: string }>();
  const padroes: [RegExp, string][] = [
    [/<script[^>]+src=["']([^"']+)["']/gi, "script"],
    [/<iframe[^>]+src=["']([^"']+)["']/gi, "iframe"],
    [/<link[^>]+href=["']([^"']+)["']/gi, "link"],
    [/<img[^>]+src=["']([^"']+)["']/gi, "img"],
  ];
  for (const [padrao, tipo] of padroes) {
    for (const m of html.matchAll(padrao)) {
      const bruto = m[1].replace(/&amp;/g, "&");
      if (!/^(https?:)?\/\//i.test(bruto)) continue;
      let host: string;
      try {
        host = new URL(bruto.startsWith("//") ? `https:${bruto}` : bruto).hostname.toLowerCase();
      } catch {
        continue;
      }
      if (!host || host === hostDoSite || host.endsWith(`.${hostDoSite}`)) continue;
      const chave = `${tipo}|${host}`;
      if (!achados.has(chave)) achados.set(chave, { pagina, tipo, host, url: limpo(bruto, 500) });
    }
  }
  return [...achados.values()];
}

/** Nota dos cabeçalhos de segurança (0–100) e o que faltou. */
export function notaDosCabecalhos(c: Record<string, string>): { nota: number; faltas: string[] } {
  let nota = 0;
  const faltas: string[] = [];
  const tem = (nome: string) => Boolean(c[nome]);
  const hsts = c["strict-transport-security"] ?? "";
  const idade = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);
  if (idade >= 31536000) nota += 20; else if (idade > 0) { nota += 10; faltas.push("HSTS com max-age menor que um ano"); } else faltas.push("sem HSTS");
  if (/includeSubDomains/i.test(hsts)) nota += 5; else if (idade > 0) faltas.push("HSTS sem includeSubDomains");
  const csp = c["content-security-policy"] ?? "";
  if (csp) {
    nota += 15;
    if (/default-src 'self'/.test(csp)) nota += 5; else faltas.push("CSP sem default-src 'self'");
    if (/frame-ancestors/.test(csp)) nota += 5;
    if (/object-src 'none'/.test(csp)) nota += 5;
    if (/script-src[^;]*'unsafe-eval'/.test(csp)) faltas.push("CSP permite unsafe-eval em páginas");
  } else faltas.push("sem Content-Security-Policy");
  if ((c["x-content-type-options"] ?? "").toLowerCase() === "nosniff") nota += 10; else faltas.push("sem X-Content-Type-Options");
  if (tem("x-frame-options") || /frame-ancestors/.test(csp)) nota += 10; else faltas.push("sem proteção contra enquadramento");
  if (tem("referrer-policy")) nota += 10; else faltas.push("sem Referrer-Policy");
  if (tem("permissions-policy")) nota += 5; else faltas.push("sem Permissions-Policy");
  if (tem("cross-origin-opener-policy")) nota += 5; else faltas.push("sem Cross-Origin-Opener-Policy");
  if (tem("cross-origin-resource-policy")) nota += 5; else faltas.push("sem Cross-Origin-Resource-Policy");
  if (c["x-powered-by"]) { nota -= 5; faltas.push("X-Powered-By revela a tecnologia"); }
  return { nota: Math.max(0, Math.min(100, nota)), faltas };
}

/** Um GET na página, medido. */
export async function verificarPagina(base: string, caminho: string, alvo: string, regiao = ""): Promise<ResultadoDaPagina> {
  const url = `${base.replace(/\/$/, "")}${caminho}`;
  const inicio = Date.now();
  const resposta = await pegar(url, { headers: { "User-Agent": "SentinelaLucia/1.0 (+https://institutolucia.org)", Accept: "text/html,application/json;q=0.9,*/*;q=0.5", "Cache-Control": "no-cache" }, redirect: "follow" }, 15_000);
  const ms = Date.now() - inicio;
  if (!resposta) return { verificacao: { alvo, regiao, no_ar: false, ms, erro: "sem resposta" }, terceiros: [], html: "" };
  const cabecalhos: Record<string, string> = {};
  for (const nome of CABECALHOS) {
    const valor = resposta.headers.get(nome);
    if (valor) cabecalhos[nome] = limpo(valor, 1500);
  }
  const html = (await resposta.text().catch(() => "")).slice(0, 3_000_000);
  const hash = await sha256(normalizar(html));
  const hostDoSite = new URL(url).hostname;
  const { nota } = notaDosCabecalhos(cabecalhos);
  return {
    verificacao: { alvo, regiao, no_ar: resposta.ok, status: resposta.status, ms, hash, cabecalhos, nota, erro: resposta.ok ? "" : `HTTP ${resposta.status}` },
    terceiros: /text\/html/.test(cabecalhos["content-type"] ?? "") ? terceirosDe(html, caminho, hostDoSite) : [],
    html,
  };
}

/** Eventos de "a página mudou", comparando com a última impressão guardada. */
export async function eventoDeMudanca(alvo: string, caminho: string, hashAntes: string | undefined, hashAgora: string | undefined, houveDeploy: boolean): Promise<Evento | null> {
  if (!hashAntes || !hashAgora || hashAntes === hashAgora) return null;
  return {
    fonte: "pagina",
    tipo: houveDeploy ? "mudou_com_deploy" : "mudou_sem_deploy",
    gravidade: houveDeploy ? "info" : "alta",
    caminho,
    detalhes: { alvo, de: hashAntes.slice(0, 16), para: hashAgora.slice(0, 16), deploy_recente: houveDeploy },
    impressao: await impressao("pagina", alvo, hashAgora),
  };
}

/** Eventos de cabeçalho que sumiu, comparando com a última verificação boa. */
export async function eventosDeCabecalho(antes: Record<string, string> | undefined, agora: Record<string, string>): Promise<Evento[]> {
  if (!antes) return [];
  const eventos: Evento[] = [];
  for (const nome of ["strict-transport-security", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "cross-origin-opener-policy"]) {
    if (antes[nome] && !agora[nome]) {
      eventos.push({ fonte: "cabecalho", tipo: "sumiu", gravidade: "alta", detalhes: { cabecalho: nome, antes: antes[nome].slice(0, 200) }, impressao: await impressao("cabecalho", nome, new Date().toISOString().slice(0, 13)) });
    }
  }
  return eventos;
}

// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// O coletor do Sentinela Lúcia, como Cloudflare Worker:
//   cron */5    coleta rápida (site, serviço de contas, tráfego, deploys, ações confirmadas, e-mails)
//   cron 6h     coleta lenta (DNS, certificados, domínios parecidos, GitHub, reputação, limpeza)
//   POST /csp   recebe os relatos de violação da política de segurança do site (sem conta; o navegador manda)
//   POST /coletar          dispara a coleta rápida agora (sessão de dono ou analista do painel, com segundo fator)
//   POST /acoes/executar   executa agora as ações já confirmadas (idem)
//   GET  /saude            diz se o Worker está vivo e quais integrações estão configuradas (só nomes, nunca valores)
import { Banco } from "./banco.ts";
import { coletaLenta, coletaRapida, executarAcoes } from "./coleta.ts";
import { registrarAlertas } from "./email.ts";
import type { Configuracao, Env } from "./tipos.ts";
import { impressao, limpo } from "./util.ts";

const json = (corpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } });

/** O app roda no Tauri (origem tauri://localhost ou http://tauri.localhost) e como PWA (APP_URL): só esses podem chamar. */
function cors(env: Env, pedido: Request): Record<string, string> {
  const origem = pedido.headers.get("Origin") ?? "";
  const permitidas = new Set(["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost", "http://localhost:1420", "http://localhost:5173", ...(env.APP_URL ? [env.APP_URL.replace(/\/$/, "")] : [])]);
  if (!permitidas.has(origem)) return {};
  return { "Access-Control-Allow-Origin": origem, "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", Vary: "Origin" };
}

/** Quem chama tem sessão válida de dono ou analista, com segundo fator? O banco responde. */
async function pessoaAutorizada(env: Env, pedido: Request): Promise<{ ok: boolean; nome?: string }> {
  const token = (pedido.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false };
  const eu = await new Banco(env).comoPessoa<{ papel?: string; ativo?: boolean; segundo_fator_na_sessao?: boolean; nome?: string } | null>(token, "eu");
  if (!eu?.ativo || !eu.segundo_fator_na_sessao || !["dono", "analista"].includes(eu.papel ?? "")) return { ok: false };
  return { ok: true, nome: eu.nome };
}

interface RelatoCsp {
  "csp-report"?: Record<string, string>;
  type?: string;
  url?: string;
  body?: Record<string, string>;
}

/** Normaliza os dois formatos de relato (report-uri e Reporting API). */
export function lerRelatos(corpo: unknown): { documento: string; diretiva: string; bloqueado: string }[] {
  const lista = Array.isArray(corpo) ? corpo : [corpo];
  const saida: { documento: string; diretiva: string; bloqueado: string }[] = [];
  for (const item of lista as RelatoCsp[]) {
    if (!item || typeof item !== "object") continue;
    const r: Record<string, string | undefined> | null = item["csp-report"] ?? (item.type === "csp-violation" ? { ...item.body, "document-uri": item.url ?? item.body?.documentURL } : null);
    if (!r) continue;
    saida.push({
      documento: limpo(r["document-uri"] ?? r.documentURL ?? "", 300).replace(/[?#].*$/, ""),
      diretiva: limpo(r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"] ?? "", 80),
      bloqueado: limpo(r["blocked-uri"] ?? r.blockedURL ?? "", 300),
    });
  }
  return saida.slice(0, 50);
}

async function receberCsp(env: Env, pedido: Request): Promise<Response> {
  if ((pedido.headers.get("Content-Length") ?? "0") > "65536" || Number(pedido.headers.get("Content-Length") ?? 0) > 65536) return json({ erro: "grande" }, 413);
  let corpo: unknown;
  try {
    corpo = JSON.parse((await pedido.text()).slice(0, 65536));
  } catch {
    return new Response(null, { status: 204 });
  }
  const relatos = lerRelatos(corpo);
  // Só relatos sobre o próprio site contam; o endereço vem do banco. Sem banco, o Worker só agradece.
  const banco = new Banco(env);
  if (!relatos.length || !banco.pronto) return new Response(null, { status: 204 });
  const config = await banco.rpc<Configuracao>("coleta_configuracao").catch(() => null);
  const host = (() => {
    try {
      return new URL(config?.configuracoes.site?.url ?? "https://institutolucia.org").hostname;
    } catch {
      return "institutolucia.org";
    }
  })();
  const nossos = relatos.filter((r) => {
    try {
      return new URL(r.documento).hostname === host;
    } catch {
      return false;
    }
  });
  if (!nossos.length) return new Response(null, { status: 204 });
  const p = await Promise.all(nossos.map(async (r) => ({ ...r, impressao: await impressao("csp", r.documento, r.diretiva, r.bloqueado) })));
  await banco.rpc("coleta_csp", { p }).catch(() => null);
  const minimo = Number(config?.regras.find((r) => r.id === "csp_violacoes")?.parametros?.minimo_hora ?? 20);
  if (config && p.length >= minimo) {
    await registrarAlertas(env, banco, [{ regra: "csp_violacoes", gravidade: "baixa", titulo: "Muitas violações da política de segurança do conteúdo", resumo: `${p.length} relatos distintos chegaram de uma vez.`, detalhes: { total: p.length }, impressao: `csp:${new Date().toISOString().slice(0, 13)}` }]).catch(() => null);
  }
  return new Response(null, { status: 204 });
}

export default {
  async scheduled(evento: ScheduledController, env: Env, ctx: ExecutionContext) {
    const lenta = evento.cron.startsWith("17 ");
    ctx.waitUntil((lenta ? coletaLenta(env) : coletaRapida(env)).then((r) => console.log(JSON.stringify({ coleta: lenta ? "lenta" : "rapida", ...r }))));
  },

  async fetch(pedido: Request, env: Env): Promise<Response> {
    const url = new URL(pedido.url);
    const extra = cors(env, pedido);
    if (pedido.method === "OPTIONS") return new Response(null, { status: 204, headers: extra });

    if (url.pathname === "/csp" && pedido.method === "POST") return receberCsp(env, pedido);

    if (url.pathname === "/saude" && pedido.method === "GET") {
      return json({
        ok: true,
        agora: new Date().toISOString(),
        configurado: {
          banco: Boolean(env.SENTINELA_SUPABASE_URL && env.SENTINELA_SERVICE_KEY),
          cloudflare: Boolean(env.CLOUDFLARE_API_TOKEN),
          vercel: Boolean(env.VERCEL_TOKEN),
          github: Boolean(env.GITHUB_TOKEN),
          supabase_site_logs: Boolean(env.SUPABASE_SITE_PAT),
          email: Boolean(env.RESEND_API_KEY),
          reputacao: Boolean(env.ABUSEIPDB_KEY),
        },
      }, 200, extra);
    }

    if ((url.pathname === "/coletar" || url.pathname === "/acoes/executar") && pedido.method === "POST") {
      const quem = await pessoaAutorizada(env, pedido);
      if (!quem.ok) return json({ erro: "sem_permissao" }, 403, extra);
      if (url.pathname === "/coletar") {
        const resumo = await coletaRapida(env, "manual");
        return json(resumo, 200, extra);
      }
      const banco = new Banco(env);
      const config = await banco.rpc<Configuracao>("coleta_configuracao");
      const texto = await executarAcoes(env, banco, config.configuracoes.plataformas?.cloudflare_zona ?? "");
      return json({ acoes: texto }, 200, extra);
    }

    return json({ erro: "nao_encontrado" }, 404, extra);
  },
} satisfies ExportedHandler<Env>;

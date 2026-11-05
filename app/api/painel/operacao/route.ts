// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Operação do site (Etapa 8, backend-2): a coordenação vê o estado da última publicação (Vercel), da última cópia do banco
// (rotina backup.yml, pelo GitHub) e pede a limpeza do cache (Cloudflare). Quem chama manda o token da própria sessão; o banco
// confere se é coordenação e segura o ritmo (operacao_pedir) ANTES de falar com qualquer serviço; os tokens dos serviços ficam
// só no servidor e nunca voltam na resposta. Sem a variável de um serviço, aquele botão nem aparece (GET devolve o que está ligado).
//   VERCEL_TOKEN_LEITURA + VERCEL_PROJECT_ID (+ VERCEL_TEAM_ID): ver a publicação
//   GITHUB_LEITURA_TOKEN (só "Actions: leitura") (+ GITHUB_PUBLICAR_REPO): ver a cópia do banco
//   CF_TOKEN_CACHE + CF_ZONE_ID (os mesmos da rotina limpar-cache.yml): limpar o cache
import { resumirBackup, resumirPublicacao } from "@/lib/operacao";
import { rpcNoBanco } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const responder = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const ligado = () => ({
  publicacao: Boolean(process.env.VERCEL_TOKEN_LEITURA && process.env.VERCEL_PROJECT_ID),
  backup: Boolean(process.env.GITHUB_LEITURA_TOKEN),
  cache: Boolean(process.env.CF_TOKEN_CACHE && process.env.CF_ZONE_ID),
});

export async function GET(pedido: Request) {
  // Quais integrações estão ligadas é dado de configuração: só responde a quem manda o token de uma sessão (a tela é da coordenação).
  if (!/^Bearer\s+[\w.-]+$/.test(pedido.headers.get("authorization") ?? "")) return responder({ erro: "Entre na sua conta de novo." }, 401);
  return responder({ ligado: ligado() });
}

async function publicacao() {
  const url = new URL("https://api.vercel.com/v7/deployments");
  url.searchParams.set("projectId", process.env.VERCEL_PROJECT_ID ?? "");
  url.searchParams.set("target", "production");
  url.searchParams.set("limit", "1");
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN_LEITURA}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!r?.ok) return { ok: false as const, detalhe: "A Vercel não respondeu." };
  const corpo = (await r.json().catch(() => null)) as { deployments?: unknown[] } | null;
  const resumo = resumirPublicacao(corpo?.deployments?.[0], Date.now());
  return { ok: resumo.estado !== "falhou", detalhe: resumo.frase, resumo };
}

async function backup() {
  const repositorio = process.env.GITHUB_PUBLICAR_REPO || "jojoeumermo/perenidade";
  const r = await fetch(`https://api.github.com/repos/${repositorio}/actions/workflows/backup.yml/runs?per_page=1`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_LEITURA_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!r?.ok) return { ok: false as const, detalhe: "O GitHub não respondeu." };
  const corpo = (await r.json().catch(() => null)) as { workflow_runs?: unknown[] } | null;
  const resumo = resumirBackup(corpo?.workflow_runs?.[0], Date.now());
  return { ok: resumo.estado !== "falhou", detalhe: resumo.frase, resumo };
}

async function limparCache() {
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CF_TOKEN_CACHE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ purge_everything: true }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  const corpo = (await r?.json().catch(() => null)) as { success?: boolean } | null;
  const ok = Boolean(r?.ok && corpo?.success);
  return { ok, detalhe: ok ? "Cache limpo. As páginas voltam a ser feitas na próxima visita." : "O Cloudflare recusou a limpeza." };
}

export async function POST(pedido: Request) {
  const token = /^Bearer\s+([\w.-]+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!token) return responder({ erro: "Entre na sua conta de novo." }, 401);
  const { acao } = (await pedido.json().catch(() => ({}))) as { acao?: string };
  if (acao !== "ver_publicacao" && acao !== "ver_backup" && acao !== "limpar_cache") return responder({ erro: "Pedido desconhecido." }, 400);
  const serv = ligado();
  const campo = acao === "ver_publicacao" ? "publicacao" : acao === "ver_backup" ? "backup" : "cache";
  if (!serv[campo]) return responder({ erro: "Esta ligação ainda não foi feita no servidor." }, 503);
  const pode = await rpcNoBanco<boolean>("operacao_pedir", { p_acao: acao }, token);
  if (!pode.ok) {
    const muitos = pode.erro === "muitos_pedidos";
    return responder({ erro: muitos ? "Muitos pedidos seguidos: espere um pouco." : "Esta tela é da coordenação." }, muitos ? 429 : 403);
  }
  const feito = acao === "ver_publicacao" ? await publicacao() : acao === "ver_backup" ? await backup() : await limparCache();
  // Só uma frase curta vai ao registro: nunca token nem o corpo da resposta de um serviço.
  await rpcNoBanco("operacao_resultado", { p_acao: acao, p_ok: feito.ok, p_detalhe: feito.detalhe }, token);
  return responder({ ok: feito.ok, detalhe: feito.detalhe, resumo: "resumo" in feito ? feito.resumo : undefined }, feito.ok || acao !== "limpar_cache" ? 200 : 502);
}

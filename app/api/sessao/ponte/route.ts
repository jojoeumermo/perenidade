// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A ponte de sessão (login único; a lógica e o desenho estão em lib/sessao/ponte.ts e docs/rede/ENTRADA.md).
//   GET  → a página mínima do quadro escondido (só o script da ponte; CSP própria em next.config.ts: só alumia. e escola. embutem).
//   POST → troca a sessão DO SITE (token no cabeçalho, pedido da mesma origem) por um código de entrada de uma vez para a Alumia
//          ou a Escola: o token_hash de um link mágico gerado aqui com a chave de serviço. Nada vai por e-mail nem por endereço.
// Regras: o destino é exatamente alumia.<site> ou escola.<site>; quem tem o aplicativo autenticador só passa com a sessão
// confirmada pelo código (aal2), e no endereço novo o código é pedido de novo; no máximo 6 códigos por conta a cada 10 minutos.
import { origemDoSite, origemPodePedir } from "@/lib/sessao/ponte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const semCache = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: semCache });

export function GET() {
  const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Ponte</title></head><body><script src="/api/sessao/ponte/script"></script></body></html>`;
  return new Response(html, { headers: { ...semCache, "Content-Type": "text/html; charset=utf-8" } });
}

// Limite por conta, na memória deste servidor (um servidor só na VPS). Some ao reiniciar: é freio, não registro.
const usos = new Map<string, number[]>();
function passou(conta: string): boolean {
  const agora = Date.now();
  const recentes = (usos.get(conta) ?? []).filter((t) => agora - t < 10 * 60_000);
  if (recentes.length >= 6) return false;
  recentes.push(agora);
  usos.set(conta, recentes);
  if (usos.size > 5000) for (const [k, v] of usos) if (v.every((t) => agora - t >= 10 * 60_000)) usos.delete(k);
  return true;
}

function cargaDoToken(token: string): Record<string, unknown> | null {
  try {
    const meio = token.split(".")[1] ?? "";
    return JSON.parse(Buffer.from(meio.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(pedido: Request) {
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!SUPA || !ANON || !servico) return resposta({ erro: "sem_servico" }, 503);
  // Só o próprio quadro da ponte chama (mesma origem do site); o destino tem de ser um dos dois subdomínios desse site.
  const origem = pedido.headers.get("origin") ?? "";
  const lugar = pedido.headers.get("sec-fetch-site");
  if (lugar && lugar !== "same-origin") return resposta({ erro: "origem" }, 403);
  const corpo = (await pedido.json().catch(() => null)) as { destino?: unknown } | null;
  const destino = typeof corpo?.destino === "string" ? corpo.destino : "";
  if (!origem || !origemPodePedir(destino, origem) || origemDoSite(destino) !== origem) return resposta({ erro: "origem" }, 403);
  const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);

  // A sessão é de verdade? O serviço de contas confere a assinatura e se a sessão continua viva.
  let usuario: { id?: string; email?: string; email_confirmed_at?: string | null; factors?: { status?: string; factor_type?: string }[] } | null = null;
  try {
    const r = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (r.ok) usuario = await r.json();
  } catch {
    return resposta({ erro: "sem_conexao" }, 502);
  }
  if (!usuario?.id || !usuario.email || !usuario.email_confirmed_at) return resposta({ erro: "entre_primeiro" }, 401);
  const comFator = (usuario.factors ?? []).some((f) => f.status === "verified");
  if (comFator && cargaDoToken(token)?.aal !== "aal2") return resposta({ erro: "segundo_fator" }, 403);
  if (!passou(usuario.id)) return resposta({ erro: "muitos_pedidos" }, 429);

  try {
    const r = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "magiclink", email: usuario.email }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const dado = (await r.json().catch(() => null)) as { hashed_token?: string; properties?: { hashed_token?: string } } | null;
    const hash = dado?.hashed_token ?? dado?.properties?.hashed_token ?? "";
    if (!r.ok || !/^[a-f0-9]{20,128}$/.test(hash)) return resposta({ erro: "falha" }, 502);
    return resposta({ token_hash: hash });
  } catch {
    return resposta({ erro: "sem_conexao" }, 502);
  }
}

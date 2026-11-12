// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A ponte de sessão (login único; a lógica e o desenho estão em lib/sessao/ponte.ts e docs/rede/ENTRADA.md).
//   GET  → a página mínima do quadro escondido (só o script da ponte; CSP própria em next.config.ts: só alumia. e escola. embutem).
//   POST → troca a sessão DO SITE (token no cabeçalho, pedido da mesma origem) por um código de entrada de uma vez para a Alumia
//          ou a Escola: o token_hash de um link mágico gerado aqui com a chave de serviço. Nada vai por e-mail nem por endereço.
// Regras: o destino é exatamente alumia.<site> ou escola.<site>; quem tem o aplicativo autenticador só passa com a sessão
// confirmada pelo código (aal2), e no endereço novo o código é pedido de novo; no máximo 6 códigos por conta a cada 10 minutos
// (contados no banco, public.alumia_ponte_passar, que também grava a conta e o destino no registro de atividades).
// O token tem de ter sido emitido há no máximo 10 minutos: o quadro da ponte renova a sessão antes de pedir (ele tem o token de
// renovação); quem roubou só um token de acesso antigo (de um log, de uma extensão) não consegue trocá-lo por sessão nova.
// Fora do navegador, Origin e Sec-Fetch-Site são escolhidos por quem chama: não são defesa contra quem já tem o token, só
// contra página de outro site (docs/rede/ENTRADA.md, "O que a ponte não defende").
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

/** O token de acesso mais velho que isto não gera código (segundos). */
const IDADE_MAXIMA_DO_TOKEN = 10 * 60;

/**
 * O freio e o registro no banco (vale entre processos e depois de reiniciar). true = pode; false = passou do limite (ou conta
 * suspensa); null = o banco ainda não tem a função (migração 20261112-alumia-portas.sql) ou não respondeu: fica só o freio da memória.
 */
async function passouNoBanco(servico: string, conta: string, destino: string): Promise<boolean | null> {
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/alumia_ponte_passar`, {
      method: "POST",
      headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_conta: conta, p_destino: destino }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    return (await r.json()) === true;
  } catch {
    return null;
  }
}

// O primeiro freio, na memória deste processo (barato, antes de ir ao banco). Some ao reiniciar: o que vale é o do banco.
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
  const carga = cargaDoToken(token);
  if (comFator && carga?.aal !== "aal2") return resposta({ erro: "segundo_fator" }, 403);
  const emitido = typeof carga?.iat === "number" ? carga.iat : 0;
  if (!emitido || Date.now() / 1000 - emitido > IDADE_MAXIMA_DO_TOKEN) return resposta({ erro: "sessao_antiga" }, 401);
  if (!passou(usuario.id)) return resposta({ erro: "muitos_pedidos" }, 429);
  const rotulo = new URL(destino).hostname.split(".")[0] ?? "";
  if ((await passouNoBanco(servico, usuario.id, rotulo)) === false) return resposta({ erro: "muitos_pedidos" }, 429);

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

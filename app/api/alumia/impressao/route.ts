// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A impressão de rede da Alumia (lib/rede/painel/impressao.ts).
//   POST, com a sessão no cabeçalho Authorization → o servidor lê o endereço de quem pediu, calcula na hora a impressão da rede
//   (HMAC-SHA-256 com o segredo de ALUMIA_IMPRESSAO_SEGREDO, lib/rede/painel/impressao.ts) e entrega ao banco SÓ a impressão,
//   com a chave de serviço (public.alumia_impressao_registrar). O endereço não vai ao banco, não é guardado nem escrito em log
//   (decisão da coordenação de 13/11). Sem o segredo, nada é registrado e o banimento por rede fica indisponível.
// A tela de entrada da Alumia chama esta rota ao entrar e antes de pedir a conta. A resposta diz só se a rede está barrada.
import { enderecoDoPedido, impressoesDaRede } from "@/lib/rede/painel/impressao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const semCache = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: semCache });

// Freio na memória deste processo: no máximo 12 registros por conta a cada 10 minutos (a tela chama uma vez ao entrar).
const usos = new Map<string, number[]>();
function passou(conta: string): boolean {
  const agora = Date.now();
  const recentes = (usos.get(conta) ?? []).filter((t) => agora - t < 10 * 60_000);
  if (recentes.length >= 12) return false;
  recentes.push(agora);
  usos.set(conta, recentes);
  if (usos.size > 5000) for (const [k, v] of usos) if (v.every((t) => agora - t >= 10 * 60_000)) usos.delete(k);
  return true;
}

export async function POST(pedido: Request) {
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!SUPA || !ANON || !servico) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const lugar = pedido.headers.get("sec-fetch-site");
  if (lugar && lugar !== "same-origin") return resposta({ ok: false, motivo: "origem" }, 403);
  const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!token) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  const corpo = (await pedido.json().catch(() => null)) as { momento?: unknown } | null;
  const momento = corpo?.momento === "pedido" ? "pedido" : "entrada";

  // A sessão é de verdade? O serviço de contas confere a assinatura e se a sessão continua viva.
  let conta = "";
  try {
    const r = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (r.ok) conta = String(((await r.json()) as { id?: string } | null)?.id ?? "");
  } catch {
    return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  }
  if (!/^[0-9a-f-]{36}$/.test(conta)) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  if (!passou(conta)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);

  // Onda R3 (2.6): com o segredo novo, também a impressão do anterior (o banco aceita por 30 dias: os banimentos seguem valendo).
  const impressoes = impressoesDaRede(enderecoDoPedido(pedido.headers));
  if (!impressoes) return resposta({ ok: false, motivo: "sem_impressao" });
  const { impressao, versao, anterior } = impressoes;

  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/alumia_impressao_registrar`, {
      method: "POST",
      headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_usuario: conta, p_impressao: impressao, p_momento: momento, p_versao: versao, p_anterior: anterior }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    // O banco ainda sem a migração do painel (ou sem resposta): nada foi registrado, e a entrada segue.
    if (!r.ok) return resposta({ ok: false, motivo: "banco" });
    const dado = (await r.json().catch(() => null)) as { barrada?: boolean; ate?: string } | null;
    return resposta({ ok: true, barrada: dado?.barrada === true, ate: dado?.barrada ? (dado.ate ?? null) : null });
  } catch {
    return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  }
}

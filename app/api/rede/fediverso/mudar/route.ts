// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// 74. Mudar de servidor no Fediverso (Prompt 4, Parte H; supabase/migracoes/20261127-p4-conta.sql), atrás de "alumia-p4-conta".
//   POST, com a sessão no cabeçalho Authorization →
//   1. o banco, COMO a pessoa, devolve a mudança dela (o @ na federação e a conta nova que ela apontou);
//   2. o servidor busca a conta nova (assinado pelo ator da instância, como as outras buscas do Fediverso) e confere que ela declara
//      esta em alsoKnownAs (sem isso, qualquer um "levaria" as seguidoras de outra pessoa);
//   3. com a chave de serviço, o banco marca a mudança e põe um Move por caixa de entrada das seguidoras na fila de entrega
//      (rede_p4_ct_mudanca_enviar). O documento do ator passa a dizer "movedTo".
// Nada é guardado aqui: nem o documento de fora, nem o endereço de quem pediu.
import { ligado } from "@/lib/recursos";
import { declaraApelido } from "@/lib/rede/conta/mudanca";
import { buscarDocumento, fed } from "@/lib/rede/fediverso/servidor";
import { chamarComoPessoa, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const semCache = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: semCache });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Freio na memória deste processo: no máximo 5 conferências por sessão a cada 10 minutos (o banco também limita).
const usos = new Map<string, number[]>();
function passou(chave: string): boolean {
  const agora = Date.now();
  const recentes = (usos.get(chave) ?? []).filter((t) => agora - t < 10 * 60_000);
  if (recentes.length >= 5) return false;
  recentes.push(agora);
  usos.set(chave, recentes);
  if (usos.size > 5000) for (const [k, v] of usos) if (v.every((t) => agora - t >= 10 * 60_000)) usos.delete(k);
  return true;
}

export async function POST(pedido: Request) {
  if (!ligado("alumia-p4-conta")) return new Response("Not Found", { status: 404 });
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!SUPA || !servico) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const lugar = pedido.headers.get("sec-fetch-site");
  if (lugar && lugar !== "same-origin") return resposta({ ok: false, motivo: "origem" }, 403);
  const token = tokenDe(pedido);
  if (!token) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  if (!passou(token.slice(-32))) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);

  // 1. Como a pessoa: a mudança que ela pediu.
  const r = await chamarComoPessoa<{ federada: boolean; handle: string | null; alvo: string | null; situacao: string | null }>(token, "rede_p4_ct_mudanca");
  if (!r.ok) return resposta({ ok: false, motivo: r.codigo }, r.status === 401 ? 401 : 400);
  const { federada, handle, alvo, situacao } = r.dado;
  if (!federada || !handle || !alvo) return resposta({ ok: false, motivo: "sem_federacao" }, 400);
  if (situacao === "enviada") return resposta({ ok: true, ja: true });

  // 2. A conta nova declara esta em alsoKnownAs?
  const doc = await buscarDocumento(alvo).catch(() => null);
  if (!declaraApelido(doc, alvo, fed.ator(handle))) return resposta({ ok: false, motivo: "sem_apelido" });

  // 3. Só o servidor manda o Move (o banco confere que o alvo é o mesmo que a pessoa pediu).
  const usuario = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) })
    .then((x) => (x.ok ? (x.json() as Promise<{ id?: string }>) : null))
    .catch(() => null);
  if (!usuario?.id || !UUID.test(usuario.id)) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  try {
    const envio = await fetch(`${SUPA}/rest/v1/rpc/rede_p4_ct_mudanca_enviar`, {
      method: "POST",
      headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_usuario: usuario.id, p_alvo: alvo }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!envio.ok) return resposta({ ok: false, motivo: "banco" }, 502);
  } catch {
    return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  }
  return resposta({ ok: true });
}

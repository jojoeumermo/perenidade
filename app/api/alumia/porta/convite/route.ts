// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A página do convite pergunta se o código vale (supabase/migracoes/20261114-alumia-o8-porta.sql, alumia_convite_conferir).
//   POST {codigo} → {valido, vence_em?}
// A resposta não diz de quem é o convite, nem quantos a pessoa já gerou. Freio por rede, na memória do processo: 30 consultas a
// cada 10 minutos (adivinhar um código de 128 bits não é o caminho, mas a rota não precisa ajudar).
import { criarFreio, deOutraOrigem, impressaoDoPedido, resposta, rpcDeServico } from "@/lib/rede/convites/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const freio = criarFreio(30, 10 * 60_000);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  const c = (await pedido.json().catch(() => null)) as { codigo?: unknown } | null;
  const codigo = typeof c?.codigo === "string" ? c.codigo.trim().toLowerCase() : "";
  if (!/^[0-9a-f]{32}$/.test(codigo)) return resposta({ valido: false });
  if (!freio(impressaoDoPedido(pedido) ?? "sem-rede")) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);
  const r = await rpcDeServico<{ valido?: boolean; vence_em?: string }>("alumia_convite_conferir", { p_codigo: codigo });
  if (!r.ok) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  return resposta({ valido: r.dado.valido === true, vence_em: r.dado.valido ? (r.dado.vence_em ?? null) : null });
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Trocar os passes de uma caixa (public.rede_caixa_trocar): POST {id, pl, pd_h?, pl_h?, bloqueio}. Só chegam os RESUMOS dos passes
// novos. Bloquear é trocar o passe de depósito da caixa que a pessoa bloqueada usa, com `bloqueio: true` (o passe velho para na hora,
// e quem foi bloqueado continua recebendo "ok" ao depositar). SEM sessão de conta: o servidor não sabe quem bloqueou quem.
import { deB64u, paraBytea, resumo, ROTULOS } from "@/lib/rede/caixas/base";
import { lerCorpo, recusaDeSessao, responder, trazSessao } from "@/lib/rede/caixas/rota";
import { CORPO_MAXIMO } from "@/lib/rede/caixas/tamanhos";
import { rpcDeServico } from "@/lib/rede/convites/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(pedido: Request) {
  if (trazSessao(pedido)) return recusaDeSessao();
  const corpo = await lerCorpo(pedido, CORPO_MAXIMO);
  const id = deB64u(corpo?.id, 32), pl = deB64u(corpo?.pl, 32);
  const pdH = corpo?.pd_h == null ? null : deB64u(corpo.pd_h, 32);
  const plH = corpo?.pl_h == null ? null : deB64u(corpo.pl_h, 32);
  if (!id || !pl || (corpo?.pd_h != null && !pdH) || (corpo?.pl_h != null && !plH) || (!pdH && !plH) || typeof corpo?.bloqueio !== "boolean") {
    return responder({ ok: false, erro: "invalido" }, 400);
  }
  const r = await rpcDeServico<{ ok: boolean; erro?: string }>("rede_caixa_trocar", {
    p_id_h: paraBytea(resumo(ROTULOS.caixa, id)), p_pl: paraBytea(pl), p_pd_h_novo: pdH ? paraBytea(pdH) : null, p_pl_h_novo: plH ? paraBytea(plH) : null, p_bloqueio: corpo.bloqueio,
  });
  if (!r.ok) return responder({ ok: false, erro: "rede" }, 502);
  return responder(r.dado?.ok ? { ok: true } : { ok: false, erro: r.dado?.erro ?? "nao_encontrada" }, r.dado?.ok ? 200 : 404);
}

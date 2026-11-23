// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Apagar uma caixa e tudo o que há nela (public.rede_caixa_apagar): POST {id, pl}. SEM sessão de conta. Responde igual com passe certo
// ou errado.
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
  if (!id || !pl) return responder({ ok: false, erro: "invalido" }, 400);
  const r = await rpcDeServico("rede_caixa_apagar", { p_id_h: paraBytea(resumo(ROTULOS.caixa, id)), p_pl: paraBytea(pl) });
  if (!r.ok && r.codigo === "sem_servico") return responder({ ok: false, erro: "sem_servico" }, 503);
  return r.ok ? responder({ ok: true }) : responder({ ok: false, erro: "rede" }, 502);
}

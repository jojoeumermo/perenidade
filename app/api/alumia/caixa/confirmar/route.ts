// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confirmar a leitura (public.rede_caixa_confirmar): POST {id, pl, ate}. Numa caixa de um leitor só, os pacotes até `ate` SAEM do
// banco. SEM sessão de conta. Responde igual com passe certo ou errado.
import { deB64u, paraBytea, resumo, ROTULOS } from "@/lib/rede/caixas/base";
import { lerCorpo, recusaDeSessao, responder, trazSessao } from "@/lib/rede/caixas/rota";
import { CORPO_MAXIMO } from "@/lib/rede/caixas/tamanhos";
import { rpcDeServico } from "@/lib/rede/convites/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O maior integer do Postgres (2^31 - 1). */
const INTEIRO_MAXIMO = 2_147_483_647;

export async function POST(pedido: Request) {
  if (trazSessao(pedido)) return recusaDeSessao();
  const corpo = await lerCorpo(pedido, CORPO_MAXIMO);
  const id = deB64u(corpo?.id, 32), pl = deB64u(corpo?.pl, 32);
  const ate = Number(corpo?.ate);
  // `ate` é um integer do Postgres: acima de 2^31 - 1 o banco recusaria com erro de tipo (o fuzzing achou com 2^53 e 1e308).
  if (!id || !pl || !Number.isInteger(ate) || ate < 0 || ate > INTEIRO_MAXIMO) return responder({ ok: false, erro: "invalido" }, 400);
  const r = await rpcDeServico("rede_caixa_confirmar", { p_id_h: paraBytea(resumo(ROTULOS.caixa, id)), p_pl: paraBytea(pl), p_ate: ate });
  if (!r.ok && r.codigo === "sem_servico") return responder({ ok: false, erro: "sem_servico" }, 503);
  return r.ok ? responder({ ok: true }) : responder({ ok: false, erro: "rede" }, 502);
}

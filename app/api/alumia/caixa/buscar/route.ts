// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Buscar os pacotes de uma caixa anônima (public.rede_caixa_buscar). POST {id, pl, cursor} → {pacotes:[{ordem, envelope, franquia,
// marca, unico, dia}]}. SEM sessão de conta. Passe de leitura errado ou caixa que não existe: lista vazia, igual à caixa vazia.
// O aparelho busca uma caixa por pedido, em intervalo fixo (lib/rede/caixas/agenda.ts): buscar várias num pedido só ligaria as caixas.
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
  const cursor = Number(corpo?.cursor ?? 0);
  // O cursor é um integer do Postgres: acima de 2^31 - 1 (ou 1e21, que o Number aceita) o banco recusaria com erro de tipo.
  if (!id || !pl || !Number.isInteger(cursor) || cursor < 0 || cursor > INTEIRO_MAXIMO) return responder({ ok: false, erro: "invalido" }, 400);
  const r = await rpcDeServico<{ pacotes: unknown[] }>("rede_caixa_buscar", { p_id_h: paraBytea(resumo(ROTULOS.caixa, id)), p_pl: paraBytea(pl), p_cursor: cursor });
  if (!r.ok) return r.codigo === "sem_servico" ? responder({ ok: false, erro: "sem_servico" }, 503) : responder({ ok: false, erro: "rede" }, 502);
  return responder({ pacotes: Array.isArray(r.dado?.pacotes) ? r.dado.pacotes : [] });
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O diretório das chaves públicas do chat novo, por codinome (public.rede_diretorio_ler): POST {codinome} → {conta}. SEM sessão de
// conta: o servidor não fica sabendo quem procurou quem. Um freio por rede na memória do processo (a impressão da rede é calculada na
// hora e nunca guardada nem mandada ao banco). Não diz quantas pré-chaves sobram (isso diria quantas conversas a pessoa começou).
import { lerCorpo, recusaDeSessao, responder, trazSessao } from "@/lib/rede/caixas/rota";
import { CORPO_MAXIMO } from "@/lib/rede/caixas/tamanhos";
import { criarFreio, impressaoDoFreio, impressaoDoPedido, rpcDeServico } from "@/lib/rede/convites/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const freio = criarFreio(120, 60_000);

export async function POST(pedido: Request) {
  if (trazSessao(pedido)) return recusaDeSessao();
  if (!freio(impressaoDoFreio(impressaoDoPedido(pedido)))) return responder({ ok: false, erro: "muitos_pedidos" }, 429);
  const corpo = await lerCorpo(pedido, CORPO_MAXIMO);
  const codinome = typeof corpo?.codinome === "string" ? corpo.codinome.trim() : "";
  // O byte zero não cabe num text do Postgres (o banco recusaria com erro de codificação): recusa aqui, como qualquer codinome inválido.
  if (codinome.length < 3 || codinome.length > 30 || codinome.includes("\u0000")) return responder({ ok: false, erro: "invalido" }, 400);
  const r = await rpcDeServico<Record<string, unknown> | null>("rede_diretorio_ler", { p_codinome: codinome });
  if (!r.ok) return responder({ ok: false, erro: r.codigo === "sem_servico" ? "sem_servico" : "rede" }, r.codigo === "sem_servico" ? 503 : 502);
  return r.dado ? responder({ conta: r.dado }) : responder({ ok: false, erro: "nao_encontrado" }, 404);
}

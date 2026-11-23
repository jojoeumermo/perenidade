// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O desafio da prova de trabalho do pedido de conversa (lib/rede/caixas/prova-servidor.ts): GET → {desafio, bits}. Sem estado (nada é
// gravado ao emitir), SEM sessão de conta. Vale 10 minutos, uma vez só (o resumo do desafio usado vai para os passes gastos no lote do
// pedido).
import { paraB64u } from "@/lib/rede/caixas/base";
import { emitirDesafioDoPedido } from "@/lib/rede/caixas/prova-servidor";
import { recusaDeSessao, responder, trazSessao } from "@/lib/rede/caixas/rota";
import { segredoDosPasses } from "@/lib/rede/passes/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(pedido: Request) {
  if (trazSessao(pedido)) return recusaDeSessao();
  const segredo = segredoDosPasses();
  if (!segredo) return responder({ ok: false, erro: "sem_servico" }, 503);
  const { desafio, bits } = emitirDesafioDoPedido(segredo);
  return responder({ desafio: paraB64u(desafio), bits });
}

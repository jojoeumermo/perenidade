// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Entrega a fila da federação (interno.rede_fed_fila). Quem chama é a rotina agendada do banco (interno.rede_fed_cutucar, pg_cron +
// pg_net, a cada minuto quando há entrega vencida). O pedido não leva segredo de propósito: esta rota só entrega o que JÁ está na
// fila, montado na hora a partir do banco; quem chamar à toa só adianta a entrega. Teto de 6 chamadas por minuto por endereço.
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { LIMITE_TOTAL, processarFila } from "@/lib/rede/fediverso/entrega";
import { modoTotal } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(pedido: Request) {
  const barrado = conferirTeto(pedido, "entregar", 6);
  if (barrado) return barrado;
  // No modo "fediverso-total", até 200 por chamada (10 de cada vez, 2 por domínio, com circuito); fora dele, 40, como sempre.
  const r = await processarFila(modoTotal() ? LIMITE_TOTAL : 40).catch(() => null);
  if (!r) return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({ ok: true, ...r }, { headers: { "Cache-Control": "no-store" } });
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A caixa de saída do ator da instância: sempre vazia (ele não posta nada).
import { CONTEXTO } from "@/lib/rede/fediverso/documentos";
import { conferirLeitor, conferirTeto } from "@/lib/rede/fediverso/rotas";
import { fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request) {
  const barrado = conferirTeto(pedido, "instancia");
  if (barrado) return barrado;
  const recusado = await conferirLeitor(pedido);
  if (recusado) return recusado;
  return respostaAP({ "@context": CONTEXTO, id: `${fed.instancia}/outbox`, type: "OrderedCollection", totalItems: 0, orderedItems: [] }, 200, 3600);
}

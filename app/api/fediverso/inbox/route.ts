// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A caixa de entrada compartilhada da Alumia (a "sharedInbox": uma entrega por instância em vez de uma por pessoa). Mesmas regras
// da caixa de cada pessoa: sem assinatura HTTP conferida, nada entra (lib/rede/fediverso/caixa.ts).
import { caixaDeEntrada } from "@/lib/rede/fediverso/rotas";

export const runtime = "nodejs";

export async function POST(pedido: Request) {
  return caixaDeEntrada(pedido);
}

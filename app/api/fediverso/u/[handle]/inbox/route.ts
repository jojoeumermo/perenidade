// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A caixa de entrada de uma pessoa da Alumia no Fediverso: só aceita atividade com assinatura HTTP conferida (lib/rede/fediverso/caixa.ts).
import { caixaDeEntrada } from "@/lib/rede/fediverso/rotas";

export const runtime = "nodejs";

export async function POST(pedido: Request) {
  return caixaDeEntrada(pedido);
}

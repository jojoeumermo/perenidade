// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A caixa de entrada de uma comunidade da Alumia como Group (o jeito do Lemmy: seguir a comunidade, mandar post e comentário para
// ela). Só existe com "fediverso-total" e "fediverso-grupos" ligados (desligados por padrão: 404, como se não existisse). Mesmas
// regras das outras caixas: sem assinatura HTTP conferida, nada entra (lib/rede/fediverso/caixa.ts).
import { caixaDeEntrada } from "@/lib/rede/fediverso/rotas";
import { gruposLigados, semFederacao } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function POST(pedido: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!gruposLigados()) return semFederacao();
  const slug = (await params).slug.toLowerCase();
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return new Response("Not Found", { status: 404 });
  return caixaDeEntrada(pedido, { comunidade: slug });
}

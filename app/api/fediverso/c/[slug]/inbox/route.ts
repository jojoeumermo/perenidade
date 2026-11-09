// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A caixa de entrada de uma comunidade da Alumia como Group (o jeito do Lemmy: seguir a comunidade, mandar post e comentário para
// ela). Só existe com "fediverso-total" e "fediverso-grupos" ligados (desligados por padrão: 404, como se não existisse). Só para
// comunidade que o banco diz que pode sair (aberta e pública; ação "comunidade" da F3): fechada, restrita, núcleo ou inexistente dá
// 404. Mesmas regras das outras caixas: sem assinatura HTTP conferida, nada entra (lib/rede/fediverso/caixa.ts), e a nota só conta
// como "da comunidade" se for endereçada ao Group (to, cc ou audience).
import { caixaDeEntrada, conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, gruposLigados, semFederacao } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function POST(pedido: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!gruposLigados()) return semFederacao();
  const slug = (await params).slug.toLowerCase();
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return new Response("Not Found", { status: 404 });
  const barrado = conferirTeto(pedido, "inbox-comunidade", 300);
  if (barrado) return barrado;
  const c = await banco<{ estado?: string } | null>("comunidade", { slug }).catch(() => undefined);
  if (c === undefined) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "120" } });
  if (c?.estado !== "ligado") return new Response("Not Found", { status: 404 });
  return caixaDeEntrada(pedido, { comunidade: slug });
}

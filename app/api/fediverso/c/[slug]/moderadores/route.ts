// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A moderação de uma comunidade aberta (a coleção "moderators" do Group, [LEMMY]). A coleção existe, porque o Lemmy a procura,
// mas sai SEMPRE vazia: quem modera uma comunidade não é exposto para fora (regra da casa: nenhuma lista de pessoas). O banco já
// manda a lista vazia (ação "comunidade", 20261110-fediverso-privacidade.sql) e esta rota não repassa nome nenhum, venha o que
// vier. Só com fediverso-total e fediverso-grupos.
import { colecaoDeModeradores } from "@/lib/rede/fediverso/documentos";
import { gruposLigados, SLUG_DE_COMUNIDADE } from "@/lib/rede/fediverso/enderecos";
import { conferirLeitor, conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request, { params }: { params: Promise<{ slug: string }> }) {
  const barrado = conferirTeto(pedido, "moderadores", 60);
  if (barrado) return barrado;
  const recusado = await conferirLeitor(pedido);
  if (recusado) return recusado;
  const slug = (await params).slug.toLowerCase();
  if (!gruposLigados() || !SLUG_DE_COMUNIDADE.test(slug)) return new Response("Not Found", { status: 404 });
  const c = await banco<{ estado: string } | null>("comunidade", { slug }).catch(() => undefined);
  if (c === undefined) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (!c || c.estado !== "ligado") return new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  return respostaAP(colecaoDeModeradores(fed, slug, []), 200, 300);
}

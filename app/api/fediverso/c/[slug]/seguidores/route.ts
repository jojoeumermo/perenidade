// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os seguidores de uma comunidade aberta (Group): só o total, como os das pessoas. Só com fediverso-total e fediverso-grupos.
// Ação do banco pedida à frente F3: comunidade_seguidores {slug} → {total}.
import { colecaoDeSeguidoresDaComunidade } from "@/lib/rede/fediverso/documentos";
import { gruposLigados, SLUG_DE_COMUNIDADE } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request, { params }: { params: Promise<{ slug: string }> }) {
  const barrado = conferirTeto(pedido, "seguidores", 60);
  if (barrado) return barrado;
  const slug = (await params).slug.toLowerCase();
  if (!gruposLigados() || !SLUG_DE_COMUNIDADE.test(slug)) return new Response("Not Found", { status: 404 });
  const r = await banco<{ total?: number } | null>("comunidade_seguidores", { slug }).catch(() => undefined);
  if (r === undefined) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (!r) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  return respostaAP(colecaoDeSeguidoresDaComunidade(fed, slug, Number.isInteger(r.total) && (r.total ?? 0) >= 0 ? (r.total as number) : 0), 200, 300);
}

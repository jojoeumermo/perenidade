// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A caixa de saída de uma comunidade aberta (Group): os últimos 20 posts que podem sair, cada um como Announce(Create(Note)), que é o
// que o Lemmy lê quando alguém de lá abre a comunidade pela primeira vez. Só com fediverso-total e fediverso-grupos.
// Ação do banco pedida à frente F3: comunidade_outbox {slug, limite} → {total, itens: post[]} (só posts federáveis da comunidade).
import { caixaDeSaidaDaComunidade, type PostFederado } from "@/lib/rede/fediverso/documentos";
import { gruposLigados, SLUG_DE_COMUNIDADE } from "@/lib/rede/fediverso/enderecos";
import { conferirLeitor, conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request, { params }: { params: Promise<{ slug: string }> }) {
  const barrado = conferirTeto(pedido, "outbox", 60);
  if (barrado) return barrado;
  const recusado = await conferirLeitor(pedido);
  if (recusado) return recusado;
  const slug = (await params).slug.toLowerCase();
  if (!gruposLigados() || !SLUG_DE_COMUNIDADE.test(slug)) return new Response("Not Found", { status: 404 });
  const c = await banco<{ estado: string } | null>("comunidade", { slug }).catch(() => undefined);
  if (c === undefined) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (!c || c.estado !== "ligado") return new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  const r = await banco<{ total?: number; itens?: PostFederado[] }>("comunidade_outbox", { slug, limite: 20 }).catch(() => null);
  const itens = Array.isArray(r?.itens) ? r.itens : [];
  const total = Number.isInteger(r?.total) && (r?.total ?? 0) >= 0 ? (r?.total as number) : itens.length;
  return respostaAP(caixaDeSaidaDaComunidade(fed, slug, total, itens), 200, 120);
}

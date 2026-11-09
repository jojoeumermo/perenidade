// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os posts fixados no perfil (a coleção "featured" do ator), como o Mastodon mostra no topo de um perfil. Só os que podem sair
// (o banco confere com interno.rede_fed_federavel; aqui, de novo, a visibilidade). Só no modo total (fediverso-total).
// A ação "destaques" do banco ({handle} → {itens: post[]}) é pedida à frente F3; enquanto não existe, a coleção sai vazia.
import { colecaoDeDestaques, type PostFederado } from "@/lib/rede/fediverso/documentos";
import { HANDLE_FED, modoTotal } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request, { params }: { params: Promise<{ handle: string }> }) {
  const barrado = conferirTeto(pedido, "destaques", 60);
  if (barrado) return barrado;
  const handle = (await params).handle.toLowerCase();
  if (!modoTotal() || !HANDLE_FED.test(handle)) return new Response("Not Found", { status: 404 });
  const a = await banco<{ estado: string }>("ator", { handle }).catch(() => null);
  if (!a) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (a.estado !== "ligado") return new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  const r = await banco<{ itens?: PostFederado[] }>("destaques", { handle }).catch(() => null);
  const posts = (Array.isArray(r?.itens) ? r.itens : []).filter((p) => p && p.handle === handle);
  return respostaAP(colecaoDeDestaques(fed, handle, posts), 200, 300);
}

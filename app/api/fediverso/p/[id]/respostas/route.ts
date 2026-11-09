// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As respostas a um post da Alumia (a coleção "replies" da Note): os ids das respostas DAQUI que também podem sair, para a outra
// instância montar o fio. Só no modo total (fediverso-total) e só para post que pode sair; o resto é 404.
// A ação "respostas" do banco ({id, limite} → {itens: id[]}) é pedida à frente F3; enquanto não existe, a coleção sai vazia.
import { colecaoDeRespostas, visibilidadeQueSai, type PostFederado } from "@/lib/rede/fediverso/documentos";
import { ID_DE_POST, modoTotal } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request, { params }: { params: Promise<{ id: string }> }) {
  const barrado = conferirTeto(pedido, "respostas", 60);
  if (barrado) return barrado;
  const id = (await params).id.toLowerCase();
  if (!modoTotal() || !ID_DE_POST.test(id)) return new Response("Not Found", { status: 404 });
  const post = await banco<PostFederado | { apagado: true } | null>("post", { id }).catch(() => undefined);
  if (post === undefined) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (!post || "apagado" in post || !visibilidadeQueSai(post)) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=120" } });
  const r = await banco<{ itens?: unknown[] }>("respostas", { id, limite: 40 }).catch(() => null);
  const ids = (Array.isArray(r?.itens) ? r.itens : []).filter((x): x is string => typeof x === "string" && ID_DE_POST.test(x)).slice(0, 40);
  return respostaAP(colecaoDeRespostas(fed, id, ids), 200, 120);
}

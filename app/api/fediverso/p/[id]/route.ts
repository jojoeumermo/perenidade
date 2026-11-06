// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Um post da Alumia como Note do Fediverso. Só responde o que pode sair agora (público para a internet, de quem ligou a federação,
// escrito depois de ligar, fora de núcleo, comunidade fechada ou restrita e equipe: interno.rede_fed_federavel). O que saiu e foi
// retirado responde 410; o resto, 404, como se não existisse. Quem abre no navegador vai para a página do post.
import { documentoDoPost, type PostFederado } from "@/lib/rede/fediverso/documentos";
import { ID_DE_POST } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto, querHtml } from "@/lib/rede/fediverso/rotas";
import { banco, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request, { params }: { params: Promise<{ id: string }> }) {
  const barrado = conferirTeto(pedido, "post");
  if (barrado) return barrado;
  const id = (await params).id.toLowerCase();
  if (!ID_DE_POST.test(id)) return new Response("Not Found", { status: 404 });
  if (querHtml(pedido)) return Response.redirect(fed.paginaDoPost(id), 302);
  const post = await banco<PostFederado | { apagado: true } | null>("post", { id }).catch(() => undefined);
  if (post === undefined) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (post && "apagado" in post) return new Response("Gone", { status: 410, headers: { "Cache-Control": "public, max-age=300" } });
  if (!post) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=120" } });
  return respostaAP(documentoDoPost(fed, post), 200, 120);
}

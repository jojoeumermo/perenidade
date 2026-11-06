// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// WebFinger da Alumia (RFC 7033): é como o Mastodon e as outras redes do Fediverso acham "@nome@alumia.institutolucia.org". Só
// responde por quem LIGOU a federação no perfil; o resto é 404, sem dizer se a conta existe.
import { documentoWebfinger } from "@/lib/rede/fediverso/documentos";
import { handleDoWebfinger } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, fed } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

const naoAchado = () => new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });

export async function GET(pedido: Request) {
  const barrado = conferirTeto(pedido, "webfinger");
  if (barrado) return barrado;
  const resource = new URL(pedido.url).searchParams.get("resource") ?? "";
  if (!resource || resource.length > 300) return new Response("Bad Request", { status: 400 });
  const handle = handleDoWebfinger(resource, fed.dominio);
  if (!handle) return naoAchado();
  const a = await banco<{ estado: string }>("ator", { handle }).catch(() => null);
  if (!a) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (a.estado !== "ligado") return naoAchado();
  return Response.json(documentoWebfinger(fed, handle), {
    headers: { "Content-Type": "application/jrd+json; charset=utf-8", "Cache-Control": "public, max-age=600", "Access-Control-Allow-Origin": "*", "X-Robots-Tag": "noindex" },
  });
}

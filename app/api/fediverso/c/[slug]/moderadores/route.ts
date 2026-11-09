// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A moderação de uma comunidade aberta (a coleção "moderators" do Group, [LEMMY]). Só entra quem modera E está com a federação
// ligada: quem não consentiu em federar (LGPD, art. 7º, I e art. 33, VIII) nunca aparece aqui, nem pelo @. O banco filtra (ação
// "comunidade": moderadores) e esta rota confere o formato de novo. Só com fediverso-total e fediverso-grupos.
import { colecaoDeModeradores } from "@/lib/rede/fediverso/documentos";
import { gruposLigados, SLUG_DE_COMUNIDADE } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request, { params }: { params: Promise<{ slug: string }> }) {
  const barrado = conferirTeto(pedido, "moderadores", 60);
  if (barrado) return barrado;
  const slug = (await params).slug.toLowerCase();
  if (!gruposLigados() || !SLUG_DE_COMUNIDADE.test(slug)) return new Response("Not Found", { status: 404 });
  const c = await banco<{ estado: string; moderadores?: unknown } | null>("comunidade", { slug }).catch(() => undefined);
  if (c === undefined) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (!c || c.estado !== "ligado") return new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  const handles = (Array.isArray(c.moderadores) ? c.moderadores : []).filter((h): h is string => typeof h === "string");
  return respostaAP(colecaoDeModeradores(fed, slug, handles), 200, 300);
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O Atom da Alumia (Prompt 4, item 50): GET /api/rede/atom/c/<slug da comunidade aberta>, /api/rede/atom/u/<@ da organização com
// selo> e /api/rede/atom/t/<#tema> [?lang=en]. O mesmo recorte do RSS (só o que já sai da Alumia, até 30 posts, só texto), atrás de
// "alumia-alcance" e de "alumia-p4-descoberta-estudo". Fora da regra: 404. Nada de quem lê é lido nem guardado.
import { responderFeed } from "@/lib/rede/descoberta-estudo/rotas-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(pedido: Request, { params }: { params: Promise<{ tipo: string; nome: string }> }) {
  const { tipo, nome } = await params;
  return responderFeed(pedido, "atom", tipo, nome);
}

export const HEAD = GET;

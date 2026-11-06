// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O índice do NodeInfo: diz onde está o documento 2.1 da Alumia (app/api/fediverso/nodeinfo).
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { fed } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request) {
  const barrado = conferirTeto(pedido, "nodeinfo", 30);
  if (barrado) return barrado;
  return Response.json(
    { links: [{ rel: "http://nodeinfo.diaspora.software/ns/schema/2.1", href: `${fed.base}/api/fediverso/nodeinfo` }] },
    { headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } },
  );
}

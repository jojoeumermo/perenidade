// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// NodeInfo 2.1 da Alumia (apontado por /.well-known/nodeinfo): o que a instância é e números agregados (quantas pessoas ligaram a
// federação e quantos posts saíram), sem nome de ninguém. Inscrições fechadas: a conta se cria no site do instituto.
import { documentoNodeinfo } from "@/lib/rede/fediverso/documentos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request) {
  const barrado = conferirTeto(pedido, "nodeinfo", 30);
  if (barrado) return barrado;
  const contagem = await banco<{ usuarios: number; posts: number }>("contagem").catch(() => ({ usuarios: 0, posts: 0 }));
  return Response.json(documentoNodeinfo(contagem, "1.0"), {
    headers: {
      "Content-Type": 'application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.1#"',
      "Cache-Control": "public, max-age=1800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

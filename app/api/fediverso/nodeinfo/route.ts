// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// NodeInfo 2.1 da Alumia (apontado por /.well-known/nodeinfo): o que a instância é e números agregados (quantas pessoas ligaram a
// federação e quantos posts saíram), sem nome de ninguém. Inscrições fechadas: a conta se cria no site do instituto. No modo total
// (fediverso-total): também os ativos do mês e do semestre (se o banco devolve, na ação "contagem") e o documento 2.0 em
// ?esquema=2.0. São só totais: nenhum dado de pessoa sai daqui.
import { documentoNodeinfo, type ContagemDoNodeinfo } from "@/lib/rede/fediverso/documentos";
import { modoTotal } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request) {
  const barrado = conferirTeto(pedido, "nodeinfo", 30);
  if (barrado) return barrado;
  const total = modoTotal();
  const esquema = total && new URL(pedido.url).searchParams.get("esquema") === "2.0" ? "2.0" : "2.1";
  const contagem = await banco<ContagemDoNodeinfo>("contagem").catch(() => ({ usuarios: 0, posts: 0 }));
  return Response.json(documentoNodeinfo(contagem, "1.0", { total, esquema }), {
    headers: {
      "Content-Type": `application/json; profile="http://nodeinfo.diaspora.software/ns/schema/${esquema}#"`,
      "Cache-Control": "public, max-age=1800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

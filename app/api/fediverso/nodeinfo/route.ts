// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// NodeInfo 2.1 da Alumia (apontado por /.well-known/nodeinfo): o que a instância é e números agregados (quantas pessoas ligaram a
// federação e quantos posts saíram), sem nome de ninguém. Inscrições fechadas: a conta se cria no site do instituto. No modo total
// (fediverso-total): também os ativos do mês e do semestre (ação "contagem_ativos" da F3: {mes, semestre}) e o documento 2.0 em
// ?esquema=2.0. São só totais: nenhum dado de pessoa sai daqui. Os números de PESSOAS (total e ativos) só saem a partir de 3;
// abaixo disso sai 0 (o de posts não conta pessoas e sai como é).
import { documentoNodeinfo, type ContagemDoNodeinfo } from "@/lib/rede/fediverso/documentos";
import { modoTotal } from "@/lib/rede/fediverso/enderecos";
import { conferirLeitor, conferirTeto, pisoDePessoas } from "@/lib/rede/fediverso/rotas";
import { banco } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request) {
  const barrado = conferirTeto(pedido, "nodeinfo", 30);
  if (barrado) return barrado;
  const recusado = await conferirLeitor(pedido);
  if (recusado) return recusado;
  const total = modoTotal();
  const esquema = total && new URL(pedido.url).searchParams.get("esquema") === "2.0" ? "2.0" : "2.1";
  const [contagem, ativos] = await Promise.all([
    banco<ContagemDoNodeinfo>("contagem").catch(() => ({ usuarios: 0, posts: 0 })),
    // Os ativos vêm de outra ação da F3 ({mes, semestre}); fora do modo total, nem pergunta.
    total ? banco<{ mes?: unknown; semestre?: unknown }>("contagem_ativos").catch(() => null) : Promise.resolve(null),
  ]);
  const comAtivos: ContagemDoNodeinfo = {
    usuarios: pisoDePessoas(contagem?.usuarios),
    posts: contagem?.posts ?? 0,
    ativos_mes: typeof ativos?.mes === "number" ? pisoDePessoas(ativos.mes) : null,
    ativos_semestre: typeof ativos?.semestre === "number" ? pisoDePessoas(ativos.semestre) : null,
  };
  return Response.json(documentoNodeinfo(comAtivos, "1.0", { total, esquema }), {
    headers: {
      "Content-Type": `application/json; profile="http://nodeinfo.diaspora.software/ns/schema/${esquema}#"`,
      "Cache-Control": "public, max-age=1800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A caixa de saída de uma pessoa da Alumia: os posts PÚBLICOS que ela escreveu depois de ligar a federação e que ainda podem sair
// (interno.rede_fed_federavel confere de novo a cada leitura). Página de 20, do mais novo ao mais antigo.
import { colecaoDaCaixaDeSaida, paginaDaCaixaDeSaida, type PostFederado } from "@/lib/rede/fediverso/documentos";
import { HANDLE_FED } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request, { params }: { params: Promise<{ handle: string }> }) {
  const barrado = conferirTeto(pedido, "outbox", 60);
  if (barrado) return barrado;
  const handle = (await params).handle.toLowerCase();
  if (!HANDLE_FED.test(handle)) return new Response("Not Found", { status: 404 });
  const q = new URL(pedido.url).searchParams;
  const antes = q.get("antes");
  const pagina = q.has("pagina") || q.has("antes");
  if (antes && !Number.isFinite(Date.parse(antes))) return new Response("Bad Request", { status: 400 });
  const r = await banco<{ total: number; itens: PostFederado[] }>("outbox", { handle, antes: antes ?? null, limite: pagina ? 20 : 1 }).catch(() => null);
  if (!r) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (!pagina) return respostaAP(colecaoDaCaixaDeSaida(fed, handle, r.total), 200, 120);
  const ultimo = r.itens.at(-1);
  const proxima = r.itens.length === 20 && ultimo ? `${fed.outbox(handle)}?antes=${encodeURIComponent(new Date(ultimo.criado_em).toISOString())}` : null;
  const aqui = `${fed.outbox(handle)}${antes ? `?antes=${encodeURIComponent(antes)}` : "?pagina=1"}`;
  return respostaAP(paginaDaCaixaDeSaida(fed, handle, r.itens, aqui, proxima), 200, 120);
}

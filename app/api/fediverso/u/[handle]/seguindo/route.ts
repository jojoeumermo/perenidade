// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quem uma pessoa da Alumia segue (a coleção "following" do ator): só o total. A lista não é pública: ela revelaria a rede de
// relações da pessoa (LGPD, art. 6º, III: só o necessário; o Mastodon só precisa do número). O número só sai a partir de 3
// (abaixo disso, 0). Só no modo total (fediverso-total).
import { colecaoSeguindo } from "@/lib/rede/fediverso/documentos";
import { HANDLE_FED, modoTotal } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto, pisoDePessoas } from "@/lib/rede/fediverso/rotas";
import { banco, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request, { params }: { params: Promise<{ handle: string }> }) {
  const barrado = conferirTeto(pedido, "seguindo", 60);
  if (barrado) return barrado;
  const handle = (await params).handle.toLowerCase();
  if (!modoTotal() || !HANDLE_FED.test(handle)) return new Response("Not Found", { status: 404 });
  const r = await banco<{ total: number }>("seguindo_publico", { handle }).catch(() => null);
  if (!r) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  return respostaAP(colecaoSeguindo(fed, handle, pisoDePessoas(r.total)), 200, 300);
}

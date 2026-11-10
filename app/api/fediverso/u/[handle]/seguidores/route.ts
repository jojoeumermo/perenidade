// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os seguidores de uma pessoa da Alumia no Fediverso: só o total, e só a partir de 3 (abaixo disso sai 0). A lista de quem segue
// não é pública (privacidade de quem segue).
import { colecaoDeSeguidores } from "@/lib/rede/fediverso/documentos";
import { HANDLE_FED } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto, pisoDePessoas } from "@/lib/rede/fediverso/rotas";
import { banco, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request, { params }: { params: Promise<{ handle: string }> }) {
  const barrado = conferirTeto(pedido, "seguidores", 60);
  if (barrado) return barrado;
  const handle = (await params).handle.toLowerCase();
  if (!HANDLE_FED.test(handle)) return new Response("Not Found", { status: 404 });
  const r = await banco<{ total: number }>("seguidores", { handle }).catch(() => null);
  if (!r) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  return respostaAP(colecaoDeSeguidores(fed, handle, pisoDePessoas(r.total)), 200, 300);
}

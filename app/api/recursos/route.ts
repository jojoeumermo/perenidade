// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Recursos que a coordenação ligou ou desligou pelo painel, para o navegador somar à variável de montagem.
// Público de propósito: só os nomes dos recursos (nada de quem decidiu), com cache curto na borda.
import { carregarVivos } from "@/lib/recursos-vivos";

export const dynamic = "force-dynamic";

export async function GET() {
  const vivos = await carregarVivos();
  return Response.json(
    { ligados: [...vivos.ligados].sort(), desligados: [...vivos.desligados].sort() },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300", "X-Robots-Tag": "noindex" } },
  );
}

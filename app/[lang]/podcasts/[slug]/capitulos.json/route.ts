// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { episodio } from "@/lib/podcast-servidor";

// Capítulos no formato do Podcasting 2.0: os tocadores que o leem mostram os marcadores do episódio.
export const revalidate = 300;

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/podcasts/[slug]/capitulos.json">) {
  const e = await episodio((await params).slug);
  if (!e) return new Response("Não encontrado", { status: 404 });
  return Response.json(
    { version: "1.2.0", chapters: (e.capitulos ?? []).map((c) => ({ startTime: c.t, title: c.titulo })) },
    { headers: { "Content-Type": "application/json+chapters", "Access-Control-Allow-Origin": "*" } },
  );
}

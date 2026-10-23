// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { episodio } from "@/lib/podcast-servidor";

// As legendas do episódio (WebVTT): transcrição com tempo para leitores de tela, tocadores e o feed.
export const revalidate = 3600;

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/podcasts/[slug]/legendas.vtt">) {
  const e = await episodio((await params).slug);
  if (!e?.legendas) return new Response("Não encontrado", { status: 404 });
  return new Response(e.legendas, { headers: { "Content-Type": "text/vtt; charset=utf-8", "Access-Control-Allow-Origin": "*" } });
}

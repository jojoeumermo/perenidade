// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O RSS do podcast de uma comunidade (Prompt 4, item 119): GET /api/rede/podcast/<endereço>. Só o que o banco deixa sair
// (public.rede_p4_podcast_rss, chamada como visitante): podcast de comunidade aberta, só os episódios cujo post já pode sair da
// Alumia, sem o texto do post e sem quem publicou. Com "alumia-p4-memoria-e-luta" ou "alumia-alcance" desligados, a Alumia
// interditada, a trava da entrada ligada ou fora da regra: 404. Nada de quem lê é lido nem guardado; nenhum número de quem ouve.
// Feed e rota próprios: não se mistura com o podcast do Instituto (app/podcast.xml).
import { alcanceLigado } from "@/lib/rede/alcance/ligado";
import { alumiaInterditada, basesDoServidor } from "@/lib/rede/alcance/servidor";
import { montarRssDoPodcast, slugOk } from "@/lib/rede/memoria/regras";
import { lerPodcast } from "@/lib/rede/memoria/servidor";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const naoAchado = () =>
  new Response("", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" } });

export async function GET(pedido: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!rotaNovaLigada("memoria-da-luta") || !alcanceLigado() || (await alumiaInterditada())) return naoAchado();
  const slug = (await params).slug.toLowerCase();
  if (!slugOk(slug)) return naoAchado();
  const podcast = await lerPodcast(slug);
  if (!podcast) return naoAchado();
  const bases = basesDoServidor();
  const xml = montarRssDoPodcast(podcast, { site: bases.site, alumia: bases.alumia, lang: new URL(pedido.url).searchParams.get("lang") ?? "pt" });
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

export const HEAD = GET;

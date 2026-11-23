// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O áudio de um episódio do podcast da comunidade (Prompt 4, item 119): GET /api/rede/podcast/<endereço>/<episódio>, o endereço que
// o RSS põe no <enclosure>. Só o episódio que o banco deixa sair (public.rede_p4_podcast_audio, só com a chave de serviço, porque o
// caminho do arquivo leva o id da conta de quem gravou); o servidor busca o arquivo no depósito e entrega pelo nosso endereço, sem
// redirecionar ao depósito. Fora da regra: 404. Nada de quem ouve é lido, guardado ou contado.
import { alcanceLigado } from "@/lib/rede/alcance/ligado";
import { alumiaInterditada } from "@/lib/rede/alcance/servidor";
import { slugOk } from "@/lib/rede/memoria/regras";
import { buscarAudio, lerAudioDoEpisodio } from "@/lib/rede/memoria/servidor";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIPOS = ["audio/webm", "audio/ogg", "audio/mp4"];
const naoAchado = () => new Response("", { status: 404, headers: { "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex" } });

export async function GET(_pedido: Request, { params }: { params: Promise<{ slug: string; episodio: string }> }) {
  if (!rotaNovaLigada("memoria-da-luta") || !alcanceLigado() || (await alumiaInterditada())) return naoAchado();
  const { slug: cru, episodio } = await params;
  const slug = cru.toLowerCase();
  if (!slugOk(slug) || !UUID.test(episodio)) return naoAchado();
  const onde = await lerAudioDoEpisodio(slug, episodio);
  if (!onde) return naoAchado();
  const arquivo = await buscarAudio(onde.bucket, onde.caminho);
  if (!arquivo) return naoAchado();
  const tamanho = arquivo.headers.get("content-length");
  return new Response(arquivo.body, {
    status: 200,
    headers: {
      "Content-Type": TIPOS.includes(onde.tipo) ? onde.tipo : "audio/webm",
      ...(tamanho && /^\d+$/.test(tamanho) ? { "Content-Length": tamanho } : {}),
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

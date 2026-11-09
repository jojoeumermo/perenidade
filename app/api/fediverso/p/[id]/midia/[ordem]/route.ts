// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A imagem de um post federado num endereço público e ESTÁVEL (o "url" do attachment da Note). As imagens dos posts moram no
// depósito "rede-midia" do Supabase, que é PRIVADO: o site mostra cada uma por link assinado, que expira, e o Mastodon guarda o
// endereço do anexo; por isso a imagem sai por aqui. Esta rota só serve imagem de post que pode sair agora (a ação "post" do banco
// confere interno.rede_fed_federavel a cada pedido) e lê o depósito como VISITANTE (chave pública do banco): a regra do próprio
// depósito (rede_midia_leitura → rede_pub_midia_pode) só deixa ler o que um visitante já vê. O endereço leva o id do post e a ordem
// da imagem, nunca o caminho no depósito (que tem o id interno do perfil). A imagem já foi limpa de EXIF/XMP no envio
// (lib/rede/publicar/midia.ts). Só no modo total (fediverso-total).
import { visibilidadeQueSai, type PostFederado } from "@/lib/rede/fediverso/documentos";
import { ID_DE_POST, modoTotal } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

const urlDoBanco = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const chavePublicaDoBanco = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CAMINHO = /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/;
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);
/** O limite do depósito (3 MB, supabase/install.sql: rede-midia). */
const MAX_BYTES = 3 * 1024 * 1024;

const naoAchado = () => new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=120" } });
const indisponivel = () => new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });

export async function GET(pedido: Request, { params }: { params: Promise<{ id: string; ordem: string }> }) {
  const barrado = conferirTeto(pedido, "midia", 120);
  if (barrado) return barrado;
  const { id: bruto, ordem: textoDaOrdem } = await params;
  const id = bruto.toLowerCase();
  if (!modoTotal() || !ID_DE_POST.test(id) || !/^[0-3]$/.test(textoDaOrdem)) return naoAchado();
  const ordem = Number(textoDaOrdem);
  const post = await banco<PostFederado | { apagado: true } | null>("post", { id }).catch(() => undefined);
  if (post === undefined) return indisponivel();
  if (!post || "apagado" in post || !visibilidadeQueSai(post)) return naoAchado();
  const m = (post.midia ?? []).find((x) => x && x.ordem === ordem);
  if (!m || !m.caminho || !CAMINHO.test(m.caminho) || !TIPOS.has(m.tipo)) return naoAchado();
  let r: Response;
  try {
    r = await fetch(`${urlDoBanco}/storage/v1/object/authenticated/rede-midia/${m.caminho.split("/").map(encodeURIComponent).join("/")}`, {
      headers: { apikey: chavePublicaDoBanco, Authorization: `Bearer ${chavePublicaDoBanco}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return indisponivel();
  }
  if (r.status === 400 || r.status === 404) return naoAchado();
  if (!r.ok || !r.body) return indisponivel();
  const declarado = Number(r.headers.get("content-length") ?? "0");
  if (declarado > MAX_BYTES) return naoAchado();
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return naoAchado();
  return new Response(bytes, {
    headers: {
      // O tipo é o que o banco registrou no envio, não o que o depósito diz.
      "Content-Type": m.tipo,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
      "X-Robots-Tag": "noindex",
    },
  });
}

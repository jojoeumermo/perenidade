// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A foto (avatar) ou a capa de uma pessoa que federa, num endereço público e estável, para o "icon" e o "image" do ator. A imagem
// enviada mora no banco como data URL (interno.perfis.rede_avatar_dados / rede_capa_dados), não num depósito: sem esta rota, não
// haveria endereço para o Mastodon buscar. Só sai a imagem que a moderação já aprovou (a ação "ator" só devolve a aprovada, contrato
// 3.1) e só de quem está com a federação ligada. Só no modo total (fediverso-total); fora dele, 404.
//
// A outra instância busca a imagem uma vez e guarda a cópia dela: quem vê o perfil lá não toca a Alumia.
import { lerDataUrl } from "@/lib/rede/fediverso/documentos";
import { HANDLE_FED, modoTotal } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

const naoAchado = () => new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });

export async function GET(pedido: Request, { params }: { params: Promise<{ handle: string; tipo: string }> }) {
  const barrado = conferirTeto(pedido, "imagem", 60);
  if (barrado) return barrado;
  if (!modoTotal()) return naoAchado();
  const { handle: bruto, tipo } = await params;
  const handle = bruto.toLowerCase();
  if (!HANDLE_FED.test(handle) || (tipo !== "avatar" && tipo !== "capa")) return naoAchado();
  const a = await banco<{ estado: string; avatar_url?: string | null; capa_url?: string | null }>("ator", { handle }).catch(() => null);
  if (!a) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (a.estado !== "ligado") return naoAchado();
  const imagem = lerDataUrl(tipo === "avatar" ? a.avatar_url : a.capa_url);
  if (!imagem) return naoAchado();
  return new Response(new Uint8Array(imagem.bytes), {
    headers: {
      "Content-Type": imagem.tipo,
      "Content-Length": String(imagem.bytes.length),
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
      "X-Robots-Tag": "noindex",
    },
  });
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A foto aprovada do cartão de educador (supabase/migracoes/20261109-cartao-publico.sql). A foto mora no banco (WebP já
// reduzido pelo navegador, até 150 KB) e só sai depois de a coordenação aprovar: public.educador_foto devolve nada para
// quem não é educador, está suspenso ou não tem foto. O endereço leva "?v=" com um pedaço do hash da foto, então uma foto
// nova é um endereço novo e a resposta pode ficar guardada por muito tempo.
import { rpcNoBanco } from "@/lib/instagram";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PREFIXO = "data:image/webp;base64,";

export async function GET(_pedido: Request, { params }: RouteContext<"/api/educador-foto/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const r = await rpcNoBanco<string | null>("educador_foto", { p_id: id });
  if (!r.ok || typeof r.dados !== "string" || !r.dados.startsWith(PREFIXO)) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  const bytes = Buffer.from(r.dados.slice(PREFIXO.length), "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

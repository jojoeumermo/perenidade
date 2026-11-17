// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O cartão de um post para colar em outro site (frente 13C): GET /api/rede/embed/<id>[?lang=en]. HTML sem script nenhum, com a
// política de segurança dele (nada roda, nada carrega, sandbox, qualquer site pode embutir) e o estilo fixo pelo hash. Só sai o post
// que o banco deixa sair (public.rede_alc_post, chamada como visitante: primeiro nível, aberto à internet, de perfil ou de
// comunidade aberta). Com a trava da entrada ligada, com "alumia-alcance" desligado ou com o post fora da regra: 404, igual a um
// post que não existe. Nada de quem pede é lido nem guardado.
import { createHash } from "node:crypto";
import { alcanceLigado } from "@/lib/rede/alcance/ligado";
import { ESTILO_DO_CARTAO, ID_OK, idiomaOk, montarCartao, politicaDoCartao } from "@/lib/rede/alcance/regras";
import { alumiaInterditada, basesDoServidor, lerItem, textosDoServidor } from "@/lib/rede/alcance/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLITICA = politicaDoCartao(`sha256-${createHash("sha256").update(ESTILO_DO_CARTAO).digest("base64")}`);
const PREVIA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

const cabecalhos = (cache: string) => ({
  "Content-Security-Policy": POLITICA,
  "Cache-Control": cache,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "X-Robots-Tag": "noindex",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
});

const naoAchado = () => new Response("", { status: 404, headers: { ...cabecalhos("public, max-age=60"), "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(pedido: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!alcanceLigado() || (await alumiaInterditada())) return naoAchado();
  const { id } = await params;
  if (!ID_OK.test(id) && !(PREVIA && /^(exemplo|previa)-[a-z0-9-]{1,60}$/.test(id))) return naoAchado();
  const item = await lerItem(id.toLowerCase());
  if (!item) return naoAchado();
  const lang = idiomaOk(new URL(pedido.url).searchParams.get("lang"));
  const t = textosDoServidor(lang);
  const html = montarCartao(item, { lang, bases: basesDoServidor(), textos: t.cartao });
  return new Response(html, { status: 200, headers: { ...cabecalhos("public, max-age=300"), "Content-Type": "text/html; charset=utf-8" } });
}

export const HEAD = GET;

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O RSS da Alumia (frente 13C): GET /api/rede/rss/c/<slug da comunidade> e /api/rede/rss/u/<@ da organização com selo>
// [?lang=en]. Só os posts que o banco deixa sair (public.rede_alc_rss, chamada como visitante): primeiro nível, abertos à internet,
// de comunidade aberta ou do perfil de organização com selo; até 30, só texto. Com a trava da entrada ligada, com "alumia-alcance"
// desligado ou fora da regra: 404. Nada de quem lê é lido nem guardado.
import { alcanceLigado } from "@/lib/rede/alcance/ligado";
import { HANDLE_OK, idiomaOk, montarRss, rotasDoAlcance, SLUG_OK } from "@/lib/rede/alcance/regras";
import { alumiaInterditada, basesDoServidor, lerCanal, textosDoServidor } from "@/lib/rede/alcance/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const naoAchado = () =>
  new Response("", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" } });

export async function GET(pedido: Request, { params }: { params: Promise<{ tipo: string; nome: string }> }) {
  if (!alcanceLigado() || (await alumiaInterditada())) return naoAchado();
  const { tipo: letra, nome: cru } = await params;
  const tipo = letra === "u" ? "perfil" : letra === "c" ? "comunidade" : null;
  const nome = cru.toLowerCase().replace(/^(@|%40)/, "");
  if (!tipo) return naoAchado();
  if (tipo === "perfil" ? !HANDLE_OK.test(nome) : !SLUG_OK.test(nome)) return naoAchado();
  const canal = await lerCanal(tipo, nome);
  if (!canal) return naoAchado();
  const lang = idiomaOk(new URL(pedido.url).searchParams.get("lang"));
  const bases = basesDoServidor();
  const xml = montarRss(canal, { lang, bases, textos: textosDoServidor(lang).rss, proprio: rotasDoAlcance.rss(bases.site, tipo, nome, lang) });
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

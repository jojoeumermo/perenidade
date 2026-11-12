// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// WebFinger da Alumia (RFC 7033): é como o Mastodon e as outras redes do Fediverso acham "@nome@alumia.institutolucia.org". Só
// responde por quem LIGOU a federação no perfil (no modo total, por todo perfil elegível: quem decide é o banco, na ação "ator");
// o resto é 404, sem dizer se a conta existe.
//
// Modo total (flag fediverso-total, decisão D1): a conta canônica passa a ser "@nome@institutolucia.org". Os dois hosts caem neste
// mesmo app (a Caddy serve os dois), e esta rota aceita os dois domínios no acct: e responde com o "subject" canônico e o "self" no
// ator do host da Alumia. É o caso "subject differs" do Mastodon ([M-WF]): ele refaz a busca no subject e chega ao MESMO ator.
// ANTES de ligar: conferir que institutolucia.org/.well-known/webfinger e /.well-known/host-meta chegam a ESTE app (a ponte do
// Cloudflare, o Worker da Escola, e a Caddy podem desviar o host curto). Se não chegarem, o Mastodon refaz a busca no subject e não
// acha ninguém. Quem confere é scripts/fediverso-interop.mjs (F5), com o A1 do roteiro nos dois hosts.
// Também responde pelo ator da instância ("acct:<domínio>@<domínio>") e, com fediverso-grupos, pelas comunidades abertas (Group).
import { documentoWebfinger, documentoWebfingerDaComunidade, documentoWebfingerDaInstancia, juntarWebfinger } from "@/lib/rede/fediverso/documentos";
import { dominiosDaConta, gruposLigados, handleDoWebfinger, modoTotal, slugDoWebfinger, webfingerDaInstancia } from "@/lib/rede/fediverso/enderecos";
import { conferirLeitor, conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, fed } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

const naoAchado = () => new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
const indisponivel = () => new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
const jrd = (corpo: unknown) =>
  Response.json(corpo, {
    headers: { "Content-Type": "application/jrd+json; charset=utf-8", "Cache-Control": "public, max-age=600", "Access-Control-Allow-Origin": "*", "X-Robots-Tag": "noindex", Vary: "Host" },
  });

export async function GET(pedido: Request) {
  const barrado = conferirTeto(pedido, "webfinger");
  if (barrado) return barrado;
  const recusado = await conferirLeitor(pedido);
  if (recusado) return recusado;
  const resource = new URL(pedido.url).searchParams.get("resource") ?? "";
  if (!resource || resource.length > 300) return new Response("Bad Request", { status: 400 });
  const total = modoTotal();
  if (!total) {
    // Como sempre foi: só o host da Alumia, só pessoa.
    const handle = handleDoWebfinger(resource, fed.dominio);
    if (!handle) return naoAchado();
    const a = await banco<{ estado: string }>("ator", { handle }).catch(() => null);
    if (!a) return indisponivel();
    if (a.estado !== "ligado") return naoAchado();
    return jrd(documentoWebfinger(fed, handle));
  }

  if (webfingerDaInstancia(resource, fed)) return jrd(documentoWebfingerDaInstancia(fed));
  const dominios = dominiosDaConta(fed, true);
  const handle = handleDoWebfinger(resource, dominios);
  const slug = gruposLigados() ? slugDoWebfinger(resource, dominios) : null;
  if (!handle && !slug) return naoAchado();
  const [a, c] = await Promise.all([
    handle ? banco<{ estado: string }>("ator", { handle }).catch(() => null) : Promise.resolve(undefined),
    // A ação da comunidade pode ainda não existir no banco (frente F3): sem ela, a comunidade só não aparece.
    slug ? banco<{ estado: string } | null>("comunidade", { slug }).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  if (handle && a === null && !c) return indisponivel();
  const pessoa = handle && a && a.estado === "ligado" ? documentoWebfinger(fed, handle, true) : null;
  const grupo = slug && c && c.estado === "ligado" ? documentoWebfingerDaComunidade(fed, slug) : null;
  if (pessoa && grupo) return jrd(juntarWebfinger(pessoa, grupo));
  if (pessoa) return jrd(pessoa);
  if (grupo) return jrd(grupo);
  return naoAchado();
}

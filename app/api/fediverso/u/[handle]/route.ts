// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O ator de uma pessoa da Alumia no Fediverso (ActivityPub, docs/rede/FEDIVERSO.md). Só existe para quem LIGOU a federação no
// próprio perfil; para o resto, 404 (nunca existiu) ou 410 (desligou: as outras instâncias apagam o que tinham). Só sai o
// codinome, o @nome, a bio pública e a chave PÚBLICA. Quem abre no navegador vai para a página do perfil.
//
// No modo total (fediverso-total): também a foto e a capa (só o rosto e a capa da galeria, em PNG público; a imagem enviada pela
// pessoa não sai sem consentimento próprio, LGPD art. 6º, III), a coleção "following", o perfil trancado
// (manuallyApprovesFollowers) e a escolha da pessoa de aparecer no diretório e na busca de texto (discoverable/indexable). Tudo vem
// da ação "ator" do banco (contrato 3.1).
import { documentoDoAtor, documentoDoAtorSaindo, imagemDoBanco } from "@/lib/rede/fediverso/documentos";
import { HANDLE_FED, modoTotal } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto, querHtml } from "@/lib/rede/fediverso/rotas";
import { atorComChaves, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

/** O que a ação "ator" devolve a mais no modo total (contrato 3.1). */
interface ExtrasDoAtor {
  avatar_url?: string | null;
  capa_url?: string | null;
  discoverable?: boolean | null;
  trancado?: boolean | null;
}

export async function GET(pedido: Request, { params }: { params: Promise<{ handle: string }> }) {
  const barrado = conferirTeto(pedido, "ator");
  if (barrado) return barrado;
  const handle = (await params).handle.toLowerCase();
  if (!HANDLE_FED.test(handle)) return new Response("Not Found", { status: 404 });
  if (querHtml(pedido)) return Response.redirect(fed.paginaDoPerfil(handle), 302);
  const a = await atorComChaves(handle).catch(() => null);
  if (!a) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (a.estado === "ligado" && a.chave_publica) {
    const base = { handle, nome: a.nome ?? handle, bio: a.bio ?? "", ligado_em: a.ligado_em ?? null, chave_publica: a.chave_publica };
    if (!modoTotal()) return respostaAP(documentoDoAtor(fed, base, { total: false, grupos: false }), 200, 300);
    const x = a as typeof a & ExtrasDoAtor;
    return respostaAP(
      documentoDoAtor(fed, {
        ...base,
        avatar: imagemDoBanco(fed, x.avatar_url),
        capa: imagemDoBanco(fed, x.capa_url),
        discoverable: x.discoverable === true,
        trancado: x.trancado === true,
      }),
      200,
      300,
    );
  }
  if (a.estado === "saindo" && a.chave_publica) return respostaAP(documentoDoAtorSaindo(fed, handle, a.chave_publica), 200, 60);
  if (a.estado === "desligado") return new Response("Gone", { status: 410, headers: { "Cache-Control": "public, max-age=300" } });
  return new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Uma comunidade ABERTA e PÚBLICA da Alumia como Group do Fediverso (o modelo do Lemmy, FEP-1b12; decisão D4 do plano). Só com as
// flags fediverso-total e fediverso-grupos; desligadas, 404 como se não existisse. Quem decide se a comunidade pode sair é o banco
// (ação "comunidade": núcleo, comunidade fechada ou restrita e equipe nunca saem). Quem abre no navegador vai para a página dela.
//
// O Group tem par de chaves próprio (ele assina os repasses, Announce, aos seguidores): gerado aqui na primeira leitura, com a
// privada cifrada pelo segredo da federação antes de ir ao banco, como as chaves das pessoas (lib/rede/fediverso/servidor.ts).
//
// Ações do banco pedidas à frente F3 (fora do contrato 3.1, que não tinha o Group):
//   comunidade {slug} → {estado: 'ligado'|'inexistente'|'fechada', slug, nome, descricao, criada_em, moderadores: handle[],
//                         chave_publica, chave_privada, icone_url?, capa_url?}
//   comunidade_chaves {slug, publica, privada} → {chave_publica, chave_privada} (grava só se ainda não há)
import { gerarParDeChaves } from "@/lib/rede/fediverso/assinatura";
import { cifrar } from "@/lib/rede/fediverso/cifra";
import { documentoDaComunidade } from "@/lib/rede/fediverso/documentos";
import { gruposLigados, SLUG_DE_COMUNIDADE } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto, querHtml } from "@/lib/rede/fediverso/rotas";
import { banco, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

const SEGREDO = process.env.ALUMIA_FEDIVERSO_SEGREDO ?? "";

interface ComunidadeDoBanco {
  estado: string;
  slug?: string;
  nome?: string | null;
  descricao?: string | null;
  criada_em?: string | null;
  chave_publica?: string | null;
  icone_url?: string | null;
  capa_url?: string | null;
}

const httpsSemSvg = (v: unknown) => (typeof v === "string" && /^https:\/\/[^\s]{1,1990}$/.test(v) && !/\.svg(\?|$)/i.test(v) ? { url: v } : null);

export async function GET(pedido: Request, { params }: { params: Promise<{ slug: string }> }) {
  const barrado = conferirTeto(pedido, "comunidade");
  if (barrado) return barrado;
  const slug = (await params).slug.toLowerCase();
  if (!gruposLigados() || !SLUG_DE_COMUNIDADE.test(slug)) return new Response("Not Found", { status: 404 });
  if (querHtml(pedido)) return Response.redirect(fed.paginaDaComunidade(slug), 302);
  const c = await banco<ComunidadeDoBanco | null>("comunidade", { slug }).catch(() => undefined);
  if (c === undefined) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  if (!c || c.estado !== "ligado") return new Response("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  let publica = c.chave_publica ?? null;
  if (!publica) {
    if (SEGREDO.length < 32) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
    const par = gerarParDeChaves();
    const guardado = await banco<{ chave_publica?: string | null }>("comunidade_chaves", { slug, publica: par.publica, privada: cifrar(par.privada, SEGREDO) }).catch(() => null);
    publica = guardado?.chave_publica ?? null;
    if (!publica) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  }
  return respostaAP(
    documentoDaComunidade(fed, {
      slug,
      nome: c.nome || slug,
      descricao: c.descricao ?? "",
      criada_em: c.criada_em ?? null,
      chave_publica: publica,
      icone: httpsSemSvg(c.icone_url),
      capa: httpsSemSvg(c.capa_url),
    }),
    200,
    300,
  );
}

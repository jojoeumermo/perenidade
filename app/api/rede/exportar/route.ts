// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Meus dados" da Alumia: a cópia em .zip (LGPD, art. 18, II). POST com a sessão no Authorization e, no corpo, { lang, linhas }
// (as linhas montadas no aparelho, que o servidor não conhece). O banco confere tudo como a própria pessoa: o segundo fator
// confirmado nos últimos 10 minutos e o limite de uma cópia por dia (public.rede_meusdados_exportar). O arquivo é montado na
// memória e vai direto na resposta, sem cache: nada fica guardado no servidor depois de baixado. Nenhum endereço de rede é lido.
import { lerCorpoLimitado, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";
import { linhasDoAparelho, montarCopia } from "@/lib/rede/meusdados/servidor";
import { IDIOMAS_DE_MEUS_DADOS } from "@/lib/rede/meusdados/textos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const semCache = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
const erro = (codigo: string, status: number) => Response.json({ erro: codigo }, { status, headers: semCache });

export async function POST(pedido: Request) {
  const lugar = pedido.headers.get("sec-fetch-site");
  if (lugar && lugar !== "same-origin") return erro("sem_permissao", 403);
  const token = tokenDe(pedido);
  if (!token) return erro("entre_primeiro", 401);
  const cru = await lerCorpoLimitado(pedido, 64 * 1024);
  if (!cru) return erro("grande", 413);
  let corpo: { lang?: unknown; linhas?: unknown } = {};
  try {
    corpo = cru.length ? (JSON.parse(new TextDecoder().decode(cru)) as typeof corpo) : {};
  } catch {
    return erro("invalido:corpo", 400);
  }
  const lang = typeof corpo.lang === "string" && IDIOMAS_DE_MEUS_DADOS.includes(corpo.lang) ? corpo.lang : "pt";
  const copia = await montarCopia(token, lang, linhasDoAparelho(corpo.linhas));
  if (!copia.ok) return erro(copia.codigo, statusDoCodigo(copia.codigo));
  return new Response(copia.zip as unknown as BodyInit, {
    headers: {
      ...semCache,
      "Content-Type": "application/zip",
      "Content-Length": String(copia.zip.length),
      "Content-Disposition": `attachment; filename="${copia.nome}"`,
      "X-Links-Temporarios": String(copia.links),
    },
  });
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Uma chave de API nova para um robô (frente 13E). A chave nasce AQUI, no servidor do site; o banco recebe só o resumo SHA-256
// (alumia_pontes_robo_chave, COMO a pessoa: só quem gerencia a organização, só robô ativo). A chave volta UMA vez, nesta
// resposta, e não é guardada em lugar nenhum; a chave antiga para de valer na hora. Com as organizações desligadas, 404.
import { pontesLigadas } from "@/lib/rede/pontes/ligado";
import { chaveNova, resumoDaChave } from "@/lib/rede/pontes/regras";
import { chamarComoPessoa, lerCorpoLimitado, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(pedido: Request) {
  if (!pontesLigadas()) return resposta({ erro: "nao_encontrado" }, 404);
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const cru = await lerCorpoLimitado(pedido, 512);
  if (!cru) return resposta({ erro: "grande" }, 413);
  let robo = "";
  try {
    const json = JSON.parse(new TextDecoder().decode(cru)) as { robo?: unknown };
    robo = typeof json.robo === "string" ? json.robo : "";
  } catch {
    return resposta({ erro: "invalido:pedido" }, 400);
  }
  if (!UUID.test(robo)) return resposta({ erro: "invalido:pedido" }, 400);
  const chave = chaveNova();
  const r = await chamarComoPessoa<unknown>(token, "alumia_pontes_robo_chave", { p_robo: robo, p_resumo: await resumoDaChave(chave) });
  if (!r.ok) return resposta({ erro: r.codigo }, statusDoCodigo(r.codigo));
  return resposta({ ok: true, chave, robo: r.dado });
}

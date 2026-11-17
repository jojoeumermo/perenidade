// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A API dos robôs identificados (frente 13E). Um robô de uma organização publica com a chave dele:
//
//   POST /api/rede/robos
//   Authorization: Bearer alumia_robo_…
//   { "texto": "…", "publico": "internet" | "membros" }
//
// O servidor tira o resumo SHA-256 da chave (a chave não vai ao banco) e chama rede_pontes_robo_publicar com a chave de serviço.
// O banco confere o resto: robô ativo, organização de pé, 12 posts por hora e 60 por dia, a triagem de quem publica. O post sai
// com o rótulo de robô e o nome da organização dona. Nenhum endereço de rede é guardado nem escrito em log.
// Com as organizações da Alumia desligadas ("alumia-org"), 404.
import { configDoAmbiente } from "@/lib/rede/contas-extra";
import { pontesLigadas } from "@/lib/rede/pontes/ligado";
import { LIMITES_DAS_PONTES as L, PUBLICOS_DO_ROBO, chaveTemForma, resumoDaChave } from "@/lib/rede/pontes/regras";
import { chamarComoServico } from "@/lib/rede/pontes/robos";
import { lerCorpoLimitado } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

/** O status HTTP de cada recusa do banco. */
function statusDaRecusa(codigo: string): number {
  if (codigo === "chave") return 401;
  if (codigo === "robo_parado" || codigo === "alumia_entrada") return 403;
  if (codigo === "muitos_pedidos") return 429;
  if (codigo === "dado_pessoal") return 422;
  if (codigo.startsWith("invalido")) return 400;
  return 502;
}

/** Como usar (sem nada de ninguém). */
export function GET() {
  if (!pontesLigadas()) return resposta({ erro: "nao_encontrado" }, 404);
  return resposta({
    como: "POST com o cabeçalho Authorization: Bearer <chave do robô> e o corpo JSON { texto, publico }.",
    publicos: PUBLICOS_DO_ROBO,
    limites: { texto: L.roboTexto, porHora: L.robosPorHora, porDia: L.robosPorDia },
    rotulo: "Todo post sai com o rótulo de robô e o nome da organização dona. Não há como tirar.",
  });
}

export async function POST(pedido: Request) {
  if (!pontesLigadas()) return resposta({ erro: "nao_encontrado" }, 404);
  const chave = /^Bearer\s+(\S{10,200})$/.exec(pedido.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!chaveTemForma(chave)) return resposta({ erro: "chave" }, 401);
  const cru = await lerCorpoLimitado(pedido, 4096);
  if (!cru) return resposta({ erro: "grande" }, 413);
  let texto = "";
  let publico = "membros";
  try {
    const json = JSON.parse(new TextDecoder().decode(cru)) as { texto?: unknown; publico?: unknown };
    texto = typeof json.texto === "string" ? json.texto : "";
    if (typeof json.publico === "string") publico = json.publico;
  } catch {
    return resposta({ erro: "invalido:pedido" }, 400);
  }
  if (!texto.trim() || texto.length > L.roboTexto) return resposta({ erro: "invalido:texto" }, 400);
  if (!(PUBLICOS_DO_ROBO as readonly string[]).includes(publico)) return resposta({ erro: "invalido:publico" }, 400);
  const config = configDoAmbiente();
  if (!config) return resposta({ erro: "sem_servico" }, 503);
  const r = await chamarComoServico<{ id: string; retido: boolean }>(config, "rede_pontes_robo_publicar", { p_resumo: await resumoDaChave(chave), p_texto: texto, p_publico: publico });
  if (!r.ok) return resposta({ erro: r.codigo }, statusDaRecusa(r.codigo));
  return resposta({ ok: true, id: r.dado.id, retido: r.dado.retido }, 201);
}

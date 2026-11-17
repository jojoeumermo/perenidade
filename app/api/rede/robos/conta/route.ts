// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Criar a conta de um robô (frente 13E). Ordem:
//   1. COMO a pessoa (alumia_pontes_robo_pedir): só quem gerencia a organização, no máximo 3 robôs por organização;
//   2. o servidor cria a conta sem senha com a chave de serviço (lib/rede/pontes/robos.ts) e liga ao pedido
//      (rede_pontes_robo_ligar). Organização com selo: o robô nasce ativo; sem selo, espera a coordenação.
// A chave de API vem depois, em /api/rede/robos/chave. Com as organizações da Alumia desligadas, 404.
import { pontesLigadas } from "@/lib/rede/pontes/ligado";
import { criarContaDoRobo } from "@/lib/rede/pontes/robos";
import { chamarComoPessoa, lerCorpoLimitado, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function POST(pedido: Request) {
  if (!pontesLigadas()) return resposta({ erro: "nao_encontrado" }, 404);
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const cru = await lerCorpoLimitado(pedido, 2048);
  if (!cru) return resposta({ erro: "grande" }, 413);
  let org = "";
  let nome = "";
  let descricao = "";
  try {
    const json = JSON.parse(new TextDecoder().decode(cru)) as { org?: unknown; nome?: unknown; descricao?: unknown };
    org = typeof json.org === "string" ? json.org.trim() : "";
    nome = typeof json.nome === "string" ? json.nome.trim() : "";
    descricao = typeof json.descricao === "string" ? json.descricao.trim() : "";
  } catch {
    return resposta({ erro: "invalido:pedido" }, 400);
  }
  if (!/^@?[a-z0-9_]{2,40}$/i.test(org)) return resposta({ erro: "invalido:pedido" }, 400);
  const pedidoDoBanco = await chamarComoPessoa<{ id: string; nome: string }>(token, "alumia_pontes_robo_pedir", { p_handle: org, p_nome: nome, p_descricao: descricao });
  if (!pedidoDoBanco.ok) return resposta({ erro: pedidoDoBanco.codigo }, statusDoCodigo(pedidoDoBanco.codigo));
  const conta = await criarContaDoRobo(pedidoDoBanco.dado.id, pedidoDoBanco.dado.nome);
  if (!conta.ok) return resposta({ erro: conta.erro }, conta.erro === "sem_servico" ? 503 : 502);
  return resposta({ ok: true, robo: conta.robo }, 201);
}

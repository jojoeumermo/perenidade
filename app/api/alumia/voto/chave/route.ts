// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A chave pública de uma consulta à base, para o aparelho cifrar a cédula (lib/rede/voto/cedula.ts).
//   POST, com a sessão no cabeçalho Authorization, {consulta} → {chave} ou {ok: false, motivo}
// A chave é derivada do segredo do servidor (ALUMIA_VOTO_SEGREDO), por consulta; a privada não sai daqui nem vai ao banco. Sem o
// segredo, "sem_servico": só então a tela vota pelo caminho de antes (a urna do banco, sem cifra no aparelho). Qualquer outra
// recusa (freio, rede) a tela mostra como erro e não rebaixa o voto. O freio é por conta: um robô sem conta não esgota o balde
// do site e não empurra os votos dos outros para o caminho sem cifra.
import { contaDoToken, criarFreio, deOutraOrigem, resposta } from "@/lib/rede/convites/servidor";
import { chavePublicaDaConsulta, segredoDoVoto } from "@/lib/rede/voto/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Derivar a chave é barato; o freio só segura uma enxurrada da mesma conta (a tela guarda a chave na memória por consulta).
const freioDaConta = criarFreio(30, 10 * 60_000);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  const segredo = segredoDoVoto();
  if (!segredo) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  if (!conta) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  const c = (await pedido.json().catch(() => null)) as { consulta?: unknown } | null;
  const consulta = typeof c?.consulta === "string" ? c.consulta.toLowerCase() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(consulta)) return resposta({ ok: false, motivo: "invalido" }, 400);
  if (!freioDaConta(conta.id)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);
  return resposta({ ok: true, chave: chavePublicaDaConsulta(segredo, consulta) });
}

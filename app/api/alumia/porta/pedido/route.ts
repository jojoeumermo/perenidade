// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O passe do pedido de entrada na Alumia (supabase/migracoes/20261114-alumia-o8-porta.sql).
//   POST, com a sessão no cabeçalho Authorization, {desafio, resposta, convite?} → {ok, convite} ou {ok: false, motivo}
// Antes do pedido de entrada, o servidor confere: a conta com o e-mail confirmado, a prova de trabalho do aparelho, a rede barrada,
// o freio da rede nesta hora e o teto da casa (o pedido com convite válido passa por cima do teto). Passou: o banco guarda um
// passe de 30 minutos, que o pedido gasta (com a porta ligada, sem o passe o banco recusa o pedido), e o convite vira a marca
// "veio por convite", sem dizer de quem. O e-mail de uma conta banida pelo painel de admin não pede a entrada de novo, nem pela
// conta criada no cadastro do site do Instituto (que não passa pela rota de criar conta da Alumia): o servidor confere o resumo
// HMAC do e-mail da conta (lib/rede/admin/email.ts).
import { emailBarrado } from "@/lib/rede/admin/servidor";
import { chaveDoFreio, conferirDesafio } from "@/lib/rede/convites/prova-servidor";
import { contaDoToken, criarFreio, deOutraOrigem, impressaoDoFreio, impressaoDoPedido, resposta, rpcDeServico, semAFuncao } from "@/lib/rede/convites/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// No máximo 12 passes por conta a cada 10 minutos (o pedido pede um só).
const freioDaConta = criarFreio(12, 10 * 60_000);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  if (!conta) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  if (!conta.confirmada) return resposta({ ok: false, motivo: "email_nao_confirmado" }, 403);
  if (!freioDaConta(conta.id)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);
  if (conta.email && (await emailBarrado(conta.email))) return resposta({ ok: false, motivo: "cadastro_fechado" }, 403);

  const c = (await pedido.json().catch(() => null)) as { desafio?: unknown; resposta?: unknown; convite?: unknown } | null;
  const prova = conferirDesafio(c?.desafio, c?.resposta, "pedido");
  if (!prova.ok) return resposta({ ok: false, motivo: prova.motivo }, 400);
  const convite = typeof c?.convite === "string" && /^[0-9a-f]{32}$/.test(c.convite) ? c.convite : null;

  const impressao = impressaoDoPedido(pedido);
  const r = await rpcDeServico<{ ok: boolean; motivo?: string; convite?: string }>("alumia_cadastro_passar", {
    p_momento: "pedido", p_chave: chaveDoFreio(impressaoDoFreio(impressao), "pedido"), p_selo: prova.selo, p_vence: new Date(prova.vence).toISOString(),
    p_impressao: impressao, p_usuario: conta.id, p_convite: convite,
  });
  // O banco ainda sem a migração da onda 8: não há passe a dar (e o banco também não o exige).
  if (semAFuncao(r)) return resposta({ ok: false, motivo: "banco" });
  if (!r.ok) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  if (!r.dado.ok) return resposta({ ok: false, motivo: r.dado.motivo ?? "muitos_pedidos" }, 429);
  return resposta({ ok: true, convite: r.dado.convite ?? "nenhum" });
}

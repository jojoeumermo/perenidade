// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A correção de uma redação da roda (supabase/migracoes/20261117-alumia-o11-redacao.sql).
//   POST, com a sessão no cabeçalho Authorization, {leitura, ficha} → {ok, feitas} ou {ok: false, motivo}
// O servidor confere a sessão, sorteia o id da correção e calcula o LACRE (lib/rede/redacao/servidor.ts: HMAC com o segredo do
// servidor sobre a correção e a pessoa), e chama o banco com a chave de serviço. O banco grava a correção com o lacre, nunca com a
// pessoa. Sem o segredo, a correção entra sem lacre. O freio é daqui, na memória do processo (uma linha de freio no banco, com o id
// da pessoa, na mesma transação da correção, ligaria uma à outra). Nada vai a log.
import { contaDoToken, criarFreio, deOutraOrigem, resposta, rpcDeServico } from "@/lib/rede/convites/servidor";
import { idDaCorrecao, lacreDaCorrecao, segredoDoLacre } from "@/lib/rede/redacao/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const freioDaConta = criarFreio(12, 10 * 60_000);

/** O erro do banco que a tela entende passa; o resto vira "falha". */
const CODIGOS = new Set([
  "nao_encontrado", "prazo", "afastada", "sem_permissao", "confirme_idade", "consentimento", "confirme_codinome", "conta_suspensa",
  "invalido:ficha", "invalido:nota", "invalido:comentario", "invalido:geral",
]);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  if (!conta) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  if (!freioDaConta(conta.id)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);
  const c = (await pedido.json().catch(() => null)) as { leitura?: unknown; ficha?: unknown } | null;
  const leitura = typeof c?.leitura === "string" ? c.leitura.toLowerCase() : "";
  if (!UUID.test(leitura) || !c?.ficha || typeof c.ficha !== "object") return resposta({ ok: false, motivo: "invalido" }, 400);

  const correcao = idDaCorrecao();
  const segredo = segredoDoLacre();
  const lacre = segredo ? lacreDaCorrecao(segredo, correcao, conta.id) : null;
  const r = await rpcDeServico<{ corrigida: boolean; feitas: number }>("alumia_redacao_corrigir", {
    p_usuario: conta.id, p_leitura: leitura, p_correcao: correcao, p_ficha: c.ficha, p_lacre: lacre,
  });
  if (!r.ok) {
    if (r.status === 0) return resposta({ ok: false, motivo: "sem_servico" }, 503);
    if (r.status === 404) return resposta({ ok: false, motivo: "banco_desatualizado" }, 503);
    return resposta({ ok: false, motivo: CODIGOS.has(r.codigo) ? r.codigo : "falha" }, 400);
  }
  return resposta({ ok: true, feitas: r.dado.feitas });
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O afastamento de quem escreveu uma correção julgada ABUSIVA pela mediação (supabase/migracoes/20261117-alumia-o11-redacao.sql).
//   POST, com a sessão no cabeçalho Authorization, {denuncia} → {ok, afastamento: "feito" | "sem_lacre"} ou {ok: false, motivo}
// A tela da mediação chama logo depois de decidir. O banco só entrega o lacre de uma denúncia já julgada abusiva e com o
// afastamento pendente, junto das pessoas que corrigiram naquela roda; o servidor confere o lacre contra cada uma
// (lib/rede/redacao/servidor.ts), manda ao banco a que bate (que a afasta da roda por 8 semanas e apaga o lacre) e devolve à tela
// só "feito". O nome não sai daqui, não vai a log, e a mediação não o recebe. Chamar de novo não muda nada.
import { contaDoToken, criarFreio, deOutraOrigem, resposta, rpcDeServico } from "@/lib/rede/convites/servidor";
import { donaDoLacre, segredoDoLacre } from "@/lib/rede/redacao/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const freioDaConta = criarFreio(30, 10 * 60_000);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  if (!conta) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  if (!freioDaConta(conta.id)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);
  const c = (await pedido.json().catch(() => null)) as { denuncia?: unknown } | null;
  const denuncia = typeof c?.denuncia === "string" ? c.denuncia.toLowerCase() : "";
  if (!UUID.test(denuncia)) return resposta({ ok: false, motivo: "invalido" }, 400);

  const dados = await rpcDeServico<{ pendente: boolean; correcao?: string; lacre?: string | null; candidatos?: unknown[] }>("alumia_redacao_afastar_dados", { p_denuncia: denuncia });
  if (!dados.ok) return resposta({ ok: false, motivo: dados.codigo === "nao_encontrado" ? "nao_encontrado" : "sem_servico" }, dados.status === 0 ? 503 : 502);
  if (!dados.dado.pendente) return resposta({ ok: true, afastamento: "decidido" });
  // Sem o segredo agora, não há como conferir: o afastamento fica pendente (a tela tenta de novo depois).
  const segredo = segredoDoLacre();
  if (!segredo) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const dona = dados.dado.correcao ? donaDoLacre(segredo, dados.dado.correcao, dados.dado.lacre, dados.dado.candidatos) : null;
  const r = await rpcDeServico<{ afastamento: string }>("alumia_redacao_afastar", { p_denuncia: denuncia, p_usuario: dona });
  if (!r.ok) return resposta({ ok: false, motivo: "sem_servico" }, 502);
  return resposta({ ok: true, afastamento: r.dado.afastamento === "feito" ? "feito" : "sem_lacre" });
}

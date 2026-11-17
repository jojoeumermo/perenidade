// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A chave pública de uma votação secreta da comunidade, para o aparelho cifrar a cédula (supabase/migracoes/20261116-alumia-o10-decisao.sql).
//   POST, com a sessão no cabeçalho Authorization, {decisao} → {chave} ou {ok: false, motivo}
// O MESMO esquema da consulta à base (app/api/alumia/voto/chave, docs/rede/VOTO-SECRETO.md §7): a chave sai do segredo do servidor
// (ALUMIA_VOTO_SEGREDO) pelo id da votação, com lib/rede/voto/servidor.ts; a privada não sai daqui nem vai ao banco. Os ids são
// sorteados (gen_random_uuid) nas duas tabelas, e o id entra na derivação, no HKDF e como dado autenticado: a cédula de uma
// votação não abre em outra, nem numa consulta. Sem o segredo, "sem_servico": só então a tela vota pela urna do banco, sem cifra.
// Qualquer outra recusa (freio, rede) a tela mostra como erro e não rebaixa o voto.
import { contaDoToken, criarFreio, deOutraOrigem, resposta } from "@/lib/rede/convites/servidor";
import { chavePublicaDaConsulta, segredoDoVoto } from "@/lib/rede/voto/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const freioDaConta = criarFreio(30, 10 * 60_000);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  const segredo = segredoDoVoto();
  if (!segredo) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  if (!conta) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  const c = (await pedido.json().catch(() => null)) as { decisao?: unknown } | null;
  const decisao = typeof c?.decisao === "string" ? c.decisao.toLowerCase() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(decisao)) return resposta({ ok: false, motivo: "invalido" }, 400);
  if (!freioDaConta(conta.id)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);
  return resposta({ ok: true, chave: chavePublicaDaConsulta(segredo, decisao) });
}

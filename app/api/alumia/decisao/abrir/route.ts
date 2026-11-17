// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A apuração das cédulas cifradas de uma votação da comunidade já FECHADA (supabase/migracoes/20261116-alumia-o10-decisao.sql).
//   POST, com a sessão no cabeçalho Authorization, {decisao} → {ok, apuradas, nulas} ou {ok: false, motivo}
// O mesmo caminho da consulta à base (app/api/alumia/voto/abrir): qualquer conta pode pedir (a tela pede sozinha para quem vê a
// votação fechada); com a votação aberta ou cancelada o banco não entrega nada, e abrir duas vezes não muda nada. O servidor abre
// todas com lib/rede/voto/servidor.ts, embaralha e devolve ao banco só as escolhas, num lote; o banco descarta o que não vale e
// põe o resto na urna. O freio é por conta, e o da votação é só um teto alto contra enxurrada. Nada daqui vai a log.
import { randomInt } from "node:crypto";
import { contaDoToken, criarFreio, deOutraOrigem, resposta, rpcDeServico } from "@/lib/rede/convites/servidor";
import { abrirCedula, embaralhar, segredoDoVoto } from "@/lib/rede/voto/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const freioDaConta = criarFreio(6, 10 * 60_000);
const freioPorDecisao = criarFreio(120, 10 * 60_000);

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
  if (!freioDaConta(conta.id) || !freioPorDecisao(decisao)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);

  const lote = await rpcDeServico<{ fechada: boolean; cedulas?: unknown[] }>("alumia_decisao_cifradas", { p_id: decisao });
  if (!lote.ok) return resposta({ ok: false, motivo: lote.codigo === "nao_encontrado" ? "nao_encontrado" : "sem_servico" }, lote.status === 0 ? 503 : 502);
  if (!lote.dado.fechada) return resposta({ ok: false, motivo: "aberta" }, 409);
  const cedulas = Array.isArray(lote.dado.cedulas) ? lote.dado.cedulas : [];
  if (cedulas.length === 0) return resposta({ ok: true, apuradas: 0, nulas: 0 });

  // Cada cédula que abre vira uma escolha (lista com um id); a que não abre fica de fora (o banco conta como nula pela diferença).
  const escolhas = embaralhar(
    cedulas.map((x) => abrirCedula(segredo, decisao, x)).filter((r): r is string[] => r !== null),
    (n) => randomInt(n),
  );
  const r = await rpcDeServico<{ apuradas: number; nulas: number }>("alumia_decisao_apurar", { p_id: decisao, p_escolhas: escolhas, p_quantas: cedulas.length });
  if (!r.ok) return resposta({ ok: false, motivo: "sem_servico" }, 502);
  return resposta({ ok: true, apuradas: r.dado.apuradas, nulas: r.dado.nulas });
}

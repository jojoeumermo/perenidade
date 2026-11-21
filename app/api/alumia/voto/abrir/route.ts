// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A apuração das cédulas cifradas de uma consulta FECHADA (supabase/migracoes/20261115-alumia-o9-resto8.sql).
//   POST, com a sessão no cabeçalho Authorization, {consulta} → {ok, apuradas, nulas} ou {ok: false, motivo}
// Qualquer conta pode pedir (a tela pede sozinha para quem vê a consulta fechada): com a consulta aberta o banco não entrega nada,
// e abrir duas vezes não muda nada (as cifradas saem na primeira). O freio é por conta (6 a cada 10 minutos), e o da consulta é só
// um teto alto contra enxurrada: um visitante sem conta não segura a apuração de ninguém. O servidor abre todas, embaralha e devolve ao banco só os
// rankings, num lote; o banco descarta o que não vale e põe o resto na urna. Nada daqui vai a log.
import { randomInt } from "node:crypto";
import { contaDoToken, criarFreio, deOutraOrigem, resposta, rpcDeServico } from "@/lib/rede/convites/servidor";
import { abrirCedula, embaralhar, segredoDoVoto } from "@/lib/rede/voto/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const freioDaConta = criarFreio(6, 10 * 60_000);
const freioPorConsulta = criarFreio(120, 10 * 60_000);

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
  if (!freioDaConta(conta.id) || !freioPorConsulta(consulta)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);

  const lote = await rpcDeServico<{ fechada: boolean; cedulas?: unknown[] }>("alumia_voto_cifradas", { p_consulta: consulta });
  if (!lote.ok) {
    // Uma consulta que não existe é um "não encontrado" comum, não uma falha do servidor: sem o 404, a borda mostrava a
    // página de erro genérica dela para um endereço que só estava errado.
    if (lote.codigo === "nao_encontrado") return resposta({ ok: false, motivo: "nao_encontrado" }, 404);
    return resposta({ ok: false, motivo: "sem_servico" }, lote.status === 0 ? 503 : 502);
  }
  if (!lote.dado.fechada) return resposta({ ok: false, motivo: "consulta_aberta" }, 409);
  const cedulas = Array.isArray(lote.dado.cedulas) ? lote.dado.cedulas : [];
  if (cedulas.length === 0) return resposta({ ok: true, apuradas: 0, nulas: 0 });

  // Cada cédula que abre vira um ranking; a que não abre fica de fora (o banco conta como nula pela diferença).
  const rankings = embaralhar(
    cedulas.map((x) => abrirCedula(segredo, consulta, x)).filter((r): r is string[] => r !== null),
    (n) => randomInt(n),
  );
  const r = await rpcDeServico<{ apuradas: number; nulas: number }>("alumia_voto_apurar", { p_consulta: consulta, p_rankings: rankings, p_quantas: cedulas.length });
  if (!r.ok) return resposta({ ok: false, motivo: "sem_servico" }, 502);
  return resposta({ ok: true, apuradas: r.dado.apuradas, nulas: r.dado.nulas });
}

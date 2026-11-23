// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conta segura da Alumia pelo servidor (lib/rede/seguranca/servico-de-contas.ts), com o token da pessoa no Authorization:
//   POST {acao: "outros"}                    desconecta todos os outros aparelhos → {ok, desconectados}
//   POST {acao: "todos", esconder?: boolean} o pânico: desconecta todos, este também, e esconde o perfil se pedido → {ok}
//   POST {acao: "codigo", codigo}            usa um código de recuperação (sessão só com a senha) → {ok, restantes} ou {ok: false}
// Primeiro o banco, com o token da pessoa (a porta, o limite e as regras de lá; ele anota o corte e para o token já emitido na
// porta); depois o serviço de contas encerra as sessões e os tokens de renovação (no projeto hospedado, o banco pode não ter
// permissão para isso; supabase/migracoes/20261120-alumia-o14-conta.sql). Erro do banco volta como {ok: false, motivo} com o código
// curto dele (sem detalhe). Sem o endereço do banco, 503 "sem_servico": a tela chama o banco direto, como antes.
import { contaDoToken, deOutraOrigem, resposta, rpcDeServico, servico, SUPA, ANON } from "@/lib/rede/convites/servidor";
import { lerToken, rpcComToken, sairPeloServicoDeContas, tirarFatoresPeloServicoDeContas } from "@/lib/rede/seguranca/servico-de-contas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const erroDoBanco = (r: { status: number; codigo: string }) =>
  resposta({ ok: false, motivo: r.status === 0 ? "sem_servico" : r.codigo }, r.status === 0 ? 503 : r.status >= 500 ? 502 : 400);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  if (!SUPA || !ANON) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!token) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  const c = (await pedido.json().catch(() => null)) as { acao?: unknown; esconder?: unknown; codigo?: unknown } | null;
  const acao = c?.acao;
  if (acao !== "outros" && acao !== "todos" && acao !== "codigo") return resposta({ ok: false, motivo: "invalido" }, 400);

  // O serviço de contas confere a assinatura do token e se a sessão continua viva.
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  if (!conta) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);

  if (acao === "outros") {
    const r = await rpcComToken<{ desconectados?: number }>("alumia_conta_desconectar", { p_sessao: null }, token);
    if (!r.ok) return erroDoBanco(r);
    const saiu = await sairPeloServicoDeContas(token, "others");
    return resposta({ ok: true, desconectados: Number(r.dado?.desconectados ?? 0), servico: saiu });
  }

  if (acao === "todos") {
    const r = await rpcComToken<{ ok?: boolean }>("alumia_conta_panico", { p_esconder: c?.esconder === true }, token);
    // Mesmo com o banco fora (ou a porta recusando), o serviço de contas ainda encerra as sessões: o pânico não para no meio.
    const saiu = await sairPeloServicoDeContas(token, "global");
    if (!r.ok && !saiu) return erroDoBanco(r);
    return resposta({ ok: true, servico: saiu });
  }

  const codigo = typeof c?.codigo === "string" ? c.codigo.slice(0, 40) : "";
  // O byte zero não cabe num text do Postgres: o banco recusaria com erro de codificação (e a tela veria 502). Código assim é inválido.
  if (codigo.includes("\u0000")) return resposta({ ok: false, motivo: "invalido" }, 400);
  // Primeiro como a pessoa (o freio de tentativas e a conferência do código). Se o banco não pode tirar o aplicativo, ele responde
  // "pelo_servidor" sem gastar o código; com a chave de serviço, o servidor termina pela função que só ela chama e tira o aplicativo
  // pelo serviço de contas. Nenhum cabeçalho do pedido decide isso: o cliente põe o cabeçalho que quiser.
  type Usou = { ok?: boolean; motivo?: string; restantes?: number; fator_pendente?: boolean };
  const r = await rpcComToken<Usou>("conta_codigo_usar", { p_codigo: codigo }, token);
  if (!r.ok) return erroDoBanco(r);
  let dado = r.dado;
  if (dado?.ok !== true && dado?.motivo === "pelo_servidor" && servico()) {
    const s = await rpcDeServico<Usou>("conta_codigo_usar_pelo_servidor", { p_usuario: conta.id, p_sessao: lerToken(token)?.sessao ?? null, p_codigo: codigo });
    if (!s.ok) return erroDoBanco(s);
    dado = s.dado;
  }
  if (dado?.ok !== true) return resposta({ ok: false, motivo: dado?.motivo === "pelo_servidor" ? "sem_servico" : "codigo_invalido" }, dado?.motivo === "pelo_servidor" ? 503 : 200);
  if (dado.fator_pendente && !(await tirarFatoresPeloServicoDeContas(conta.id))) {
    // O código já foi gasto e o aplicativo não saiu: a pessoa tenta com outro código (ou fala com a coordenação, que zera o fator).
    return resposta({ ok: false, motivo: "falha" }, 502);
  }
  await sairPeloServicoDeContas(token, "others");
  return resposta({ ok: true, restantes: Number(dado.restantes ?? 0) });
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O navegador conhecido (P5, A4; o desenho está em lib/sessao/aparelho.ts).
//   POST (Authorization: Bearer <token da sessão>) → {ok, conhecido}
// O navegador chama logo que uma sessão aparece neste endereço (lib/sessao/cliente-aparelho.ts): o serviço de contas confere o
// token, e o banco decide se este navegador já é conhecido da conta (pelo cookie HttpOnly, que só esta rota lê e grava). Navegador
// conhecido: a sessão nova não gera o aviso de "entrada nova". Novo: o aviso sai na hora, com o navegador e o sistema (sem endereço
// de rede). Sessão que ninguém apresentou em 10 minutos (entrada direto pela API, fora do site) recebe o aviso do mesmo jeito.
import { contaDoToken, deOutraOrigem, resposta, servico, SUPA } from "@/lib/rede/convites/servidor";
import { lerToken } from "@/lib/rede/seguranca/servico-de-contas";
import { reconhecerNavegador } from "@/lib/sessao/aparelho-servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  if (!SUPA || !servico()) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  if (!conta) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  // O token já foi conferido pelo serviço de contas: a sessão dele vale.
  const token = /^Bearer (\S+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1] ?? "";
  const lido = lerToken(token);
  if (!lido || lido.conta !== conta.id.toLowerCase()) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  const r = await reconhecerNavegador(pedido, conta.id, lido.sessao);
  const corpo = resposta({ ok: r.conhecido !== null, conhecido: r.conhecido });
  if (r.setCookie) corpo.headers.append("Set-Cookie", r.setCookie);
  return corpo;
}

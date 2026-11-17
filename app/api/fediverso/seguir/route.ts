// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Seguir (ou deixar de seguir) alguém de outra instância do Fediverso. Só para quem tem a federação LIGADA no próprio perfil (seguir
// de fora revela o @nome da pessoa à outra instância; LGPD art. 33, VIII). No modo "fediverso-total" o banco liga a federação de
// quem aceita o consentimento novo da Alumia (D2), e quem a desligou no perfil continua de fora; antes de pôr o Follow na fila, a
// rota confere de novo no banco (ação "ator": ligado e sem impedimento) e garante o par de chaves da pessoa, para o pedido não sair
// da fila como "sem_chave". O pedido (Follow) vai para a fila e sai assinado; quando a outra instância aceita, os posts públicos de
// lá passam a aparecer na linha. Teto por pessoa no banco (rede_fed_eu).
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { processarFila } from "@/lib/rede/fediverso/entrega";
import { conferirTeto, pessoaFederada, recusaDaFederacao } from "@/lib/rede/fediverso/rotas";
import { atorRemoto, banco, codigoParaATela, ErroDoBanco, fed, modoTotal } from "@/lib/rede/fediverso/servidor";
import { chamarComoPessoa, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(pedido: Request) {
  const barrado = conferirTeto(pedido, "seguir", 30);
  if (barrado) return barrado;
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const corpo = (await pedido.json().catch(() => null)) as { ator?: unknown; sim?: unknown } | null;
  const ator = typeof corpo?.ator === "string" && /^https:\/\/[^\s]{1,490}$/.test(corpo.ator) ? corpo.ator : null;
  if (!ator) return resposta({ erro: "invalido:ator" }, 400);
  const sim = corpo?.sim !== false;
  const eu = await chamarComoPessoa<{ perfil: string; handle?: string | null; ligado: boolean }>(token, "rede_fed_eu", { p_acao: "seguir" });
  if (!eu.ok) return resposta({ erro: codigoParaATela(eu.codigo) }, statusDoCodigo(eu.codigo));
  // Desligada (por escolha da pessoa ou por impedimento): nada sai, nem no modo total.
  if (!eu.dado.ligado) return resposta({ erro: "fediverso_desligado" }, 409);
  if (modoTotal()) {
    const federada = await pessoaFederada(eu.dado.handle);
    if (federada !== "ok") return recusaDaFederacao(federada);
  }
  if (sim && !(await atorRemoto(ator).catch(() => null))?.inbox) return resposta({ erro: "nao_encontrado" }, 404);
  try {
    await banco("seguir", { perfil: eu.dado.perfil, ator, pedido: fed.atividade("follow", randomUUID()), sim });
  } catch (e) {
    const codigo = e instanceof ErroDoBanco ? e.message : "falha";
    return resposta({ erro: codigoParaATela(codigo) }, statusDoCodigo(codigo));
  }
  after(() => processarFila(10).then(() => undefined, () => undefined));
  return resposta({ ok: true, seguindo: sim ? "pedido" : "nao" });
}

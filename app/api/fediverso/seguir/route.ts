// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Seguir (ou deixar de seguir) alguém de outra instância do Fediverso. Só para quem LIGOU a federação no próprio perfil (seguir de
// fora revela o @nome da pessoa à outra instância). O pedido (Follow) vai para a fila e sai assinado; quando a outra instância
// aceita, os posts públicos de lá passam a aparecer na aba Fediverso. Teto por pessoa no banco (rede_fed_eu).
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { processarFila } from "@/lib/rede/fediverso/entrega";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { atorRemoto, banco, ErroDoBanco, fed, modoTotal } from "@/lib/rede/fediverso/servidor";
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
  const eu = await chamarComoPessoa<{ perfil: string; ligado: boolean }>(token, "rede_fed_eu", { p_acao: "seguir" });
  if (!eu.ok) return resposta({ erro: eu.codigo }, statusDoCodigo(eu.codigo));
  // No modo "fediverso-total" todo perfil elegível já é federado (o consentimento entra na entrada da Alumia): não pede "ligado".
  if (!eu.dado.ligado && !modoTotal()) return resposta({ erro: "fediverso_desligado" }, 409);
  if (sim && !(await atorRemoto(ator).catch(() => null))?.inbox) return resposta({ erro: "nao_encontrado" }, 404);
  try {
    await banco("seguir", { perfil: eu.dado.perfil, ator, pedido: fed.atividade("follow", randomUUID()), sim });
  } catch (e) {
    const codigo = e instanceof ErroDoBanco ? e.message : "falha";
    return resposta({ erro: codigo }, statusDoCodigo(codigo));
  }
  after(() => processarFila(10).then(() => undefined, () => undefined));
  return resposta({ ok: true, seguindo: sim ? "pedido" : "nao" });
}

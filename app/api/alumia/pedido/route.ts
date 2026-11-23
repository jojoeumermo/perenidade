// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O pedido de conversa sem lista (onda R2, item 2.5): POST {codinome, desafio, nonce, envelope} com Authorization: PrivateToken (um
// passe anônimo). SEM sessão de conta. Confere a prova de trabalho (desafio nosso, no prazo, bits zero) e o passe; o banco grava o
// envelope na caixa de pedidos da conta do codinome, no lote em ordem sorteada, e gasta o passe e o desafio (repetidos, recusados).
// O envelope é HPKE X-Wing para a chave de pedidos da pessoa: o servidor não sabe quem pediu nem o que diz.
import { deB64u, paraB64 } from "@/lib/rede/caixas/base";
import { TAMANHO_DO_DESAFIO, TAMANHO_DO_NONCE } from "@/lib/rede/caixas/prova";
import { conferirDesafioDoPedido } from "@/lib/rede/caixas/prova-servidor";
import { juntador, lerCorpo, recusaDeSessao, responder, trazSessao } from "@/lib/rede/caixas/rota";
import { CORPO_MAXIMO, TAMANHO_PEDIDO } from "@/lib/rede/caixas/tamanhos";
import { conferirPasse, segredoDosPasses } from "@/lib/rede/passes/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(pedido: Request) {
  if (trazSessao(pedido)) return recusaDeSessao();
  const segredo = segredoDosPasses();
  if (!segredo) return responder({ ok: false, erro: "sem_servico" }, 503);
  const corpo = await lerCorpo(pedido, CORPO_MAXIMO);
  const codinome = typeof corpo?.codinome === "string" ? corpo.codinome.trim() : "";
  const desafio = deB64u(corpo?.desafio, TAMANHO_DO_DESAFIO);
  const nonce = deB64u(corpo?.nonce, TAMANHO_DO_NONCE);
  const envelope = deB64u(corpo?.envelope);
  if (codinome.length < 3 || codinome.length > 30 || !desafio || !nonce || !envelope) return responder({ ok: false, erro: "invalido" }, 400);
  if (envelope.length !== TAMANHO_PEDIDO) return responder({ ok: false, erro: "tamanho" }, 400);
  const gastoDoDesafio = conferirDesafioDoPedido(segredo, desafio, nonce);
  if (!gastoDoDesafio) return responder({ ok: false, erro: "prova" }, 400);
  const passe = await conferirPasse(pedido.headers.get("authorization"));
  if (!passe.ok) return responder({ ok: false, erro: passe.motivo === "sem_servico" ? "sem_servico" : "passe" }, passe.motivo === "sem_servico" ? 503 : 401);
  const { resultado } = juntador().juntar({ acao: "pedido", codinome, envelope: paraB64(envelope), gastos: [paraB64(passe.resumo), paraB64(gastoDoDesafio)] });
  const r = await resultado;
  return r.ok ? responder({ ok: true }) : responder({ ok: false, erro: r.erro }, r.erro === "rede" ? 502 : 409);
}

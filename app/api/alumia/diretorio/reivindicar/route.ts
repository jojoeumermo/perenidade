// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Reivindicar uma pré-chave Proteus (ou um pacote MLS) de cada aparelho de uma conta (public.rede_diretorio_reivindicar): POST
// {codinome, tipo} com Authorization: PrivateToken (um passe anônimo). SEM sessão de conta. Cada pré-chave sai do banco ao ser
// entregue; o passe é gasto no banco na mesma chamada (repetido, recusado). O servidor sabe que alguém começou algo com aquela conta,
// não quem.
// Onda R3 (item 2.7, chat entre instâncias): quem vem de OUTRA instância não tem passe daqui (e um passe de lá diria de onde vem). Com
// o chat entre instâncias ligado (ALUMIA_INSTANCIA), vale também {codinome, tipo, desafio, nonce} sem passe: o desafio do pedido de
// conversa (GET /api/alumia/pedido/desafio) resolvido com BITS_DE_FORA bits; o resumo do desafio é gasto no lugar do passe.
import { deB64u, paraBytea } from "@/lib/rede/caixas/base";
import { provaConfere, TAMANHO_DO_DESAFIO, TAMANHO_DO_NONCE } from "@/lib/rede/caixas/prova";
import { conferirDesafioDoPedido } from "@/lib/rede/caixas/prova-servidor";
import { lerCorpo, recusaDeSessao, responder, trazSessao } from "@/lib/rede/caixas/rota";
import { CORPO_MAXIMO } from "@/lib/rede/caixas/tamanhos";
import { rpcDeServico } from "@/lib/rede/convites/servidor";
import { BITS_DE_FORA_MINIMO, instanciaValida } from "@/lib/rede/instancias/endereco";
import { conferirPasse, segredoDosPasses } from "@/lib/rede/passes/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pago = { ok: true; resumo: Uint8Array } | { ok: false; motivo: string };

/** O que paga: o passe (o de sempre) ou, de outra instância, a prova de trabalho de fora. */
async function pago(pedido: Request, corpo: Record<string, unknown> | null): Promise<Pago> {
  const cabecalho = pedido.headers.get("authorization");
  if (cabecalho || corpo?.desafio === undefined) {
    const p = await conferirPasse(cabecalho);
    return p.ok ? p : { ok: false, motivo: p.motivo };
  }
  if (!instanciaValida((process.env.ALUMIA_INSTANCIA ?? "").trim().toLowerCase())) return { ok: false, motivo: "passe" };
  const segredo = segredoDosPasses();
  if (!segredo) return { ok: false, motivo: "sem_servico" };
  const desafio = deB64u(corpo.desafio, TAMANHO_DO_DESAFIO), nonce = deB64u(corpo.nonce, TAMANHO_DO_NONCE);
  if (!desafio || !nonce || !provaConfere(desafio, nonce, BITS_DE_FORA_MINIMO)) return { ok: false, motivo: "prova" };
  const gasto = conferirDesafioDoPedido(segredo, desafio, nonce);
  return gasto ? { ok: true, resumo: gasto } : { ok: false, motivo: "prova" };
}

export async function POST(pedido: Request) {
  if (trazSessao(pedido)) return recusaDeSessao();
  const corpo = await lerCorpo(pedido, CORPO_MAXIMO);
  const codinome = typeof corpo?.codinome === "string" ? corpo.codinome.trim() : "";
  const tipo = corpo?.tipo === "proteus" || corpo?.tipo === "mls" ? corpo.tipo : null;
  if (codinome.length < 3 || codinome.length > 30 || !tipo) return responder({ ok: false, erro: "invalido" }, 400);
  const passe = await pago(pedido, corpo);
  if (!passe.ok) {
    const erro = passe.motivo === "sem_servico" ? "sem_servico" : passe.motivo === "prova" ? "prova" : "passe";
    return responder({ ok: false, erro }, erro === "sem_servico" ? 503 : erro === "prova" ? 400 : 401);
  }
  const conta = await rpcDeServico<{ usuario?: string } | null>("rede_diretorio_ler", { p_codinome: codinome });
  if (!conta.ok) return responder({ ok: false, erro: "rede" }, 502);
  if (!conta.dado?.usuario) return responder({ ok: false, erro: "nao_encontrado" }, 404);
  const r = await rpcDeServico<unknown[]>("rede_diretorio_reivindicar", { p_usuario: conta.dado.usuario, p_tipo: tipo, p_passe: paraBytea(passe.resumo) });
  if (!r.ok) {
    const erro = r.codigo === "passe_usado" || r.codigo === "nao_encontrado" ? r.codigo : "rede";
    return responder({ ok: false, erro }, erro === "passe_usado" ? 409 : erro === "nao_encontrado" ? 404 : 502);
  }
  return responder({ pre: Array.isArray(r.dado) ? r.dado : [] });
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A emissão dos passes anônimos (Privacy Pass, RFC 9578, tipo 0x0002 Blind RSA), COM a sessão da conta (aprovada, não suspensa, com
// a porta). Os pedidos chegam CEGOS: o servidor não vê os passes que assina, e quando um passe é gasto não sabe de quem é.
//   POST {lote}               → {resposta}  o lote do dia: 30 passes gerais com a chave da semana. Uma vez por conta por dia (a marca
//                                           "já pegou hoje" é um HMAC do segredo do dia com a conta, e some amanhã).
//   POST {tipo, alvo}         → {contexto, semana:0, id, publica, seq}  a chave da urna desta votação (nasce aqui, se a conta vota nela)
//   POST {tipo, alvo, pedido} → {resposta}  UM passe da urna desta votação. Uma vez por conta por votação (a marca é um HMAC do segredo
//                                           com a conta e o contexto: o banco não sabe de quem é).
import { rpcNoBanco } from "@/lib/instagram";
import { deB64u, paraB64u, paraBytea } from "@/lib/rede/caixas/base";
import { lerCorpo, responder } from "@/lib/rede/caixas/rota";
import { contaDoToken, deOutraOrigem } from "@/lib/rede/convites/servidor";
import { rpcDeServico } from "@/lib/rede/convites/servidor";
import { contextoDaUrna, semanaDe, type TipoDaUrna } from "@/lib/rede/passes/comum";
import {
  bancoDoSite, chaveDoEmissor, emitirLote, emitirUm, loteConferido, marcaDoContexto, marcaDoDia, pedidoConferido, segredoDosPasses,
} from "@/lib/rede/passes/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const recusaDoBanco = (erro: string) => {
  const recusada = /consentimento|alumia_entrada|sem_permissao/.test(erro);
  return responder({ ok: false, erro: recusada ? "entre_primeiro" : "rede" }, recusada ? 403 : 502);
};

export async function POST(pedido: Request) {
  const segredo = segredoDosPasses();
  if (!segredo) return responder({ ok: false, erro: "sem_servico" }, 503);
  if (deOutraOrigem(pedido)) return responder({ ok: false, erro: "origem" }, 403);
  const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return responder({ ok: false, erro: "rede" }, 502);
  if (!conta || !token) return responder({ ok: false, erro: "entre_primeiro" }, 401);
  const corpo = await lerCorpo(pedido, 24 * 1024);
  if (!corpo) return responder({ ok: false, erro: "invalido" }, 400);
  let banco;
  try {
    banco = await bancoDoSite();
  } catch {
    return responder({ ok: false, erro: "sem_servico" }, 503);
  }

  try {
    // ── O passe da urna ──
    if (corpo.tipo !== undefined || corpo.alvo !== undefined) {
      const tipo = corpo.tipo as TipoDaUrna;
      const alvo = typeof corpo.alvo === "string" ? corpo.alvo : "";
      const contexto = contextoDaUrna(tipo, alvo);
      if (!contexto || corpo.lote !== undefined) return responder({ ok: false, erro: "invalido" }, 400);
      if (corpo.pedido === undefined) {
        // A chave: só nasce para quem vota nesta votação (a regra é do banco, com a sessão).
        const pode = await rpcNoBanco<boolean>("rede_passes_contexto_pode", { p_tipo: tipo, p_alvo: alvo }, token);
        if (!pode.ok) return recusaDoBanco(pode.erro);
        if (pode.dados !== true) return responder({ ok: false, erro: "sem_permissao" }, 403);
        const chave = await chaveDoEmissor(0, contexto, banco, segredo, true);
        if (!chave || chave.seq === null) return responder({ ok: false, erro: "rede" }, 502);
        return responder({ contexto: paraB64u(contexto), semana: 0, id: paraB64u(chave.id), publica: paraB64u(chave.publica), seq: chave.seq });
      }
      const bruto = deB64u(corpo.pedido);
      const chave = await chaveDoEmissor(0, contexto, banco, segredo, false);
      if (!chave) return responder({ ok: false, erro: "nao_encontrada" }, 404);
      // O pedido é conferido ANTES de marcar (um pedido malformado não gasta o passe da votação).
      if (!bruto || !pedidoConferido(bruto, chave.id)) return responder({ ok: false, erro: "invalido" }, 400);
      const marcou = await rpcNoBanco<boolean>("rede_passes_contexto_marcar", { p_tipo: tipo, p_alvo: alvo, p_marca: paraBytea(marcaDoContexto(conta.id, contexto, segredo)) }, token);
      if (!marcou.ok) return recusaDoBanco(marcou.erro);
      if (marcou.dados !== true) return responder({ ok: false, erro: "ja_pegou" }, 409);
      // A votação secreta da equipe: o "já pegou a cédula" conta só aqui, pelo serviço (public.rede_urna_cedula_contar) — o banco não
      // pode mover esse contador pela marca, que é um HMAC que ele não confere (qualquer conta o inflaria com uma marca nova).
      if (tipo === "equipe") {
        const contou = await rpcDeServico<boolean>("rede_urna_cedula_contar", { p_tipo: tipo, p_alvo: alvo });
        if (!contou.ok || contou.dado !== true) return responder({ ok: false, erro: "rede" }, 502);
      }
      return responder({ resposta: paraB64u(await emitirUm(bruto, chave)) });
    }

    // ── O lote do dia ──
    const lote = deB64u(corpo.lote);
    const chave = await chaveDoEmissor(semanaDe(), new Uint8Array(0), banco, segredo, true);
    if (!chave) return responder({ ok: false, erro: "rede" }, 502);
    // O lote é conferido ANTES de marcar o dia (um lote malformado não gasta o dia da pessoa).
    if (!lote || !loteConferido(lote, chave.id)) return responder({ ok: false, erro: "invalido" }, 400);
    const marcou = await rpcNoBanco<boolean>("rede_passes_marcar_hoje", { p_marca: paraBytea(marcaDoDia(conta.id, undefined, segredo)) }, token);
    if (!marcou.ok) return recusaDoBanco(marcou.erro);
    if (marcou.dados !== true) return responder({ ok: false, erro: "ja_pegou" }, 409);
    return responder({ resposta: paraB64u(await emitirLote(lote, chave)) });
  } catch (e) {
    const m = (e as Error).message;
    if (m === "invalido") return responder({ ok: false, erro: "invalido" }, 400);
    return m === "sem_servico" ? responder({ ok: false, erro: "sem_servico" }, 503) : responder({ ok: false, erro: "rede" }, 502);
  }
}

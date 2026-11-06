// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A entrega: pega na fila do banco (interno.rede_fed_fila) as atividades vencidas, monta cada uma NA HORA (um post só sai se ainda
// pode sair: interno.rede_fed_federavel é conferida de novo), assina com a chave do ator e entrega na caixa de entrada da outra
// instância. Falha temporária volta para a fila com espera crescente (até 8 tentativas); recusa definitiva (4xx) sai da fila.
// Sem "@/". Só roda no servidor.
import { randomUUID } from "node:crypto";
import { assinarPedido } from "./assinatura";
import { atividadeCreate, atividadeDelete, atividadeFollow, atividadeResposta, atividadeUndoFollow, atividadeUpdate, type PostFederado } from "./documentos";
import { pedirAoFediverso } from "./http";
import { abrirChave, banco, fed } from "./servidor";

interface ItemDaFila {
  id: number;
  tipo: "create" | "update" | "delete" | "accept" | "reject" | "follow" | "undo-follow";
  objeto: string;
  destino: string;
  extra: { pedido?: string };
  tentativas: number;
  handle: string;
  chave_publica: string | null;
  chave_privada: string | null;
}

/** Monta a atividade de um item; nulo quando ela não deve mais sair (o post deixou de poder sair, por exemplo). */
async function montar(item: ItemDaFila): Promise<Record<string, unknown> | null> {
  switch (item.tipo) {
    case "create":
    case "update": {
      const post = await banco<PostFederado | { apagado: true } | null>("post", { id: item.objeto });
      if (!post || "apagado" in post) return null;
      return item.tipo === "create" ? atividadeCreate(fed, post) : atividadeUpdate(fed, post);
    }
    case "delete":
      return atividadeDelete(fed, item.handle, item.objeto);
    case "accept":
      return atividadeResposta(fed, "Accept", item.handle, item.objeto, item.extra.pedido ?? "", randomUUID());
    case "reject":
      return atividadeResposta(fed, "Reject", item.handle, item.objeto, item.extra.pedido ?? "", randomUUID());
    case "follow":
      return item.extra.pedido ? atividadeFollow(fed, item.handle, item.objeto, item.extra.pedido) : null;
    case "undo-follow":
      return item.extra.pedido ? atividadeUndoFollow(fed, item.handle, item.objeto, item.extra.pedido, randomUUID()) : null;
    default:
      return null;
  }
}

/** Entrega uma atividade assinada. Devolve o status HTTP (0 = não conectou). */
export async function entregar(destino: string, atividade: Record<string, unknown>, handle: string, chavePrivada: string): Promise<number> {
  const corpo = JSON.stringify(atividade);
  const cab = assinarPedido({ metodo: "POST", url: destino, corpo, chaveId: fed.chave(handle), chavePrivada });
  const r = await pedirAoFediverso(destino, { metodo: "POST", corpo, cabecalhos: { ...cab, Accept: "application/activity+json" }, maxBytes: 64 * 1024, tempoMs: 10_000 });
  return r?.status ?? 0;
}

/** Entrega até `limite` itens vencidos da fila. Devolve quantos saíram, quantos voltaram para a fila e quantos foram descartados. */
export async function processarFila(limite = 20): Promise<{ entregues: number; adiados: number; descartados: number }> {
  const itens = await banco<ItemDaFila[]>("fila_pegar", { limite });
  const total = { entregues: 0, adiados: 0, descartados: 0 };
  // Poucas de cada vez, para não abrir conexões demais de uma só instância do servidor.
  for (let i = 0; i < itens.length; i += 5) {
    await Promise.all(
      itens.slice(i, i + 5).map(async (item) => {
        const chave = abrirChave(item.chave_privada);
        if (!chave) {
          await banco("fila_feito", { id: item.id, ok: false, definitivo: true, erro: "sem_chave" });
          total.descartados++;
          return;
        }
        const atividade = await montar(item).catch(() => undefined);
        if (atividade === undefined) {
          await banco("fila_feito", { id: item.id, ok: false, erro: "banco" });
          total.adiados++;
          return;
        }
        if (atividade === null) {
          await banco("fila_feito", { id: item.id, ok: true, erro: "" });
          total.descartados++;
          return;
        }
        const status = await entregar(item.destino, atividade, item.handle, chave);
        if (status >= 200 && status < 300) {
          await banco("fila_feito", { id: item.id, ok: true });
          total.entregues++;
        } else {
          // 4xx (menos 408 e 429) é recusa definitiva; o resto (5xx, sem conexão, tempo) tenta de novo mais tarde.
          const definitivo = status >= 400 && status < 500 && status !== 408 && status !== 429;
          await banco("fila_feito", { id: item.id, ok: false, definitivo, erro: `http_${status}` });
          if (definitivo) total.descartados++;
          else total.adiados++;
        }
      }),
    );
  }
  return total;
}

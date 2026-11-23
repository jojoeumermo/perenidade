// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O cartão desta instância para o chat entre instâncias (onda R3, item 2.7; docs/rede/INSTANCIAS.md): GET ?desde=<seq> → {v, nome,
// chat, ponta, linhas}. O nome da instância, o servidor do chat separado e o registro público de transparência (o mesmo de
// public.rede_kt_trecho, que já é público), para o aparelho de quem vem de outra instância conferir a corrente. SEM sessão de conta.
// Desligado (404) enquanto ALUMIA_INSTANCIA (o nome do site) não estiver configurado ou o chat não estiver separado: o chat entre
// instâncias só existe com o servidor do chat separado (lib/rede/caixas/servidor-do-chat.ts). Nada é gravado; nenhum endereço é lido.
import { enderecoDoChat } from "@/lib/rede/caixas/servidor-do-chat";
import { recusaDeSessao, responder, trazSessao } from "@/lib/rede/caixas/rota";
import { rpcDeServico } from "@/lib/rede/convites/servidor";
import { instanciaValida } from "@/lib/rede/instancias/endereco";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(pedido: Request) {
  if (trazSessao(pedido)) return recusaDeSessao();
  const nome = (process.env.ALUMIA_INSTANCIA ?? "").trim().toLowerCase();
  const chat = enderecoDoChat();
  if (!instanciaValida(nome) || !chat) return responder({ ok: false, erro: "nao_encontrado" }, 404);
  const desde = Number(new URL(pedido.url).searchParams.get("desde") ?? "0");
  if (!Number.isInteger(desde) || desde < 0) return responder({ ok: false, erro: "invalido" }, 400);
  const [ponta, linhas] = await Promise.all([
    rpcDeServico<{ seq: number; resumo: string }>("rede_kt_ponta", {}),
    rpcDeServico<unknown[]>("rede_kt_trecho", { p_desde: desde }),
  ]);
  if (!ponta.ok || !linhas.ok) return responder({ ok: false, erro: "rede" }, 502);
  return responder({ v: 1, nome, chat, ponta: ponta.dado, linhas: Array.isArray(linhas.dado) ? linhas.dado : [] });
}

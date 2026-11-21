// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O pedido de conversa sem lista (onda R2, item 2.5), o lado de quem pede: o envelope (HPKE X-Wing para a chave de pedidos da outra
// pessoa, montado pela frente da conversa a dois, completado a 4096) vai para a caixa de pedidos pública dela, com uma prova de trabalho
// (lib/rede/caixas/prova.ts) e um passe anônimo. Nenhum dos dois diz quem pediu. "Quem pode me chamar" e "recusa não se repete por 30
// dias" são conferidos no aparelho de quem recebe (lib/rede/caixas/freios.ts), não no servidor.
// Onda R3 (o chat separado, item 3.1): com o servidor do chat fora do site (lib/rede/caixas/servidor-do-chat.ts), o pedido vai direto
// para a caixa de pedidos da pessoa no servidor do chat (o id e o passe de depósito dela vêm do diretório, como na R2), com o desafio
// do servidor do chat e o mesmo passe; o site não vê o pedido.
// Sem "@/" de propósito.
import { gastarPasse } from "../passes/cliente";
import { lerDiretorio } from "./diretorio";
import { enderecoDoChat } from "./servidor-do-chat";
import { deB64u, paraB64u } from "./base";
import { BITS, resolverProva, TAMANHO_DO_DESAFIO } from "./prova";
import { TAMANHO_PEDIDO } from "./tamanhos";
import { erroDe, getAnonimo, postAnonimo } from "./transporte";

/** O maior número de bits que o aparelho aceita resolver (um servidor que pede mais estaria travando o aparelho). */
const BITS_MAXIMOS = BITS + 2;

/**
 * Deposita o pedido na caixa de pedidos de `codinome`. Erros: "tamanho", "sem_pedidos" (a pessoa não recebe pedidos pelo chat novo),
 * "passe_usado", "cheia" (a caixa de pedidos dela encheu hoje), "rede", "sem_passes", "entre_primeiro" (para pegar os passes do dia).
 */
export async function depositarPedido(codinome: string, envelope: Uint8Array, chat: string = enderecoDoChat()): Promise<void> {
  if (envelope.length !== TAMANHO_PEDIDO) throw erroDe("tamanho");
  if (chat) return depositarPedidoNoServidorDoChat(chat, codinome, envelope);
  const d = await getAnonimo("/api/alumia/pedido/desafio");
  const desafio = deB64u(d.corpo?.desafio, TAMANHO_DO_DESAFIO);
  const bits = Number(d.corpo?.bits);
  if (d.status !== 200 || !desafio || !Number.isInteger(bits) || bits < BITS || bits > BITS_MAXIMOS) throw erroDe("rede");
  const nonce = await resolverProva(desafio, bits);
  const passe = await gastarPasse();
  const r = await postAnonimo("/api/alumia/pedido", { codinome, desafio: paraB64u(desafio), nonce: paraB64u(nonce), envelope: paraB64u(envelope) }, passe);
  if (r.status === 200 && r.corpo?.ok === true) return;
  throw erroDe(typeof r.corpo?.erro === "string" ? r.corpo.erro : "rede");
}

/** O mesmo, com o chat separado: a caixa de pedidos (do diretório) no servidor do chat, com o desafio dele e um passe. */
async function depositarPedidoNoServidorDoChat(chat: string, codinome: string, envelope: Uint8Array): Promise<void> {
  const dir = await lerDiretorio(codinome);
  if (!dir) throw erroDe("sem_pedidos");
  const d = await getAnonimo(`${chat}/desafio`);
  const desafio = deB64u(d.corpo?.desafio, TAMANHO_DO_DESAFIO);
  const bits = Number(d.corpo?.bits_com_passe);
  if (d.status !== 200 || !desafio || !Number.isInteger(bits) || bits < BITS || bits > BITS_MAXIMOS) throw erroDe("rede");
  const nonce = await resolverProva(desafio, bits);
  const passe = await gastarPasse();
  const r = await postAnonimo(
    `${chat}/caixa/lote`,
    { itens: [{ acao: "pedido", id: paraB64u(dir.pedidosCaixa), pd: paraB64u(dir.pedidosPd), envelope: paraB64u(envelope), desafio: paraB64u(desafio), nonce: paraB64u(nonce) }] },
    passe,
  );
  const lista = r.corpo?.resultados;
  const item = Array.isArray(lista) && lista.length === 1 ? (lista[0] as { ok?: unknown; erro?: unknown }) : null;
  if (r.status === 200 && item?.ok === true) return;
  throw erroDe(typeof item?.erro === "string" ? item.erro : typeof r.corpo?.erro === "string" ? r.corpo.erro : "rede");
}

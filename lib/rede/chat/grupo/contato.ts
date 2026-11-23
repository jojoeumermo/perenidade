// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conversa em grupo (recurso "alumia-chat-grupo") convida só quem já tem conversa a dois ABERTA com quem convida: é por ela que vão
// o convite e o pedido de entrada (formato.ts). Aqui, o que o chat a dois deste aparelho sabe da pessoa: a conversa, o @ e a
// identidade da conta, só quando ela confere com o registro público das chaves e não mudou (com a identidade mudada, a conversa a
// dois também não manda nada até a pessoa aceitar ou comparar o código). Sem "@/": roda no Node nos testes.
import { deB64Url } from "../r2/bytes";
import type { ChatDoAparelho } from "../r2/servico";
import type { ContatoDoGrupo } from "./servico";

type ConversaDaTela = ReturnType<ChatDoAparelho["conversas"]>[number];

export function contatoDoChat(chat: ChatDoAparelho, achar: (c: ConversaDaTela) => boolean): ContatoDoGrupo | null {
  const conv = chat.conversas().find((c) => c.situacao === "aberta" && !c.bloqueada && achar(c));
  if (!conv) return null;
  const k = chat.estado.lista.contatos[conv.com];
  if (!k || k.mudou || k.registro !== "confere") return null;
  return { conta: conv.com, codinome: conv.codinome, conversa: conv.id, identidade: deB64Url(k.identidade) };
}

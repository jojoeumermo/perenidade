// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O portão do recurso "alumia-chat-so-app" (onda R3, item 1.2). Ligado, o site deixa de carregar o chat: as páginas do chat
// (/alumia/conversas, /alumia/aparelhos, o chat da equipe no painel) mostram só "Para conversar, use o app" com o link para a
// página de baixar e conferir (/alumia/app), e nenhum módulo de chave do chat chega ao navegador. Desligado (o padrão do beta),
// tudo fica como está.
//
// SÓ PELO NOME, sempre: a produção usa NEXT_PUBLIC_RECURSOS="todos", e "todos" NÃO pode ligar isto (ligado, quem está no
// beta pelo site perde o chat). Enquanto o nome não estiver no catálogo (lib/recursos.ts, que é da junção), o portão lê a lista
// da montagem e só liga com o nome escrito nela. Quando estiver, só vale se também estiver em SO_PELO_NOME; senão fica
// desligado (falha fechada para o lado de não mudar nada).
//
// Sem "@/" de propósito: o proxy.ts (borda) e os testes no Node usam.
import { lerRecursos, ligado, RECURSOS, SO_PELO_NOME, type Recurso } from "../../recursos";

export const RECURSO_CHAT_SO_APP = "alumia-chat-so-app";

/** A decisão, separada para os testes conferirem sem mexer no ambiente. `noCatalogo`/`soPeloNome` dizem como o catálogo está. */
export function decidirChatSoApp(lista: Set<string>, catalogo: { noCatalogo: boolean; soPeloNome: boolean; ligadoPeloCatalogo: () => boolean }): boolean {
  if (lista.has(`-${RECURSO_CHAT_SO_APP}`)) return false;
  if (!catalogo.noCatalogo) return lista.has(RECURSO_CHAT_SO_APP);
  if (!catalogo.soPeloNome) return false;
  return catalogo.ligadoPeloCatalogo();
}

/** O site está no modo "o chat só nos apps"? */
export function chatSoApp(): boolean {
  // A referência literal (process.env.NEXT_PUBLIC_RECURSOS) é o que o Next grava no código do navegador.
  const lista = lerRecursos(process.env.NEXT_PUBLIC_RECURSOS);
  const noCatalogo = Object.prototype.hasOwnProperty.call(RECURSOS, RECURSO_CHAT_SO_APP);
  return decidirChatSoApp(lista, {
    noCatalogo,
    soPeloNome: (SO_PELO_NOME as readonly string[]).includes(RECURSO_CHAT_SO_APP),
    ligadoPeloCatalogo: () => ligado(RECURSO_CHAT_SO_APP as Recurso),
  });
}

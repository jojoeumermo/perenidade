// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A guarda das posições recebidas NESTA aba (Prompt 4, itens 2 e 7): uma só por aba, na memória. O chat (lib/rede/chat/r2/navegador.ts,
// `aoPosicao`) entrega aqui o que chegou de dentro do cifrado; a tela do Perto e o aviso da casca leem daqui. Nada vai ao disco: ao
// fechar a aba, some; no Sair rápido e no "apagar tudo do chat", some na hora. Sem trajeto: a guarda fica só com a última de cada pessoa.
import { aoApagarTudoDoChat } from "../chat/gaveta";
import { type CorpoDePosicao, GuardaDePosicoes } from "./posicao";

export const guardaDePosicoes = new GuardaDePosicoes();

/** O que o chat chama quando chega uma posição (origem "c:<conversa>" ou "g:<grupo>"). */
export function posicaoChegou(origem: string, autor: string, corpo: CorpoDePosicao, quando: number): void {
  guardaDePosicoes.receber(origem, autor, corpo, quando);
}

aoApagarTudoDoChat(() => guardaDePosicoes.esquecer());

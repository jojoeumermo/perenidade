// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O passo a passo de cada seção do painel, em linguagem simples, mostrado pelo botão "Como funciona esta seção"
// (components/painel/GuiaDaSecao.tsx). Seção sem guia aqui não mostra o botão.

export interface Guia {
  /** Para que serve a seção, numa frase. */
  paraQue: string;
  /** Os passos, em ordem: cada um com um título curto e o que fazer. */
  passos: { titulo: string; texto: string }[];
  /** Uma dica ou um cuidado (opcional). */
  dica?: string;
}

export const GUIAS: Record<string, Guia> = {
  mesa: {
    paraQue: "A Mesa mostra o que chegou para você hoje.",
    passos: [
      { titulo: "Veja o que espera por você", texto: "A lista mostra o que revisar, o que responder e o que fazer. O número diz quantos itens há em cada linha." },
      { titulo: "Filtre se quiser", texto: "Use os botões Tudo, Revisar, Responder e Fazer para ver só um tipo de trabalho." },
      { titulo: "Clique e vá direto", texto: "Clique numa linha e o painel abre a seção certa, já no trabalho." },
    ],
    dica: "Nada aqui é obrigatório. Faça o que der, no seu tempo.",
  },
  escrever: {
    paraQue: "Aqui você escreve aulas, matérias, verbetes e tudo o que vai para o site.",
    passos: [
      { titulo: "Escolha o que vai escrever", texto: "Clique no cartão do tipo de texto: aula de uma trilha, material avulso, verbete e outros." },
      { titulo: "Escreva com calma", texto: "Use o botão Tela cheia para escrever sem nada em volta. O menu Bloco da aula põe os blocos prontos (provocação, na vida real, leve para a sua comunidade)." },
      { titulo: "Cite as fontes", texto: "Toda aula precisa de pelo menos uma fonte. Preencha o título, o autor e o endereço." },
      { titulo: "Envie para a revisão", texto: "Clique em Enviar para revisão. Nada vai ao ar sem a revisão da equipe." },
    ],
    dica: "O rascunho fica guardado sozinho neste aparelho.",
  },
};

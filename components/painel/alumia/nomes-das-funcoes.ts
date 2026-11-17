// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O nome e a descrição de cada função da Alumia como a coordenação lê no painel. O texto de lib/recursos.ts é para quem mexe no
// código (fala de SQL, de variável e de arquivo); este é o da tela.

export interface NomeDaFuncao {
  nome: string;
  sobre: string;
}

export const NOMES_DAS_FUNCOES: Record<string, NomeDaFuncao> = {
  "rede-v2": { nome: "Alumia (a base)", sobre: "A rede inteira: posts, discussões, comunidades e perfil com @. Todas as outras funções dependem desta." },
  "alumia-2": { nome: "Cara nova da Alumia", sobre: "As telas no desenho do Mosaico da Arquibancada: atos, calendário, listas e segurança." },
  "alumia-stories": { nome: "Stories", sobre: "Publicações que somem em 24 horas, sem registro de quem viu, e que nunca saem para o Fediverso." },
  "alumia-org": { nome: "Organizações com selo", sobre: "Páginas das organizações, consultas à base, plenárias e prestação de contas." },
  "alumia-modo-ato": { nome: "Modo ato", sobre: "“Fui detido”, “Estou bem” e identidades, para o dia do ato. A segurança da conta e os aparelhos abrem com a cara nova." },
  "alumia-chat-grupo": { nome: "Conversa do núcleo", sobre: "A conversa cifrada de ponta a ponta entre as pessoas de um núcleo." },
  "alumia-proximas": { nome: "Telas em construção", sobre: "Transparência, listas e versão leve. Ligue só quando estiverem prontas." },
  "alumia-linha-aberta": { nome: "Linha com regra aberta (Em roda)", sobre: "A ordem da linha igual para todo mundo e escrita na tela, as linhas que cada pessoa monta e os assuntos em alta." },
  "alumia-aberta": { nome: "Alumia aberta", sobre: "Tira o aviso de “em construção” e abre a Alumia. Ligue só no fim das ondas, depois do SQL final." },
  "alumia-convites": { nome: "Convites", sobre: "Quem já está dentro convida (3 por mês): o convite leva à triagem e não aprova ninguém. A triagem vê só “veio por convite”, nunca de quem." },
  "alumia-fui-detido": { nome: "Fui detido", sobre: "O botão do modo ato que avisa os contatos escolhidos (e, se a pessoa quiser, a assessoria jurídica da organização). Ligue só depois do parecer do advogado." },
  "alumia-entrada": { nome: "Entrada com triagem", sobre: "Anda junto com a trava da entrada: liga e desliga no quadro da trava." },
  "alumia-mapa": { nome: "Mapa por cidade", sobre: "Chamados, eventos e núcleos no mapa do Brasil, só por município; número só a partir de 3 e núcleo sem número. Nada carrega de fora." },
  "alumia-ao-vivo": { nome: "Pergunte a… ao vivo", sobre: "Sessões de perguntas com hora marcada, convite aceito pela convidada e fila por ordem de chegada." },
  "alumia-alcance": { nome: "Levar para fora", sobre: "Arte em imagem e QR feitos no aparelho, RSS e cartão para colar em outro site, só do que é aberto à internet. Nada sai com a trava da entrada ligada." },
  "alumia-leve": { nome: "Leve e no seu tempo", sobre: "Economia de dados, escrever sem rede (guardado só no aparelho), Início só em texto, hora de parar e silêncio dos avisos." },
  "alumia-traducao": { nome: "Traduzir post", sobre: "O botão Traduzir, pelo servidor de tradução próprio, só quando a pessoa toca. Precisa do endereço do tradutor no servidor do site." },
  "alumia-telegram": { nome: "Telegram da organização", sobre: "Organização com selo publica junto no próprio canal do Telegram. Precisa do token e da rotina no servidor do site." },
  "fediverso-total": { nome: "Fediverso", sobre: "A Alumia conversa com outras redes livres (Mastodon e afins): perfis que consentiram, posts públicos, respostas e menções." },
  "fediverso-grupos": { nome: "Comunidades no Fediverso", sobre: "As comunidades abertas aparecem como grupos para quem está em outras redes livres (Lemmy e afins)." },
};

/** O nome da função para a tela (o técnico, se for uma que este código ainda não conhece). */
export const nomeDaFuncao = (nome: string): NomeDaFuncao => NOMES_DAS_FUNCOES[nome] ?? { nome, sobre: "Função do catálogo do banco que esta versão do painel ainda não descreve." };

/** As duas chaves que o cartão "Fediverso" liga e desliga juntas. */
export const FUNCOES_DO_FEDIVERSO = ["fediverso-total", "fediverso-grupos"] as const;

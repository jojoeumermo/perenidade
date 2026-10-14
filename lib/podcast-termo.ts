// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Termo de cessão de uso de voz e imagem do convidado. O mesmo texto aparece no link do convidado (aceite on-line) e no
// modelo para imprimir do painel. Está em português porque é o que vale juridicamente para o instituto.

export const TERMO_TITULO = "Termo de autorização de uso de voz e imagem";

export const termo = (nome: string) => [
  `Eu, ${nome || "________________________________"}, participo como convidado(a) de um episódio do podcast do Instituto Lúcia, projeto de educação popular, gratuito e sem fins lucrativos.`,
  "Autorizo, de forma gratuita e sem prazo, o uso da minha voz e das minhas falas gravadas para o episódio e para os trechos curtos de divulgação (cortes), em qualquer meio: o site do instituto, o feed do podcast e as plataformas que o distribuem (Spotify, Apple Podcasts, YouTube e outras) e as redes sociais do instituto.",
  "Se eu marcar a opção de imagem, autorizo também o uso da minha imagem (foto ou vídeo da gravação) nas mesmas condições.",
  "O episódio será publicado sob a licença Creative Commons Atribuição-CompartilhaIgual 4.0 (CC BY-SA 4.0), como o restante do acervo: qualquer pessoa pode ouvir, copiar e compartilhar, citando a fonte. O instituto não vende nem licencia o episódio para fins comerciais.",
  "O instituto se compromete a não usar a minha participação fora de contexto nem de forma que distorça o que eu disse, e a me mostrar a versão editada antes da publicação, se eu pedir.",
  "Meus dados de contato não serão publicados nem repassados a ninguém. Posso pedir a retirada do episódio a qualquer momento pelo e-mail contato@institutolucia.org; a retirada vale para o site e o feed do instituto, mas cópias já feitas por terceiros sob a licença livre podem continuar existindo.",
];

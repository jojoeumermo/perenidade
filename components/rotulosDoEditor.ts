// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
// Os rótulos do editor de texto em português (painel e Sala livre), num arquivo leve: quem só precisa deles não carrega
// a tela inteira de Escrever.
import type { EditorLabels } from "./Editor";

export const editorPt: EditorLabels = {
  bold: "Negrito",
  italic: "Itálico",
  heading: "Título de seção",
  subheading: "Subtítulo",
  quote: "Citação",
  list: "Lista",
  numbered: "Lista numerada",
  link: "Link",
  linkPrompt: "Endereço do link:",
  preview: "Pré-visualizar",
  write: "Voltar a escrever",
  empty: "*Nada para mostrar ainda.*",
  video: "Vídeo (endereço do YouTube, Vimeo ou PeerTube)",
  videoPrompt: "Endereço do vídeo (https://…). O vídeo fica onde está; a aula só aponta para ele.",
  math: "Conta passo a passo",
  image: "Imagem",
  imageAlt: "Descreva a imagem para quem não enxerga (o que aparece nela):",
  imageCredit: "Crédito e licença (autor, ano, de onde veio). Só envie imagem sua, em domínio público ou com licença livre:",
  sending: "Limpando os dados embutidos e enviando a imagem…",
  check: "Conferir ortografia e gramática",
  checking: "Conferindo…",
  checkNone: "Nenhum apontamento.",
  checkLive: "Conferir enquanto escrevo",
  checkNote: "O texto vai ao conferidor do instituto (LanguageTool, de código aberto) ao apertar o botão ou, se você ligar, alguns segundos depois de parar de digitar. Os apontamentos ficam sublinhados no texto.",
  checkFailed: "A conferência não respondeu. Tente de novo em um minuto.",
  checkStale: "O texto mudou: confira de novo.",
};

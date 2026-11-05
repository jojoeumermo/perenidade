// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O nome de "Jogos" no menu e a frase de uma linha, nos 6 idiomas. Separado dos JSON completos (i18n/jogos/) para o menu
// do topo, que é componente de cliente, não baixar os seis arquivos. Só pt é texto final; os outros são rascunho.

export const ROTA_DOS_JOGOS = "/jogos";

export const MENU_DOS_JOGOS: Record<string, { rotulo: string; descricao: string }> = {
  pt: { rotulo: "Jogos", descricao: "Palavras cruzadas, sudoku, forca, memória, música para crianças e os jogos de formação, sem pontos nem placar" },
  en: { rotulo: "Games", descricao: "Crosswords, sudoku, hangman, memory, music for children and the training games, with no points or leaderboard" },
  es: { rotulo: "Juegos", descricao: "Crucigramas, sudoku, ahorcado, memoria, música para niños y los juegos de formación, sin puntos ni ranking" },
  fr: { rotulo: "Jeux", descricao: "Mots croisés, sudoku, pendu, memory, musique pour enfants et jeux de formation, sans points ni classement" },
  ru: { rotulo: "Игры", descricao: "Кроссворды, судоку, виселица, память, музыка для детей и учебные игры, без очков и рейтинга" },
  zh: { rotulo: "游戏", descricao: "填字、数独、猜词、记忆配对、儿童音乐和培训游戏，没有积分和排行榜" },
};

export const menuDosJogos = (lang: string) => MENU_DOS_JOGOS[lang] ?? MENU_DOS_JOGOS.pt;

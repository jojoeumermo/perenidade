// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Os poucos textos da casca do aplicativo, nos seis idiomas (o português é o de referência). Ficam aqui, e não nos JSON
// de i18n, para a casca (carregada em todas as páginas do celular) não pesar o núcleo de tradução de ninguém.
import type { AbaDoApp } from "./modo";

export interface TextosDoApp {
  abas: Record<AbaDoApp, string>;
  /** O nome do menu de baixo, para o leitor de tela. */
  menu: string;
  voltar: string;
  aulaDoDia: string;
  abrirAula: string;
  minutos: (n: number) => string;
}

const PT: TextosDoApp = {
  abas: { inicio: "Início", estudar: "Estudar", jogos: "Jogos e labs", comunidade: "Alumia", eu: "Eu" },
  menu: "Menu do aplicativo",
  voltar: "Voltar",
  aulaDoDia: "Aula do dia",
  abrirAula: "Abrir a aula",
  minutos: (n) => `${n} min`,
};

const TEXTOS: Record<string, TextosDoApp> = {
  pt: PT,
  en: { abas: { inicio: "Home", estudar: "Study", jogos: "Games & labs", comunidade: "Alumia", eu: "Me" }, menu: "App menu", voltar: "Back", aulaDoDia: "Lesson of the day", abrirAula: "Open the lesson", minutos: (n) => `${n} min` },
  es: { abas: { inicio: "Inicio", estudar: "Estudiar", jogos: "Juegos y labs", comunidade: "Alumia", eu: "Yo" }, menu: "Menú de la aplicación", voltar: "Volver", aulaDoDia: "Clase del día", abrirAula: "Abrir la clase", minutos: (n) => `${n} min` },
  fr: { abas: { inicio: "Accueil", estudar: "Étudier", jogos: "Jeux et labos", comunidade: "Alumia", eu: "Moi" }, menu: "Menu de l’application", voltar: "Retour", aulaDoDia: "Leçon du jour", abrirAula: "Ouvrir la leçon", minutos: (n) => `${n} min` },
  ru: { abas: { inicio: "Главная", estudar: "Учёба", jogos: "Игры и лабы", comunidade: "Alumia", eu: "Я" }, menu: "Меню приложения", voltar: "Назад", aulaDoDia: "Урок дня", abrirAula: "Открыть урок", minutos: (n) => `${n} мин` },
  zh: { abas: { inicio: "首页", estudar: "学习", jogos: "游戏与实验", comunidade: "Alumia", eu: "我" }, menu: "应用菜单", voltar: "返回", aulaDoDia: "今日一课", abrirAula: "打开课程", minutos: (n) => `${n} 分钟` },
};

export const textosDoApp = (lang: string): TextosDoApp => TEXTOS[lang] ?? PT;

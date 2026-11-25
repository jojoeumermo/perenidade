// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Os textos da experiência própria do aplicativo instalado (app/[lang]/app/..., components/app/ShellDoApp.tsx).
// Como os da casca (components/app/textos.ts), ficam fora do núcleo de tradução para não pesar o dicionário de ninguém;
// o português é a referência e os outros cinco idiomas seguem a mesma estrutura.

export interface TextosDoAppNovo {
  /** Nome curto da área do aplicativo (barra de cima, aviso de redirect). */
  nomeDaArea: string;
  /** Barra de cima: rótulo do botão de voltar já existe na casca; aqui o título quando a tela não é de nenhuma aba. */
  buscar: string;
  conta: string;
  /** Aviso para quem abre uma rota do aplicativo no navegador (o redirect é imediato; isto quase nunca aparece). */
  abrindoNoApp: string;
  irParaOSite: string;
  /** Início do aplicativo. */
  seuResumo: string;
  aulasFeitas: (n: number) => string;
  nenhumaAulaAinda: string;
  verTudo: string;
  estantes: string;
  noMuro: string;
  atalhos: string;
  /** Hub Estudar. */
  estudarLead: string;
  aulas: (n: number) => string;
  /** Hub Jogos. */
  jogosLead: string;
  laboratorios: string;
  /** Hub Eu. */
  euLead: string;
  /** O cartão de apoio da aba Eu: no aplicativo o convite não abre sozinho, ele mora aqui. */
  apoiar: string;
  apoiarLead: string;
  /** Jornada de estudo própria (disciplina, trilha, aula). */
  trilhas: string;
  progressoDe: (feitas: number, total: number) => string;
  continuarEstudo: string;
  comecarTrilha: string;
  concluirESeguir: string;
  concluirTrilha: string;
  desfazer: string;
  aulaConcluida: string;
  proximaAula: string;
  trilhaConcluida: string;
  voltarParaTrilha: string;
  emPreparacao: string;
  semAulasAinda: string;
  aulaDe: (i: number, n: number) => string;
  minutos: (n: number) => string;
  seuProgresso: string;
  continuarDeOndeParou: string;
  maisDoEstudo: string;
}

const PT: TextosDoAppNovo = {
  nomeDaArea: "Aplicativo",
  buscar: "Buscar",
  conta: "Sua conta",
  abrindoNoApp: "Esta tela é do aplicativo instalado. Abrindo o site…",
  irParaOSite: "Ir para o site",
  seuResumo: "Seu resumo",
  aulasFeitas: (n) => (n === 1 ? "1 aula feita neste aparelho" : `${n} aulas feitas neste aparelho`),
  nenhumaAulaAinda: "Nenhuma aula feita ainda neste aparelho",
  verTudo: "Ver tudo",
  estantes: "Estantes",
  noMuro: "No muro de hoje",
  atalhos: "Atalhos",
  estudarLead: "As disciplinas do Instituto, em trilhas de aulas curtas.",
  aulas: (n) => (n === 1 ? "1 aula" : `${n} aulas`),
  jogosLead: "Jogos, laboratórios e ferramentas para aprender fazendo.",
  laboratorios: "Laboratórios",
  euLead: "Seu estudo, seu caderno e suas preferências, neste aparelho.",
  apoiar: "Apoiar o instituto",
  apoiarLead: "Gratuito, sem anúncio e sem rastreador: quem pode contribuir mantém tudo no ar.",
  trilhas: "Trilhas",
  progressoDe: (f, n) => `${f} de ${n} aulas`,
  continuarEstudo: "Continuar estudando",
  comecarTrilha: "Começar a trilha",
  concluirESeguir: "Concluir e seguir",
  concluirTrilha: "Concluir a trilha",
  desfazer: "Desfazer",
  aulaConcluida: "Aula concluída",
  proximaAula: "Próxima aula",
  trilhaConcluida: "Trilha concluída. Bom trabalho!",
  voltarParaTrilha: "Voltar para a trilha",
  emPreparacao: "em preparação",
  semAulasAinda: "Nenhuma aula pronta ainda nesta disciplina.",
  aulaDe: (i, n) => `Aula ${i} de ${n}`,
  minutos: (n) => `${n} min`,
  seuProgresso: "Seu progresso",
  continuarDeOndeParou: "Continuar de onde parou",
  maisDoEstudo: "Revisão, temas, cópia e dados",
};

export const TEXTOS_DO_APP_NOVO: Record<string, TextosDoAppNovo> = {
  pt: PT,
  en: {
    ...PT,
    nomeDaArea: "App",
    buscar: "Search",
    conta: "Your account",
    abrindoNoApp: "This screen belongs to the installed app. Opening the site…",
    irParaOSite: "Go to the site",
    seuResumo: "Your summary",
    aulasFeitas: (n) => (n === 1 ? "1 lesson done on this device" : `${n} lessons done on this device`),
    nenhumaAulaAinda: "No lessons done on this device yet",
    verTudo: "See all",
    estantes: "Shelves",
    noMuro: "On today's wall",
    atalhos: "Shortcuts",
    estudarLead: "The Institute's subjects, in short-lesson tracks.",
    aulas: (n) => (n === 1 ? "1 lesson" : `${n} lessons`),
    jogosLead: "Games, labs and tools to learn by doing.",
    laboratorios: "Labs",
    euLead: "Your studies, notebook and preferences, on this device.",
    apoiar: "Support the institute",
    apoiarLead: "Free, ad-free and tracker-free: those who can contribute keep everything running.",
    trilhas: "Tracks",
    progressoDe: (f, n) => `${f} of ${n} lessons`,
    continuarEstudo: "Keep studying",
    comecarTrilha: "Start the track",
    concluirESeguir: "Complete and continue",
    concluirTrilha: "Complete the track",
    desfazer: "Undo",
    aulaConcluida: "Lesson complete",
    proximaAula: "Next lesson",
    trilhaConcluida: "Track complete. Well done!",
    voltarParaTrilha: "Back to the track",
    emPreparacao: "in preparation",
    semAulasAinda: "No lesson ready in this subject yet.",
    aulaDe: (i, n) => `Lesson ${i} of ${n}`,
    minutos: (n) => `${n} min`,
    seuProgresso: "Your progress",
    continuarDeOndeParou: "Continue where you left off",
    maisDoEstudo: "Review, topics, backup and data",
  },
  es: {
    ...PT,
    nomeDaArea: "Aplicación",
    buscar: "Buscar",
    conta: "Tu cuenta",
    abrindoNoApp: "Esta pantalla es de la aplicación instalada. Abriendo el sitio…",
    irParaOSite: "Ir al sitio",
    seuResumo: "Tu resumen",
    aulasFeitas: (n) => (n === 1 ? "1 clase hecha en este aparato" : `${n} clases hechas en este aparato`),
    nenhumaAulaAinda: "Todavía no hay clases hechas en este aparato",
    verTudo: "Ver todo",
    estantes: "Estanterías",
    noMuro: "En el muro de hoy",
    atalhos: "Atajos",
    estudarLead: "Las disciplinas del Instituto, en rutas de clases cortas.",
    aulas: (n) => (n === 1 ? "1 clase" : `${n} clases`),
    jogosLead: "Juegos, laboratorios y herramientas para aprender haciendo.",
    laboratorios: "Laboratorios",
    euLead: "Tu estudio, tu cuaderno y tus preferencias, en este aparato.",
    apoiar: "Apoyar el instituto",
    apoiarLead: "Gratuito, sin anuncios y sin rastreadores: quien puede contribuir mantiene todo en pie.",
    trilhas: "Rutas",
    progressoDe: (f, n) => `${f} de ${n} clases`,
    continuarEstudo: "Seguir estudiando",
    comecarTrilha: "Empezar la ruta",
    concluirESeguir: "Completar y seguir",
    concluirTrilha: "Completar la ruta",
    desfazer: "Deshacer",
    aulaConcluida: "Clase completada",
    proximaAula: "Próxima clase",
    trilhaConcluida: "Ruta completada. ¡Buen trabajo!",
    voltarParaTrilha: "Volver a la ruta",
    emPreparacao: "en preparación",
    semAulasAinda: "Aún no hay clases listas en esta disciplina.",
    aulaDe: (i, n) => `Clase ${i} de ${n}`,
    minutos: (n) => `${n} min`,
    seuProgresso: "Tu progreso",
    continuarDeOndeParou: "Continuar donde lo dejaste",
    maisDoEstudo: "Repaso, temas, copia y datos",
  },
  fr: {
    ...PT,
    nomeDaArea: "Application",
    buscar: "Rechercher",
    conta: "Votre compte",
    abrindoNoApp: "Cet écran appartient à l'application installée. Ouverture du site…",
    irParaOSite: "Aller au site",
    seuResumo: "Votre résumé",
    aulasFeitas: (n) => (n === 1 ? "1 leçon faite sur cet appareil" : `${n} leçons faites sur cet appareil`),
    nenhumaAulaAinda: "Aucune leçon faite sur cet appareil pour l'instant",
    verTudo: "Tout voir",
    estantes: "Rayonnages",
    noMuro: "Au mur d'aujourd'hui",
    atalhos: "Raccourcis",
    estudarLead: "Les disciplines de l'Institut, en parcours de leçons courtes.",
    aulas: (n) => (n === 1 ? "1 leçon" : `${n} leçons`),
    jogosLead: "Jeux, labos et outils pour apprendre en faisant.",
    laboratorios: "Labos",
    euLead: "Votre étude, votre carnet et vos préférences, sur cet appareil.",
    apoiar: "Soutenir l'institut",
    apoiarLead: "Gratuit, sans pub ni traqueur : ceux qui peuvent contribuer maintiennent tout en ligne.",
    trilhas: "Parcours",
    progressoDe: (f, n) => `${f} leçons sur ${n}`,
    continuarEstudo: "Continuer à étudier",
    comecarTrilha: "Commencer le parcours",
    concluirESeguir: "Terminer et continuer",
    concluirTrilha: "Terminer le parcours",
    desfazer: "Annuler",
    aulaConcluida: "Leçon terminée",
    proximaAula: "Leçon suivante",
    trilhaConcluida: "Parcours terminé. Bravo !",
    voltarParaTrilha: "Retour au parcours",
    emPreparacao: "en préparation",
    semAulasAinda: "Aucune leçon prête dans cette discipline.",
    aulaDe: (i, n) => `Leçon ${i} sur ${n}`,
    minutos: (n) => `${n} min`,
    seuProgresso: "Votre progression",
    continuarDeOndeParou: "Reprendre où vous vous étiez arrêté",
    maisDoEstudo: "Révision, thèmes, copie et données",
  },
  ru: {
    ...PT,
    nomeDaArea: "Приложение",
    buscar: "Поиск",
    conta: "Ваш аккаунт",
    abrindoNoApp: "Этот экран принадлежит установленному приложению. Открываем сайт…",
    irParaOSite: "Перейти на сайт",
    seuResumo: "Ваш итог",
    aulasFeitas: (n) => `Уроков пройдено на этом устройстве: ${n}`,
    nenhumaAulaAinda: "На этом устройстве пока нет пройденных уроков",
    verTudo: "Показать все",
    estantes: "Полки",
    noMuro: "Сегодня на стене",
    atalhos: "Ярлыки",
    estudarLead: "Дисциплины Института в виде коротких уроков.",
    aulas: (n) => `Уроков: ${n}`,
    jogosLead: "Игры, лаборатории и инструменты, чтобы учиться делом.",
    laboratorios: "Лаборатории",
    euLead: "Ваша учёба, тетрадь и настройки на этом устройстве.",
    apoiar: "Поддержать институт",
    apoiarLead: "Бесплатно, без рекламы и трекеров: те, кто может, поддерживают всё это.",
    trilhas: "Маршруты",
    progressoDe: (f, n) => `${f} из ${n} уроков`,
    continuarEstudo: "Продолжить учёбу",
    comecarTrilha: "Начать маршрут",
    concluirESeguir: "Завершить и дальше",
    concluirTrilha: "Завершить маршрут",
    desfazer: "Отменить",
    aulaConcluida: "Урок пройден",
    proximaAula: "Следующий урок",
    trilhaConcluida: "Маршрут пройден. Отличная работа!",
    voltarParaTrilha: "Назад к маршруту",
    emPreparacao: "в подготовке",
    semAulasAinda: "В этой дисциплине пока нет готовых уроков.",
    aulaDe: (i, n) => `Урок ${i} из ${n}`,
    minutos: (n) => `${n} мин`,
    seuProgresso: "Ваш прогресс",
    continuarDeOndeParou: "Продолжить с того места",
    maisDoEstudo: "Повторение, темы, копия и данные",
  },
  zh: {
    ...PT,
    nomeDaArea: "应用",
    buscar: "搜索",
    conta: "您的账户",
    abrindoNoApp: "此页面属于已安装的应用。正在打开网站…",
    irParaOSite: "前往网站",
    seuResumo: "您的概览",
    aulasFeitas: (n) => `本设备已完成 ${n} 课`,
    nenhumaAulaAinda: "本设备还没有完成的课程",
    verTudo: "查看全部",
    estantes: "书架",
    noMuro: "今日墙报",
    atalhos: "快捷方式",
    estudarLead: "学院的学科,以短课组成的路线。",
    aulas: (n) => `${n} 课`,
    jogosLead: "游戏、实验室和工具,在实践中学习。",
    laboratorios: "实验室",
    euLead: "您的学习、笔记本和偏好设置,都在本设备上。",
    apoiar: "支持学院",
    apoiarLead: "免费、无广告、无跟踪:有能力的人捐款,让一切维持运转。",
    trilhas: "路线",
    progressoDe: (f, n) => `${f}/${n} 课`,
    continuarEstudo: "继续学习",
    comecarTrilha: "开始路线",
    concluirESeguir: "完成并继续",
    concluirTrilha: "完成路线",
    desfazer: "撤销",
    aulaConcluida: "本课已完成",
    proximaAula: "下一课",
    trilhaConcluida: "路线已完成,做得好!",
    voltarParaTrilha: "返回路线",
    emPreparacao: "准备中",
    semAulasAinda: "该学科暂无可用课程。",
    aulaDe: (i, n) => `第 ${i}/${n} 课`,
    minutos: (n) => `${n} 分钟`,
    seuProgresso: "您的进度",
    continuarDeOndeParou: "从上次的地方继续",
    maisDoEstudo: "复习、主题、备份与数据",
  },
};

export const textosDoAppNovo = (lang: string): TextosDoAppNovo => TEXTOS_DO_APP_NOVO[lang] ?? PT;

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do desenho novo da entrada da Alumia (a parede de ladrilhos, o painel de quem chega, o caminho em 4 passos e os
// carimbos), nos seis idiomas do site. O português é o original; os outros são rascunho até a revisão da tradução.
// Sem "@/" de propósito (o teste roda no Node).

export interface TextosDaParede {
  /** O nome da parede para o leitor de tela. */
  rotulo: string;
  /** O trecho do título que sai em vermelho (tem de estar dentro de "titulo"). */
  tituloDestaque: string;
  /** A legenda com o painel ainda vazio: a frase e o fecho em destaque. */
  falta: [string, string];
  /** "{codinome}" é o codinome que a pessoa escreveu. */
  voce: string;
  voceFoto: string;
  soVoce: string;
  voceSelo: string;
  caminho: [string, string, string, string];
  caminhoRotulo: string;
  carimbos: { analise: string; aprovada: string; recusada: string; suspensa: string };
  continuar: string;
  voltarPasso: string;
  emailAjuda: string;
  pecaTitulo: string;
  rosto: {
    titulo: string;
    semCodinome: string;
    mosaico: string;
    mosaicoAjuda: string;
    foto: string;
    fotoAjuda: string;
    escolher: string;
    trocar: string;
    nota: string;
    erro: string;
  };
  escola: string;
  organizacoes: string;
  qrExemplo: string;
}

const pt: TextosDaParede = {
  rotulo: "Parede de ladrilhos com os retratos de Lenin, Marx, Engels, Rosa Luxemburgo, Gramsci, Paulo Freire, Marielle Franco, Stalin e Che Guevara. O último painel é o seu.",
  tituloDestaque: "quem luta",
  falta: ["Cada painel é de quem veio antes.", "Falta um: o seu."],
  voce: "O último painel é você: o mosaico de {codinome}.",
  voceFoto: "O último painel é você, com a sua foto.",
  soVoce: "Só este aparelho vê.",
  voceSelo: "Você",
  caminho: ["Conta", "Pedido", "Triagem", "Segundo fator"],
  caminhoRotulo: "Passos da entrada",
  carimbos: { analise: "Em análise", aprovada: "Aprovada", recusada: "Não aceito", suspensa: "Suspensa" },
  continuar: "Continuar",
  voltarPasso: "Voltar para a conta",
  emailAjuda: "Só para entrar e receber o aviso da triagem. Ninguém na rede vê.",
  pecaTitulo: "Peça a entrada",
  rosto: {
    titulo: "Seu rosto na rede",
    semCodinome: "Escreva o codinome e o mosaico aparece.",
    mosaico: "Mosaico do codinome",
    mosaicoAjuda: "O padrão, protegido: o desenho nasce do codinome e ninguém vê o seu rosto.",
    foto: "Minha foto",
    fotoAjuda: "Para quem escolhe aparecer em público. Dá para voltar ao mosaico quando quiser.",
    escolher: "Escolher a foto",
    trocar: "Trocar a foto",
    nota: "A foto fica só neste aparelho agora: ela não é enviada com o pedido. Depois de entrar, você confirma no perfil se quer que a rede veja.",
    erro: "Não deu para abrir essa imagem. Tente outra (JPG, PNG ou WebP).",
  },
  escola: "Tem conta da Escola Lúcia Maria? Ela vale aqui: entre com o mesmo e-mail e a mesma senha.",
  organizacoes: "Ver as organizações com selo",
  qrExemplo: "QR de exemplo. O de verdade é feito na hora, só para você.",
};

const en: TextosDaParede = {
  rotulo: "Tile wall with the portraits of Lenin, Marx, Engels, Rosa Luxemburg, Gramsci, Paulo Freire, Marielle Franco, Stalin and Che Guevara. The last panel is yours.",
  tituloDestaque: "those who fight",
  falta: ["Each panel belongs to someone who came before.", "One is missing: yours."],
  voce: "The last panel is you: the mosaic of {codinome}.",
  voceFoto: "The last panel is you, with your photo.",
  soVoce: "Only this device sees it.",
  voceSelo: "You",
  caminho: ["Account", "Request", "Screening", "Two-factor"],
  caminhoRotulo: "Steps to get in",
  carimbos: { analise: "Under review", aprovada: "Approved", recusada: "Not accepted", suspensa: "Suspended" },
  continuar: "Continue",
  voltarPasso: "Back to the account",
  emailAjuda: "Only to sign in and to get the screening notice. Nobody on the network sees it.",
  pecaTitulo: "Ask to join",
  rosto: {
    titulo: "Your face on the network",
    semCodinome: "Type the code name and the mosaic appears.",
    mosaico: "Code name mosaic",
    mosaicoAjuda: "The default, protected: the drawing comes from the code name and nobody sees your face.",
    foto: "My photo",
    fotoAjuda: "For those who choose to appear in public. You can go back to the mosaic whenever you want.",
    escolher: "Choose the photo",
    trocar: "Change the photo",
    nota: "For now the photo stays on this device only: it is not sent with the request. After you get in, you confirm on your profile whether the network should see it.",
    erro: "That image could not be opened. Try another one (JPG, PNG or WebP).",
  },
  escola: "Have an Escola Lúcia Maria account? It works here: sign in with the same e-mail and password.",
  organizacoes: "See the verified organizations",
  qrExemplo: "Sample QR. The real one is made on the spot, just for you.",
};

const es: TextosDaParede = {
  rotulo: "Pared de azulejos con los retratos de Lenin, Marx, Engels, Rosa Luxemburgo, Gramsci, Paulo Freire, Marielle Franco, Stalin y Che Guevara. El último panel es el tuyo.",
  tituloDestaque: "quien lucha",
  falta: ["Cada panel es de quien vino antes.", "Falta uno: el tuyo."],
  voce: "El último panel eres tú: el mosaico de {codinome}.",
  voceFoto: "El último panel eres tú, con tu foto.",
  soVoce: "Solo este aparato lo ve.",
  voceSelo: "Tú",
  caminho: ["Cuenta", "Solicitud", "Revisión", "Segundo factor"],
  caminhoRotulo: "Pasos de la entrada",
  carimbos: { analise: "En revisión", aprovada: "Aprobada", recusada: "No aceptada", suspensa: "Suspendida" },
  continuar: "Continuar",
  voltarPasso: "Volver a la cuenta",
  emailAjuda: "Solo para entrar y recibir el aviso de la revisión. Nadie en la red lo ve.",
  pecaTitulo: "Pide la entrada",
  rosto: {
    titulo: "Tu rostro en la red",
    semCodinome: "Escribe el nombre clave y aparece el mosaico.",
    mosaico: "Mosaico del nombre clave",
    mosaicoAjuda: "Lo normal, protegido: el dibujo nace del nombre clave y nadie ve tu rostro.",
    foto: "Mi foto",
    fotoAjuda: "Para quien elige aparecer en público. Puedes volver al mosaico cuando quieras.",
    escolher: "Elegir la foto",
    trocar: "Cambiar la foto",
    nota: "Por ahora la foto se queda solo en este aparato: no se envía con la solicitud. Después de entrar, confirmas en tu perfil si quieres que la red la vea.",
    erro: "No se pudo abrir esa imagen. Prueba con otra (JPG, PNG o WebP).",
  },
  escola: "¿Tienes cuenta de la Escola Lúcia Maria? Vale aquí: entra con el mismo correo y la misma contraseña.",
  organizacoes: "Ver las organizaciones con sello",
  qrExemplo: "QR de ejemplo. El de verdad se hace en el momento, solo para ti.",
};

const fr: TextosDaParede = {
  rotulo: "Mur de carreaux avec les portraits de Lénine, Marx, Engels, Rosa Luxemburg, Gramsci, Paulo Freire, Marielle Franco, Staline et Che Guevara. Le dernier panneau est le vôtre.",
  tituloDestaque: "celles et ceux qui luttent",
  falta: ["Chaque panneau appartient à quelqu'un qui est venu avant.", "Il en manque un : le vôtre."],
  voce: "Le dernier panneau, c'est vous : la mosaïque de {codinome}.",
  voceFoto: "Le dernier panneau, c'est vous, avec votre photo.",
  soVoce: "Seul cet appareil le voit.",
  voceSelo: "Vous",
  caminho: ["Compte", "Demande", "Vérification", "Double facteur"],
  caminhoRotulo: "Étapes de l'entrée",
  carimbos: { analise: "À l'étude", aprovada: "Approuvée", recusada: "Non acceptée", suspensa: "Suspendue" },
  continuar: "Continuer",
  voltarPasso: "Revenir au compte",
  emailAjuda: "Seulement pour se connecter et recevoir l'avis de la vérification. Personne sur le réseau ne le voit.",
  pecaTitulo: "Demandez l'entrée",
  rosto: {
    titulo: "Votre visage sur le réseau",
    semCodinome: "Écrivez le pseudonyme et la mosaïque apparaît.",
    mosaico: "Mosaïque du pseudonyme",
    mosaicoAjuda: "Le choix par défaut, protégé : le dessin naît du pseudonyme et personne ne voit votre visage.",
    foto: "Ma photo",
    fotoAjuda: "Pour qui choisit d'apparaître en public. Vous pouvez revenir à la mosaïque quand vous voulez.",
    escolher: "Choisir la photo",
    trocar: "Changer la photo",
    nota: "Pour l'instant la photo reste sur cet appareil : elle n'est pas envoyée avec la demande. Une fois entré·e, vous confirmez dans votre profil si le réseau peut la voir.",
    erro: "Impossible d'ouvrir cette image. Essayez-en une autre (JPG, PNG ou WebP).",
  },
  escola: "Vous avez un compte de l'Escola Lúcia Maria ? Il vaut ici : connectez-vous avec le même e-mail et le même mot de passe.",
  organizacoes: "Voir les organisations vérifiées",
  qrExemplo: "QR d'exemple. Le vrai est créé sur le moment, rien que pour vous.",
};

const ru: TextosDaParede = {
  rotulo: "Стена из плиток с портретами Ленина, Маркса, Энгельса, Розы Люксембург, Грамши, Паулу Фрейре, Мариэль Франко, Сталина и Че Гевары. Последняя панель — ваша.",
  tituloDestaque: "кто борется",
  falta: ["Каждая панель — тех, кто был до нас.", "Не хватает одной: вашей."],
  voce: "Последняя панель — это вы: мозаика {codinome}.",
  voceFoto: "Последняя панель — это вы, с вашей фотографией.",
  soVoce: "Это видит только это устройство.",
  voceSelo: "Вы",
  caminho: ["Аккаунт", "Заявка", "Проверка", "Второй фактор"],
  caminhoRotulo: "Шаги входа",
  carimbos: { analise: "На рассмотрении", aprovada: "Одобрено", recusada: "Не принято", suspensa: "Заблокировано" },
  continuar: "Продолжить",
  voltarPasso: "Назад к аккаунту",
  emailAjuda: "Только для входа и для уведомления о проверке. В сети его никто не видит.",
  pecaTitulo: "Подайте заявку",
  rosto: {
    titulo: "Ваше лицо в сети",
    semCodinome: "Напишите псевдоним, и появится мозаика.",
    mosaico: "Мозаика псевдонима",
    mosaicoAjuda: "По умолчанию, под защитой: рисунок рождается из псевдонима, и вашего лица никто не видит.",
    foto: "Моя фотография",
    fotoAjuda: "Для тех, кто решил быть на виду. К мозаике можно вернуться в любой момент.",
    escolher: "Выбрать фотографию",
    trocar: "Сменить фотографию",
    nota: "Пока фотография остаётся только на этом устройстве: с заявкой она не отправляется. После входа вы подтвердите в профиле, показывать ли её сети.",
    erro: "Не удалось открыть это изображение. Попробуйте другое (JPG, PNG или WebP).",
  },
  escola: "Есть аккаунт Escola Lúcia Maria? Он действует и здесь: войдите с той же почтой и тем же паролем.",
  organizacoes: "Посмотреть организации с печатью",
  qrExemplo: "Пример QR. Настоящий создаётся на месте, только для вас.",
};

const zh: TextosDaParede = {
  rotulo: "瓷砖墙上是列宁、马克思、恩格斯、罗莎·卢森堡、葛兰西、保罗·弗莱雷、玛丽艾尔·佛朗哥、斯大林和切·格瓦拉的肖像。最后一块是你的。",
  tituloDestaque: "斗争者",
  falta: ["每一块都属于先行者。", "还缺一块：你的。"],
  voce: "最后一块就是你：{codinome} 的马赛克。",
  voceFoto: "最后一块就是你，用的是你的照片。",
  soVoce: "只有这台设备能看到。",
  voceSelo: "你",
  caminho: ["账号", "申请", "审核", "双重验证"],
  caminhoRotulo: "进入的步骤",
  carimbos: { analise: "审核中", aprovada: "已通过", recusada: "未通过", suspensa: "已停用" },
  continuar: "继续",
  voltarPasso: "返回账号",
  emailAjuda: "只用于登录和接收审核通知。网络里没有人能看到。",
  pecaTitulo: "申请进入",
  rosto: {
    titulo: "你在网络里的面孔",
    semCodinome: "写下代号，马赛克就会出现。",
    mosaico: "代号马赛克",
    mosaicoAjuda: "默认方式，受保护：图案由代号生成，没有人看到你的脸。",
    foto: "我的照片",
    fotoAjuda: "给选择公开露面的人。随时可以换回马赛克。",
    escolher: "选择照片",
    trocar: "更换照片",
    nota: "照片现在只留在这台设备上：不会随申请发送。进入之后，你在个人资料里确认是否让网络看到。",
    erro: "无法打开这张图片。换一张试试（JPG、PNG 或 WebP）。",
  },
  escola: "有 Escola Lúcia Maria 的账号吗？在这里也能用：用同一个邮箱和密码登录。",
  organizacoes: "查看有印章的组织",
  qrExemplo: "示例二维码。真正的二维码当场生成，只给你。",
};

const TEXTOS: Record<string, TextosDaParede> = { pt, en, es, fr, ru, zh };

export function textosDaParede(lang: string): TextosDaParede {
  return TEXTOS[lang] ?? pt;
}

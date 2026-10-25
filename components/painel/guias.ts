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
  // ── Hoje ──
  mesa: {
    paraQue: "A Mesa mostra o que chegou para você hoje.",
    passos: [
      { titulo: "Veja o que espera por você", texto: "A lista mostra o que revisar, o que responder e o que fazer. O número diz quantos itens há em cada linha." },
      { titulo: "Filtre se quiser", texto: "Use os botões Tudo, Revisar, Responder e Fazer para ver só um tipo de trabalho." },
      { titulo: "Clique e vá direto", texto: "Clique numa linha e o painel abre a seção certa, já no trabalho." },
    ],
    dica: "Nada aqui é obrigatório. Faça o que der, no seu tempo.",
  },
  atividade: {
    paraQue: "Tudo o que a galera posta no site e no painel, na hora em que acontece.",
    passos: [
      { titulo: "Acompanhe a lista", texto: "Cada linha é uma publicação nova: comentário, tópico da Comunidade, envio, aula. As mais novas ficam no alto." },
      { titulo: "Filtre por tipo e por tempo", texto: "Escolha o tipo de atividade e o período (por exemplo, Últimos 7 dias). Carregar as mais antigas mostra o que veio antes." },
      { titulo: "Escolha como ser avisado", texto: "Em Como me avisar, peça um e-mail quando chegar algo novo, ou só um resumo." },
      { titulo: "Marque como visto", texto: "Marcar tudo como visto zera o contador do menu." },
    ],
  },
  conversas: {
    paraQue: "Os canais de cada departamento, grupos, mensagens diretas e as reuniões por vídeo, cifrados de ponta a ponta.",
    passos: [
      { titulo: "Escolha onde falar", texto: "À esquerda ficam os departamentos e grupos; ao lado, os canais. Clique num canal para abrir a conversa." },
      { titulo: "Escreva, mande arquivo ou áudio", texto: "Na barra de baixo, escreva e aperte Enter. Ao lado ficam Enviar arquivo, Gravar áudio, Criar enquete e Criar evento." },
      { titulo: "Responda, fixe e encaminhe", texto: "Passe o mouse numa mensagem para responder, reagir, fixar, encaminhar ou guardar nas Mensagens favoritas." },
      { titulo: "Entre nas reuniões", texto: "As reuniões por vídeo aparecem em Ao vivo agora e Próximas. Entrar abre a sala dentro do painel." },
    ],
    dica: "As mensagens são cifradas neste aparelho. Confira o Código de segurança com quem você fala para ter certeza de que é a pessoa.",
  },
  rede: {
    paraQue: "O mural interno da equipe: publicações e pedidos de ajuda para todos ou para uma função.",
    passos: [
      { titulo: "Escolha a comunidade", texto: "As comunidades separam os assuntos (departamentos, avisos, ajuda). A lista fica ao lado." },
      { titulo: "Publique", texto: "Criar publicação abre a caixa de texto. Escolha uma etiqueta, se quiser, e para quem vai." },
      { titulo: "Comente e responda", texto: "Comentar e Responder ficam embaixo de cada publicação." },
    ],
    dica: "O mural é cifrado: só a equipe lê. Mesmo assim, nada de senha ou dado pessoal de estudante aqui.",
  },
  // ── Produção ──
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
  videoaulas: {
    paraQue: "Gravar ou enviar aulas curtas em vídeo, de até 10 minutos, e revisar as da sua disciplina.",
    passos: [
      { titulo: "Grave ou envie", texto: "Em Gravar uma aula, escolha câmera ou tela e aperte Começar a gravar. Se o vídeo já está pronto, use Enviar um vídeo pronto." },
      { titulo: "Preencha os detalhes", texto: "Título, disciplina, trilha, descrição e fontes. Em Acessibilidade, gere ou escreva a transcrição e as legendas." },
      { titulo: "Espere a revisão", texto: "A curadoria confere som, imagem, conteúdo e fontes. Aprovada, a aula entra no site e vai sozinha para o YouTube do instituto." },
      { titulo: "Acompanhe em Minhas", texto: "Lá aparece se a aula está no ar, a nota da curadoria e o link do YouTube para pôr num bloco de vídeo de uma aula." },
    ],
    dica: "Grave num lugar silencioso e com luz de frente. Ninguém aparece no vídeo sem autorização.",
  },
  aovivo: {
    paraQue: "Marcar aulas na agenda pública, chamar colegas para dar junto e abrir a sala.",
    passos: [
      { titulo: "Marque a aula", texto: "+ Marcar uma aula abre a gaveta: título, disciplina, dia, hora, duração e, se quiser, colegas para dar junto." },
      { titulo: "Escolha a sala", texto: "Sala do site para turma pequena; Sala no Jitsi para turma grande. Para muita gente, use Transmitir pelo YouTube do instituto." },
      { titulo: "Na hora, comece", texto: "Abra a sala e aperte Começar agora: quem marcou presença recebe um recado." },
      { titulo: "No fim, encerre", texto: "Encerrar a aula fecha o bate-papo. Se transmitiu pelo YouTube, a gravação entra sozinha; se gravou em outro lugar, ponha o link." },
    ],
    dica: "A chave de transmissão do YouTube vale só para a sua aula. Não mande para ninguém.",
  },
  estudio: {
    paraQue: "Criar posts, stories, cartazes e capas com a identidade do instituto.",
    passos: [
      { titulo: "Escolha um modelo", texto: "Os modelos estão separados por formato e grupo (posts, stories, datas, campanhas). Clique num para abrir." },
      { titulo: "Troque textos e imagens", texto: "Clique no que quer mudar. As cores e as letras da marca já estão prontas." },
      { titulo: "Baixe ou envie", texto: "Baixe a peça em imagem ou mande para a Divulgação pôr no calendário." },
      { titulo: "Precisa de mais?", texto: "Editor avançado: PhotoCraft abre o editor completo, com camadas. Ajuda rápida explica os atalhos." },
    ],
    dica: "A marca nunca muda: não estique, não troque a cor nem as letras do logo.",
  },
  escritorio: {
    paraQue: "Documentos, planilhas e apresentações dentro do painel.",
    passos: [
      { titulo: "Escolha o programa", texto: "Documento (WordCraft), planilha (GridCraft) ou apresentação (DeckCraft)." },
      { titulo: "Crie ou abra", texto: "Comece do zero ou abra um arquivo do seu aparelho." },
      { titulo: "Guarde", texto: "Baixe o arquivo para o seu aparelho, ou anexe numa conversa da equipe." },
    ],
  },
  caderno: {
    paraQue: "A sala de estudo para preparar aulas e episódios: fontes, resumo, cartões, questionário e mapa.",
    passos: [
      { titulo: "Junte as fontes", texto: "Ponha os textos, links e PDFs que você vai estudar." },
      { titulo: "Gere o material de estudo", texto: "Resumo, cartões de memória, questionário e mapa de ideias, a partir das fontes." },
      { titulo: "Ouça ou revise", texto: "A leitura em voz alta ajuda a revisar no ônibus. Use os cartões até acertar todos." },
    ],
    dica: "Confira tudo nas fontes antes de levar para uma aula: o material gerado é ponto de partida.",
  },
  tarefas: {
    paraQue: "Microtarefas de 5, 15 ou 30 minutos, a revisão rápida, mutirões e projetos.",
    passos: [
      { titulo: "Escolha pelo tempo que você tem", texto: "As sugestões aparecem pelo seu tempo. Ver as de 30 minutos mostra as maiores." },
      { titulo: "Pegue uma", texto: "Vou fazer esta reserva a tarefa para você. Como fazer explica o passo a passo." },
      { titulo: "Entregue", texto: "Escreva Sua entrega e aperte Entregar. Se travar, Pedir ajuda a um mentor." },
      { titulo: "Ou devolva", texto: "Não deu? Liberar devolve a tarefa para outra pessoa pegar, sem problema." },
    ],
    dica: "Nada para mim hoje também é resposta: volte quando der.",
  },
  "acervo-dentro": {
    paraQue: "Cada obra do acervo com o selo da ficha (completa, parcial ou faltando), para escolher o que cuidar.",
    passos: [
      { titulo: "Veja os selos", texto: "Completa, parcial ou faltando: o selo mostra o que falta na ficha de cada obra." },
      { titulo: "Escolha o que cuidar", texto: "Comece pelas que estão faltando. Cada uma abre com o que precisa ser preenchido." },
      { titulo: "Mande para a curadoria", texto: "Só a curadoria mexe no acervo: as suas sugestões vão para ela decidir." },
    ],
  },
  exercicios: {
    paraQue: "Exercícios ligados às aulas e as entregas dos estudantes para comentar.",
    passos: [
      { titulo: "Crie um exercício", texto: "+ Novo exercício: escolha a aula, o programa ou outro material, e acrescente os passos." },
      { titulo: "Acompanhe as entregas", texto: "Comentar as entregas abre o que os estudantes mandaram." },
      { titulo: "Comente com cuidado", texto: "Enviar o comentário manda a sua devolutiva. Elogie o que deu certo antes de corrigir." },
    ],
  },
  minhas: {
    paraQue: "O que você enviou e em que pé está.",
    passos: [
      { titulo: "Veja a situação", texto: "Cada envio mostra se está esperando, em revisão, aprovado ou devolvido." },
      { titulo: "Leia o parecer", texto: "Se a revisão pediu mudanças, o parecer aparece no envio." },
      { titulo: "Corrija e reenvie", texto: "Abra a versão, ajuste, Guardar alterações e libere de novo para a fila de revisão." },
    ],
  },
  juntas: {
    paraQue: "Contribuições de colegas que chamaram você para trabalhar junto.",
    passos: [
      { titulo: "Abra o convite", texto: "Cada contribuição mostra quem chamou e o que falta." },
      { titulo: "Edite junto", texto: "Abra a versão, faça a sua parte e Guardar alterações." },
      { titulo: "Saia se precisar", texto: "Sair desta colaboração tira você sem apagar o trabalho de ninguém." },
    ],
  },
  fila: {
    paraQue: "Ler, dar parecer e decidir o que vai ao ar.",
    passos: [
      { titulo: "Abra um envio", texto: "A fila mostra o que espera revisão, com a disciplina e quem enviou." },
      { titulo: "Leia com o checklist", texto: "Confira conteúdo, fontes, linguagem simples e acessibilidade." },
      { titulo: "Decida", texto: "Aprovar põe no ar. Não aprovar devolve com o seu parecer, que precisa dizer o que mudar." },
    ],
    dica: "Ninguém aprova o próprio envio. Parecer bom é curto, gentil e diz o que fazer.",
  },
  traducoes: {
    paraQue: "As aulas que ainda não têm tradução e as traduções a caminho.",
    passos: [
      { titulo: "Veja o que falta", texto: "Quanto já está traduzido mostra o andamento por idioma." },
      { titulo: "Pegue uma aula", texto: "Vou traduzir esta reserva a aula para você. Traduzir abre o texto ao lado do original." },
      { titulo: "Chame ajuda", texto: "+ Chamar outro tradutor para ajudar divide o trabalho." },
      { titulo: "Envie", texto: "Guardar mantém o rascunho; Enviar para a revisão manda para quem confere." },
    ],
  },
  triagem: {
    paraQue: "A primeira leitura do que o público envia.",
    passos: [
      { titulo: "Leia o envio", texto: "Veja se é sério, se está no assunto e se não tem dado pessoal exposto." },
      { titulo: "Libere ou barre", texto: "Liberar para a fila de revisão manda para quem entende do assunto. Barrar recusa spam e ofensa." },
    ],
    dica: "Na dúvida, libere: a revisão decide. Barre só o que é claramente lixo.",
  },
  curriculo: {
    paraQue: "As suas disciplinas e trilhas: sugerir mudanças e convidar colegas de outras disciplinas.",
    passos: [
      { titulo: "Veja as trilhas", texto: "Cada disciplina mostra as trilhas por etapa e as aulas previstas." },
      { titulo: "Sugira mudanças", texto: "Proponha uma trilha nova, uma aula a mais ou outra ordem. A coordenação decide." },
      { titulo: "Convide ajuda", texto: "Chame colegas de outras disciplinas para escrever junto quando o tema cruza áreas." },
    ],
  },
  fontes: {
    paraQue: "Obras, verbetes e datas em acervos e enciclopédias livres, para escrever com fonte à vista.",
    passos: [
      { titulo: "Pesquise", texto: "Escreva o tema e escolha onde procurar." },
      { titulo: "Confira a origem", texto: "Abra o resultado e veja quem escreveu e quando." },
      { titulo: "Use na aula", texto: "Copie o título, o autor e o endereço para o campo Fontes do que você está escrevendo." },
    ],
  },
  materiais: {
    paraQue: "Zines, cartazes, imagens e PDFs da equipe.",
    passos: [
      { titulo: "Cadastre um material", texto: "＋ Novo material: envie o arquivo daqui ou cole um endereço https." },
      { titulo: "Crédito e licença", texto: "São obrigatórios: quem fez e com que licença pode ser usado." },
      { titulo: "Aprove ou recuse", texto: "Quem cuida dos materiais confere e aprova antes de ir para o site." },
    ],
  },
  divulgacao: {
    paraQue: "O calendário de posts e stories, o kit da marca e o acesso ao Instagram.",
    passos: [
      { titulo: "Veja o calendário", texto: "Hoje mostra o que sai agora. O que a equipe sugere traz as ideias de post para encaixar." },
      { titulo: "Crie uma peça", texto: "＋ Novo item põe uma peça no calendário. Criar arte no Estúdio de design abre o modelo." },
      { titulo: "Siga a marca", texto: "Em Arquivos da marca ficam as cores, as letras, as regras de uso e o que não fazer." },
    ],
    dica: "Nada vai para o Instagram sem a conferência de outra pessoa da equipe.",
  },
  // ── Atendimento ──
  comunidade: {
    paraQue: "Cuidar da Comunidade: fila de revisão, denúncias, banimentos, anotações e o filtro de palavras.",
    passos: [
      { titulo: "Comece pela fila", texto: "Fila de revisão mostra o que ficou retido pelo filtro. Aprovar, Editar ou Recusar." },
      { titulo: "Veja as denúncias", texto: "Em Denúncias, leia o contexto e Marcar como resolvida depois de agir." },
      { titulo: "Bana só quando preciso", texto: "Banir quem escreveu pede confirmação e fica registrado. Desfazer o banimento existe." },
      { titulo: "Ajuste o filtro", texto: "Filtro de palavras: acrescente o que precisa ser retido para revisão." },
    ],
    dica: "Explique a regra antes de punir. Quem erra pela primeira vez merece uma conversa.",
  },
  reforco: {
    paraQue: "Dúvidas de estudantes esperando resposta.",
    passos: [
      { titulo: "Assuma um pedido", texto: "Assumir este pedido mostra que você vai responder." },
      { titulo: "Responda", texto: "Responda pelo canal combinado, com calma e linguagem simples." },
      { titulo: "Conclua ou devolva", texto: "Já respondi: concluir fecha o pedido. Não posso responder: devolver à fila deixa para outra pessoa." },
    ],
    dica: "Nunca peça telefone ou endereço do estudante. A conversa fica nos canais do instituto.",
  },
  mural: {
    paraQue: "Anúncios do Mural dos Trabalhadores esperando decisão.",
    passos: [
      { titulo: "Leia o anúncio", texto: "Veja se é trabalho digno, se não tem golpe e se o contato é seguro." },
      { titulo: "Decida", texto: "Aprovar publica no Mural; Recusar explica o motivo para quem enviou." },
    ],
    dica: "Na dúvida sobre golpe, recuse e peça mais informação.",
  },
  gaveta: {
    paraQue: "Trabalhos de estudantes para a Gaveta Aberta: conferir, publicar ou recusar.",
    passos: [
      { titulo: "Abra o trabalho", texto: "Ver o PDF mostra o arquivo enviado." },
      { titulo: "Confira", texto: "Autoria, termo aceito, nada de dado pessoal sensível no arquivo." },
      { titulo: "Publique ou recuse", texto: "Publicar põe na Gaveta Aberta do site." },
    ],
  },
  boletim: {
    paraQue: "O boletim do jornal por e-mail e quem pediu para recebê-lo.",
    passos: [
      { titulo: "Monte a edição", texto: "Começar uma edição nova abre o rascunho. Guardar rascunho a qualquer hora." },
      { titulo: "Teste antes", texto: "Enviar teste para mim mostra como chega na caixa de entrada." },
      { titulo: "Reaproveite", texto: "Em Enviadas, Usar como base copia uma edição antiga para a nova." },
    ],
  },
  // ── Pessoas ──
  departamentos: {
    paraQue: "A página de cada departamento: meta do mês, quadro da semana, pedidos de outros departamentos, quem responde e como trabalha.",
    passos: [
      { titulo: "Escolha o departamento", texto: "Os botões do alto trocam de departamento. O seu aparece primeiro; o número vermelho é de pedidos abertos." },
      { titulo: "Peça o que precisa", texto: "Na página de outro departamento, Pedir algo: o que é, os detalhes e o prazo. Quem responde por ele é avisado." },
      { titulo: "Cuide dos pedidos", texto: "Em Pedidos: Aceitar, Pôr no quadro, Feito ou Recusar (com a resposta). Quem pediu recebe um recado." },
      { titulo: "Use o quadro da semana", texto: "No Quadro, ＋ cria um cartão; avançar → leva de A fazer até Feito. Cartão de pedido que chega ao Feito fecha o pedido sozinho." },
      { titulo: "Deixe o bastão", texto: "Em Como trabalhamos, deixe a passagem de bastão quando sair de uma função ou ficar fora um tempo." },
    ],
    dica: "Quem responde pelo departamento (o representante, a coordenação) escreve o como trabalhamos e a meta do mês.",
  },
  pessoas: {
    paraQue: "Convidar, confiar funções e acompanhar a equipe.",
    passos: [
      { titulo: "Veja as candidaturas", texto: "Candidaturas pelo formulário e Pedidos feitos pelo painel: Aceitar ou Recusar." },
      { titulo: "Confie uma função", texto: "Confiar uma função escolhe o cargo e a disciplina ou departamento da pessoa." },
      { titulo: "Ajude quem travou", texto: "Redefinir a senha gera uma senha forte para entregar à pessoa em mãos." },
      { titulo: "Consulte o histórico", texto: "Histórico de funções mostra quem deu e tirou cada função, e quando." },
    ],
    dica: "Dê a função mínima para o trabalho. Dá para confiar mais depois.",
  },
  supervisao: {
    paraQue: "Proteções reversíveis: pausar envios, modo de segurança e suspensão em emergência.",
    passos: [
      { titulo: "Pause os envios", texto: "Pausar os envios fecha o envio de contribuições do público por um tempo. Reabrir os envios volta ao normal." },
      { titulo: "Proteja a Comunidade", texto: "Modo de segurança da Comunidade segura tudo para revisão durante um ataque." },
      { titulo: "Suspenda em emergência", texto: "Suspender em emergência tira o acesso de uma conta na hora. Reativar a conta desfaz." },
    ],
    dica: "Tudo aqui é reversível e fica no Registro de atividades.",
  },
  reunioes: {
    paraQue: "A agenda de reuniões da equipe, dentro de Conversas e reuniões.",
    passos: [
      { titulo: "Veja a agenda", texto: "Ao vivo agora e Próximas mostram as reuniões marcadas." },
      { titulo: "Entre", texto: "Entrar abre a sala de vídeo dentro do painel. Pôr na agenda (.ics) guarda no seu calendário." },
    ],
  },
  horas: {
    paraQue: "O termo de adesão, as horas de trabalho e os certificados.",
    passos: [
      { titulo: "Aceite o termo", texto: "Li e aceito o termo libera a contagem das horas." },
      { titulo: "Veja as horas", texto: "O trabalho no painel conta sozinho. Como as horas são contadas explica quanto vale cada coisa." },
      { titulo: "Registre o que fez fora", texto: "Registrar horas feitas fora do painel: descreva o trabalho. Alguém da equipe confirma." },
      { titulo: "Peça o certificado", texto: "Pedir certificado manda o pedido; a coordenação prepara e assina." },
    ],
  },
  saude: {
    paraQue: "A vitrine de profissionais de saúde voluntários: o cartão de cada um, o termo e a conferência do registro.",
    passos: [
      { titulo: "Monte o cartão", texto: "Dados do cartão: nome, área, registro e como atende. Seu cartão na vitrine mostra a prévia." },
      { titulo: "Aceite o termo", texto: "Li e aceito o termo. Se pedirem, envie o termo assinado no gov.br." },
      { titulo: "Espere a conferência", texto: "Quem cuida da Saúde confere o registro e publica. Se ajustarem o seu cartão, você aprova o texto." },
      { titulo: "Saia quando quiser", texto: "Sair da vitrine tira o seu cartão do site na hora." },
    ],
    dica: "Área sensível: só a coordenação e o representante da Saúde publicam e conferem.",
  },
  termos: {
    paraQue: "Os termos aceitos por cada pessoa: o texto exato, a versão, a data e a impressão digital. Ninguém apaga.",
    passos: [
      { titulo: "Procure a pessoa", texto: "A lista separa por departamento, educação por área e outras funções." },
      { titulo: "Leia o que foi aceito", texto: "Ler o texto aceito mostra a versão exata que a pessoa assinou." },
      { titulo: "Baixe se precisar", texto: "Baixar a lista (CSV) para guardar ou prestar contas." },
    ],
  },
  estatisticas: {
    paraQue: "O que os estudantes procuram e o que a equipe produz, por disciplina.",
    passos: [
      { titulo: "Veja a equipe", texto: "Equipe por cargo mostra quantas pessoas há em cada função." },
      { titulo: "Veja o que chegou", texto: "O que chegou nos últimos 12 meses, mês a mês." },
      { titulo: "Leve para a reunião", texto: "Baixar planilha (CSV) para decidir o que entra e o que sai." },
    ],
    dica: "Os números não identificam ninguém: servem para decidir, não para vigiar.",
  },
  avisos: {
    paraQue: "Um quadro que aparece por cima do painel da equipe até cada pessoa fechar.",
    passos: [
      { titulo: "Escreva o aviso", texto: "Curto e claro: o que mudou e o que a pessoa precisa fazer." },
      { titulo: "Escolha para quem", texto: "Em Para quem, toda a equipe ou só algumas funções." },
      { titulo: "Envie e acompanhe", texto: "Enviar o aviso põe no ar. Tirar do ar quando não for mais preciso." },
    ],
  },
  // ── Site ──
  site: {
    paraQue: "A faixa do alto do site, a pausa geral de envios e os limites do assistente.",
    passos: [
      { titulo: "Troque a faixa", texto: "Escreva o recado e Guardar a faixa. Voltar ao texto de sempre desfaz." },
      { titulo: "Pause se precisar", texto: "Pausar os envios fecha as contribuições do público; Reabrir os envios volta." },
      { titulo: "Confira o assistente", texto: "Testar agora cada provedor mostra se a avaliação automática está respondendo." },
    ],
  },
  abertura: {
    paraQue: "O quadro que aparece quando o site abre.",
    passos: [
      { titulo: "Escreva o aviso", texto: "Título, texto curto e, se quiser, um botão com link." },
      { titulo: "Guarde", texto: "Guardar aviso põe no ar para quem abrir o site." },
    ],
    dica: "No dia da eleição a lei proíbe pedir voto em candidato ou partido. Chame para votar, sem nome.",
  },
  podcast: {
    paraQue: "Episódios da pauta à publicação: roteiro, gravação, versões, revisão, capas, cortes e agenda.",
    passos: [
      { titulo: "Crie o episódio", texto: "Criar abre a ficha: pauta, convidados, roteiro e fontes." },
      { titulo: "Grave e suba as versões", texto: "Cada versão fica guardada; a revisão escuta e comenta." },
      { titulo: "Publique", texto: "Publicar: passo a passo mostra o que precisa (capa, termo do convidado, descrição) antes de ir ao ar." },
    ],
  },
  emissoras: {
    paraQue: "Pôr a Rádio Lúcia no ar e indicar emissoras populares e comunitárias.",
    passos: [
      { titulo: "Prepare a transmissão", texto: "Passo a passo: transmitir a rádio pelo YouTube explica como ligar sem ir ao ar." },
      { titulo: "Ponha no ar", texto: "Pôr no ar para o público… pede confirmação. Tirar do ar a qualquer momento." },
      { titulo: "Indique emissoras", texto: "Sugerir uma emissora manda para o diretório público, depois da conferência." },
    ],
  },
  apoiadores: {
    paraQue: "A página Apoie, o mural de apoiadores e as contas do mês.",
    passos: [
      { titulo: "Ajuste a campanha", texto: "Faixas, metas e custos recorrentes (para onde vai o dinheiro)." },
      { titulo: "Publique", texto: "Guardar rascunho e, quando estiver certo, Publicar. Desfazer a última publicação existe." },
      { titulo: "Cuide do mural", texto: "Pedidos para aparecer: Aprovar ou Recusar." },
      { titulo: "Preste contas", texto: "Em Lançamentos, registre entradas e saídas do mês." },
    ],
  },
  erros: {
    paraQue: "O que o público relatou na página Achei um erro.",
    passos: [
      { titulo: "Leia o relato", texto: "Cada relato traz a página e o que a pessoa viu." },
      { titulo: "Corrija ou encaminhe", texto: "Erro de texto vai para quem cuida daquela disciplina; erro do site vai para o Desenvolvimento." },
    ],
  },
  tecnico: {
    paraQue: "Publicação, avaliação automática, faxina e sinais de varredura.",
    passos: [
      { titulo: "Veja a publicação", texto: "Mostra quando o site publicou pela última vez e se algo ficou atrasado." },
      { titulo: "Confira os sinais", texto: "Varreduras e tentativas estranhas aparecem resumidas, sem dado pessoal." },
    ],
  },
  // ── Segurança ──
  seguranca: {
    paraQue: "Segundo fator obrigatório, coordenação pedagógica e ordem de sucessão.",
    passos: [
      { titulo: "Exija o segundo fator", texto: "Segundo fator obrigatório faz as funções sensíveis entrarem com código do autenticador." },
      { titulo: "Monte a ordem de sucessão", texto: "Quem assume se a coordenação sumir: Acrescentar, Tirar e Guardar ordem." },
      { titulo: "Passe a coordenação", texto: "Passar a coordenação pede confirmação e fica registrado." },
    ],
    dica: "Mantenha pelo menos duas pessoas de confiança na ordem de sucessão.",
  },
  interdicao: {
    paraQue: "Tirar o site ou uma área do ar por um tempo, e apagar de uma vez uma chuva de spam.",
    passos: [
      { titulo: "Escolha onde", texto: "O site inteiro ou só algumas áreas, e por quanto tempo." },
      { titulo: "Veja antes de apagar", texto: "Ver quanto seria apagado mostra o tamanho do expurgo antes de agir." },
      { titulo: "Peça ou aplique", texto: "Pedir o expurgo manda para a aprovação; Aprovar e aplicar executa." },
    ],
    dica: "Expurgo não tem volta. Confira duas vezes.",
  },
  registro: {
    paraQue: "Tudo o que foi decidido, por quem e quando.",
    passos: [
      { titulo: "Procure", texto: "O registro está em ordem de tempo; Mais antigos → mostra o que veio antes." },
      { titulo: "Use para prestar contas", texto: "Cada decisão mostra quem fez e quando. Ninguém apaga." },
    ],
  },
  // ── Você ──
  contribuicoes: {
    paraQue: "O que você fez, as horas estimadas, os selos e o comprovante de voluntariado.",
    passos: [
      { titulo: "Veja o que fez", texto: "Envios, revisões, tarefas e aulas, com as horas estimadas." },
      { titulo: "Baixe o comprovante", texto: "O comprovante de voluntariado sai daqui, pronto para imprimir." },
    ],
  },
  conta: {
    paraQue: "O seu nome, a sua senha, a proteção da conta e o que aparece no seu cartão.",
    passos: [
      { titulo: "Proteja a conta", texto: "Proteção da conta: troque a senha e ligue o segundo fator. Guarde os códigos de recuperação." },
      { titulo: "Ajuste como você aparece", texto: "Como você aparece: nome, foto ou ícone, e o currículo do cartão de educador." },
      { titulo: "Preferências", texto: "Avisos por e-mail, privacidade nas conversas e a faixa de assinatura de e-mail." },
      { titulo: "Seus dados", texto: "Em Seus dados (LGPD), baixe ou peça para apagar o que é seu." },
    ],
  },
};

/** O glossário do painel: as palavras que aparecem nas seções, em linguagem simples (Ctrl K › Glossário do painel). */
export const GLOSSARIO: [string, string][] = [
  ["Banimento", "Tirar de uma conta o direito de escrever na Comunidade. Fica no registro e a coordenação é avisada; dá para desfazer."],
  ["Cifra de ponta a ponta", "As Conversas e o Mural da equipe são embaralhados no seu aparelho: nem o servidor lê."],
  ["Código de segurança", "Uma sequência que você confere com a outra pessoa para ter certeza de que fala com ela nas Conversas."],
  ["Códigos de recuperação", "Códigos de uso único para entrar se você perder o celular do segundo fator. Guarde em papel."],
  ["Coordenação pedagógica", "A vice-coordenação: cuida das aulas e assina certificados junto com a coordenação."],
  ["Curadoria", "Quem decide o que vai ao ar e cuida do acervo."],
  ["Departamento", "O grupo de quem faz o mesmo tipo de trabalho (Comunicação, Pedagógico, Mediação…), com página, quadro e pedidos."],
  ["Despertar", "O percurso de formação do zero à consciência de classe, em cinco etapas, com tarefas no mundo real."],
  ["Disciplina", "A matéria (Matemática, História, Defesa pessoal…). Cada disciplina tem trilhas por etapa."],
  ["Expurgo", "Apagar de uma vez uma chuva de spam. Não tem volta."],
  ["Fila de revisão", "O que espera alguém ler e decidir antes de ir ao ar."],
  ["Gaveta Aberta", "Trabalhos de estudantes (TCC, artigos, apostilas) publicados no site, com o termo deles."],
  ["Horas confirmadas", "As horas de voluntariado já conferidas; contam para o certificado comunitário."],
  ["Interdição", "Tirar o site, ou só uma área, do ar por um tempo (ataque, erro grave)."],
  ["Mediação", "Quem cuida da Comunidade, do Mural dos Trabalhadores e da Gaveta Aberta."],
  ["Meta do mês", "O número que o departamento combinou de alcançar no mês (posts, aulas, respostas)."],
  ["Modo foco", "Deixa no menu só as seções essenciais."],
  ["Modo leve", "Tira animações, sombras e texturas: bom para aparelho fraco e internet ruim."],
  ["Mural dos Trabalhadores", "Anúncios de trabalho e serviço conferidos pela mediação."],
  ["Núcleo", "Um grupo de estudo no bairro, na escola ou no trabalho, que faz as aulas junto."],
  ["Parecer", "O que a revisão escreve ao decidir: o que está bom e o que mudar."],
  ["Passagem de bastão", "O recado de quem sai de uma função para quem chega: o que estava fazendo e onde estão as coisas."],
  ["Pedido entre departamentos", "Um departamento pede algo a outro, com prazo. Quem responde aceita, faz ou recusa explicando."],
  ["Quadro da semana", "Os cartões do departamento: a fazer, fazendo, esperando aprovação e feito."],
  ["Rascunho", "O que você está escrevendo. Fica guardado sozinho, neste aparelho e na sua conta."],
  ["Representante", "A pessoa que responde por um departamento, nomeada pela coordenação."],
  ["Retido", "Mensagem segurada pelo filtro de palavras, esperando a mediação."],
  ["Segundo fator", "O código de seis números do aplicativo autenticador, pedido depois da senha."],
  ["Supervisão", "Quem cuida das proteções reversíveis: pausar envios, modo de segurança, suspender em emergência."],
  ["Termo de voluntário", "O combinado que todo mundo aceita ao entrar na equipe: é voluntário, sem pagamento, e o que se publica fica livre."],
  ["Triagem", "A primeira leitura do que o público envia: o que passa vai para a fila de revisão."],
  ["Trilha", "Uma sequência de aulas de uma disciplina, numa etapa (fundamental, médio, superior)."],
  ["Ver como", "Prévia do painel como outra função vê: o menu e os botões mudam; os dados continuam os seus."],
  ["Vitrine de saúde", "A página de profissionais de saúde voluntários. Área sensível, com termo e conferência do registro."],
];

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Recursos novos que entram desligados. Cada um aparece quando o nome está na variável de montagem
// NEXT_PUBLIC_RECURSOS, separada por vírgulas (ou "todos"), ou quando está em PADRAO (já testado e já ligado em
// produção: o ambiente novo, como a prévia, o espelho ou a cópia local, nasce igual à produção).
//
//   NEXT_PUBLIC_RECURSOS=meu-estudo,exercicios          (no .env.local para testar; na Vercel para publicar)
//   NEXT_PUBLIC_RECURSOS=escola,-vlibras                ("-nome" desliga um recurso padrão)
//   NEXT_PUBLIC_RECURSOS=nenhum                         (desliga todos os padrões)
//
// "todos" liga tudo, MENOS o que está em SO_PELO_NOME: a Escola Lúcia Maria e o Vale o Escrito só ligam com o nome escrito
// na lista, porque a produção usa "todos": a Escola não pode abrir antes de a coordenação mandar o texto (docs/ESCOLA.md)
// e o Vale o Escrito não abre antes de a curadoria revisar as entradas e a assessoria jurídica conferir
// (docs/vale-o-escrito/ESPEC.md); a Rede Lúcia v2 só liga pelo nome porque a migração SQL dela (supabase/migracoes/2026-11-rede-*.sql)
// ainda precisa rodar no Supabase de produção antes (docs/rede/V2.md). Desligado, a Rede e o Fórum de hoje ficam exatamente como estão.
//
// O valor é lido na montagem do site: mudou a variável, monte e publique de novo. Sem os atalhos "@/" de propósito:
// `npm run testar:meu-estudo` roda este arquivo direto no Node.

export const RECURSOS = {
  "meu-estudo": "Painel Meu estudo: aulas feitas, testes, desempenho por tema, o que revisar, cópia e apagar",
  exercicios: "Exercícios com explicação de cada erro, dificuldade, tema e status de revisão (disciplina piloto)",
  revisoes: "Etiqueta de revisão em cada aula (em revisão / revisada por função em data), histórico e créditos",
  turma: "Modo turma: sequência de aulas num link, sem cadastro, e comprovante de conclusão feito no aparelho",
  professores: "Páginas para professores: guia de uso em sala e planos de aula",
  "mapa-curricular": "Habilidades da BNCC e da matriz do Enem ligadas a cada aula",
  nivelamento: "Teste curto de nivelamento por disciplina, que só sugere por onde começar",
  metas: "Meta semanal opcional e lembrete por arquivo de agenda (.ics)",
  vlibras: "Botão para ativar o VLibras (serviço externo do governo), que só carrega depois do clique",
  ajudou: "Isso ajudou? no fim da aula; a resposta fica no aparelho e, com a Escola ligada, soma +1 anônimo para a equipe",
  "guia-contribuir": "Guia de contribuição: funções, passo a passo, modelo de aula e checklist de revisão",
  "pratica-sem-placar": "Esconde os pontos e a sequência de dias da prática das aulas de idioma",
  "enem-video": "Vídeos curtos do curso ENEM: tocador com narração pré-gravada, legendas e transcrição, nas aulas que têm vídeo",
  "enem-curso": "Curso ENEM: a página /enem, diagnóstico, plano, prática por habilidade, provas oficiais por ano e dia, oficina de redação e reta final",
  escola: "Escola Revolucionária Lúcia Maria: entrada, cursos, matrícula, campus e calendário (só para quem tem conta)",
  "vale-o-escrito": "Vale o Escrito: observatório de crimes de interesse público já em fonte pública (teia, mapa, dossiês, envio de fonte e correção)",
  "rede-v2": "Alumia (Rede v2): Rede e Fórum numa só (posts curtos, discussões, dúvidas, enquetes), comunidades com página própria, perfil com @nome, endereços de post, perfil e comunidade",
  turmas: "Turmas: as turmas por curso da Escola (/escola/turmas) e a Turma do mês (/turmas). Em pausa até haver gente para acompanhar",
  "fediverso-total": "Alumia mesclada ao Fediverso: todo perfil que consentiu federa, posts públicos saem, respostas, menções, curtidas e impulsos de fora entram no mesmo feed e nos mesmos avisos (docs/plano-2026-11/PLANO-FEDIVERSO.md)",
  "fediverso-grupos": "Comunidades abertas da Alumia como Group do Fediverso (Lemmy); só vale com fediverso-total ligado",
  "assistente-publico": "Assistente de IA aberto, sem conta (/api/assistente), usado pelo reforço e pelas ferramentas de estudo: IAs gratuitas em rodízio e limite por pessoa sem guardar o IP. O botão \"?\" das páginas não usa IA: são perguntas frequentes prontas",
  // Alumia, Onda 5 (docs/plano-2026-11/PLANO-ALUMIA.md): tudo só pelo nome e só junto com "rede-v2". Desligadas, a Alumia de hoje
  // não muda nada; as rotas novas (/alumia/atos, /alumia/organizacoes…) respondem 404.
  "alumia-2": "Alumia nova (Mosaico da Arquibancada): fundo noite, Archivo, faixa tecida, mosaico do ato e as telas novas de atos, calendário, listas, versão leve, transparência e segurança. Precisa de rede-v2",
  "alumia-proximas": "Alumia: telas que ainda estão em construção (transparência, listas, versão leve). Só ligam quando ficarem prontas",
  "alumia-stories": "Alumia: stories de 24 h, sem registro de quem viu, que nunca federam. Precisa de rede-v2 e alumia-2",
  "alumia-modo-ato": "Alumia: modo ato, Fui detido, Estou bem e as identidades. Precisa de rede-v2 e alumia-2 (a segurança da conta e os aparelhos conectados abrem com alumia-2)",
  "alumia-org": "Alumia: organizações com selo (não é apoio do Instituto), consultas à base, plenárias e prestação de contas. Precisa de rede-v2 e alumia-2",
  "alumia-chat-grupo": "Alumia: conversa cifrada de ponta a ponta do núcleo (grupo). Precisa de rede-v2 e alumia-2",
  "alumia-chat-so-app": "Alumia: o chat só nos apps (o site mostra o aviso e a página de baixar e conferir). Só pelo nome; desligado no beta",
  "alumia-linha-aberta": "Alumia: a linha com regra aberta (Em roda), igual para todo mundo e escrita na tela, com troca para a ordem de chegada; linhas montadas por filtro, assuntos em alta, enquanto você esteve fora, ordem das respostas e ocultar resposta. Precisa de rede-v2, alumia-2 e do SQL 20261113-alumia-o7-linha.sql",
  "alumia-convites": "Alumia: convites para a Alumia que levam à triagem (não aprovam ninguém; a triagem vê só \"veio por convite\", nunca de quem). Mostra o item Convidar e abre /alumia/convite. Precisa de rede-v2, alumia-2 e do SQL 20261114-alumia-o8-porta.sql",
  "alumia-fui-detido": "Alumia: o botão Fui detido do modo ato (recado fixo para os contatos escolhidos e, se a pessoa quiser, para a assessoria jurídica da organização; só oculta, nunca apaga). Liga só depois do parecer do advogado, pelo painel com a segunda confirmação (o banco também exige). Precisa de rede-v2, alumia-2, alumia-modo-ato e do SQL 20261115-alumia-o9-modoato.sql",
  "alumia-estudo": "Alumia: o estudo da onda 11 (banco de questões, turmas de estudo com o combinado da semana, agenda de provas e monitoria, redação entre pares com a rubrica do ENEM). Precisa de rede-v2, alumia-2 e do SQL da onda 11 (20261117-alumia-o11-*.sql)",
  "alumia-coautoria": "Alumia: assinar junto (só aparece quem aceitou), o \"Fonte?\" de quem lê, marcar na foto com aceite e a checagem do Vale o Escrito na nota de contexto. Precisa de rede-v2, alumia-2 e do SQL 20261118-alumia-o12-coautoria.sql",
  "alumia-video-post": "Alumia: vídeo curto no post (até 60 s), regravado no aparelho e sem os dados escondidos do arquivo. Liga só pelo nome e, no banco, pelo painel. Precisa de rede-v2, alumia-2 e do SQL 20261118-alumia-o12-midia.sql",
  // Onda 13: todos só pelo nome e desligados.
  "alumia-mapa": "Alumia: o mapa por cidade (/alumia/mapa) com chamados, núcleos e eventos, precisão de município, número só a partir de 3 e núcleo sem número; o desenho do Brasil é da própria Alumia, nada carrega de fora. Precisa de rede-v2, alumia-2 e do SQL 20261119-alumia-o13-mapa.sql",
  "alumia-ao-vivo": "Alumia: \"Pergunte a…\" com hora marcada (/alumia/mapa/ao-vivo e na caixa de perguntas), convite com aceite, fila por ordem de chegada. Precisa de rede-v2, alumia-2 e do SQL 20261119-alumia-o13-mapa.sql",
  "alumia-alcance": "Alumia: levar para fora (arte em PNG e QR feitos no aparelho, RSS e cartão para colar em outro site só do que é aberto à internet, levar e trazer quem eu sigo). Nada sai com a trava da entrada ligada. Precisa de rede-v2, alumia-2 e do SQL 20261119-alumia-o13-alcance.sql",
  "alumia-leve": "Alumia: leve e no seu tempo (/alumia/leve): economia de dados, escrever sem rede (a fila mora só no aparelho), Início só em texto, hora de parar e silêncio dos avisos. Precisa de rede-v2 e alumia-2 (sem SQL)",
  "alumia-traducao": "Alumia: traduzir post pelo servidor de tradução próprio (ALUMIA_TRADUCAO_URL), só quando a pessoa toca. Precisa de rede-v2, alumia-2 e do SQL 20261119-alumia-o13-pontes.sql",
  "alumia-telegram": "Alumia: publicar junto no canal do Telegram da organização com selo (ALUMIA_TELEGRAM_TOKEN e a rotina de /api/rede/telegram). Precisa de rede-v2, alumia-2, alumia-org e do SQL 20261119-alumia-o13-pontes.sql",
  // Desligado, toda a Alumia mostra só o aviso "em construção" (o ramo do aviso, PR #39). Fica em PADRAO desde a integração
  // (21/11/2026, decisão da coordenação): o painel desliga com ligado=false em interno.recursos_vivos. O aviso é components/rede/EmConstrucao.tsx.
  "alumia-aberta": "Alumia aberta ao público. Desligada, quem entra em qualquer endereço da Alumia vê só o aviso de que ela está em construção",
  // R1 (23/11/2026): só pelo nome e desligados; o painel único liga.
  "alumia-falar-moderacao": "Alumia: falar com a moderação, um canal direto entre a pessoa e a mediação de uma comunidade (não é denúncia). A mediação responde como \"Mediação\"; o codinome só aparece se a pessoa quiser. Não é cifrado. Precisa de rede-v2, alumia-2 e do SQL 20261123-r1-uso.sql",
  "alumia-identidades": "Alumia: várias identidades da mesma pessoa (/alumia/identidades), sem ligação visível com a primeira. Ainda não está pronta para uso: fica desligada até a troca de identidade sair. Precisa de rede-v2, alumia-2 e do SQL 20261123-r1-uso.sql",
  "alumia-entrada": "Alumia fechada: sem conta aprovada ninguém vê a rede. Tela própria de entrar e criar conta, triagem da coordenação e da mediação no painel e segundo fator obrigatório. Precisa do SQL 20261110-alumia-entrada.sql e, no banco, de interno.alumia_entrada_ligar(true)",
  // Prompt 5 (E1): o redesign "Caderno aberto". Só pelo nome e desligado: ligar é decisão da coordenação, quando aprovar. Desligado,
  // nada muda; ligado, o <html> ganha data-design="novo" (app/[lang]/layout.tsx) e os estilos por área (styles/design/) passam a valer.
  // O design de hoje continua inteiro como a opção "Contornos fortes" do botão de acessibilidade (data-fortes, lib/prefs.ts).
  "design-novo": "Redesign do site (Caderno aberto): cantos arredondados, fios finos e sombras leves no site do instituto e no painel, cada área com as suas variáveis. O design de hoje vira a opção Contornos fortes do botão de acessibilidade. Sem SQL além do catálogo (20261126-p5-design.sql)",
  // Prompt 4, itens 137 e 138: áudio e vídeo curto no chat, cifrados no aparelho (uma chave por arquivo), só o cifrado no depósito
  // e a chave dentro da mensagem cifrada. Só pelo nome e desligado: o banco também recusa o depósito com ele desligado.
  "alumia-p4-anexo-cifrado": "Alumia: áudio e vídeo curto no chat a dois e no grupo, cifrados no aparelho; o depósito guarda só o cifrado, sem saber de quem é. Precisa do SQL 20261127-p4-anexo-cifrado.sql",
  // Prompt 4, itens 3 e 5: só pelo nome e desligado (SQL 20261127-p4-selo-contagens.sql).
  "alumia-p4-selo-contagens": "Selo de verificado para pessoas (gratuito, só a coordenação dá e tira), nomes reservados de figuras públicas e contagens públicas de seguidores e apoios por escolha de cada pessoa (desligadas por padrão, nunca abaixo de 3)",
  // Prompt 4 (grupo presença e print): só pelo nome e desligado; o painel único liga.
  "alumia-p4-presenca-print": "Alumia: status online por escolha (só \"ativo recentemente\", só para a roda de confiança, um campo arredondado para a hora, sem histórico), a proteção contra print no navegador (story e foto de perfil que a autora protege; aviso de que no navegador é mais fraca; nunca avisa a autora) e o Sair rápido com três toques na marca. Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-presenca-print.sql",
  // Prompt 4, item 4 (25/11/2026): só pelo nome e desligado; o painel único liga. Os nomes das categorias esperam a revisão jurídica.
  "alumia-p4-avisos-de-local": "Alumia: avisos de local no estilo do Waze (/alumia/mapa/avisos), sem autor, numa grade de cerca de 200 m, com categorias fechadas e que somem em 2 horas. Só membros logados. Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-avisos-de-local.sql",
  // Prompt 4 (segurança pessoal, itens 10 a 12): só pelo nome e desligado. O banco também exige a linha ligada no painel.
  "alumia-p4-seguranca-pessoal": "Alumia: segurança pessoal (/alumia/seguranca-pessoal): chave de segurança, registro de abuso com carimbo de tempo e plantão jurídico (cifrados no aparelho só para a assessoria indicada pela organização) e o interruptor de sumiço. Liga só depois do parecer jurídico. Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-seguranca-pessoal.sql; o carimbo precisa de ALUMIA_CARIMBO_URL",
  // Prompt 4 (compositor, itens 26 a 29, 117 e 118): só pelo nome e desligado; o banco também exige a linha ligada no painel.
  "alumia-p4-compositor": "Alumia: álbum de até 20 imagens, artigo com capa, índice e leitura em páginas, versão curta, marca \"com fonte\" escolhida ao escrever, \"Mande a sua\" (o total só a partir de 3) e o filtro de imagens sem descrição (só no aparelho). Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-compositor.sql",
  // Prompt 4, grupo "cartão do post" (itens 30, 31, 35 e 120): só pelo nome e desligado; o painel único liga.
  "alumia-p4-cartao-do-post": "Alumia: reações próprias da comunidade (a mediação escolhe até 6 emojis), pasta dos salvos que vira coleção pública e exportar post aberto como imagem para Instagram e WhatsApp. Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-cartao-do-post.sql",
  // Prompt 4 (criação coletiva, itens 33, 34, 36 e 37): só pelo nome e desligado. O banco também exige a linha ligada no painel.
  "alumia-p4-criacao-coletiva": "Alumia: criação coletiva (/alumia/criacao): rascunho coletivo de nota ou manifesto sobre a wiki da comunidade (sugestões, comentários e versões), anotações à margem das páginas do acervo só para quem é da comunidade, o estúdio de cartaz e lambe-lambe com a identidade da organização e a zine A4 dobrável, os dois desenhados no aparelho. Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-criacao-coletiva.sql",
  // Prompt 4 (cultura, itens 38 a 42): só pelo nome e desligado. O banco também exige a linha ligada no painel.
  "alumia-p4-cultura": "Alumia: cultura (/alumia/cultura): obra seriada com aviso de capítulo novo para quem segue, mural de arte sob codinome, cineclube e clube de leitura da comunidade (sem ranking e com o progresso do grupo só somado, a partir de 3) e playlist coletiva só de links, com a prévia feita pelo servidor. Precisa do SQL 20261127-p4-cultura.sql.",
  // Prompt 4 (grupo memória e luta, itens 43, 44, 115, 116, 119 e 121): só pelo nome e desligado; o painel único liga.
  "alumia-p4-memoria-e-luta": "Alumia: memória e luta (/alumia/memoria-da-luta e /alumia/desafio): o quadro Neste dia na luta no topo da linha, o arquivo vivo da comunidade (consentimento por item, a mediação confere, quem aparece pede para sair), as campanhas com linha do tempo, o mural de vitórias, o podcast da comunidade com RSS e o desafio diário (pontuação só no aparelho, sem sequência nem ranking). Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-memoria-e-luta.sql",
  // Prompt 4 (organização e ação coletiva, itens 52 a 67 e 122): só pelo nome e desligado; o painel único liga.
  "alumia-p4-organizacao": "Alumia: organização e ação coletiva (/alumia/organizar): o quadro da organização com rodízio de funções, a enquete de horário, as reuniões recorrentes com .ics, o consenso por posições, o orçamento participativo, a meta coletiva e o inventário; o mural ofereço/preciso e de vagas, o banco de tempo e os pontos de apoio da comunidade; o termômetro do território; a rota do ato sem internet; o apoio direto por Pix aleatório; pedir checagem ao Instituto; e a ata assistida (transcrição só no aparelho). Nenhum número de pessoas abaixo de 3. Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-organizacao.sql",
  // Prompt 4 (lote ação coletiva, Parte F: itens 89 a 100 e 122 a 126): só pelo nome e desligado; o painel único liga.
  "alumia-p4-coletiva": "Alumia: ação coletiva (/alumia/acao-coletiva): pressão em parlamentar, radar de projetos de lei, modelos de documento, cartas de solidariedade, questionário da base, panfleto, acessibilidade, ciranda e previsão do tempo do ato, pouso solidário, ficha de filiação cifrada, Pix oficial com aviso de chave diferente, rodízio de tarefas, frentes entre organizações, sala de imprensa, vitrine da economia solidária e links da organização. Nenhuma lista de pessoas e nenhum número abaixo de 3. Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-coletiva.sql; os itens 92, 98 e 99 esperam a revisão jurídica",
  // Prompt 4 (grupo conversa, itens 13 a 21): só pelo nome e desligado; o painel único liga.
  "alumia-p4-conversa": "Alumia: no chat, foto de ver uma vez com a proteção contra print, freio de encaminhamento, notas para mim, envio agendado no aparelho, não perturbe guardado só no aparelho e transcrição da nota de voz no aparelho (onde o navegador garante). Tudo dentro do cifrado. A foto precisa também de alumia-p4-anexo-cifrado; o não perturbe precisa do SQL 20261127-p4-conversa.sql",
  // Prompt 4 (lote "perto", itens 2, 7, 8, 22, 23, 24 e 25): só pelo nome e desligado; o banco também exige a linha ligada no painel.
  "alumia-p4-perto": "Alumia: perto (/alumia/perto): localização compartilhada só cifrada de ponta a ponta, só com o círculo de confiança (os contatos de segurança que aceitaram), por tempo limitado e sem trajeto; pedido de ajuda (SOS) com confirmação; volta para casa com o cronômetro só no aparelho; o canal de aviso da organização (só os avisos, o número só a partir de 3 e só para quem gere); e, na sala de voz cifrada, o palco com a fila de mãos, o estudo em grupo com ritmo compartilhado e a sala de espera com senha. Precisa de rede-v2, alumia-2, alumia-modo-ato (o círculo são os contatos de segurança dele), do chat novo e do SQL 20261127-p4-perto.sql",
  // Prompt 4 (lote descoberta e estudo, Parte E e Parte G): só pelo nome e desligado; o painel único liga.
  "alumia-p4-descoberta-estudo": "Alumia: descoberta e estudo (/alumia/descobrir e /alumia/estudar): assuntos em movimento (só #temas de 3 comunidades ou mais), \"Você está em dia\" como escolha de cada pessoa (a rolagem contínua continua), #temas do Fediverso só de servidores aprovados, RSS e Atom por #tema, linhas compartilháveis; ritmo de estudo e baralhos de revisão só no aparelho, simulado da turma (resultado só em faixa, a partir de 3), mentoria entre pares, estante de fontes com citação ABNT, trilha de segurança digital, calendário de inscrições pela agenda de provas, mural de editais e bolsas, correção de referência da redação e o glossário ao toque. Nenhuma lista de pessoas e nenhum número abaixo de 3. Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-descoberta-estudo.sql",
  // Prompt 4 (lote "conta", Parte H: itens 74 a 80, 104, 105, 107 a 114 e 127 a 129): só pelo nome e desligado; o banco também exige a
  // linha ligada no painel.
  "alumia-p4-conta": "Alumia: conta e convivência (/alumia/conta): níveis de proteção prontos e checkup de privacidade, revisão das menções de quem a pessoa não segue, horário de atendimento e mensagem de ausência, respostas rápidas e diário cifrado só no aparelho, modo viagem, mudar de servidor no Fediverso levando as seguidoras; nas comunidades, escudo contra invasão, quiz das regras, guia de entrada, sala de cuidado (CVV 188 e serviços públicos) e mediação restaurativa; e o \"releia antes de enviar\" no aparelho. Nenhuma lista de pessoas e nenhum número abaixo de 3. Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-conta.sql",
  // Prompt 4 (lote "pontes", itens 81 a 88 e 130 a 134): só pelo nome e desligado; o banco também exige a linha ligada no painel.
  "alumia-p4-pontes": "Alumia: pontes e acessibilidade: o ato como evento no Fediverso (só o ponto público), a federação só com servidores aprovados (modo da mediação), os cartões de vídeo e áudio de fora pela rota-proxy, a ponte com o Bluesky (desligada: depende de decisão do Instituto), os avisos de ato no canal do Telegram da organização, a janela de Libras na aula ao vivo, as legendas ao vivo na sala de voz (só no aparelho), a busca nos salvos (só no aparelho), os avisos só de quem a pessoa segue, o \"pouco útil\" secreto nas respostas (só desce a partir de 3) e o leitor de fios. Precisa de rede-v2, alumia-2 e do SQL 20261127-p4-pontes.sql",
  "alumia-p4-chamadas": "Alumia: chamada de voz e de vídeo na conversa a dois (itens 139 e 140 do Prompt 4): o toque vai dentro da conversa cifrada, a voz e o vídeo vão direto entre os dois aparelhos, sempre pela retransmissão e cifrados de ponta a ponta, sem nenhum registro de chamada. A chamada de grupo fica de fora até a combinação ir assinada (docs/rede/VOZ.md). Precisa de rede-v2, alumia-2, do chat novo e do SQL 20261127-p4-chamadas.sql",
  "sala-livekit": "Salas de vídeo do painel (reuniões da equipe, chamada de canal, estudo em grupo e os links das turmas) pelo LiveKit Cloud em vez do Jitsi (item 141 do Prompt 4). Precisa das variáveis LIVEKIT_* no servidor e do texto de privacidade publicado ANTES de ligar: o serviço de fora recebe o endereço de rede, o nome na sala, o áudio e o vídeo. O estudo em grupo (sem conta) só abre com a chave do Turnstile no servidor (TURNSTILE_SECRET_KEY). Desligada, tudo segue pelo Jitsi",
} as const;

export type Recurso = keyof typeof RECURSOS;

/**
 * Ligados por padrão, sem precisar da variável. Só entra aqui o recurso que cumpre as DUAS condições: (1)
 * docs/RECURSOS.md e docs/RELATORIO-ESTUDO-NO-APARELHO.md o dão como testado; (2) a produção já o liga hoje (conferido
 * em 03/11/2026 no código publicado de https://institutolucia.org: NEXT_PUBLIC_RECURSOS="todos"). Assim a produção não
 * muda nada, e a prévia, o espelho e a cópia local nascem completos. "enem-curso" e "enem-video" ficam de fora porque
 * o relatório do estudo no aparelho não os cobre; "escola" fica de fora de propósito (quem liga é a coordenação).
 */
export const PADRAO: readonly Recurso[] = [
  "meu-estudo",
  "exercicios",
  "revisoes",
  "turma",
  "professores",
  "mapa-curricular",
  "nivelamento",
  "metas",
  "vlibras",
  "ajudou",
  "guia-contribuir",
  "pratica-sem-placar",
  // T03 (06/11/2026): a coordenação pediu o assistente ligado em todo o site. Desliga com "-assistente-publico" ou pelo painel.
  "assistente-publico",
  // Alumia nova (10/11/2026): a coordenação pediu a cara nova no ar, com stories e organizações. O SQL da onda já rodou (rede_alumia_versao = 2).
  "alumia-2",
  "alumia-stories",
  "alumia-org",
  // Lançamento (integração de 21/11/2026, seção 6 da passagem de 13/11): o Fediverso completo e a Alumia aberta saem ligados, depois do
  // SQL único (rede_alumia_versao = 12). O painel desliga cada um com uma linha ligado=false em interno.recursos_vivos, sem apagar nada.
  "fediverso-total",
  "alumia-aberta",
  // Beta fechado (17/11/2026, "Fediverso em tudo"): as comunidades abertas também saem como Group do Fediverso. No banco, o
  // catálogo o tem só pelo nome (20261122-alumia-beta-fim.sql), e o painel o desliga como os outros.
  "fediverso-grupos",
];

/** Recursos que "todos" não liga: só ligam com o nome na lista. */
export const SO_PELO_NOME: readonly Recurso[] = ["escola", "vale-o-escrito", "rede-v2", "fediverso-total", "fediverso-grupos", "alumia-2", "alumia-stories", "alumia-modo-ato", "alumia-org", "alumia-chat-grupo", "alumia-proximas", "alumia-entrada", "alumia-linha-aberta", "alumia-convites", "alumia-fui-detido", "alumia-estudo", "alumia-coautoria", "alumia-video-post", "alumia-mapa", "alumia-ao-vivo", "alumia-alcance", "alumia-leve", "alumia-traducao", "alumia-telegram", "alumia-aberta", "alumia-falar-moderacao", "alumia-identidades", "alumia-chat-so-app", "design-novo", "alumia-p4-anexo-cifrado", "alumia-p4-selo-contagens", "alumia-p4-presenca-print", "alumia-p4-avisos-de-local", "alumia-p4-seguranca-pessoal", "alumia-p4-compositor", "alumia-p4-cartao-do-post", "alumia-p4-criacao-coletiva", "alumia-p4-cultura", "alumia-p4-memoria-e-luta", "alumia-p4-organizacao", "alumia-p4-coletiva", "alumia-p4-conversa", "alumia-p4-perto", "alumia-p4-descoberta-estudo", "alumia-p4-conta", "alumia-p4-pontes", "alumia-p4-chamadas", "sala-livekit"];

/**
 * Recursos EM PAUSA: prontos e testados, mas desligados por decisão da coordenação (T08, 06/11/2026: "deixa desativado pelo
 * painel interno (podendo ligar de novo) as turmas por enquanto. Não temos gente o suficiente"). Como os de SO_PELO_NOME,
 * "todos" não os liga; ao contrário deles, ligar pelo painel vale na hora, sem segunda pessoa (no banco, so_pelo_nome = false),
 * porque não há texto, revisão jurídica nem migração esperando: é só a equipe voltar a ter gente para acompanhar.
 */
export const EM_PAUSA: readonly Recurso[] = ["turmas"];

/** Lê a lista da variável. Separado para os testes poderem conferir a leitura sem mexer no ambiente. */
export function lerRecursos(valor: string | undefined): Set<string> {
  return new Set(
    (valor ?? "")
      .split(",")
      .map((nome) => nome.trim().toLowerCase())
      .filter(Boolean),
  );
}

// A referência precisa ser literal (process.env.NEXT_PUBLIC_RECURSOS) para o Next gravar o valor no código do navegador.
const ligados = lerRecursos(process.env.NEXT_PUBLIC_RECURSOS);

/** O que a coordenação decidiu pelo painel (tabela de recursos no banco): ver lib/recursos-vivos.ts. */
export interface Vivos {
  ligados: ReadonlySet<string>;
  desligados: ReadonlySet<string>;
}
let vivos: Vivos = { ligados: new Set(), desligados: new Set() };

/** Guarda a decisão lida do banco (cache curto, feito por lib/recursos-vivos.ts). Sem ela, vale só a variável de montagem. */
export function definirVivos(novos: Vivos): void {
  vivos = novos;
}

/**
 * O recurso está ligado nesta montagem do site? "-nome" na lista sempre desliga; o nome na lista liga; "todos" liga o
 * que não está em SO_PELO_NOME nem em EM_PAUSA; e os de PADRAO ficam ligados, a não ser que a lista diga "nenhum".
 * Sem "lista" (o uso normal), entra também a decisão do painel: desligado no banco desliga sempre; ligado no banco liga,
 * inclusive os de SO_PELO_NOME (o banco só grava esses depois da confirmação de uma segunda pessoa).
 */
export function ligado(recurso: Recurso, lista?: Set<string>): boolean {
  const base = lista ?? ligados;
  if (base.has(`-${recurso}`)) return false;
  if (!lista && vivos.desligados.has(recurso)) return false;
  if (base.has(recurso)) return true;
  if (base.has("todos") && !SO_PELO_NOME.includes(recurso) && !EM_PAUSA.includes(recurso)) return true;
  if (PADRAO.includes(recurso) && !base.has("nenhum")) return true;
  return !lista && vivos.ligados.has(recurso);
}

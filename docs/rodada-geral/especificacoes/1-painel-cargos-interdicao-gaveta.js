export const meta = {
  name: 'painel-cargos-interdicao-gaveta',
  description: 'Cadeia de código: cargos e painel (C1) -> interdição/expurgo/pedidos (C2) -> Gaveta Aberta (C3), cada uma em worktree próprio',
  phases: [
    { title: 'C1 Cargos', detail: 'auditoria de cargos, supervisão, marketing, edição de usuários' },
    { title: 'C2 Interdição', detail: 'site fantasma, interdição por área, expurgo, pedidos de aprovação' },
    { title: 'C3 Gaveta', detail: 'trabalhos de estudantes com termo de cessão' },
  ],
}

const COMUM = `
Você trabalha no repositório do Instituto Lúcia (escola e biblioteca comunitária gratuita; Next.js 16 + React 19 + Tailwind 4 + Supabase/Postgres). Você está num git worktree isolado (seu diretório atual). Responda e escreva tudo do site em português do Brasil.

ANTES DE COMEÇAR
- Rode \`npm ci\` no seu worktree (node_modules não vem junto).
- Leia docs/MANUTENCAO.md inteiro (regras da casa) e o começo de supabase/install.sql (como a segurança funciona: tabelas no esquema "interno", só funções do esquema "public" como porta de entrada, cada função confere permissão dentro do banco).
- Regras da casa que você DEVE seguir: não mexer em fontes, cores nem no texto central da página inicial; páginas novas reaproveitam as peças existentes (Cartaz, PageHeading, classes do painel em components/painel/comum.tsx etc.); vocabulário: coordenador, vice-coordenador, curadoria, mediador, educador, revisor, tradutor, jornalista, voluntário — nunca "administrador", "moderador" nem "líder" em texto visível; privacidade: nada de rastreador, o mínimo de dados, e se mudar o que se guarda, atualize content/paginas/privacidade.md; todo arquivo novo começa com a linha de licença igual aos outros ("// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE)." ou "-- ..." em SQL); identificadores e comentários no estilo do código ao redor (o painel e o SQL usam nomes em português; comentários curtos explicando o porquê).
- install.sql precisa continuar podendo rodar de novo sem quebrar nada (idempotente: create table if not exists, alter ... add column if not exists, drop constraint if exists + add constraint, create or replace function). Toda função public nova precisa entrar na lista de concessões (grant/revoke) no fim do arquivo, do jeito que as outras entram.
- Textos da interface pública vão em i18n/ nos CINCO idiomas (pt, en, es, zh, ru) com tradução de verdade; \`npm run conferir:i18n\` precisa passar. O painel (components/painel) é só em português, sem i18n, como já é hoje.

PORTAS (se precisar subir o site de teste): use LUCIA_BACKEND_PORTA={{BACKEND}} e a porta do site {{SITE}}: \`LUCIA_BACKEND_PORTA={{BACKEND}} npm run dev:local -- {{SITE}}\`. As contas de teste estão no começo de scripts/backend-local.mjs (qualquer senha; segundo fator 123456). O Chromium está em /opt/pw-browsers (Playwright configurado; NÃO rode "playwright install"). Pode instalar o pacote playwright numa pasta temporária fora do repositório (por exemplo /tmp/claude-0/pw-{{ID}}) para dirigir o navegador, se quiser conferir telas. Desligue os servidores que subir quando terminar.

VERIFICAÇÃO OBRIGATÓRIA antes de cada commit final: \`npm run typecheck\`, \`npm run lint\`, \`npm run conferir:i18n\`, \`npm run testar:banco\` (se mexeu no SQL; acrescente conferências novas em scripts/testar-banco.mjs para TUDO o que você criou: quem pode, quem não pode, e o que acontece), \`/tmp/claude-0/tools/validar.sh\` (valida o conteúdo de content/ com as regras do build, em ~2 s) e, uma vez no fim, \`npm run build\` (~2–3 min). Tudo tem de passar. Não pule, não desligue nem afrouxe teste nenhum.

GIT
- Trabalhe no ramo {{RAMO}}. {{BASE}}
- Faça commits com mensagens no estilo do repositório ("Área: o que mudou", em português), terminando com estas duas linhas:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RC8WhefzeEqi4x664juFrr
- NÃO faça push, NÃO faça merge em outros ramos, NÃO mexa no ramo claude/kind-einstein-fsn6gj.
- Ao terminar, o worktree deve estar limpo (tudo commitado).

RELATÓRIO FINAL (é o valor de retorno, não uma mensagem para pessoas): nome do ramo, hash do último commit, lista do que foi feito (por item pedido), o que foi verificado e como, o que ficou de fora e por quê, decisões de desenho que o dono do projeto precisa conhecer, e qualquer passo manual necessário em produção (ex.: rodar install.sql de novo no SQL Editor).
`

const prep = (txt, o) => txt.replaceAll('{{RAMO}}', o.ramo).replaceAll('{{BASE}}', o.base).replaceAll('{{BACKEND}}', o.backend).replaceAll('{{SITE}}', o.site).replaceAll('{{ID}}', o.id)

const C1 = `
TAREFA C1 — Cargos do painel: auditoria completa, dois cargos novos, edição de usuários e a trava da auto-suspensão.

Contexto: os papéis hoje são coordenacao, vice, curadoria, mediacao, educacao, revisao, traducao, jornalismo, mentoria, design, desenvolvimento (tabela interno.papeis; funções interno.tem/lider/coord/curador/cuida/media/radialista/media_mural/mentor/envia; no navegador: lib/backend.ts (Role, can, leads), components/painel/Painel.tsx (lista "secoes" com quem vê cada seção, e a Mesa), components/painel/comum.tsx (papeis, oQueFaz), painel_resumo no SQL (contagens da Mesa)).

1) AUDITORIA DE CADA CARGO. Para cada papel, monte a matriz: o que ele deve fazer (oQueFaz e o que o dono descreveu), que seções do painel vê, que funções do banco consegue chamar, que contagens a Mesa mostra. Corrija:
   a) qualquer seção ou contagem que um cargo vê sem ser inerente ao cargo (o pedido do dono: "todos eles só conseguem ver no painel o que é inerente a cada cargo") — confira também que o banco recusa de verdade o que a interface esconde;
   b) cargos sem utilidade ou sem autonomia real (por exemplo: o tradutor tem como achar o que precisa de tradução e enviar a tradução? o desenvolvimento tem alguma ferramenta própria ou é só decorativo? revisão e educação têm a fila certa? mentoria vê só a própria disciplina?). Dê a cada cargo o mínimo que torne o trabalho dele possível dentro do painel, sem inflar o escopo.
   c) Mesa: cada pessoa vê só as pendências que pode resolver.
   Registre a matriz final em docs/MANUTENCAO.md (uma tabela cargo × o que vê e o que pode).

2) CARGO NOVO "supervisao" (Supervisão; no texto: supervisor/supervisora). Fica logo abaixo da coordenação e da vice-coordenação. É o "mediador do painel interno": faz as coisas andarem e impede o caos quando os dois estão ausentes, sem plenos poderes. Implemente:
   - quem nomeia: coordenação ou vice-coordenação (papel_conceder); só a coordenação retira supervisão de alguém que também seja vice, como já é a lógica para vice. Entra nas listas de papéis válidos (papeis, convites; NÃO entra no formulário público de voluntariado nem nas candidaturas — é cargo de confiança).
   - segundo fator: trate como coordenação/vice/curadoria em interno.tem (exige a sessão confirmada quando a exigência estiver ligada).
   - pode: ver a lista de voluntários (nome, funções, visto por último — SEM e-mails); suspender e reativar, com motivo obrigatório, contas que não tenham coordenação, vice nem supervisão (suspensão de emergência), avisando coordenação e vice; apagar mensagens do Mural da equipe (moderação interna); ler o Registro de atividades; ligar/desligar a pausa geral de envios e o modo de segurança da Comunidade (proteções reversíveis) — mas não a faixa do alto nem o cadastro aberto, a menos que você ache melhor e justifique; ver (só ler) os pedidos de voluntariado pendentes.
   - não pode: conceder/retirar papéis, convidar, segurança e sucessão, aviso de abertura, apoiadores, editar usuários, mexer na coordenação ou na vice. (Interdição e expurgo virão na tarefa seguinte, C2, como PEDIDOS que coordenação/vice aprovam — não faça isso agora, mas deixe o terreno pronto, por exemplo a função interno.supervisor() e a seção do painel organizada.)
   - Mesa e painel_resumo mostram ao supervisor o que ele pode resolver.

3) CARGO NOVO "marketing" (Marketing e divulgação). É a junção do design com a divulgação do instituto; a pessoa também cuida do Instagram (posts, stories etc.). Implemente:
   - tem todos os poderes do design (envia imagens/arquivos — interno.envia —, seção Materiais e arquivos);
   - entra no formulário público de voluntariado (components/VolunteerForm.tsx + i18n nos 5 idiomas), nas candidaturas, inscrições e convites. O papel "design" continua existindo para quem já tem (não quebre ninguém), mas pedidos e convites novos passam a oferecer "Marketing e divulgação" no lugar de "Design"; explique isso em oQueFaz/MANUTENCAO.md.
   - seção nova no painel, "Divulgação" (para marketing, coordenação e vice): (a) calendário editorial — tabela nova (rede: instagram ou outra; formato: post, carrossel, story, reels, vídeo, outro; título; legenda; data prevista; link ou arquivo aprovado do material; situação: ideia → rascunho → pronto → publicado; quem criou/mexeu por último), com listar/criar/editar/mudar situação/apagar; coordenação e vice podem comentar (campo nota) e devolver para rascunho; (b) "Kit da marca": links para os arquivos de marca já em public/ (marca.png, marca-512.png, emblema.png, cartao.png, icone-512.png etc.), as cores e as fontes do site (leia de app/globals.css ou de onde os tokens morarem — não invente cores); (c) "Acesso ao Instagram": um texto claro dizendo que o acesso é dado pela coordenação pelo próprio Instagram/Central de Contas da Meta (como colaborador), e que o site NUNCA guarda senha de rede social; mais um campo de configuração (coordenação edita) com o endereço público do perfil do instituto (por exemplo https://www.instagram.com/...), que aparece ali como link. Não guarde credenciais de jeito nenhum.
   - canal "marketing" na conversa/mural da equipe, se as listas de canais existirem para cada papel (equipe_mensagens.canal/para) — mantenha coerente com os outros papéis.

4) COORDENAÇÃO E VICE EDITAM OUTROS USUÁRIOS (menos o e-mail):
   - função para editar nome e apresentação (bio) de outra pessoa; função para redefinir a senha de outra pessoa (quando ela esqueceu). O e-mail ninguém muda por aqui (não crie função para isso).
   - a vice não edita nem redefine a senha de quem é coordenação; ninguém usa essas funções na própria conta (para si existe "Minha conta"); a pessoa recebe um aviso; tudo vai para o registro de atividades (sem a senha, claro).
   - senha: grave com o mesmo esquema do serviço de contas do Supabase (auth.users.encrypted_password com crypt(senha, gen_salt('bf')) do pgcrypto; no Supabase o pgcrypto mora no esquema "extensions" — trate isso de forma robusta e confira como o banco de teste local (scripts/banco-local.mjs) monta auth.users e se tem pgcrypto; se o PGlite não tiver, adapte o banco de teste para ter, sem enfraquecer a função real); exija senha forte (mesma regra mínima que a tela de "Minha conta"/entrada usa — confira); encerre as sessões abertas da pessoa se as tabelas existirem (auth.sessions / auth.refresh_tokens, protegido com to_regclass); marque o perfil para "trocar a senha no próximo acesso" — e no painel, como já existe a porta do segundo fator, mostre uma porta "Escolha uma senha nova" antes de abrir o painel para quem estiver marcado (supabase.auth.updateUser) e limpe a marca depois.
   - na interface (Pessoas → a ficha de cada pessoa): editar nome/bio; "Redefinir senha" que gera no navegador uma senha forte (crypto.getRandomValues), mostra uma única vez com botão de copiar e instrução de entregar por canal seguro; ou permite digitar uma.

5) SUSPENDER A PRÓPRIA CONTA: o dono pediu para tirar o botão de suspender a própria conta do painel (ele disse que existe e é perigoso). O banco já recusa (usuario_suspender compara p_usuario com quem chama) — confira e mantenha; esconda o botão para a própria pessoa em Pessoas e procure em TODO o painel (Minha conta, Segurança, etc.) qualquer botão de suspender/desativar/encerrar a própria conta e remova. Se existir algum "apagar minha conta" legítimo de privacidade (LGPD) em /meus-dados, NÃO remova esse sem antes avaliar: o pedido é sobre suspender pelo painel; relate o que encontrou.

6) Atualize: lib/backend.ts (tipo Role), comum.tsx (papeis, oQueFaz), rótulos do Registro de atividades (Lideranca.tsx) para as ações novas, scripts/backend-local.mjs (contas de teste novas: supervisor@local e marketing@local, com os papéis; atualize o comentário do topo), docs/MANUTENCAO.md, e conferências novas em scripts/testar-banco.mjs cobrindo cada permissão (supervisão pode/não pode, marketing pode/não pode, edição de usuário e senha, vice x coordenação, auto-suspensão recusada).

Confira de ponta a ponta subindo o site de teste e entrando com cada conta (pelo menos coordenação, vice, supervisor, marketing, mediador, tradutor, educador, leitora): cada uma vê só o que deve. Descreva no relatório a matriz final de cargos.
`

const C2 = `
TAREFA C2 — Interdição do site (o "site fantasma"), interdição de áreas, expurgo das áreas públicas e pedidos de aprovação da supervisão.

Comece lendo o relatório da tarefa anterior (C1), que criou o cargo de supervisão e reorganizou o painel:
---- RELATÓRIO C1 ----
{{C1}}
---- FIM ----

1) INTERDIÇÃO. O dono quer um botão no painel, só para coordenação, vice-coordenação e supervisão, que deixe o site sem funcionar por um tempo: tudo some ("fantasma"), MAS a entrada (/entrar) e o painel continuam funcionando, para a equipe poder religar. A mesma ferramenta interdita áreas específicas (exemplo dele: a Comunidade virou um caos e nem a avaliação automática nem a mediação dão conta; ou simplesmente manutenção).
   - Estado guardado em interno.configuracoes (chave própria): geral (bool), lista de áreas interditadas, motivo interno, mensagem pública opcional, desde, por quem. Defina num lugar só (um módulo TS, por exemplo lib/interdicao.ts) a lista de áreas públicas e os prefixos de caminho de cada uma (comunidade; mural dos trabalhadores; reforço; contribuir/denunciar; jornal e notícias; rádio; acervo e catálogo; trilhas/estantes/aulas; ferramentas; memorial/galeria/linha do tempo; debates/checagens/glossário; e o que mais houver em app/[lang]) e mantenha a lista do SQL igual (faça uma conferência automática que falhe se as duas listas divergirem). Deixe fácil acrescentar áreas novas (a próxima tarefa vai acrescentar "gaveta", a área de trabalhos de estudantes em /gaveta).
   - Bloqueio na frente do site (proxy.ts, que é o middleware do Next 16): lê o estado por uma função pública barata (acrescente ao que public.site() já devolve ou crie uma função pública própria), guarda o resultado em memória por uns 20–30 s e, se o serviço não responder, deixa o site funcionar normalmente (o banco é opcional e o site precisa abrir sem ele). Caminho interditado → reescreve (rewrite, não redirect) para uma página "fantasma" mínima, com status 503, Retry-After e Cache-Control: no-store; essa página não mostra o cabeçalho, o menu nem nada do site: só o nome do instituto, que está temporariamente fora do ar, a mensagem pública (se houver) e um link discreto "Entrar" para a equipe. Ficam sempre liberados: /entrar, /painel, a própria página fantasma, e os arquivos estáticos (o matcher do proxy já ignora _next e arquivos com extensão — confira /sw.js, manifest, ícones, .well-known/assetlinks.json do app Android). Lembre que hoje o proxy redireciona todo caminho sem idioma para /pt: a página fantasma não pode cair nesse redirecionamento nem herdar o layout de app/[lang] (estude a estrutura de layouts; uma rota com layout raiz própria é um caminho possível).
   - Service worker (public/sw.js): confira a estratégia; garanta que, com a interdição ligada e a pessoa online, o navegador mostre a página fantasma e não uma cópia guardada do site (sem quebrar o modo sem internet quando não há interdição). O app Android é o próprio site, então vale o mesmo.
   - Banco: com uma área interditada, as funções públicas daquela área recusam envio e leitura para o público com o código 'area_interditada' (a equipe com papel de cuidar da área ainda pode ler e apagar, para limpar a bagunça); com a interdição geral, tudo o que é público recusa. Componentes do site que chamam essas funções (Forum/Comunidade, Mural, Reforço, Contribuir, Anotações, Rádio…) mostram uma mensagem clara quando recebem esse código (i18n nos 5 idiomas, em errors).
   - Quem faz: coordenação e vice ligam e desligam direto (motivo obrigatório; vai para o registro e avisa a liderança). A supervisão NÃO aplica sozinha: ela faz um PEDIDO com justificativa (mínimo de umas 30 letras), que só entra em vigor quando coordenação ou vice aprovar no painel (um dos dois basta); o mesmo para pedir a liberação. Pedido parado vence sozinho depois de 72 h.

2) EXPURGO (botão de apagar tudo das áreas abertas ao público, para chuva de spam de robôs):
   - coordenação e vice fazem direto; a supervisão pede (mesma fila de pedidos, mesma aprovação).
   - escolhe as áreas: Comunidade (tópicos, respostas e votos), Mural dos Trabalhadores, anotações públicas das aulas, pedidos de reforço não concluídos, mural de apoiadores, envios do público que esperam a triagem (contribuições com triagem 'aguardando'), e deixe o desenho pronto para a área nova "gaveta" (a próxima tarefa liga). Escolhe o período: última hora, 6 h, 24 h, 7 dias ou tudo. Opção marcada por padrão: poupar o que foi escrito por gente da equipe. Opção: ligar a pausa geral de envios junto.
   - confirmação forte: a pessoa digita EXPURGAR; o painel mostra antes quantos itens de cada área serão apagados (função de prévia) e depois quantos foram.
   - tudo atômico, registrado no registro de atividades e no livro do acervo (audit_logs) quando couber, com aviso à liderança.

3) PEDIDOS: tabela nova para os pedidos da supervisão (tipo: interdição, liberação, expurgo; os dados do pedido; justificativa; autor; situação pendente/aprovado/recusado/vencido; quem decidiu e quando). Funções: criar (supervisão), listar (coordenação, vice, supervisão — a supervisão vê os próprios e os decididos), decidir (coordenação/vice; aprovar aplica a ação na mesma transação, com os dados que estavam no pedido). Aviso para coordenação e vice quando chega pedido; aviso para o supervisor quando é decidido. A Mesa da coordenação e da vice mostra os pedidos pendentes.

4) Painel: seção nova (grupo "Segurança" ou "Site", o que fizer mais sentido) "Interdição e expurgo", visível para coordenação, vice e supervisão, com o estado atual em destaque (quando o site está fantasma, um aviso forte no topo do painel para todo mundo da equipe), os controles, a fila de pedidos e o histórico recente. Mantenha a linguagem simples e sem alarmismo, no tom do resto do painel.

5) Testes em scripts/testar-banco.mjs para tudo (quem pode, quem não pode, pedido aprovado aplica, recusado não aplica, vencido não aplica, expurgo apaga só o período e só as áreas escolhidas, poupa a equipe quando pedido, função pública da área interditada recusa o público e deixa a equipe limpar). Para o proxy, crie uma conferência simples da lógica de caminhos (função pura em lib/interdicao.ts testada por um script em scripts/, ou dentro de um teste existente) — e confira de verdade subindo o site de teste: ligue a interdição geral pelo painel e veja com o navegador que as páginas viram fantasma (503) e que /entrar e /painel continuam funcionando; interdite só a Comunidade e veja que o resto do site abre.

6) Documente em docs/MANUTENCAO.md (seção nova "Interdição e expurgo": quando usar, como desfazer, o que acontece no app Android, o que fazer se o painel não abrir — por exemplo um comando SQL de emergência para desligar a interdição).
`

const C3 = `
TAREFA C3 — "Gaveta Aberta": o lugar onde estudantes publicam trabalhos antigos sem uso, para livre acesso de todos.

O dono descreveu assim: "você era aluno da disciplina tal na faculdade, fez um projeto maneiro, mas foi descartado porque foi só um TCC. Aí você pode publicar lá com um comentário seu sobre para quem achar interessante ter livre acesso. Ao postar o material, a pessoa tem que assinar tipo um termo dizendo que o material dela agora é para livre uso de todos." Ele não quis o nome "mural dos alunos". Use o nome "Gaveta Aberta" (trabalhos que saíram da gaveta), com a linha de apoio "trabalhos de estudantes, livres para todos" — e deixe o nome fácil de trocar (só nos textos de i18n e do painel).

Comece lendo os relatórios das tarefas anteriores (C1: cargos; C2: interdição, expurgo e pedidos), porque você vai se encaixar no que elas fizeram:
---- RELATÓRIO C1 ----
{{C1}}
---- RELATÓRIO C2 ----
{{C2}}
---- FIM ----

1) Banco: tabela nova com: autor (conta obrigatória — participante da comunidade já serve), título, tipo (TCC, monografia, dissertação, artigo, projeto, relatório, apostila/resumo, código, apresentação, outro), disciplina (slug de lib/areas.ts, validado como as outras tabelas fazem), curso (opcional), instituição (opcional), ano (opcional, com limites sensatos), comentário de quem publica (por que vale a pena; com mínimo e máximo de tamanho), link https OU arquivo PDF enviado, licença escolhida (CC BY 4.0 — padrão —, CC BY-SA 4.0 ou CC0 1.0), nome para o crédito público, o aceite do termo (nome completo de quem aceitou, versão do termo, data), situação (pendente → aprovado/recusado, com nota e quem decidiu). Limite de envios por pessoa (use o mecanismo de limites que já existe), pausa geral de envios vale aqui também (gatilho como nas outras tabelas), banimentos valem, filtro de termos vetados vale no texto.
   - Funções: enviar; minhas publicações; retirar a minha (a pessoa pode tirar a ficha do ar; explique no termo que a licença já concedida continua valendo para quem já copiou); listar públicas (só aprovadas, com filtros: disciplina, tipo, busca por texto) — e a fila de decisão para a equipe (mediação, curadoria, coordenação e vice; supervisão não, é cargo interno), com aprovar/recusar com nota. painel_resumo/Mesa ganham a contagem.
   - Encaixe na interdição (área "gaveta", caminhos /gaveta…) e no expurgo (área "gaveta", respeitando período e "poupar a equipe") que a tarefa C2 criou, mantendo as conferências de sincronia que ela deixou.
2) Arquivo PDF: hoje o depósito "envios" só aceita envio da equipe (interno.envia()). Crie um depósito próprio e fechado para a Gaveta (só PDF, até 10 MB, cada pessoa só na própria pasta), com leitura liberada apenas para os arquivos de fichas APROVADAS (regra de storage.objects consultando a tabela) e para a equipe que decide; o download no site usa o cliente (supabase.storage.from(...).download) e oferece o arquivo com um nome legível. Avise na tela de envio que PDFs podem carregar o nome do autor e outros dados nos metadados e que a mediação confere o arquivo antes de publicar. Link externo é aceito para quem preferir (repositório da universidade, Zenodo, OSF, GitHub, Google Drive etc.). Confira o Content-Security-Policy em next.config.ts: o download precisa funcionar sem abrir brechas novas.
3) Termo de cessão: escreva o termo (versão "1"), sóbrio e claro, em português, mostrado inteiro antes do envio e também numa página própria (/gaveta/termo): a pessoa declara que é autora do material (ou tem a autorização dos coautores), que o material não viola direitos de terceiros nem expõe dados pessoais de outras pessoas sem consentimento, e que, ao publicar, licencia o material sob a licença escolhida (livre uso de todos, inclusive cópia e redistribuição, com crédito no caso de CC BY/BY-SA), de forma irrevogável para as cópias já feitas; o instituto pode guardar, exibir e distribuir; a pessoa pode pedir que a ficha saia do ar. Aceite com caixa de marcação + nome completo digitado. Guarde a versão aceita. Atualize content/paginas/termos.md e content/paginas/privacidade.md (o que se guarda: nome completo do termo — visível só para a equipe que decide e para a coordenação —, o arquivo, os dados da ficha).
4) Site público: página /gaveta (com o desenho das outras páginas de cartaz: reaproveite Cartaz/PageHeading e as peças de lista que já existem), filtros, cartões com título, tipo, disciplina, curso/instituição/ano, crédito, selo da licença, comentário de quem publicou, botão abrir/baixar e um link "denunciar" que leva à página de denúncia existente com o alvo preenchido. Formulário de envio (pede login; quem não tem conta vê como entrar/criar conta). Área "Minhas publicações" para a pessoa logada. Entrada na página /explorar e no que mais listar seções do site (busca, mapa do site, sitemap se houver). i18n nos 5 idiomas.
5) Painel: seção "Gaveta Aberta" (grupo Atendimento) com a fila e o histórico, prévia do arquivo para quem decide.
6) Testes no testar-banco para tudo (inclusive: anônimo não envia, sem termo não envia, só aprovado aparece no público, autor retira, equipe decide, interdição e expurgo da área "gaveta" funcionam) e conferência de ponta a ponta no site de teste (enviar com a conta leitora@local, aprovar com mediador@local, ver no público).
`

phase('C1 Cargos')
const r1 = await agent(prep(COMUM, { ramo: 'wf/c1-cargos', base: 'Crie o ramo a partir do HEAD atual do seu worktree: git checkout -b wf/c1-cargos.', backend: '54401', site: '3401', id: 'c1' }) + C1, { label: 'C1 cargos e painel', phase: 'C1 Cargos', isolation: 'worktree' })
log('C1 terminou')

phase('C2 Interdição')
const r2 = await agent(prep(COMUM, { ramo: 'wf/c2-interdicao', base: 'Este trabalho continua o ramo wf/c1-cargos: crie o seu ramo a partir dele (git checkout -b wf/c2-interdicao wf/c1-cargos). Se o ramo wf/c1-cargos não existir, pare e relate.', backend: '54402', site: '3402', id: 'c2' }) + C2.replace('{{C1}}', String(r1 ?? '(sem relatório)')), { label: 'C2 interdição e expurgo', phase: 'C2 Interdição', isolation: 'worktree' })
log('C2 terminou')

phase('C3 Gaveta')
const r3 = await agent(prep(COMUM, { ramo: 'wf/c3-gaveta', base: 'Este trabalho continua o ramo wf/c2-interdicao: crie o seu ramo a partir dele (git checkout -b wf/c3-gaveta wf/c2-interdicao). Se o ramo wf/c2-interdicao não existir, pare e relate.', backend: '54403', site: '3403', id: 'c3' }) + C3.replace('{{C1}}', String(r1 ?? '(sem relatório)')).replace('{{C2}}', String(r2 ?? '(sem relatório)')), { label: 'C3 Gaveta Aberta', phase: 'C3 Gaveta', isolation: 'worktree' })

return { c1: r1, c2: r2, c3: r3 }

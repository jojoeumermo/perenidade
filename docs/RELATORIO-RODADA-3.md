# Rodada 3 — relatório final

Tudo está no `master` e publicado pela Vercel. Cada lote passou por `lint`, `typecheck`, `conferir:i18n` (agora com seis idiomas), `testar:banco` (1380 conferências), as outras suítes da CI e o build. **Nada foi rodado no banco de produção.**

## Preciso de você (em ordem)

1. **Banco de produção.** Faça um backup (Database → Backups) e rode o `supabase/install.sql` inteiro no SQL Editor. Ele é idempotente e só acrescenta. Traz desta rodada: Apoie e prestação de contas, situação das contribuições, comentários das aulas em vídeo e moderação do bate-papo ao vivo, exercícios de prática, tarefas ("Para você hoje"), a **tranca final** (segurança por linha em todas as tabelas internas) e a coluna `ordem` das conversas.
2. **Funções do Supabase.** A rotina "Publicar funções do Supabase" do GitHub falha porque falta o segredo `SUPABASE_ACCESS_TOKEN` (GitHub → Settings → Secrets and variables → Actions → New repository secret; o token sai em supabase.com → Account → Access Tokens). Com ele, cada mudança publica sozinha. Sem ele, publique à mão: `supabase functions deploy assistente`, `supabase functions deploy enviar-emails` e `supabase functions deploy avaliar-comunidade`. O assistente precisa desta publicação para aceitar o francês.
3. **Assistente de reforço:** continua **desligado**, como você pediu. Se um dia quiser ligar, os provedores gratuitos entram como segredos das funções (`GROQ_API_KEY`, `CEREBRAS_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, cada um com o seu `*_MODELO` opcional).
4. **Senha:** decidido manter no Supabase o mínimo de 12 com minúscula, maiúscula e número; o site passou a cobrar a mesma regra (nada a fazer).
5. **E-mail:** SPF, DKIM e DMARC do domínio, passo a passo em `docs/EMAIL-ENTREGA.md`.
6. **Estúdio (estudio.institutolucia.org):** `npx wrangler login` e `node scripts/publicar-estudio.mjs` (guia em `docs/ESTUDIO-EDITORES.md`); depois, na Vercel, `NEXT_PUBLIC_ESTUDIO_URL=https://estudio.institutolucia.org` e um redeploy. Sem isso, as páginas dos estúdios mostram "ainda não está no ar no endereço do instituto".
7. **Vercel (da rodada 2, se ainda não fez):** `VERCEL_DEEP_CLONE=true` para a linha do tempo do acervo; `LANGUAGETOOL_URL` se subir o LanguageTool próprio.
8. **Dependabot:** os PRs de dependências abertos precisam de "rebase" antes de juntar.

## O que entrou nesta rodada

| Lote | Commit |
| --- | --- |
| Caderno: leitor com marca-texto, revisão espaçada, caderno de erros, simulado e cópia de segurança | `ba43987` |
| Minha conta refeita (abas, proteção, códigos de recuperação, senha por frase, meus dados, atividade) | `e55e396` |
| Boletim do jornal por blocos, teste para mim, rascunhos, histórico, lista com problema | `b7297e9` |
| Divulgação (quadro e calendário, kit da marca, registro do Instagram) | `0f8f3b5` |
| Materiais e arquivos (arquivo no formulário, crédito e licença, candidatura, galeria) | `92507dc` |
| Traduções (reservar, lado a lado, glossário, progresso) | `e8e7502` |
| Controles do site e assistente com vários provedores, em ordem e com reserva | `a4a05b6` |
| "Para você hoje", saúde do acervo, mutirões, projetos, minhas contribuições | `be65364` |
| Apoie e prestação de contas | `2cf9f6c` |
| Contribuir com o editor do Escrever e código de acompanhamento | `fc61869` |
| Comunidade refeita (salas, voto útil, árvore, conversa ligada à aula) | `dc599b4` |
| Estúdio rápido melhorado, PhotoCraft/FilmCraft/EffectCraft e Estúdio de prática | `240f2be`, `4b49cbb`, `fa21773` |
| Comentários ao vivo nas aulas em vídeo e moderação do bate-papo ao vivo; faixa principal do topo corrigida | `9b01994` |
| Exercícios de prática entregues pela Gaveta Aberta | `77b6b61` |
| **Francês como sexto idioma** (todo o site público) | `3091ad1`, `af5440f` |
| **Ferramentas refeitas**: música (escalas, acordes, piano roll, ditado), órbitas e queda por planeta, treino de balanceamento, revisão guiada da redação, Física em movimento (lançamento, circuito, ondas) e Reações com átomos | `a4452b9` |
| **Auditoria**: tranca final de RLS com teste, desempate no chat (teste que falhava às vezes), hreflang e canônico na página inicial | `61db11e` |
| **Estudo**: "O que estudar agora?", plano de estudos com .ics, prova da trilha como nivelamento, "Não entendi este trecho", ferramentas de quem escreve, cartões para o Anki | `4dadd26` e o commit deste relatório |

## Conferência do pedido, item por item

Legenda: ✅ feito · ◐ feito em parte · ✗ não feito.

### Rodada 2 (lista "vê se tá batendo tudo")
- ✅ Caixa de ferramentas por disciplina; tabela periódica com detalhes do elemento.
- ✅ Desligar conversas para todos, por grupo ou por pessoa.
- ◐ **Banco de questões público**: existe (`/questoes`), cresce sozinho com as questões das aulas e as enviadas pelos educadores. **Não busca questões na internet**: provas de concursos e vestibulares têm direitos de terceiros e fontes sem licença. Fica como decisão sua.
- ✅ "Envios do público" leva à triagem; avisos à equipe por e-mail e em balão; autonomia dos educadores; supervisão de podcast removida; quadro de missões; Fontes abertas para quem produz; menu recolhível, tela cheia e modo foco; ícones de perfil; teoria revolucionária ensinando política; Anna's Archive; editar aula publicada; ortografia pelo servidor próprio; filtro nas conversas; caixa de sugestões do marketing; grupo Tecnologia; atalhos do esqueleto; anexos nas aulas; fluxo de contribuição externa; "Trabalhar junto"; resumo da trilha no guia; trilhas por etapa; vídeo até 480p; "revisão" no lugar de "curadoria"; câmera e tela juntas, PDF e transcrição; mapa mental do caderno e baixar tudo; cada função só vê o que é dela; porta-voz (só um título); coordenação pedagógica; aprendizado interno; estatísticas; termo de voluntário; modo foco; cartão de quem ensina e Quem somos; painel de disciplinas e trilhas; convite ao Apoie depois do aviso; voluntariado em destaque; costura e crochê.
- ✅ Comentários em tempo real com mediação nas aulas em vídeo e ao vivo.
- ✅ Traduções nos idiomas do site e **o francês como idioma do site**.
- ◐ **Painel em francês**: o site público inteiro está em francês; o painel (que troca as frases por dicionário) ainda não tem o dicionário francês. Quem escolhe francês vê o painel em português.

### Sala Lúcia e Reuniões
- ✅ Aulas ao vivo com sala própria e Jitsi configurável (`NEXT_PUBLIC_JITSI_DOMAIN`), botões por papel, sem gravação.
- ✅ Aba Reuniões: propostas, aprovação, agenda, presença, ata e .ics.

### Psicologia e Engenharia de Sistemas
- ✅ Neurodiversidade e psicanálise; Engenharia de Sistemas com as 12 trilhas.

### Estúdio de design
- ✅ Estúdio rápido mantido e melhorado (guias e ímã, atalhos, histórico, exportar em lote); PhotoCraft hospedado sem modificação; PSD de ida; envio de volta para Trabalhos e Materiais; ajuda Photoshop → PhotoCraft.

### Escrever (editor de aulas)
- ✅ Editor por blocos (parágrafo, títulos, listas, citação, imagem, vídeo, fórmula, conta passo a passo, pergunta rápida, código, anexo, tabela), voltar ao texto sem perder nada, anexos, guia de produção, atalhos.
- ✅ Agora também: contador de palavras e tempo de leitura, medidor de legibilidade com meta por etapa, checklist viva, detector de jargão por trilha, aviso de pré-requisito e assistente de roteiro.
- ✗ **Ainda falta (o maior pedaço que ficou):** o layout novo da superfície de escrita (folha central, faixa de detalhes, etapas, barra de ação fixa, prévia lado a lado, modo foco com atalho, histórico de versões, menu "/" e barra flutuante) e os **blocos interativos**: gráfico de função com controles, geometria, calculadora de variáveis, gráficos de dados, simulações (Matter.js) e moléculas 3D dentro da aula; o pacote infantil e de línguas (cartões, memória, arrastar e soltar, caça-palavras, forca, completar e montar frase, pronúncia com gravação de voz, quiz ilustrado, cena clicável, música com letra); Blockly, código executável no bloco, Mermaid, quadro de desenho, mapa e linha do tempo; testes de vários tipos (V/F, numérica, lacunas, ordenar); comentários do revisor aceitáveis num clique. É um projeto de várias fases por si só.

### Caderno de estudos
- ✅ Fontes, leitor com marca-texto, revisão espaçada, caderno de erros, simulado, cópia de segurança, mapa mental, baixar tudo.
- ✅ Agora também: "O que estudar agora?", plano de estudos com .ics, nivelamento pela prova da trilha, "Não entendi este trecho" (comunidade ou reforço, com prévia), cartões para o Anki.
- ✅ Redação do ENEM com revisão guiada pelas cinco competências (sem nota automática).
- ✗ **Falta:** "Cadernos prontos" publicados pelo painel e "Caderno desta trilha"; selos por trilha e certificado de participação do aluno; sala de estudo em grupo com cronômetro compartilhado; envio da redação para correção por voluntário; conta opcional para sincronizar (era opcional).

### Telas do painel (Minha conta, Boletim, Divulgação, Materiais, Traduções, Controles)
- ✅ Todas refeitas nesta rodada (commits acima). O rascunho automático de tradução (LibreTranslate) ficou de fora de propósito: exige servidor próprio; o painel explica isso.

### Tarefas ("Para você hoje"), Acervo, Comunidade, Contribuir, Apoie
- ✅ Todas feitas nesta rodada (commits acima).

### Rádio, páginas públicas, SEO e acessibilidade
- ✅ Rádio própria removida, diretório "Rádios do povo" mantido; frases do topo por página; estados vazios úteis; índices e busca nas páginas longas; melhorias por página.
- ✅ 404 própria, aviso de aula não traduzida, robots coerente, hreflang e canônico (agora também na página inicial), imagem de compartilhamento por página, sitemap com data real, trilhas em construção, denunciar com o item preenchido, navegação na aula.
- ✅ **Auditoria de segurança do banco**: 103 tabelas, todas no esquema fechado `interno`, sem permissão direta para ninguém de fora; 541 funções `security definer`, todas com `search_path` fixo; buckets com políticas por papel. Achado e corrigido: 8 tabelas criadas no fim do arquivo só ganhavam a segurança por linha na segunda execução; a tranca final resolve e um teste confere.
- ◐ **Cloudflare:** o robots do site está certo; se o painel da Cloudflare ainda injetar o "Managed robots.txt", desligue em Security → Bots (ou AI Crawl Control) → "Manage your robots.txt".

### Edição de vídeo, Laboratório de Redes, Laboratórios e ferramentas
- ✅ Estúdio de prática (FilmCraft e EffectCraft), material da Blender Foundation, exercícios e entrega.
- ✅ Laboratório de Redes, IDE, terminal Linux, montador de PC, IA, planilha, segurança, PhET.
- ✅ Ferramentas antigas refeitas (música, sistema solar, balanceamento, redação, física e química), mantendo as que já estavam boas.

## Em resumo, o que faltou
1. **Escrever:** layout novo e os blocos interativos (o maior pedaço).
2. **Caderno:** Cadernos prontos, selos e certificado do aluno, sala de estudo em grupo, redação para correção por voluntário.
3. **Painel em francês** (o site público já está).
4. **Banco de questões buscando na internet** (não feito por direitos autorais; a decisão é sua).

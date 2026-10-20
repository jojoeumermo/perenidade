# Rodada 3 — relatório final

Tudo está no `master` e publicado pela Vercel. Cada lote passou por `lint`, `typecheck`, `conferir:i18n` (seis idiomas), `testar:banco`, as outras suítes da CI e o build. **Nada foi rodado no banco de produção.**

## Preciso de você

1. **Cloudflare:** resolvido em 19/10/2026. A política de bots de IA passou a permitir o treinamento na entrada, e a sincronização do robots.txt foi desligada; o Google, o Bing, a Apple e o Baidu estão liberados, e o robots.txt do site segue mandando embora os robôs de treino.
2. **Assistente de reforço:** continua **desligado**, como você pediu. Para ligar um dia, os provedores gratuitos entram como segredos das funções (`GROQ_API_KEY`, `CEREBRAS_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`).

O `install.sql` foi rodado de novo (19/10/2026) e conferido em produção: os cadernos prontos e as resoluções das questões respondem.

Já resolvido nesta rodada, sem nada a fazer: funções do Supabase publicadas sozinhas pelo GitHub (segredo `SUPABASE_ACCESS_TOKEN` e variável `FUNCOES=sim`), Estúdio no ar em estudio.institutolucia.org, SPF/DKIM/DMARC do e-mail, PRs do Dependabot, senha com minúscula, maiúscula e número nos dois lados. A variável `VERCEL_DEEP_CLONE` foi retirada: a linha do tempo do acervo agora vem de `historico/acervo.json`.

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
| Comentários ao vivo nas aulas em vídeo e moderação do bate-papo ao vivo | `9b01994` |
| Exercícios de prática entregues pela Gaveta Aberta | `77b6b61` |
| Francês como sexto idioma do site público | `3091ad1`, `af5440f` |
| Ferramentas refeitas (música, órbitas, balanceamento, redação, física, reações) | `a4452b9` |
| Auditoria: tranca final de RLS com teste, desempate no chat, hreflang e canônico | `61db11e` |
| Estudo: "O que estudar agora?", plano com .ics, nivelamento, "Não entendi este trecho", cartões para o Anki | `4dadd26`, `b8b8320` |
| **Editor de aulas:** folha com etapas, faixa de detalhes, versões, prévia ao lado, modo foco, barra de ação, menu "/" e **blocos interativos** (gráfico com controles, calculadora, gráficos de dados, testes de cinco tipos, cartões, memória, forca, caça-palavras, pronúncia com gravação, diagramas, linha do tempo, desenho, atalho para ferramentas); sugestões da revisão aceitas num clique | `ba159f0` |
| **Caderno:** cadernos prontos montados no painel, caderno da aula e da trilha, selo de trilha com certificado de participação conferível, sala de estudo em grupo com cronômetro, redação enviada para correção por voluntário | `07d26f0` |
| **Banco de questões:** ENEM de 2009 em diante (enem.dev), Unicamp e Fuvest (BLUEX, 2018–2024) e 1.ª fase da OAB (2010–2018), com correção na hora, caderno de erros e resoluções dos educadores, atualizado sozinho toda semana | `551aaaf`, `5598818` |
| **Banco de questões, saúde:** Revalida (Inep) por ano e as residências do Enare, médica e multiprofissional, por especialidade (HealthQA-BR, CC BY 4.0). Total: **14.696 questões** | `f23f3bb` |
| **Caderno de estudos com a identidade do instituto:** capa na faixa preta com a cunha e a estrela, cadernos como lombadas, fontes como recortes, ferramentas em três gavetas (Entender, Treinar, Organizar) com ícones, cada ferramenta com a sua faixa, resumo numerado, carimbos, fichas, questionário com letras, folha pautada, relógio de foco e um começo guiado; claro, escuro e celular | `678700e` |
| **Banco de questões, segunda leva:** ITA (2008–2024), IME (2017–2023), Fuvest desde 1981 e mais anos da Unicamp (Alvorada-Bench, licença MIT) e olimpíadas de matemática por nível, com a OBMEP (MATH-PT, licença MIT). Total: **9.064 questões** | `38184fe` |
| **Editor de aulas, os blocos que faltavam:** simulação física (Matter.js, em metros, com altura e velocidade ao vivo), molécula em 3D (nome, fórmula SMILES do PubChem ou coordenadas XYZ; forma pela teoria VSEPR, girar com o dedo), geometria com pontos que se arrastam (medidas, ângulos e áreas ao vivo), mapa (Natural Earth, sem servidor de fora; pontos, rotas e países em destaque), programação por blocos (Blockly, com saída esperada e o programa em Python e JavaScript), código para rodar (Python e JavaScript no navegador, laço sem fim interrompido), cena clicável (explorar ou encontrar), arrastar para o grupo, montar a frase, música com letra que acompanha, figuras nos testes e quadro de desenho no estilo do Excalidraw | `c67adba`, `e1a21b4` |
| **Linha do tempo do acervo completa:** o histórico inteiro, resumido em `historico/acervo.json` pela rotina de publicação | `ad18f74` |
| **Painel em francês:** todas as frases traduzidas e o francês na escolha de idioma do painel | `a04bca2`, `fb90a5c` |
| **Painel completo nos cinco idiomas** (4.637 frases em cada um, inclusive os textos que vêm de `lib/`: senha, sala de vídeo, avisos do navegador; feito numa sessão paralela) | `f22b3ef` |
| Verificação do GitHub voltou a passar (ESLint sem ler pacotes de terceiros; "Estudo em grupo" no interruptor de áreas) | `d1b72d2` e o commit deste relatório |

## Conferência do pedido, item por item

Legenda: ✅ feito · ◐ feito em parte · ✗ não feito.

- ✅ **Escrever:** layout novo e todos os blocos interativos do pedido, inclusive Blockly, moléculas 3D, Matter.js, quadro no estilo do Excalidraw e mapa. O mapa não usa o Leaflet: ele precisaria de um servidor de mapas de fora, que veria quem estuda; os contornos vêm do Natural Earth e são desenhados aqui.
- ✅ **Caderno:** tudo do pedido. A conta para sincronizar continua opcional: o caderno funciona sem conta e tem cópia de segurança em arquivo.
- ✅ **Banco de questões:** ENEM, Unicamp, Fuvest, ITA, IME, OAB, olimpíadas de matemática, Revalida e Enare (14.696 questões). ◐ Concursos públicos (bancas como Cespe, FCC, FGV) e os outros vestibulares não têm hoje nenhuma fonte aberta organizada, com gabarito e enunciado em texto; os sites que reúnem essas provas não liberam os dados. Quando aparecer uma fonte assim, ela entra no importador como as outras; até lá, entram pelo "Enviar questão" dos educadores.
- ✅ **Linha do tempo do acervo** completa.
- ✅ **Painel** completo nos cinco idiomas (francês, inglês, espanhol, russo e chinês).
- ✅ O restante da rodada 2 e da rodada 3 (Sala Lúcia, Reuniões, Psicologia, Engenharia de Sistemas, Estúdio de design, telas do painel, tarefas, comunidade, Apoie, rádio, SEO, acessibilidade, auditoria, laboratórios), conforme os commits acima.

## O que ainda falta

1. **Concursos públicos de outras bancas no banco de questões:** só quando existir uma fonte aberta (ver acima).

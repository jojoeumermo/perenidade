# Rodada 3 — relatório final

Tudo está no `master` e publicado pela Vercel. Cada lote passou por `lint`, `typecheck`, `conferir:i18n` (seis idiomas), `testar:banco`, as outras suítes da CI e o build. **Nada foi rodado no banco de produção.**

## Preciso de você

1. **Banco de produção: rodar o `supabase/install.sql` de novo.** Você já rodou uma vez nesta rodada, mas depois entraram: sugestões da revisão aceitas num clique, cadernos prontos, certificado de participação do aluno (e a conferência dele), resoluções das questões escritas pelos educadores e áudio (gravação de voz) no depósito de envios. Faça um backup (Database → Backups) e rode o arquivo inteiro no SQL Editor; ele é idempotente e só acrescenta.
2. **Assistente de reforço:** continua **desligado**, como você pediu. Para ligar um dia, os provedores gratuitos entram como segredos das funções (`GROQ_API_KEY`, `CEREBRAS_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`).
3. **Cloudflare (se ainda aparecer):** se o painel da Cloudflare injetar o "Managed robots.txt", desligue em Security → Bots → "Manage your robots.txt".

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
| **Banco de questões:** ENEM de 2009 em diante (enem.dev), Unicamp e Fuvest (BLUEX, 2018–2024) e 1.ª fase da OAB (2010–2018), 6.316 questões, atualizadas sozinhas toda semana, com correção na hora, caderno de erros e resoluções dos educadores | `551aaaf`, `5598818` |
| **Linha do tempo do acervo completa:** o histórico inteiro, resumido em `historico/acervo.json` pela rotina de publicação | `ad18f74` |
| **Painel em francês:** as 4.322 frases traduzidas e o francês na escolha de idioma do painel | `a04bca2`, `fb90a5c` |
| Verificação do GitHub voltou a passar (ESLint sem ler pacotes de terceiros; "Estudo em grupo" no interruptor de áreas) | `d1b72d2` e o commit deste relatório |

## Conferência do pedido, item por item

Legenda: ✅ feito · ◐ feito em parte · ✗ não feito.

- ✅ **Escrever:** layout novo e blocos interativos (lista acima). ◐ Ficaram de fora, trocados por blocos próprios mais leves: Blockly, moléculas 3D, simulação física (Matter.js), quadro tipo Excalidraw e mapa (Leaflet). Para simulações e moléculas, o bloco "ferramenta" leva às ferramentas do site que já fazem isso.
- ✅ **Caderno:** tudo do pedido. A conta para sincronizar continua opcional: o caderno funciona sem conta e tem cópia de segurança em arquivo.
- ✅ **Banco de questões:** ENEM, Unicamp, Fuvest e OAB. ◐ Outros vestibulares e concursos públicos não têm fonte aberta organizada (com gabarito e enunciado em texto); entram pelo "Enviar questão" dos educadores.
- ✅ **Linha do tempo do acervo** completa.
- ✅ **Painel em francês** completo.
- ✅ O restante da rodada 2 e da rodada 3 (Sala Lúcia, Reuniões, Psicologia, Engenharia de Sistemas, Estúdio de design, telas do painel, tarefas, comunidade, Apoie, rádio, SEO, acessibilidade, auditoria, laboratórios), conforme os commits acima.

## O que ainda falta

1. **Rodar o `install.sql` de novo** (item 1 acima). Até lá, cadernos prontos, certificado do aluno, sugestões da revisão e resoluções das questões dão erro em produção.
2. **Painel em inglês, espanhol, russo e chinês:** o painel cresceu muito nas rodadas de chat, cargos e plataforma EaD (de 2.137 para 4.322 frases) e esses quatro dicionários só cobrem 1.955. As frases que faltam aparecem em português. O francês está completo.
3. Os blocos que ficaram de fora do editor (Blockly, moléculas 3D, Matter.js, Excalidraw, mapa), se ainda quiser.

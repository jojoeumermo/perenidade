# Guia de manutenção do Instituto Lúcia

Este é o documento de referência do projeto: como ele é organizado, como se escreve conteúdo, como ligar as contas de voluntários e o que fazer quando algo dá errado.

## 1. A ideia em três frases

1. **O site publicado é feito só de arquivos.** Tudo o que o visitante lê vem da pasta `content/`. Cada mudança fica no histórico de versões e pode ser desfeita.
2. **O banco de dados é um apoio, não o acervo.** Ele guarda contas, a fila de contribuições, as conversas da comunidade e a programação da rádio. Se ele cair ou for invadido, as aulas continuam no ar.
3. **Nada entra sem aprovação.** Contribuições ficam na fila do painel; depois de aprovadas, uma rotina automática as transforma em arquivos de `content/`.

## 2. Regras da casa

- **Design:** não se mexe em fontes, cores nem no texto central da página inicial. Novas páginas reaproveitam as peças que já existem.
- **Simplicidade:** o foco é o ensino. Fórum, jornal e rádio são complementos e ficam fora do caminho de quem só quer estudar.
- **Palavras:** no site se fala em *coordenador, vice-coordenador, curadoria, mediador, educador, revisor, tradutor, jornalista (que também é radialista), voluntário*. Não se usam "administrador", "moderador" nem "líder".
- **Fontes:** toda aula, matéria, checagem, verbete e homenagem cita pelo menos uma fonte. Nada inventado.
- **Pessoas e organizações:** ao falar de pessoas vivas, partidos ou empresas, só fatos documentados e linguagem sóbria. O objetivo é educar.
- **Direitos autorais:** nenhum arquivo de terceiros é hospedado. O acervo guarda a ficha e o link para a fonte legítima; nunca um link direto para PDF, nunca um link de loja ou de editora. Obra protegida vira "ficha de referência" e aponta para um catálogo de bibliotecas. Letras de música e livros protegidos não são reproduzidos.
- **Privacidade:** nada de rastreadores de publicidade nem anúncios. Estudar não exige conta. O que o site guarda está descrito, sem enfeite, em `content/paginas/privacidade.md`: mudou o que se guarda, mude a página.
- **Licenças:** o código é software livre sob a GNU AGPL versão 3 ou posterior (`LICENSE`); o conteúdo educacional é CC BY-SA 4.0 (`LICENSE-CONTEUDO.md`).
- **Idiomas:** o site abre sempre em português. Os outros idiomas são inglês, espanhol, chinês e russo.

## 3. Organização das pastas

| Pasta | O que tem |
| --- | --- |
| `content/trilhas/<trilha>/` | `_trilha.md` (título, disciplina, etapa), `plano.json` (roteiro) e uma aula por arquivo |
| `content/acervo/` | fichas de obras escolhidas pela curadoria |
| `content/catalogo/<disciplina>.json` | catálogo ampliado, importado de catálogos abertos |
| `content/autores/`, `memorial/`, `glossario/`, `jornal/`, `checagens/`, `debates/`, `videos/` | uma ficha por arquivo |
| `content/paginas/` | páginas de texto corrido (sobre, voluntariado, linha do tempo, guia de fontes, privacidade, termos de uso) |
| `content/frases.json`, `content/perguntas.json`, `content/comecar.json` | frase do dia, perguntas de partida e a lista de leitura "Por onde começar" (só cita aulas e obras que existem; se alguma sumir, a montagem do site avisa) |
| `content/radios.json` | rádios populares e comunitárias que o tocador oferece (só transmissões abertas e conferidas) |
| `content/abertura.json` | aviso que aparece ao abrir o site; a coordenação pode trocá-lo ou desligá-lo pelo painel |
| `content/noticias.json` | veículos do giro de notícias (nome, site e endereço de distribuição RSS); a página se refaz sozinha a cada quinze minutos |
| `content/galeria.json` e `public/imagens/galeria/` | cartazes e imagens históricas em domínio público, cada um com contexto e fonte |
| `content/busca.json` | termos em inglês e espanhol e o nome que o assunto tem nas aulas, para a busca entender quem escreve em outro idioma |
| `public/imagens/memorial/` | retratos do memorial (só imagens de licença livre, com crédito e fonte no cabeçalho da ficha) |
| `public/arquivos/` | imagens e PDFs aprovados no painel, já limpos de dados embutidos (ver seção 7) |
| `i18n/` | textos da interface (`pt.json` é a referência) |
| `lib/areas.ts` | lista de disciplinas, grupos, etapas, licenças e ferramentas |
| `lib/tipos.json` | tipos de contribuição aceitos pelo painel |
| `supabase/install.sql` | banco de apoio, em um arquivo só |
| `scripts/` | roteiros de apoio (ver seção 9) |

Rotas ficam em `app/[lang]/`. Os nomes das rotas são em português (`/trilhas`, `/acervo`, `/ferramentas`…).

## 4. Como escrever conteúdo

Todo arquivo de conteúdo é Markdown com um cabeçalho. O build confere cada campo: arquivo errado quebra o build de propósito, para nunca publicar algo incompleto. HTML dentro do texto não é aceito, e imagens também não.

### Trilha (`content/trilhas/<trilha>/_trilha.md`)

```yaml
---
titulo: "Teoria musical do zero"
area: musica            # uma das disciplinas de lib/areas.ts
etapa: fundamental      # fundamental | medio | superior
ordem: 1                # posição dentro da etapa
resumo: "Uma linha que apresenta a trilha."
---
Parágrafo de apresentação.
```

### Roteiro (`content/trilhas/<trilha>/plano.json`)

Lista ordenada das aulas previstas. Aula que ainda não tem arquivo aparece no site como "em preparação".

```json
[
  { "slug": "o-que-e-som", "titulo": "O que é som" },
  { "slug": "a-pauta", "titulo": "A pauta e as claves" }
]
```

### Aula (`content/trilhas/<trilha>/<slug>.md`)

```yaml
---
titulo: "A pauta e as claves"
resumo: "Onde as notas moram."
autores: ["Nome de quem escreveu"]
revisada: true          # opcional; sem isso aparece o aviso "aguarda revisão"
ferramentas: [resolvedor, graficos]   # opcional; vêm primeiro na caixa de ferramentas da aula
fontes:
  - titulo: "Nome da obra ou da página"
    autor: "Autor ou instituição"
    ano: "2020"
    url: "https://…"    # opcional
quiz:
  - pergunta: "…"
    opcoes: ["a", "b", "c"]
    resposta: 1         # posição da opção certa, começando em 0
    explicacao: "…"
---
Texto da aula.
```

O nome do arquivo pode ter um número na frente (`03-fracoes.md`); o endereço da aula usa só o slug. A ordem das aulas é a do `plano.json`.

Blocos especiais dentro do texto de uma aula:

````markdown
```pauta
clave: sol
compasso: 4/4
notas: C4/4 D4/4 E4/4 F4/4 | G4/2 G4/2
nomes: sim
```

```teclado
C4 E4 G4
```

```verificar
Quanto vale o 7 em 3,75?
- sete unidades
+ sete décimos
- sete centésimos
> Releia o trecho sobre as casas depois da vírgula.
```
````

Na pauta, cada nota é `LetraOitava/Duração` (C4 é o dó central; `#` e `b` depois da letra; durações 1, 2, 4, 8; `r/4` é pausa; `|` é barra de compasso). No bloco `verificar`, `+` marca a resposta certa e `>` é a dica. Blocos de código `python` e `php` ganham o link "Testar este código".

### Prática lúdica (aulas de idioma)

Nas disciplinas de idioma (inglês, inglês infantil, espanhol, francês, chinês e russo), a aula pode trazer no cabeçalho o campo `pratica`: a lista de exercícios que o site joga no fim da aula, no jeito dos aplicativos de língua (uma sessão, um exercício por vez, resposta na hora, pontos e sequência de dias guardados só no navegador). A voz é a do aparelho de quem estuda; o reconhecimento de fala, onde o navegador tem. Os tipos e os campos (conferidos em `lib/pratica.ts`; erro derruba o build):

```yaml
pratica:
  - tipo: escolha            # pergunta, opcoes (2 a 6), resposta (posição da certa), audio?, dica?
    pergunta: "Como se diz o nome da letra E?"
    opcoes: ["i", "é", "ei"]
    resposta: 0
    audio: "E"
  - tipo: traduzir           # frase, resposta (traduções aceitas), palavras? (banco para montar tocando), na_lingua?
    frase: "Bom dia"
    resposta: ["Good morning"]
    palavras: ["Good", "morning", "night", "Hello"]
  - tipo: pares              # pares de [esquerda, direita] (2 a 8)
    pares: [["house", "casa"], ["book", "livro"]]
  - tipo: lacuna             # frase com ___, resposta, opcoes?, dica?
    frase: "My ___ is Maria."
    resposta: "name"
  - tipo: ordenar            # frase na língua (as palavras são embaralhadas), traducao?
    frase: "How do you spell your name?"
    traducao: "Como se escreve o seu nome?"
  - tipo: ouvir              # frase (o aparelho fala; a pessoa escreve), traducao?
    frase: "Nice to meet you."
  - tipo: falar              # frase (a pessoa lê em voz alta), traducao?
    frase: "Good morning."
  - tipo: cartoes            # cartoes de frente e verso (repetição espaçada)
    cartoes: [{ frente: "house", verso: "casa" }]
```

O educador de idiomas monta a prática no painel, em *Escrever → Prática de idioma* (escolhe a trilha e a aula já escrita, acrescenta os exercícios, testa como estudante e envia); ela segue pela fila de revisão como toda contribuição e, aprovada, a publicação grava os exercícios no cabeçalho da aula (`pratica` e `pratica_origem`).
### Caixa de ferramentas

As ferramentas práticas (calculadora, resolvedor, gráficos, tabela periódica, pronúncia, folha de redação e as outras) têm cada uma a sua página em `/ferramentas/<nome>` e também abrem **dentro das aulas**, das trilhas e das estantes, sem sair da página: no computador a caixa abre ao lado e a aula se afasta; no celular ela sobe de baixo, acima da barra de navegação. Só a ferramenta aberta é baixada, e o que se digitou nela continua lá ao fechar e abrir de novo.

A caixa de uma aula junta, nesta ordem e sem repetir:

1. as ferramentas que a própria aula sugere no campo `ferramentas` do cabeçalho;
2. as da disciplina, em `areaTools` (`lib/areas.ts`): por exemplo, inglês e espanhol têm pronúncia e frases; ENEM tem redação, cronômetro, resolvedor, estatística e tabela periódica;
3. as universais, em `universalTools`: calculadora, cronômetro e dicionário.

Um nome que não exista na lista `tools` de `lib/areas.ts` faz a montagem do site parar, com o nome do arquivo e da ferramenta no erro.

**Para acrescentar uma ferramenta nova:**

1. ponha o nome (em português, com hífens) em `tools`, em `lib/areas.ts`, e, se for o caso, nas disciplinas de `areaTools`;
2. escreva o componente em `components/tools/` e acrescente um `case` em `components/tools/ToolView.tsx` (a caixa das aulas) e na página `app/[lang]/ferramentas/[tool]/page.tsx`;
3. diga em `lib/ferramentas/secoes.ts` que pedaço dos textos ela usa (o objeto `tools` dos dicionários): a aula só manda para o navegador os textos das ferramentas daquela disciplina;
4. ponha o nome em `toolNames` e os textos em `tools.<seção>` nos cinco dicionários (`i18n/*.json`) e rode `npm run conferir:i18n`;
5. se ela faz contas, deixe a conta num arquivo puro em `lib/ferramentas/` e acrescente conferências em `scripts/testar-ferramentas.mjs` (`npm run testar:ferramentas`).

O resolvedor também aceita **foto do exercício**: a foto vai para o assistente de reforço só para ser transcrita, e a conta continua sendo feita no próprio navegador (ver a seção 15b).

### Demais fichas

| Coleção | Campos do cabeçalho |
| --- | --- |
| `acervo` | `titulo, autor, area, licenca, fonte, url, idioma`, opcionais `ano`, `autores: [slug]`; o texto é a sinopse |
| `autores` | `nome, anos, origem`, opcionais `arquivo` (https), `arquivo_fonte`; o texto é a biografia |
| `memorial` | `nome, nascimento, morte, local`, opcionais `foto` (em `/imagens/memorial/`), `foto_credito` e `foto_fonte`; o texto é a homenagem |
| `glossario` | `termo, resumo`; texto opcional |
| `jornal` | `titulo, autor, data (AAAA-MM-DD), fontes`, opcionais `subtitulo`, `editoria` |
| `checagens` | `alegacao, veredito (Falso, Enganoso, Falta contexto ou Verdadeiro), data, fontes` |
| `debates` | `afirmacao, resposta, fontes`, opcional `falacias: [slug]` (as falácias que a frase usa; slug que não existe quebra a montagem); texto opcional |
| `falacias` | `nome, resumo` (uma linha), `familia` (`relevancia`, `provas`, `premissas`, `desvio` ou `sentido`), `o_que_e, dia_a_dia, debate_publico, como_responder, fontes`, opcionais `original` (nome em latim ou inglês) e `parecidas: [slug]`; texto opcional. O exemplo do debate público é sóbrio e não cita pessoa viva nem partido pelo nome |
| `videos` | `titulo, canal, url, area, idioma`; o texto diz por que vale assistir |

A **caixa de ferramentas de checagem** (página Checagens) vem de `content/ferramentas-de-checagem.json`: grupos (`imagem`, `video`, `arquivo`, `agencias`, `buscador`, `dados`, `dominio`, `guias`) com `id`, `nome` e `url` (https, nunca PDF) de cada ferramenta. A frase que explica cada uma fica nos dicionários (`factCheck.toolbox.tools.<id>`), nos cinco idiomas. Confira se o endereço abre antes de pôr.

`ativo: false` no cabeçalho tira qualquer item do ar sem apagá-lo (é a "quarentena" das denúncias).

**O glossário cresce sozinho.** Além das fichas de `content/glossario/`, cada aula pode definir os próprios termos no cabeçalho:

```yaml
glossario:
  - termo: "Mais-valia"
    definicao: "A diferença entre o valor que o trabalhador produz e o salário que recebe."
```

A cada montagem, o site junta tudo, procura cada termo no texto de todas as aulas e mostra, na página do glossário, em quais disciplinas e aulas ele aparece.

### Traduções

A tradução de `arquivo.md` é `arquivo.en.md` (ou `.es`, `.zh`, `.ru`), na mesma pasta, repetindo só os campos de texto. Sem tradução, o conteúdo aparece em português com um aviso. Em chinês, deixe a pontuação fora do negrito (`**termo**：`), senão o destaque não aparece.

## 5. Continuar de onde parou

```bash
npm run proximo              # resumo por disciplina
npm run proximo -- musica    # as próximas aulas de uma disciplina
```

O roteiro (`plano.json`) é a memória do que falta. Uma aula conta como pronta quando existe um arquivo com aquele slug, tenha sido escrita pela equipe ou enviada por um voluntário pelo painel; por isso nada é duplicado. Aula enviada sobre um tema fora do roteiro entra no fim da trilha.

Para ampliar uma disciplina: acrescente itens ao `plano.json` ou crie uma nova trilha com `_trilha.md` e `plano.json`.

## 6. Ligar as contas (Supabase)

Sem esta etapa o site funciona, só não aparecem o painel, a comunidade e a rádio.

1. Crie um projeto em supabase.com (o plano gratuito basta). Região: São Paulo.
2. Abra **SQL Editor**, cole o conteúdo inteiro de `supabase/install.sql` e clique em **Run**. Pode rodar de novo quando o arquivo mudar: ele não apaga nada.
3. Em **Project Settings → API**, confira que em *Exposed schemas* **não** aparece `interno` (o padrão já é só `public`).
4. Ainda em **API**, copie a *Project URL* e a chave *anon public*. No serviço de hospedagem do site, crie as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com esses valores e publique o site de novo.
5. Em **Authentication → URL Configuration**, ponha o endereço do site em *Site URL* e acrescente `https://SEU-DOMINIO/**` em *Redirect URLs*.
6. Em **Authentication → Sign In / Providers → Email**: deixe o e-mail ligado, **ligue "Confirm email"** e deixe ligado "Allow new users to sign up" (quem barra o cadastro é o banco: com o cadastro da comunidade fechado, sem convite válido a conta não é criada). Ponha o tamanho mínimo da senha em 12, em *Password Requirements* escolha a opção que exige letras minúsculas, maiúsculas, números e símbolos (o site já cobra isso na tela, com a lista de regras que vai sendo marcada e o botão de mostrar a senha, mas quem vale é o serviço de contas) e ligue "Secure password change" (trocar a senha passa a pedir uma confirmação recente). A confirmação de e-mail é o que prova que a conta pertence a quem tem a caixa de entrada: sem ela, qualquer pessoa cria uma conta com o e-mail de outra e, se essa outra pessoa se candidatar a voluntária, recebe a função quando a candidatura for aceita. Ela depende do envio de e-mails: configure antes o SMTP do Resend (seção "E-mails automáticos").
7. **A primeira conta (a sua).** Em **Authentication → Users → Add user → Create new user**, digite o seu e-mail e a sua senha e marque "Auto Confirm User". Enquanto não existe coordenação, essa criação é livre. Depois, no **SQL Editor**, rode:

   ```sql
   select public.promover_coordenacao('seu-email@exemplo.com');
   ```

   A partir daí o painel mostra as abas da coordenação, e **nenhuma conta nova é criada sem convite**. A senha nunca é escrita em arquivo, mensagem ou código: só nesse campo do painel do serviço de contas.

   **Convites.** No painel, aba **Voluntários → Convites**: o convite pessoal leva o e-mail da pessoa e, se quiser, a função; o convite da comunidade vale para várias pessoas, sem função. O endereço aparece uma única vez. Quem recebe abre o endereço, cria a própria senha e entra.

   **Senha perdida.** O site não tem "esqueci minha senha". A coordenação (ou a vice-coordenação) resolve pelo painel: **Voluntários e convites → Pessoas → abrir a ficha → Redefinir a senha**. O painel gera uma senha forte no navegador (ou aceita uma digitada), mostra uma única vez para ser entregue por um canal seguro, grava como o serviço de contas grava (bcrypt, extensão `pgcrypto`, que o `install.sql` liga), encerra as sessões abertas da pessoa e, no próximo acesso, pede que ela escolha outra antes de abrir o painel. A senha nunca vai para o registro. A vice-coordenação não redefine a da coordenação, e ninguém usa isso na própria conta (para si existe *Minha conta*). O e-mail de ninguém muda pelo painel. Continua valendo o caminho do serviço de contas: **Authentication → Users → Send password recovery** (precisa de SMTP).

   **Ninguém consegue entrar no painel?** No SQL Editor: `select public.convidar_pelo_banco('email@exemplo.com');` devolve o final do endereço de um convite pessoal, válido por dois dias.
8. Para a publicação automática (seção 7), cadastre nos segredos do repositório `SUPABASE_URL` (a mesma *Project URL*) e `SUPABASE_SERVICE_ROLE_KEY` (a chave *service_role*). **Essa chave nunca vai para o site nem para o `.env` de ninguém.** Depois crie, na aba *Variables* da mesma tela, a variável `PUBLICAR` com o valor `sim`: é ela que liga a rotina de hora em hora.
9. Opcional — entrada com o Google: ligue o provedor em **Authentication → Providers → Google** e crie a variável `NEXT_PUBLIC_AUTH_GOOGLE=1`.
10. **Proteção contra robôs (Cloudflare Turnstile).** Crie o widget no painel da Cloudflare. A *site key* (pública) vai para a variável `NEXT_PUBLIC_TURNSTILE_SITE_KEY` na hospedagem. A *secret key* vai **somente** em **Authentication → Attack Protection → Enable Captcha protection → Turnstile**, no Supabase. Ela nunca entra no repositório, em `.env` nem em mensagem. Ordem certa: primeiro publique o site com a *site key*; só depois ligue a proteção no Supabase. Na ordem inversa ninguém consegue entrar até o site novo subir.
11. **Segundo fator.** Em **Authentication → Sign In / Providers → Multi-Factor**, ligue o TOTP (aplicativo autenticador). Cada pessoa da equipe cadastra o seu no painel, em **Minha conta → Segundo fator**. A partir daí, a tela de entrada pede o código logo depois da senha, e o banco só reconhece as funções dessa conta em sessão confirmada pelo código, com a exigência geral ligada ou não. A exigência de segundo fator para as funções com poder de decisão (coordenação, vice-coordenação, curadoria e mediação) **nasce ligada**: sem o aplicativo cadastrado, o painel dessas contas abre direto na tela de cadastro e não mostra mais nada. Por isso o TOTP precisa estar ligado no Supabase **antes** de rodar o `install.sql`. A coordenação pode desligar a exigência na aba **Segurança e sucessão**, e a escolha dela não é desfeita quando o arquivo é rodado de novo. Se a coordenação perder o aparelho e ficar trancada do lado de fora, rode no **SQL Editor**:

    ```sql
    update interno.configuracoes set valor = '{"exigir_2fa": false}' where chave = 'seguranca';
    ```
12. Opcional — faxina automática: se a extensão `pg_cron` estiver ligada (**Database → Extensions**) quando o `install.sql` rodar, o banco descarta sozinho, toda madrugada, o que ficou velho: contadores de limite, avisos lidos há mais de 30 dias, aparelhos sem uso há 180 dias, pedidos de reforço encerrados, denúncias resolvidas há mais de um ano e registro de atividades com mais de 400 dias. Sem ela, nada quebra; só não há descarte.

### O painel

O painel (`/painel`) é um ambiente à parte do site: ocupa a tela inteira, sem cabeçalho, rodapé, rádio nem menu do site público (quem esconde isso é `components/OutsidePanel.tsx`, usado no layout), e tem um único caminho de volta, "Voltar ao site". O menu lateral é dividido por área:

| Área | Seções | Quem vê |
| --- | --- | --- |
| (início) | Mesa, Conversas, Mural da equipe | todos; conversas e mural, só quem tem função |
| Produção | Escrever, Aulas em vídeo, Aulas ao vivo, Estúdio de design, Caderno de estudos, Meus envios, Compartilhadas comigo, Fila de revisão, Triagem, Fontes abertas, Materiais e arquivos, Podcast | conforme a função; a triagem, mediação, curadoria e coordenação; o estúdio, marketing, design, jornalismo e coordenação; o caderno, todos |
| Atendimento | Comunidade, Aula de reforço, Mural dos Trabalhadores, Boletim do jornal | conforme a função; o mural, coordenação e mediação |
| Produção | Traduções, Divulgação | traduções: tradução, revisão, curadoria e coordenação; divulgação: marketing e coordenação |
| Pessoas | Voluntários e convites, Supervisão, Horas e certificados, Avisos à equipe | a primeira, coordenação e vice; Supervisão, só a supervisão; os avisos, coordenação, vice e supervisão |
| Site | Controles do site, Aviso de abertura, Rádio, Apoiadores, Estado técnico | coordenação; a rádio, também o jornalismo; o estado técnico, também o desenvolvimento |
| Segurança | Segurança e sucessão, Registro de atividades | coordenação; o registro, também a supervisão (só leitura) |
| Você | Minha conta (nome, senha, segundo fator, aparelhos) | todos |

A lista de seções e a regra de quem vê cada uma estão em um só lugar, no começo de `Dentro`, em `components/painel/Painel.tsx`. Para criar uma seção nova: escreva o componente em `components/painel/`, acrescente uma linha a essa lista e a linha que o mostra logo abaixo. Sem ninguém mexer por meia hora, o painel fecha a sessão sozinho.

**Controles do site** (só coordenação) mudam o site inteiro na hora, sem publicar nada: o texto da **faixa do alto** e a **pausa geral de envios**, que fecha tudo o que o público pode enviar (mural, reforço, boletim, contribuições, comunidade) enquanto a equipe continua trabalhando. A pausa é conferida no banco (gatilho `lucia_pausa`), não só na tela. O site público lê isso pela função `site()` (`components/Strip.tsx`), no máximo de dez em dez minutos por visitante.

**Trabalho em conjunto.** Quem enviou uma contribuição (ou a curadoria) chama um colega específico em *Meus envios → abrir → Trabalho em conjunto*. A pessoa chamada recebe um recado na hora, vê a contribuição em *Compartilhadas comigo* e pode abrir e editar só aquela, só enquanto está pendente; o acesso é tirado por quem liberou ou pela própria pessoa. São no máximo cinco por contribuição. Não é edição simultânea letra a letra: cada um guarda a sua vez, a tela se atualiza sozinha a cada vinte segundos, e se alguém guardou enquanto outro editava, o segundo é avisado e nada é sobrescrito (campo `versao`). Quem escreve uma aula também pode chamar colegas já no formulário *Escrever* (campo "Trabalhar junto"): ao enviar, os chamados recebem o acesso e o recado na hora.

**Tempo real.** O serviço de contas tem um canal de mensagens instantâneas (Realtime, por WebSocket), que o painel usa de duas formas, ambas em `lib/tempo-real.ts`. A primeira é o canal `painel`: toda ação que dá certo (`useAcao`) manda aos outros painéis abertos só o nome da função chamada (`chat_enviar`, `contribuicao_decidir`…), nunca o conteúdo; quem recebe refaz as listas que está vendo (`useLista` escuta o evento `painel-remoto`). O conteúdo continua vindo pelas funções do banco, que conferem quem pode ver o quê. A segunda é a sala de cada aula ao vivo (canal `aula:<id>`), com a presença de quem está nela e os sinais do WebRTC. Sem o canal (ambiente de teste local, serviço fora do ar), tudo continua pelo relógio de sempre. A política de segurança das páginas (`next.config.ts`) libera o endereço `wss://` do serviço para isso.

**Avisos à equipe.** Coordenação, vice-coordenação e supervisão (do podcast ou como função própria) escrevem em *Avisos à equipe* um aviso que aparece como um quadro por cima do painel de cada pessoa, até ela apertar "Entendi": para a equipe toda ou só para algumas funções (e a equipe do podcast), importante ou não, por um prazo de 1 a 60 dias. Chega na hora pelo canal de tempo real e, por garantia, de minuto em minuto. Tabelas `interno.avisos_gerais` e `avisos_gerais_vistos`; quem mandou vê quantas pessoas já fecharam cada aviso e pode tirá-lo do ar.

**Rascunhos que não se perdem.** O que a pessoa escreve em *Escrever* (por tipo de contribuição), na edição de uma contribuição pendente e na prática de idiomas é guardado sozinho: no navegador a cada pausa de um segundo e, com conta, no banco alguns segundos depois (`interno.rascunhos`, até 40 por pessoa e 200 KB cada). Fechou o navegador, atualizou a página ou abriu de outro aparelho, o texto volta (vale a cópia mais nova). Enviada a contribuição, o rascunho some dos dois lugares. O formulário público *Contribuir*, sem conta, já guardava o rascunho no navegador. A lógica está em `lib/rascunho.ts`.

**Guia de produção de aula.** Ao escolher "Aula" ou "Material avulso" em *Escrever*, o formulário mostra ao lado um guia (`components/painel/GuiaDaAula.tsx`): do que a aula trata (a posição no roteiro, o que vem antes e depois, o tom de cada etapa), como estruturar (com um esqueleto para inserir), a formatação do texto, como fazer os testes (a pergunta rápida no meio e as questões do fim) e as regras de fonte e linguagem. É orientação, não obrigação. O formulário também ganhou o editor das questões de fim de aula ("Teste o que você aprendeu"), que entram no cabeçalho `quiz` quando a aula é publicada.

**Aulas ao vivo.** Educadores, educadores secundários e a coordenação marcam aulas em *Aulas ao vivo*: título, descrição, disciplina, trilha, data e hora, duração, colegas que dão a aula junto (até oito; cada um recebe o recado e também conduz a sala) e, para turma grande, uma sala de fora (Jitsi, Meet). A agenda pública fica em `/ao-vivo`; cada aula tem a sala em `/ao-vivo/sala?aula=<id>`. Quem tem conta marca presença e é avisado quando a aula começa. Na sala, quem conduz liga a câmera, a tela ou só a voz, começa e encerra a aula e pode gravar (arquivo `.webm` no próprio aparelho, para depois enviar como aula em vídeo ou colar o endereço na gravação); quem assiste vê o vídeo, levanta a mão e fala no bate-papo (precisa de conta; o texto passa pelo filtro de palavras e pelo limite de envios, e quem conduz ou media pode esconder uma fala). O vídeo vai direto do navegador de quem ensina para cada navegador na sala (WebRTC, sem servidor no meio, só os servidores STUN públicos para descobrir o endereço): é o que dá para fazer de graça, e serve a turmas pequenas; o envio de quem ensina cresce com o número de pessoas, daí a sala de fora para turmas grandes. O bate-papo fica guardado como registro da aula (`interno.aulas_chat`, apagado 180 dias depois). Tabelas `aulas_ao_vivo`, `aulas_inscricoes` e `aulas_chat`; código em `lib/aovivo.ts`, `components/aovivo/` e `components/painel/AoVivo.tsx`.

**Estúdio de design.** Marketing, design, jornalismo e coordenação têm em *Estúdio de design* um editor de artes dentro do painel, com a identidade do instituto como padrão: modelos tirados do Kit de Lançamento (posts, stories, carrossel, cartaz A4, folheto, avatar, capa de podcast, cartão de link, capa de vídeo), texto nas três letras do site, formas (retângulo, elipse, estrela, linha, cunha, raios), imagens (do aparelho, da galeria de cartazes do site e da Wikimedia Commons, só com licença livre, pelas rotas `/api/imagens` e `/api/imagem`), a marca em três variantes, fundo com a trama e os fios, camadas que se movem, redimensionam e giram, desfazer e refazer, alinhamento, exportação em PNG, JPEG e PDF (pela impressão). Os trabalhos ficam na conta (`interno.designs`, até 200 por pessoa e 3 MB cada) e, por padrão, compartilhados com a equipe, que pode continuar de onde a pessoa parou. Código em `components/painel/design/` (`motor.ts` desenha, `modelos.ts` são os modelos, `Estudio.tsx` é a tela).

**Caderno de estudos.** A página pública `/caderno` é a sala de estudo: a pessoa junta fontes (aulas e obras do site pela busca, texto colado, arquivos `.txt` e `.md`) e o caderno extrai delas resumo e palavras-chave, responde perguntas com as passagens das fontes, monta cartões de memória, questionário (as perguntas rápidas das aulas mais lacunas sorteadas), mapa dos títulos, linha do tempo dos anos citados e um resumo em áudio a duas vozes do aparelho; ao lado, notas com exportação em `.md`, plano com relógio de estudo e o dicionário. Tudo roda no navegador e fica guardado só nele; não há modelo de linguagem, e a página diz isso. No painel, a seção *Caderno de estudos* é a mesma ferramenta, para preparar aulas; no podcast, a aba *Caderno* acrescenta o esboço de roteiro no gabarito do programa. Código em `lib/caderno.ts` e `components/caderno/Caderno.tsx`.

**Podcast: passo a passo.** A aba *Publicar: passo a passo* do podcast mostra, para um episódio escolhido (ou criado ali), os seis passos até o site, com o que já está feito marcado, o que falta da lista de conferência em vermelho e um botão que abre a aba certa do episódio; o passo do áudio final tem o envio do MP3 ali mesmo, e os passos de aprovação e publicação têm os botões de enviar, aprovar e publicar. O endereço `painel?aba=podcast&ep=<id>&passo=<aba>` abre o episódio já na aba pedida.

### Papéis

Cada pessoa vê no painel só as seções das suas funções. O banco confere a função de novo em cada pedido: esconder a seção é conforto, não é a proteção.

**Uma pessoa pode ter quantos papéis quiser** (jornalista e tradutora, educadora e curadora…): cada papel é uma linha em `interno.papeis`, e as permissões são a soma de todos (`interno.tem` responde "sim" se qualquer linha bater). Quem tem vários papéis entra no grupo de departamento de cada um; ao perder um papel, sai do grupo e a chave da conversa é trocada. No painel, os papéis aparecem como etiquetas em *Voluntários e convites → Pessoas* (com ✕ para retirar e "Confiar mais uma função"), na Mesa e na lista da equipe; no menu lateral, o principal e "+N". Quem já tem função pede outra pela Mesa ("Pedir outra função").

**Hierarquia de cargos.** Coordenação (nível 4), vice-coordenação (3), supervisão (2) e os papéis de trabalho (1). O nível de uma pessoa é o maior entre os papéis dela. Quem gere cargos (coordenação, vice e supervisão) só confia papel de nível **menor** que o próprio e só mexe nos cargos de quem está **abaixo**; ninguém mexe nos próprios; a coordenação mexe em todos (menos nos próprios, e nunca tira a última coordenação). Por cima disso: vice e supervisão só a coordenação nomeia; curadoria e mediação (que exigem segundo fator) ficam com coordenação e vice. As regras estão em `interno.nivel`, `interno.nivel_de`, `interno.pode_conceder` e `interno.pode_mexer`, e valem em `papel_conceder`, `papel_remover`, `candidatura_decidir`, `inscricao_decidir` e `convite_criar`.

**Histórico de cargos.** A tabela `interno.papeis_historico` guarda, para cada papel, quem confiou e quando e quem retirou e quando (gatilho `lucia_papeis_historico`; a sucessão automática entra como "sistema"). Os papéis que existiam antes do histórico entraram uma vez na instalação, como "migracao". A coordenação lê em *Pessoas → Histórico de funções* (`papeis_historico_listar`).

| Papel (nome no banco) | Nome no site | O que pode |
| --- | --- | --- |
| `coordenacao` | coordenador | tudo: aprova voluntários, distribui funções e disciplinas, nomeia vice e supervisão, edita nome e apresentação de outras contas e redefine senhas (nunca o e-mail), decide publicações, cuida do mural e da rádio, define a sucessão, lê o registro de atividades. Só existe um |
| `vice` | vice-coordenador | o mesmo que a coordenação, menos: nomear ou tirar vice, passar a coordenação, mexer na sucessão, mudar a exigência de segundo fator, definir a sala da equipe, emitir certificados e mexer na conta da coordenação |
| `supervisao` | supervisor | logo abaixo da coordenação e da vice: faz o painel andar quando as duas estão ausentes. Vê a equipe (nome, funções, último acesso, **sem e-mail**) e os pedidos de voluntariado (só leitura); suspende em emergência, com motivo obrigatório, quem não é coordenação, vice nem supervisão (a coordenação é avisada na hora) e reativa só o que ela mesma suspendeu; apaga publicações do Mural da equipe; lê o registro de atividades e o livro do acervo; liga e desliga a pausa geral de envios e o modo de segurança da Comunidade. Não confia funções, não convida, não edita contas, não mexe na faixa do alto, no cadastro aberto, na segurança nem na sucessão. Exige segundo fator como a coordenação. Cargo de confiança: entra por nomeação ou convite, nunca por candidatura |
| `curadoria` | curadoria | lê a fila inteira, edita e decide; cuida da comunidade (fila de revisão, palavras vetadas, denúncias) e pode fazer a triagem. Não vê a fila de reforço (lá há e-mail de estudante) |
| `representante` | representante do departamento | porta-voz e primeira entrada de um departamento (a disciplina guarda o departamento): administra o grupo do departamento nas conversas (descrição, foto, quem escreve), combina e delega tarefas. Nomeado pela coordenação, vice ou supervisão; não dá nem tira funções |
| `mediacao` | mediador | acompanha a Comunidade e decide os casos de dúvida (aprova, edita, oculta ou libera mensagens); aprova, edita ou recusa anúncios do Mural dos Trabalhadores; faz a triagem das contribuições de fora (libera para a fila de revisão ou barra, com nota); decide anotações de leitura; bane a conta de quem passa do limite e, em caso extremo, a origem de rede (não bane gente da equipe, e só a coordenação desfaz). Não aprova conteúdo de ensino, não vê a fila de revisão, não mexe em pessoas, no filtro de palavras, nas denúncias nem nos controles do site |
| `educacao` (por disciplina) | educador | escreve aulas da sua disciplina, vê e dá parecer na fila dela, dá parecer nas matérias do jornal, cuida da comunidade e atende o reforço da disciplina |
| `educacao_secundaria` (por disciplina) | educador secundário | os mesmos poderes do educador na disciplina, e também materiais avulsos (aulas avulsas, listas, resumos) que aparecem numa aba própria da disciplina; conversa no grupo da educação |
| `revisao` | revisor | lê a fila e dá parecer; vê as traduções a caminho |
| `traducao` | tradutor | vê em *Traduções* as aulas que ainda não têm tradução em cada idioma e as traduções já enviadas por outras pessoas (para não repetir), e envia traduções; não vê a fila dos outros |
| `jornalismo` | jornalista, radialista e podcaster | escreve matérias para o jornal; faz o podcast (ver a seção do podcast); manda o boletim; cuida da Rádio Lúcia (canais, faixas, transmissão ao vivo, pôr e tirar do ar) e indica emissoras para a lista "Rádios do povo", que entram pela fila de revisão |
| `mentoria` (por disciplina) | mentor | responde pedidos de aula de reforço da sua disciplina (a disciplina é obrigatória) |
| `marketing` | marketing e divulgação | o design e a divulgação juntos: prepara materiais e imagens (como o design), monta em *Divulgação* o calendário de posts e stories (ideia → rascunho → pronto → publicado), usa o kit da marca e o link do perfil do Instagram. O acesso ao Instagram é dado pela coordenação na própria Central de Contas da Meta, como colaborador: **o site nunca guarda senha de rede social** |
| `design` | designer | prepara materiais gráficos e imagens e atende pedidos de ajuda das outras funções; conversa no mesmo grupo do marketing |
| `desenvolvimento` | desenvolvedor | vê o *Estado técnico* (rotina de publicação, segunda avaliação, faxina, pgcrypto, sinais de varredura: só contagens e datas, nenhum dado de pessoa) e atende pedidos de ajuda pelo mural da equipe; não tem poder sobre conteúdo nem sobre pessoas |

**Matriz de seções do painel.** Todos veem Mesa, Escrever, Meus envios e Minha conta; quem tem qualquer função vê também Conversas, Mural da equipe, Compartilhadas comigo, Fontes abertas e Horas e certificados. Além disso:

| Seção | Quem vê |
| --- | --- |
| Fila de revisão | coordenação, vice, curadoria, revisão, educação (só a própria disciplina) |
| Triagem | coordenação, vice, curadoria, mediação |
| Traduções | coordenação, vice, curadoria, revisão, tradução |
| Materiais e arquivos | coordenação, vice, curadoria, design, marketing |
| Divulgação | coordenação, vice, marketing |
| Comunidade | coordenação, vice, curadoria, mediação, educação |
| Aula de reforço | coordenação, vice, mentoria e educação (só a própria disciplina) |
| Mural dos Trabalhadores | coordenação, vice, mediação |
| Gaveta Aberta | coordenação, vice, curadoria, mediação |
| Boletim do jornal | coordenação, vice, jornalismo |
| Voluntários e convites | coordenação, vice |
| Supervisão | supervisão |
| Controles do site, Aviso de abertura, Apoiadores, Segurança e sucessão | coordenação, vice |
| Rádio | coordenação, vice, jornalismo |
| Estado técnico | coordenação, vice, desenvolvimento |
| Registro de atividades | coordenação, vice, supervisão |

A Mesa de cada pessoa conta só o que ela pode resolver: quem dá parecer não conta o que já leu nem o que ainda espera a triagem; a curadoria não conta o reforço; a supervisão conta os pedidos de voluntariado e as suspensões que fez; o marketing conta os posts prontos com a data chegando e os devolvidos pela coordenação; o desenvolvimento conta o que foi aprovado há mais de três horas e não foi ao ar; e toda função conta os pedidos de ajuda do mural da equipe endereçados a ela. Cada regra desta tabela é conferida de novo no banco (`npm run testar:banco`).

**Ninguém suspende a própria conta.** O banco recusa, e o painel nem mostra o botão na própria ficha. A coordenação também não apaga a própria conta pelo painel (passa o cargo antes, em Segurança e sucessão); as outras contas continuam podendo apagar os próprios dados em *Minha conta*, que é um direito de quem usa o site.

Quem contribui sem conta, pela página Contribuir, entra na mesma fila, depois de passar pela triagem.

### Mediação: Comunidade, mural e triagem

A página **Comunidade** é aberta: qualquer visitante lê dúvidas, conversas e respostas. Escrever exige conta, e toda mensagem passa pela avaliação automática do banco (`interno.veredito`) antes de qualquer outra coisa. São três saídas. A mensagem adequada vai ao ar na hora. A que viola claramente as regras (ameaça, apologia ao ódio: as expressões marcadas como graves no filtro) é barrada: fica guardada, oculta, e entra no Registro de atividades. O caso de dúvida (palavra do filtro, endereço de site, telefone ou e-mail, texto gritado ou repetido, autor com mensagens ocultadas há pouco) entra retido (`retido`), invisível para os outros, até alguém que cuida da comunidade (mediação, curadoria, educadores, coordenação) aprovar, editar ou recusar em *Comunidade → Fila de revisão*; quem escreveu vê a própria mensagem marcada como "aguardando mediação" e recebe um recado com a decisão. Se a avaliação falhar, a mensagem vai para a fila: falha nunca vira aprovação. Cada mensagem guarda o veredito que recebeu (colunas `avaliacao` e `motivo`). Depois de publicada, a mensagem continua ao alcance da mediação, que pode ocultar, editar, trancar a conversa ou banir a conta, e do público, pela página Denunciar. Quem cuida da comunidade também pode liberar uma mensagem barrada por engano. Nada disso vale para o Mural dos Trabalhadores nem para a triagem das contribuições, que seguem com leitura humana antes de qualquer publicação.

**Segunda avaliação (opcional, nasce desligada).** As regras acima são a primeira camada e funcionam sozinhas. Dá para acrescentar uma segunda, feita pelo serviço de moderação da OpenAI, que lê o sentido do texto e não só os sinais. Ligada, o caminho de uma mensagem que as regras deixam passar muda: ela é gravada oculta, na fila, com o motivo "a segunda avaliação ainda não rodou"; o navegador avisa a função `avaliar-comunidade` (em `supabase/functions/`), que busca o texto no banco com a chave de serviço, consulta o serviço de moderação e devolve o resultado ao banco; o banco decide (`interno.decidir_externa`): publica, barra (ameaça, ódio e conteúdo sexual com menor apontados com clareza) ou deixa na fila (qualquer outra sinalização, nota alta, fala de autolesão). O navegador só pede a avaliação: não manda texto nem veredito, e sem o pedido nada é publicado. Chave ausente, serviço fora do ar, tempo esgotado, limite de requisições ou resposta estranha deixam a mensagem na fila. Mensagem que ficou para trás (navegador fechado, serviço fora do ar) pode ser reavaliada, pelo botão da *Fila de revisão* ou por quem escreveu ao voltar, com até três tentativas por mensagem e sem nunca aparecer antes da decisão; se dois resultados chegarem, só o primeiro vale. Nenhuma decisão automática suspende ou bane conta. O que as regras do banco barram ou seguram nem chega a essa segunda etapa.

**Modo de segurança.** Em *Controles do site*, ao lado do cadastro da comunidade, a coordenação liga o **Modo de segurança: somente aprovação manual**. Ligado, toda mensagem nova de quem não cuida da comunidade espera na fila, nenhum texto sai para a segunda avaliação e nenhum resultado dela publica nada (nem o de uma mensagem que já tinha saído para avaliar). Não apaga o que está no ar, não fecha a leitura nem o cadastro, não toca no mural nem na triagem. A escolha fica no banco (`comunidade_modo_seguranca`, só coordenação e vice) e no registro de atividades. O mesmo cartão mostra, separados, se a segunda avaliação está habilitada no banco, o resultado do último teste de funcionamento (botão *Testar agora*: a função faz uma chamada de verdade ao serviço com um texto fixo) e a última mensagem real avaliada. Habilitada não quer dizer funcionando.

Para ativar, nesta ordem:

1. Tenha pronta a mudança da página de privacidade: o texto está em `docs/privacidade-avaliacao-automatica.md` e entra em `content/paginas/privacidade.md` no mesmo dia em que a segunda avaliação for ligada, nem antes nem depois. Com ela ligada, o texto de cada mensagem da Comunidade (só o texto, sem conta, e-mail nem endereço de rede) é enviado a uma empresa de fora do país.
2. Rode o `supabase/install.sql` no SQL Editor.
3. Guarde a chave como segredo da função, nunca em arquivo do projeto: `supabase secrets set OPENAI_API_KEY=...` (ou **Edge Functions → Secrets** no painel).
4. Publique a função: `supabase functions deploy avaliar-comunidade`.
5. Teste com a exigência ainda desligada: chamar a função com uma mensagem qualquer deve devolver `{"veredito":"ignorado"}`.
6. Ligue no SQL Editor: `select public.comunidade_avaliacao_externa(true);`. Escreva uma mensagem de teste e confira que ela aparece em instantes. Se ficar na fila com "a segunda avaliação não respondeu", veja o registro da função (ele diz o tipo de falha, nunca a chave nem o texto).
7. Para desligar a qualquer momento: `select public.comunidade_avaliacao_externa(false);`. Volta a valer só a primeira camada, na hora.

**Conferência de links (opcional).** Com o segredo `GOOGLE_SAFE_BROWSING_KEY` na mesma função (`supabase secrets set GOOGLE_SAFE_BROWSING_KEY=...`), os endereços de site que aparecem numa mensagem são conferidos no Google Safe Browsing (golpe, programa malicioso, página enganosa; uso não comercial). Só os endereços saem, nunca o texto. Link perigoso, ou link que não deu para conferir, manda a mensagem para a fila de revisão; nada é publicado nem barrado só por isso. Sem o segredo, mensagem com link vai para a fila, como já acontecia.

As conferências dessa parte são `npm run testar:moderacao` (a chamada ao serviço, simulada, sem rede e sem chave) e a seção "segunda avaliação" de `npm run testar:banco` (o que o banco faz com cada resultado).

O **Mural dos Trabalhadores** é decidido pela coordenação e pela mediação, que também pode acertar o texto de um anúncio pendente. Retirar do ar um anúncio já aprovado continua só com a coordenação, na aba **No ar** da seção: o anúncio passa a "não aprovado", com o motivo que quem anunciou lê em "Meus anúncios", e nada é apagado na hora.

**Cadastro aberto.** Qualquer pessoa cria conta com e-mail e senha (página Entrar, ou "Criar conta" na Comunidade). A conta nasce sem função nenhuma: pode perguntar, responder e contribuir, e nada do que escreve aparece antes da mediação. A coordenação fecha essa porta em *Controles do site → Cadastro da comunidade* (volta a valer só o convite), e a pausa geral de envios também a fecha enquanto durar. A regra está no gatilho `lucia_conta_nova`. No serviço de contas, mantenha ligadas a confirmação de e-mail e a verificação contra robôs (seção 6).

**Banimento.** Na *Fila de revisão* e na página da conversa, quem media pode banir a conta de quem escreveu: a conta fica suspensa (lê, mas não envia), o que ela tinha na fila é recusado e a coordenação é avisada na hora. Em caso extremo, o banimento inclui a **origem de rede**: o banco guarda só o código embaralhado da origem (o mesmo usado nos limites de envio, nunca o endereço) e o gatilho `lucia_pausa` recusa, com `acesso_bloqueado`, todo envio de fora vindo dela, com ou sem conta. Uma origem pode ser uma escola ou um sindicato inteiro: use com parcimônia. A lista fica em *Comunidade → Banimentos*; só a coordenação desfaz.

**Candidatura de voluntário.** O formulário público (página Voluntariado e página Entrar) pede nome completo, e-mail, função e apresentação, sem exigir conta, e grava em `interno.inscricoes`. A coordenação decide em *Voluntários e convites → Candidaturas*. Ao aceitar, quem não tem conta ganha um convite pessoal (só para aquele e-mail, já com a função, válido por 14 dias) que a coordenação manda por e-mail; quem já tem conta com o e-mail confirmado recebe a função na hora. O site não envia e-mail sozinho: o painel mostra o endereço do convite e um atalho para o programa de e-mail.

A **Triagem** é a primeira barreira das contribuições: o que vem de quem não é da equipe nasce com `triagem = aguardando` e não aparece para educadores nem revisores. A mediação lê, acerta a forma se for o caso, e **libera** (segue para a fila de revisão) ou **barra** (encerra como não aprovado, com nota obrigatória). Curadoria e coordenação enxergam tudo e também podem triar, então a fila não trava se faltar mediador. O que a equipe escreve pula a triagem.

### Conversas e Mural da equipe

**Conversas** é o bate-papo: privado (duas pessoas), em grupo, e os **grupos de departamento**. Qualquer pessoa da equipe procura outra pelo nome e começa uma conversa, ou cria um grupo e escolhe quem entra (dá para marcar de uma vez todos de uma função). Só quem participa de uma conversa a lê: nem a coordenação abre conversa alheia. Aparece quem está online (painel aberto nos últimos dois minutos) e o "visto por último" de cada um. Não há canal aberto permanente com o banco: a conversa aberta se atualiza a cada três segundos e a lista a cada oito, o que na prática é tempo real. Tudo some em trinta dias, e o botão "Apagar todas as conversas agora" do coordenador (no Mural da equipe) leva tudo junto.

Os **grupos de departamento** são onze e já existem sozinhos: a equipe toda, coordenação, curadoria, mediação, educação, revisão, tradução, jornalismo (que é também rádio e podcast), aula de reforço, design e desenvolvimento. Quem recebe uma função entra na hora no grupo dela e no da equipe toda; quem deixa de tê-la (ou tem a conta suspensa) sai na hora. A coordenação e a vice-coordenação estão em todos. Ninguém sai, põe ou tira gente, nem apaga um grupo de departamento: ele acompanha as funções (gatilho `lucia_departamentos`, em `interno.papeis` e `interno.perfis`).

**Autodestruição.** Em cada conversa, qualquer participante escolhe, no alto, "Some em 1 hora", "1 dia" ou "7 dias" (ou desliga). Vale para as mensagens enviadas dali em diante: cada uma guarda o próprio prazo (`expira_em`) e é apagada do banco quando ele passa; a tela já esconde antes. Quem ligou e quando aparece na própria conversa.

**A cifra, sem frase.** Não existe mais a frase da equipe. Cada aparelho (cada navegador em que a pessoa abre o painel) cria um par de chaves ECDH P-256; a parte privada é criada como não exportável e fica só no navegador (IndexedDB), e o banco guarda só a parte pública (`interno.chat_aparelhos`). Cada conversa tem uma chave AES-GCM de 256 bits, criada num navegador e embrulhada para cada aparelho de quem participa (`interno.chat_chaves`). O banco recusa texto aberto e guarda só `c2.<versão>.<vetor>.<cifrado>`; cada mensagem vai amarrada à conversa, à versão da chave e ao autor, então nem mesmo trocar o autor de uma mensagem direto no banco passa despercebido (ela para de abrir). Quando alguém sai de uma conversa (ou de um departamento, ou remove um aparelho), a conversa passa a exigir uma versão nova da chave, que quem saiu nunca recebe. Quem chega depois (pessoa nova num grupo, celular novo) recebe as chaves dos colegas: qualquer aparelho com o painel aberto repassa sozinho, a cada meio minuto, o que falta para os outros. A lista "Aparelhos com acesso às suas conversas", no pé de Conversas, mostra os aparelhos da conta e deixa remover um perdido; a pessoa é avisada sempre que as conversas dela abrem num aparelho novo. Testes: `npm run testar:sigilo` (a cifra, sem banco) e a seção de conversas de `npm run testar:banco`.

**Confiança entre aparelhos.** O banco não decide mais quais aparelhos pertencem a cada pessoa: quem decide é a própria pessoa, e quem confere são os aparelhos dos colegas. Cada conta tem uma **chave de identidade** (ECDSA P-256, `interno.chat_identidades`, só a parte pública), criada no primeiro aparelho que abre as conversas. Todo aparelho leva um **certificado** (`chat_aparelhos.certificado`): a assinatura da chave pública dele pela identidade. Aparelho novo entra **pendente**: mostra na tela um código de oito números (e um QR) e sela com esse código a própria chave pública (`pedido`); num aparelho já aprovado, a pessoa vai em *Conversas → Aparelhos → Aprovar*, digita o código (ou lê o QR), e esse aparelho abre o pedido, confere a chave, certifica o novo e lhe repassa a identidade embrulhada (`chat_aparelho_aprovar`). O aparelho pendente pergunta a cada cinco segundos se já foi aprovado. Os aparelhos dos colegas só embrulham chaves para aparelhos cujo certificado confere com a identidade que **eles** guardaram da pessoa (IndexedDB, "confiar na primeira vez"): quem tem a chave de serviço pode cadastrar um aparelho falso, mas não consegue assiná-lo, e nenhuma chave chega a ele (testes em `testar:banco`, seção "Confiança entre aparelhos"). O banco, por garantia extra, também não guarda embrulho para aparelho sem certificado. Pedido não atendido em um dia é descartado na faxina.

**Migração dos aparelhos de antes.** Conta sem identidade: o primeiro aparelho que abrir as conversas depois da atualização cria a identidade, se certifica e aprova sozinho os outros aparelhos antigos da conta (`chat_identidade_definir`), avisando a pessoa na lista de aparelhos: "não reconhece algum? remova". Daí em diante, todo aparelho novo passa pela aprovação.

**Código de segurança.** Em cada conversa (no alto da privada, ou em *Pessoas* no grupo), "código de segurança" mostra sessenta números (e um QR) derivados das duas identidades. Iguais nas duas telas quando ninguém trocou as chaves no caminho. Comparado pessoalmente, a pessoa marca "verificado"; a marca fica só no aparelho, nunca no banco.

**Quando a identidade de alguém muda** (recomeçou a identidade, ou alguém trocou a chave no banco), a conversa mostra "a chave de segurança de fulano mudou". Sem verificação, o aviso é dispensável e tudo segue; com verificação, o aviso fica em destaque e **nenhuma chave é entregue aos aparelhos novos da pessoa** até "Confirmar a chave nova".

**Assinatura do autor.** Cada mensagem leva, dentro do cifrado, a assinatura da identidade de quem escreveu (`s1.<assinatura>.<texto>`), presa à conversa, à versão da chave e ao autor. Quem lê confere com a identidade que conhece do autor: assinatura que não confere aparece como "não foi possível verificar o autor", não como se fosse da pessoa; mensagem de antes das assinaturas abre normalmente, marcada como sem assinatura.

**Rotação da chave.** Além de trocar quando alguém sai, a chave de uma conversa é trocada na próxima mensagem quando a atual tem mais de sete dias ou mais de mil mensagens (`lib/chaveiro.ts`): um aparelho tomado mais tarde não lê o passado inteiro. Não é sigilo perfeito por mensagem (Double Ratchet) nem MLS; ver o relatório `docs/RELATORIO-CHAT-E-CARGOS.md` para a recomendação.

**Cópia de recuperação.** Em *Conversas → Aparelhos → Cópia de recuperação*, a pessoa gera uma chave de 32 letras (mostrada uma única vez, para anotar) e o aparelho guarda no banco (`interno.chat_recuperacoes`) a identidade e as chaves de conversa que conhece, cifradas com ela (PBKDF2 + AES-GCM, no aparelho). Num aparelho novo, "Tenho a chave de recuperação" restaura a identidade sem outro aparelho, e os colegas não veem mudança nenhuma. Sem a chave, quem perde todos os aparelhos usa "Recomeçar a identidade": os aparelhos antigos saem, a identidade muda e os colegas veem o aviso. O banco guarda só o cifrado e nunca vê a chave.

O limite, dito com franqueza: quem altera o JavaScript servido pelo site (hospedagem, repositório, DNS) pode roubar chaves de quem abrir o painel; um aparelho desbloqueado lê tudo o que a pessoa lê; e o banco continua vendo quem fala com quem, quando e quanto (metadados), mesmo sem ler o conteúdo. Para testar a aprovação com dois "aparelhos" numa máquina só, abra o painel em `http://localhost:3100` e em `http://127.0.0.1:3100` (origens diferentes guardam chaves diferentes; `next.config.ts` libera a segunda só em desenvolvimento).

**O que vai dentro da mensagem.** Responder citando, encaminhar, mencionar com @nome, a prévia de link e o emoji de uma reação viajam *dentro* do cifrado, num pacote `j1.{…}` montado por `lib/mensagem.ts` antes de assinar e cifrar; o banco não vê nada disso. O que o banco sabe é só o tipo da linha (`texto`, `reacao` ou `edicao`) e, nas duas últimas, qual mensagem é o alvo (`interno.conversa_mensagens.tipo`/`alvo`): assim ele consegue garantir no servidor que só a autora edita (e só até 15 minutos depois de enviar, erro `fora_do_prazo`), que cada pessoa tem uma reação por mensagem (a nova troca a anterior) e que apagar o texto leva as reações e edições junto. A tela junta tudo (`Vista` em `components/painel/Conversas.tsx`): a última edição vale pelo texto, com a marca "Editada"; a citação é guardada com o trecho citado, então continua legível mesmo se a original sumir, e tocar nela rola até a mensagem.

**Formatação, menções e prévia de link.** `*negrito*`, `_itálico_`, `~tachado~`, `` `mono` `` e listas (`- ` ou `1. `) são lidos no aparelho (`formatar` em `lib/mensagem.ts`) e viram elementos do React (`components/painel/Formatado.tsx`): nada do texto vira HTML. `@nome` (primeiro nome ou nome inteiro, sem acento) marca a pessoa; quem é mencionado vê a mensagem com borda dourada e a conversa com a marca "@" na lista. A prévia de link é feita **só com o endereço** (domínio e última parte do caminho), no aparelho de quem envia: a política de segurança do painel não deixa o navegador buscar outros sites, e o servidor nunca busca o link. Testes: `npm run testar:mensagens`.

**Entrega, leitura e "digitando…".** O primeiro tique é a mensagem no banco; o segundo, quando o aparelho da outra pessoa a abriu (`chat_recebidas`, por conversa); os tiques dourados e o "Lida por" dos grupos vêm de `conversa_membros.lido_em`. "Está digitando…"/"gravando áudio…" é um aviso por conversa (`chat_digitando`, no máximo um a cada quatro segundos) que vale por oito segundos. Em *Minha conta → Privacidade nas conversas* cada pessoa esconde o "visto por último" e a confirmação de leitura (`perfil_preferencias`); quem esconde também deixa de ver o dos outros, e o servidor é quem corta (`chat_ver`, `chat_conversas`, `equipe_membros`), não a tela.

**Rascunho, fixadas, favoritas e seleção.** O rascunho de cada conversa fica no `localStorage` do aparelho e some ao enviar. Fixar é da conversa (todos veem, no máximo cinco, `interno.conversa_fixadas`); favoritar é de cada pessoa, em todos os aparelhos dela (`interno.conversa_favoritas`, botão ★ na lista). "Selecionar" marca várias mensagens para encaminhar (cifrando de novo para cada conversa de destino, com a marca "Encaminhada") ou apagar as suas.

**Arquivos: foto, vídeo, áudio, PDF e DOCX.** Cada arquivo é cifrado neste aparelho com uma chave só dele (AES-GCM-256 do WebCrypto, presa à conversa pelo AAD) e sobe já cifrado para `interno.conversa_anexos` (base64 → bytea, `chat_anexo_enviar`); a chave, o vetor e o SHA-256 do conteúdo vão *dentro* da mensagem, que é assinada e cifrada com a chave da conversa. O banco guarda só bytes cifrados, o tamanho e a quem pertence: nem tipo, nem nome, nem legenda. O arquivo sobe antes e é preso à mensagem em `chat_enviar` (`p_anexos`); o que ficar solto por uma hora some na faxina, e tudo some junto com a mensagem (apagar, autodestruição, trinta dias, "apagar tudo"). Quem recebe baixa (`chat_anexo_ler`, só quem está na conversa), abre e confere o resumo contra o que veio na mensagem assinada (`lib/anexos.ts`); se não bater, não mostra. Limites: 12 MB por arquivo e seis por mensagem, conferidos no aparelho e no banco. O tipo é descoberto pelos primeiros bytes, nunca pela extensão (`identificar`); HTML, executável e o resto são recusados antes de cifrar. Fotos são redesenhadas no canvas antes de sair (somem os dados embutidos pela câmera: local, aparelho, autor) e podem ser cortadas, riscadas ou borradas (o borrão reduz o trecho a blocos; o que estava ali não volta). Áudio: segure o botão para gravar, "Travar" para gravar sem segurar, ouça antes de enviar; a forma de onda é calculada no aparelho e vai dentro da mensagem; toca em 1×, 1,5× e 2×. PDF abre no leitor do próprio navegador (quadro `blob:`, liberado em `frame-src`); DOCX é convertido aqui mesmo pela biblioteca `mammoth` e mostrado num quadro `sandbox` sem permissão nenhuma. Ctrl+V e arrastar sobre a caixa anexam. "Ver uma vez" (foto e vídeo): quem enviou não relê, cada pessoa abre uma única vez e o banco apaga os bytes quando todos abriram (ou em catorze dias); não entra na galeria. "Arquivos", no cabeçalho, é a galeria da conversa (montada a partir das mensagens abertas neste aparelho). Encaminhar um arquivo baixa, abre e cifra de novo com chave nova para a conversa de destino. **Sem transcrição de áudio**: a única API de reconhecimento de voz dos navegadores manda o som para o servidor do fabricante, e a regra é "no aparelho ou nada". Testes: `npm run testar:anexos` (cifra, tipos, limites) e a seção "Arquivos nas conversas" em `testar:banco`.

**Organização.** Cada pessoa fixa no alto, arquiva, silencia (8 horas, 7 dias ou para sempre), marca como não lida e tranca cada conversa (`interno.conversa_prefs`, `chat_conversa_marcar`); vale em todos os aparelhos dela e os outros não veem. A lista tem os filtros Todas, Não lidas, Grupos e Fixadas, e as arquivadas ficam atrás de um botão (mensagem nova desarquiva). Silenciada não conta no painel (`presenca`). A **busca** é só no aparelho: o que ele já abriu entra num índice local (`lib/busca-local.ts`, IndexedDB `lucia-busca`, MiniSearch), apagado ao sair da conta e podado em trinta dias; o servidor não procura no que não lê. **Avisos do navegador** (`lib/notificacoes.ts`): sem prévia, por escolha em *Minha conta* (nenhum, "chegou mensagem" ou "chegou mensagem de Fulana"); nascem no próprio aparelho com o painel aberto, não há serviço de push. **Trava com a digital** (`lib/trava.ts`): reaproveita a chave de acesso já cadastrada para entrar; pede ao navegador uma assinatura com verificação do usuário e não manda nada a lugar nenhum. É trava de tela, contra o aparelho destravado nas mãos de outra pessoa: vale ao abrir as conversas (preferência do aparelho) e, nas conversas trancadas uma a uma, a cada vez. Não existe no ambiente local (sem passkey).

**Grupos.** Quem cria é administrador (`conversa_membros.admin`); administradores põem e tiram gente, promovem e rebaixam (o último não se rebaixa; se sair, quem está há mais tempo assume), e definem as permissões: "só administradores mudam nome, descrição e foto" (ligada por padrão) e "só administradores mandam mensagem" (os outros reagem e votam; o banco barra, `so_admins`). A coordenação administra qualquer grupo em que esteja. Nome e descrição ficam em claro no banco (são metadados, como o nome já era); a **foto do grupo** é uma mensagem com a imagem, cifrada como qualquer outra, para a qual o grupo aponta (`conversas.foto`). **Avisos do sistema** ("Fulana entrou", "mudou o nome", "ligou a autodestruição") são linhas `tipo = 'sistema'` que o banco escreve com `detalhe` em claro, sem cifra, porque são metadados que ele já conhece; ninguém as apaga. **Enquete e evento** vão dentro do cifrado (`enquete`, `evento` em `lib/mensagem.ts`); o voto (`tipo = 'voto'`) e a resposta ao evento (`tipo = 'rsvp'`, vou/talvez/não) são linhas apontando para a mensagem, uma por pessoa (a nova troca a anterior, como a reação), com o conteúdo cifrado. **Relato à coordenação**: a pessoa seleciona mensagens, o aparelho dela as abre e manda o texto legível, com o motivo e sobre quem, para `interno.conversa_relatos` (`chat_relatar`); só quem gere a equipe lê (`chat_relatos`, botão ⚑) e resolve com uma nota. É a única porta pela qual alguém lê conteúdo de uma conversa de que não participa, e só o que quem relatou escolheu; o aparelho avisa isso antes de enviar. Relatos resolvidos somem em um ano.

**Uso só profissional.** Conversa privada só com a liderança (coordenação, vice, supervisão) ou entre quem colabora numa contribuição pendente (`interno.privado_permitido`); o resto é nos grupos. A coordenação vê quem está em privado em `chat_privadas`, sem conteúdo. No painel inteiro, cada pessoa vê as outras pelo primeiro nome (`interno.nome_visto`); nome completo e e-mail só para a coordenação. O **representante** (`papel = 'representante'`, `disciplina` = o departamento) administra o grupo do próprio departamento (`interno.chat_admin`) sem poder sobre funções.

**Consenso antes de ir ao ar.** `contribuicao_decidir` só aprova aula ou avulso com parecer favorável de outro educador da mesma disciplina (ou da liderança, se não houver outro), e quem aprova não pode ser o autor nem quem deu o parecer (`interno.consenso_de_aula`).

O **Mural da equipe** é um mural de publicações e comentários, com um canal para todos, um por função e um de pedidos de ajuda entre funções, e a lista de quem está na equipe ao lado. Ele usa a mesma cifra: cada canal é cifrado com a chave do grupo do departamento correspondente ("Todos" e "Pedidos de ajuda" usam a do grupo da equipe toda). Tudo some sozinho depois de trinta dias, e o coordenador tem o botão "Apagar todas as conversas agora".

### Imagens e arquivos

Quem envia uma imagem ou um PDF não publica sozinho: o arquivo aparece no **Mural da equipe** para os colegas olharem e apoiarem. Com dois apoios, a coordenação pode aprovar (o coordenador pode aprovar sem esperar; recusar, qualquer um dos dois pode).

### Sucessão

A coordenação indica, na aba **Segurança e sucessão**, uma lista ordenada de sucessores. Se o coordenador ficar **90 dias** sem entrar no painel, a coordenação passa sozinha para a primeira pessoa da lista que tenha entrado nos últimos 30 dias; o antigo coordenador vira vice. A troca fica no registro de atividades e todos da coordenação são avisados. O coordenador também pode passar o cargo na hora, pelo mesmo painel.

A sucessão do banco não resolve a da **infraestrutura**: domínio, hospedagem, Cloudflare, Supabase e repositório estão em contas pessoais. Guarde essas senhas em um gerenciador com acesso de emergência para a pessoa de confiança.

### Registro de atividades

Toda decisão (aprovar, recusar, dar ou tirar função, suspender, mudar configuração, emitir certificado, passar a coordenação) é gravada com autor, data e o que mudou. A coordenação lê na aba **Registro de atividades**. Ninguém apaga nem edita o registro pelo painel; a faxina automática (seção 6, item 12) descarta só o que tem mais de 400 dias.

Ao lado dele, na mesma aba, fica o **Livro do acervo** (tabela `interno.audit_logs`). Esse não depende de nenhuma função lembrar de anotar: um gatilho do banco escreve uma linha a cada inclusão, edição, aprovação, recusa, publicação ou exclusão em `contribuicoes`, `arquivos`, `materiais` e `papeis`, com a data, a conta e por onde a mudança entrou (painel, rotina de publicação ou direto no SQL Editor). Guarda o título e o nome dos campos que mudaram, nunca o texto. Um segundo gatilho recusa editar, apagar ou esvaziar a tabela, até para o dono do banco; só sai o que passou de 400 dias. Quem tem a senha do banco ainda consegue desligar o gatilho: contra isso valem as cópias de segurança do Supabase, não o livro. Para vigiar outra tabela, acrescente o nome dela na lista da seção *Livro do acervo* do `install.sql`.

### E-mails automáticos

O site manda sozinho os e-mails de que as pessoas precisam: a confirmação de que a candidatura a voluntário chegou (e um aviso para a coordenação), o convite de quem foi aceito (o link pessoal vai direto para o e-mail da pessoa), o aviso de pedido recusado, a confirmação do pedido de reforço, o link de confirmação do boletim e as edições do boletim, que o jornalismo escreve e envia pelo painel (**Boletim do jornal**), cada uma com o link de saída da lista.

Como funciona: o banco põe cada e-mail numa fila (`interno.emails`, fechada como as outras tabelas). A rotina **Enviar e-mails** (`.github/workflows/emails.yml`) roda de dez em dez minutos, pega a fila com a chave de serviço e envia pelo Resend. Depois que um e-mail sai, o texto dele é apagado do banco. O mesmo endereço recebe no máximo três e-mails do mesmo tipo por dia, para ninguém usar os formulários para encher a caixa de outra pessoa. A situação (quantos esperam, saíram e falharam) aparece em **Controles do site**.

Para ligar, uma vez só:

1. Crie uma conta em resend.com e acrescente o domínio `institutolucia.org` em **Domains**. O Resend mostra três ou quatro registros de DNS (SPF, DKIM e, se quiser, DMARC): copie cada um para **Cloudflare → DNS** do domínio, com a nuvem laranja **desligada** (só DNS). Espere o Resend marcar o domínio como verificado.
2. Gere uma chave em **API Keys** com permissão só de envio (*Sending access*), restrita ao domínio.
3. No GitHub, em **Settings → Secrets and variables → Actions**: segredo `RESEND_API_KEY` com a chave; variável `EMAIL_REMETENTE` com `Instituto Lúcia <noreply@institutolucia.org>`; variável `EMAIL_RESPOSTA` com `institutolucia@tutamail.com`; variável `EMAILS` com `sim`. Os segredos `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem (são os da publicação).
4. Respostas: os e-mails saem de `noreply@institutolucia.org`, endereço que não recebe nada, e levam `institutolucia@tutamail.com` como "responder para". Quem clica em responder escreve direto para a caixa do instituto. O Email Routing do Cloudflare não é necessário para isso; ele só serviria para criar caixas de entrada com o domínio do site.
5. Rode o `supabase/install.sql` no SQL Editor (ele cria a fila e liga os envios no banco).
6. Em **Actions → Enviar e-mails → Run workflow**, rode uma vez e confira o registro: "N enviado(s)".

Os e-mails da própria entrada (confirmar o cadastro, trocar a senha) não passam por aqui: quem manda é o serviço de contas. O servidor de e-mail padrão do Supabase manda pouquíssimos por hora e só serve para teste. Com o cadastro aberto, use o mesmo Resend em **Supabase → Authentication → SMTP Settings** (servidor `smtp.resend.com`, porta 465, usuário `resend`, senha = uma chave do Resend, remetente `noreply@institutolucia.org`).

## 7. Como uma contribuição vira página

1. Alguém envia (pela página Contribuir ou pelo painel). O banco confere tamanho, campos, fonte obrigatória e limite de envios.
2. Se veio de fora da equipe, a mediação faz a triagem: libera para a fila de revisão ou barra.
3. A coordenação ou a curadoria aprova no painel. Nada muda no site ainda.
4. De hora em hora, a rotina **Publicar contribuições aprovadas** roda `scripts/sincronizar.mjs`: busca os itens aprovados, confere tudo de novo, grava os arquivos em `content/`, monta o site para validar e registra a mudança no histórico. Aulas e materiais avulsos levam junto as questões de fim de aula (`quiz`), quando o educador as escreveu; a prática de idioma aprovada entra no cabeçalho da aula já existente (`pratica`), como a tradução.
5. Só então o painel marca o item como publicado.

**Imagens e PDFs** seguem o mesmo caminho. Quem envia uma imagem pelo editor tem o arquivo refeito no próprio navegador (vira WebP novo, sem localização, sem modelo de câmera, sem nome de autor) antes de sair do aparelho. O arquivo fica em um depósito fechado até a curadoria aprovar. Na publicação, a rotina baixa só os aprovados, confere pelos primeiros bytes se o arquivo é mesmo o que diz ser, recusa imagem que ainda traga dados embutidos, limpa os PDFs e grava em `public/arquivos/` com um nome derivado do conteúdo. **Vídeo não é hospedado:** a aula aponta para o endereço do vídeo, que só carrega quando a pessoa clica.

Para publicar na hora, rode a rotina manualmente. Para pausar as publicações, apague a variável `PUBLICAR`.

## 8. Segurança: o que protege o quê

- **Tabelas fechadas.** Ficam no esquema `interno`, sem nenhuma permissão direta. A única entrada são as funções do esquema `public`, e cada uma confere quem está chamando.
- **Chaves.** A chave *anon* é pública por natureza e não abre nada sozinha. A *service_role* existe só nos segredos das rotinas automáticas (publicação e e-mails) e, dentro delas, só nos passos que falam com o banco: a instalação dos pacotes e o build rodam código de terceiros e não a enxergam. Pelo mesmo motivo, o token de escrita do GitHub só existe no passo que faz o push da publicação.
- **Texto, não código.** O conteúdo é Markdown sem HTML; links só http(s); imagens só as que estão em `public/arquivos/` e `public/imagens/`. Os cabeçalhos de segurança (`next.config.ts`) impedem scripts de fora.
- **Limites.** Envios anônimos têm limite por origem, campo-isca contra robôs e tamanho máximo. A entrada (pedido de link, senha da equipe e cadastro) passa pela verificação do Turnstile, conferida pelo próprio serviço de contas. Os formulários abertos (contribuir, mural, denúncia, reforço) são protegidos pelo limite de envios e pelo campo-isca, dentro do banco.
- **Segundo fator** para as funções com poder de decisão (seção 6) e **aviso de aparelho novo**: quando uma conta da equipe entra de um aparelho que nunca usou, a pessoa e a coordenação são avisadas no painel.
- **Iscas.** Endereços que só robôs de invasão procuram (`/wp-admin`, `/.env`, `/phpmyadmin`, arquivos `.php`, `.sql`, `.bak`…) respondem "não encontrado" sem gastar nada, e a visita fica no **Registro de atividades** como `isca` (só o caminho e o programa usado, sem endereço de rede, por trinta dias). No banco existem funções com nomes tentadores (`exportar_usuarios`, `admin_senhas`, `chaves_api`) que não devolvem nada: quem chama fica registrado e a coordenação é avisada.
- **Filtro do que vem de fora.** Na comunidade, a avaliação automática publica o que é adequado, barra as expressões graves e manda para a fila de revisão o que tem termo da lista vetada ou outro sinal de dúvida. Nos envios de quem não tem conta (anúncio do mural, pedido de reforço, contribuição), o texto com termo vetado é recusado na hora; o reforço também recusa endereços de sites e nomes de arquivos. A lista se edita na aba **Comunidade**, em *Filtro de palavras*. Filtro de palavra é a primeira barreira, não a única: anúncio do mural e contribuição de fora não vão ao ar sem uma pessoa da equipe ler, e na comunidade a mediação acompanha o que foi publicado.
- **Pouco para roubar.** O banco não guarda senha (isso é do serviço de contas), endereço, documento nem telefone. O nome público padrão é um codinome ("Estudante 12345"). Um vazamento exporia e-mails e mensagens, e é por isso que a regra é guardar o mínimo.
- **Interpretadores isolados.** Python e PHP rodam no navegador de quem usa, dentro de um Worker sem acesso à página.

### Se algo der errado

| Situação | O que fazer |
| --- | --- |
| Foi publicado algo indevido | Reverta o registro de publicação no histórico. O site volta ao estado anterior. |
| Conta de voluntário comprometida | No painel, aba Voluntários: suspenda a conta e retire as funções. Confira no registro de atividades o que ela fez. |
| A coordenação perdeu o segundo fator | Rode no SQL Editor o comando da seção 6, item 11, entre e cadastre um aparelho novo. |
| Alguém caiu em uma isca | Está no registro de atividades, com a conta e a hora. Se for conta da equipe, trate como conta comprometida. |
| Suspeita de invasão do banco | Desative a rotina de publicação. No Supabase, gere chaves novas (**API → Roll keys**), atualize as variáveis e os segredos. O acervo não é afetado. |
| Banco perdido | Crie outro projeto e rode `supabase/install.sql`. Perdem-se contas, fila e conversas; o conteúdo publicado continua intacto. |
| Enxurrada de contribuições falsas | Recuse em lote no painel; a rotina publica no máximo 25 itens por rodada, e só os aprovados. |
| Chuva de spam que a mediação não dá conta | Painel → **Interdição e expurgo**: interdite a área e use o expurgo (seção abaixo). |
| O site está fora do ar e o painel não abre | Rode no SQL Editor: `update interno.configuracoes set valor = valor \|\| '{"geral": false, "areas": []}'::jsonb where chave = 'interdicao';`. Em até meio minuto o site volta. |

### Interdição e expurgo

**Quando usar.** A interdição tira do ar, por um tempo, o site inteiro ou só algumas áreas (Comunidade, Mural, Reforço, Contribuir, Rádio, Acervo, Disciplinas, Ferramentas e as outras da lista em `lib/interdicao.ts`): para manutenção, ou quando uma área virou caos e nem a avaliação automática nem a mediação dão conta. Nada é apagado. O expurgo é o contrário: apaga de uma vez o que o público escreveu (conversas, respostas e votos da Comunidade, anúncios do Mural, anotações das aulas, pedidos de reforço não concluídos, contribuições esperando a triagem, trabalhos da Gaveta Aberta) num período escolhido (última hora, 6 h, 24 h, 7 dias ou tudo). Não tem volta.

**Quem faz.** Coordenação e vice-coordenação aplicam direto, com motivo (vai para o registro e para o aviso à liderança). A supervisão não aplica: faz um **pedido** com justificativa, que só vale quando a coordenação ou a vice aprovar, com os dados que estavam no pedido; pedido parado vence em 72 horas. Tudo fica em *Interdição e expurgo*, com a fila de pedidos e o histórico.

**O que o público vê.** Caminho fechado mostra uma página mínima, sem cabeçalho nem menu, dizendo que aquela parte (ou o site) está fora do ar por um tempo, com o recado escrito pela coordenação e um link discreto "Equipe: entrar". A resposta é 503, com `Retry-After` e sem cache; o endereço não muda. Quem decide isso é o `proxy.ts`, que lê o estado na função pública `site()` e guarda por meio minuto: a mudança chega a todos em até 30 segundos. Se o banco não responder, o site abre normalmente (o banco nunca derruba o acervo). Ficam sempre abertos `/entrar`, `/painel` e os arquivos (ícones, `manifest`, `sw.js`, `.well-known/assetlinks.json`). Com o site inteiro fora do ar, os serviços em `/api/` também param.

**No banco.** Cada função pública da área fechada recusa o público com `area_interditada` (o site mostra a mensagem nos cinco idiomas); quem cuida da área (mediação na Comunidade, jornalismo na rádio, a equipe nas contribuições) continua lendo e limpando pelo painel. O estado mora em `interno.configuracoes` (chave `interdicao`).

**No aplicativo e sem internet.** O app Android é o próprio site: vale o mesmo. O modo sem internet (`public/sw.js`) busca a rede primeiro; com a interdição ligada e a pessoa online, aparece a página fechada (o 503 nunca é guardado). Sem internet, o aparelho continua mostrando as páginas que já tinha guardado.

**Como desfazer.** Em *Interdição e expurgo*, "Reabrir tudo agora" (ou desmarcar as áreas e aplicar). Se o painel não abrir, o comando SQL da tabela acima reabre tudo.

**Área nova.** Acrescente em `lib/interdicao.ts` (nome e caminhos) e em `interno.areas_publicas()` no `install.sql`, e ponha `perform interno.aberta('<área>')` no começo das funções públicas dela. `npm run testar:interdicao` falha se as duas listas divergirem ou se uma rota de `app/[lang]` não pertencer a nenhuma área.

## 9. Roteiros de apoio

| Roteiro | Para que serve |
| --- | --- |
| `preparar.mjs` | copia os interpretadores de Python e PHP para `public/` (roda sozinho após `npm install`) |
| `banco-local.mjs`, `backend-local.mjs`, `dev-local.mjs` | banco de teste em memória para desenvolver o painel |
| `testar-banco.mjs` | instala o banco do zero e testa cada permissão |
| `sincronizar.mjs` | leva as contribuições aprovadas para `content/` e os arquivos aprovados para `public/arquivos/` |
| `gerar-epub.mjs` | monta um livro digital (EPUB) de cada trilha com aula escrita, em `public/epub/`; roda sozinho antes de `npm run build` |
| `proximo.mjs` | mostra o que falta escrever |
| `importar-catalogo.mjs` | refaz o catálogo ampliado a partir do Project Gutenberg (só autores em domínio público no Brasil) e do Arquivo Marxista. As disciplinas das lutas sociais ficam de fora da importação automática: nelas, cada obra é escolhida à mão |
| `cabecalho.mjs` | leitura e escrita do cabeçalho dos arquivos de conteúdo, usada pelos outros roteiros |
| `conferir-i18n.mjs` | compara os cinco dicionários |
| `conferir-links.mjs` | testa os endereços citados no conteúdo |
| `testar-interdicao.mjs` | confere a lógica de caminhos da interdição e que a lista de áreas do site é a mesma do banco |
| `testar-ferramentas.mjs` | confere as contas das ferramentas práticas (resolvedor, unidades, química, genética, estatística, lógica e as demais) |
| `testar-assistente.mjs` | confere, sem rede e sem chave, o pedido e a leitura da resposta do assistente de reforço |

## 10. Antes de publicar uma mudança

```bash
npm run lint
npm run typecheck
npm run conferir:i18n
npm run testar:banco
npm run testar:interdicao
npm run testar:ferramentas
npm run testar:assistente
npm run build
```

Mudou a interface? Rode `npm run dev:local` e confira no navegador, inclusive no tamanho de celular e nos cinco idiomas. No banco de teste, o código do segundo fator é sempre `123456`.

O modo sem internet (`public/sw.js`) só funciona no site montado (`npm run build` e `npm run start`), nunca no modo de desenvolvimento. Se mudar o que ele guarda, troque o número da versão no começo do arquivo, senão os aparelhos continuam com a cópia antiga.

## 11. Rádio

O tocador tem duas partes. As **rádios populares** vêm de `content/radios.json`: só entram emissoras com transmissão aberta em https, conferida na hora de cadastrar; as que não deixam tocar de fora aparecem como link para o site delas. Rode `npm run conferir:links` de tempos em tempos, porque endereço de transmissão muda sem aviso.

A **rádio própria** fica "Em breve" para o público até a coordenação clicar em **Pôr no ar** na aba Rádio do painel. Os áudios são enviados pelo próprio painel ou indicados por endereço https (o site é servido em https e o navegador não toca áudio http dentro dele; o banco recusa). Só publique gravações próprias, em domínio público ou com licença que permita a transmissão: música comercial exige licenciamento.

## 12. Apoio financeiro

O endereço da campanha fica em `lib/site.ts`. O mural de apoiadores é preenchido pela coordenação na aba Apoiadores do painel; só entra o nome de quem autorizou.

## 13. Voluntariado, horas e certificados

O voluntário aceita no painel um termo de adesão baseado na Lei nº 9.608/1998 (serviço voluntário: sem salário e sem vínculo de emprego). A partir daí a plataforma conta sozinha as horas do trabalho feito no painel (`interno.horas_apurar`, em `supabase/install.sql`): aula aprovada, parecer, tradução, decisão de curadoria, triagem, reforço concluído, episódio publicado e os demais tipos de `interno.horas_tabela()`. Cada trabalho conta uma vez (a coluna `fonte` impede repetição), no dia em que terminou, até 12 h por dia somando tudo, e entra já confirmado. O coordenador ajusta quanto vale cada tipo na *Tabela de horas* do painel (vale dali em diante); coordenação e vice podem desconsiderar uma linha que ainda não esteja em certificado. O que a pessoa faz fora do painel ela registra à mão, e a coordenação confere. Quando quer o certificado, o voluntário escolhe o período e clica em *Pedir certificado*: coordenação e vice são avisadas no painel e por e-mail, e o pedido chega com as horas do período e um resumo das atividades pronto. O coordenador usa *Preparar o certificado* (o formulário de abertura vem preenchido) ou responde sem abrir, com uma nota que a pessoa lê no painel. O certificado de horas é aberto pelo coordenador (nunca para si mesmo) e leva sempre **três assinaturas eletrônicas**: a de um educador, a do vice-coordenador e, por último, a do coordenador, que é a emissão. Cada um assina na própria conta, em *Horas e certificados*; fica guardado quem assinou, em nome de que função, o dia e a hora. Ninguém assina o próprio certificado, e sem vice-coordenador nomeado não se emite. A folha é única (`components/painel/Certificado.tsx`, estilo em `app/globals.css`): A4 deitada, salva em PDF pelo navegador, com o número do certificado e uma impressão digital (SHA-256) do que ele afirma. É assinatura eletrônica simples, feita dentro do site; quem precisar de mais força pode, além disso, assinar o PDF em um serviço de assinatura como o do gov.br. Qualquer pessoa confere a autenticidade em `/certificado`, com o código impresso.

Enquanto o instituto não tiver CNPJ, o certificado é uma **declaração de um projeto comunitário**, assinada por pessoa física. Vale como comprovação de atividade; cada escola ou empresa decide se aceita como hora complementar. Não prometa mais do que isso.

## 14. Aviso de abertura e período eleitoral

O aviso que aparece ao abrir o site sai de `content/abertura.json`, tem data para sumir sozinho e só aparece em português. A coordenação pode trocá-lo ou desligá-lo na aba **Aviso de abertura**, sem publicar o site de novo.

Manifestação de apoio a candidatura na internet é livre para pessoa física, mas a lei eleitoral proíbe o anonimato: o aviso precisa dizer quem assina. Propaganda eleitoral em site de **pessoa jurídica** é proibida: se o instituto virar associação com CNPJ, esse tipo de aviso sai do ar. No dia da votação, não se publica conteúdo novo de campanha. Nada de ofensa a adversário: fato documentado e linguagem sóbria.

## 15. Mural dos Trabalhadores

Qualquer pessoa anuncia, sem conta: escolhe o tipo, escreve o ofício, o título, a descrição, a **cidade**, o **estado** e o contato. O anúncio passa pelo filtro de palavras e fica esperando: **a coordenação (coordenador e vice) e a mediação aprovam**, na seção **Mural dos Trabalhadores** do painel. Aprovado, fica no ar por 180 dias; tirar do ar antes disso é com a coordenação, na aba **No ar**. Quem anunciou sem conta recebe um código para retirar o anúncio quando quiser. Quem procura filtra por estado, cidade, tipo e palavra.

## 15a. Gaveta Aberta

A **Gaveta Aberta** (`/gaveta`, "trabalhos de estudantes, livres para todos") é onde estudantes publicam trabalhos próprios que ficaram parados: TCC, monografia, artigo, projeto, relatório, apostila, código. Quem publica precisa de conta (participante da comunidade já serve), escreve um comentário sobre o trabalho, escolhe a licença (CC BY 4.0, CC BY-SA 4.0 ou CC0 1.0) e o nome do crédito, e aceita o **termo de cessão** (`content/paginas/gaveta-termo.md`, também em `/gaveta/termo`) digitando o nome completo. O trabalho chega por um link https (repositório da universidade, Zenodo, GitHub…) ou por um PDF de até 10 MB.

- **Nada aparece antes da mediação.** A fila fica em *Gaveta Aberta*, no painel (mediação, curadoria, coordenação e vice). Quem decide confere o link ou abre o PDF, olha se não há dados de outras pessoas (nem nas propriedades do arquivo) e publica ou recusa com nota; quem publicou recebe um recado. Uma ficha já publicada também pode ser tirada do ar por quem decide.
- **O PDF** vai para o depósito fechado `gaveta` do Supabase, na pasta da própria pessoa, com nome sorteado. Só a própria pessoa e a equipe que decide o leem; depois da aprovação, qualquer pessoa baixa (a regra do depósito consulta a tabela por `interno.gaveta_le`). O site entrega o arquivo com o título como nome.
- **O nome completo do termo** fica só com a equipe que decide e a coordenação; nunca aparece no site.
- **Quem publicou tira a ficha do ar** em "Minhas publicações": a ficha some e o PDF é apagado do depósito. Quem já copiou continua podendo usar, pela licença.
- Valem a pausa geral de envios, os banimentos (banir recusa o que a conta tinha esperando na Gaveta), o filtro de palavras e o limite de cinco envios por dia. A Gaveta é uma área da interdição (`gaveta`) e do expurgo.
- **Mudou o termo?** Escreva a versão nova em `gaveta-termo.md`, troque a versão em `lib/gaveta.ts` (`TERMO_VERSAO`) e em `interno.gaveta_termo_versao()` no `install.sql`, e rode o `install.sql` de novo. `npm run testar:interdicao` confere que as duas versões batem. Envios feitos com a versão antiga continuam com ela registrada.
- **O nome "Gaveta Aberta"** mora só nos textos (`drawer` nos dicionários e os rótulos do painel): trocar o nome não mexe no banco.

## 15b. Assistente de reforço

Quando não há voluntário, quem tem conta pode tirar a dúvida com um **assistente automático**: um quadro "Sem voluntário agora? Pergunte ao assistente" na página de reforço e o botão **Foto do exercício** no resolvedor passo a passo (a foto é lida, o enunciado transcrito e, se for uma conta que o resolvedor entende, dá para refazê-la ali mesmo, passo a passo, sem IA). Ele usa o **Claude, da Anthropic**, um serviço **pago por pergunta**, e por isso **nasce desligado**.

Sempre ligadas, sem custo e sem mandar nada para fora: as **sugestões de aulas e verbetes** que aparecem na página de reforço enquanto a pessoa escreve (é o índice da busca do próprio site, filtrado pela disciplina).

- **Como funciona.** O navegador chama a função `assistente` (em `supabase/functions/assistente/`). Antes de gastar qualquer centavo, ela pergunta ao banco (`assistente_usar`, com a sessão de quem pergunta): conta ativa, assistente ligado, aula de reforço não interditada, envios não pausados e vaga no limite da pessoa e no teto do site. Só com o "sim" ela chama o serviço. Se o serviço falhar, a pergunta não é descontada da pessoa.
- **O que fica guardado.** Só quantas perguntas cada conta fez em cada dia (`interno.assistente_uso`, apagado depois de 90 dias). Pergunta, foto e resposta não passam pelo banco nem pelo registro da função; o registro diz só o tipo de falha.
- **O que vai para fora.** A dúvida, o assunto, a disciplina, o idioma, os títulos e endereços das aulas sugeridas e, se houver, a foto (redesenhada e reduzida no aparelho, sem os dados embutidos). Nome, e-mail, conta e endereço de rede não vão. O texto para a página de privacidade está em `docs/privacidade-assistente.md` e entra **no mesmo dia em que o assistente for ligado**, nem antes nem depois.
- **O comportamento.** O roteiro fixo do assistente (o "prompt de sistema") fica em `supabase/functions/assistente/assistente.ts`, constante `SISTEMA`: explica passo a passo, no espírito da educação popular, sem esconder a resposta; recomenda só aulas do próprio site; não inventa fonte; em saúde, direito e segurança orienta e manda procurar o serviço (192/SAMU em emergência, CVV 188). Mudou o texto? Rode `npm run testar:assistente` e publique a função de novo.
- **O painel.** *Controles do site → Assistente de reforço* (só coordenação e vice): ligar e desligar, perguntas por pessoa por dia (padrão 10), teto do site inteiro por dia (padrão 200; é o freio de gasto), botão **Testar agora** (uma chamada de verdade, curtinha), e a situação: função e chave, serviço respondendo, última pergunta de verdade, perguntas de hoje e da semana. Ligar avisa a liderança e fica no registro de atividades. A supervisão não liga nem desliga (é dinheiro), mas a interdição da aula de reforço e a pausa de envios também param o assistente.

**Quanto custa.** O serviço cobra por pedaço de texto ("token") que entra e que sai. Com o modelo padrão, `claude-opus-5-5` (US$ 4 por milhão de tokens de entrada e US$ 20 por milhão de saída), uma dúvida típica gasta cerca de 1.500 tokens de entrada e de 1.000 a 3.000 de saída (contando o raciocínio do modelo): **algo entre US$ 0,03 e US$ 0,07 por pergunta**; a foto acrescenta perto de US$ 0,01. Com o teto padrão de 200 perguntas por dia, o pior dia fica perto de US$ 15. São estimativas: o gasto de verdade aparece no Console da Anthropic. Para gastar menos, troque o modelo pelo segredo `ASSISTENTE_MODELO`: `claude-sonnet-5-5` custa metade do padrão; `claude-haiku-5-5` (US$ 0,10 e US$ 0,50 por milhão) sai por cerca de um décimo de centavo de dólar por pergunta, com explicações mais simples. Outro nome no segredo é ignorado e volta o padrão. Além do teto do painel, ponha um **limite de gasto mensal** na própria conta da Anthropic.

Para ligar, nesta ordem:

1. Crie uma conta de API no Console da Anthropic (platform.claude.com), cadastre a forma de pagamento, ponha o limite de gasto mensal e gere uma chave.
2. Rode o `supabase/install.sql` no SQL Editor (cria a tabela de contadores e as funções).
3. Guarde a chave como segredo da função, nunca em arquivo do projeto: `supabase secrets set ANTHROPIC_API_KEY=...` (ou **Edge Functions → Secrets** no painel). Opcional: `supabase secrets set ASSISTENTE_MODELO=claude-haiku-5-5`.
4. Publique a função: `supabase functions deploy assistente`. Ela baixa sozinha o SDK oficial da Anthropic (versão fixa, `@anthropic-ai/sdk@0.133.0`).
5. No painel, ainda desligado, aperte **Testar agora o assistente**: tem de aparecer "a função respondeu e o modelo … devolveu uma resposta". Se não: "a função não respondeu" é a função não publicada; "sem a chave" é o segredo faltando; "o serviço recusou a chave" é chave errada ou conta sem crédito.
6. Ponha o texto de `docs/privacidade-assistente.md` na página de privacidade e publique.
7. Ligue no painel e faça uma pergunta de teste com uma conta comum.
8. Para desligar a qualquer momento: o mesmo botão. O quadro some na hora (no máximo até a pessoa recarregar a página).

**Testes.** `npm run testar:assistente` confere, sem rede e sem chave, o que se aceita do navegador (tamanho, foto, só endereços do próprio site), o pedido montado para o serviço e a leitura da resposta (recusa, resposta cortada, foto). A seção do assistente em `npm run testar:banco` confere os limites e as permissões. No ambiente local (`npm run dev:local`), a função é imitada pelo banco de teste: o banco conta como em produção e a resposta é um texto fixo, sem chamar serviço nenhum.

## 16. Leitor digital, livro em EPUB e aplicativo

- **Kindle e outros leitores de tinta eletrônica.** O site reconhece o aparelho (pelo nome do navegador e pelo tipo de tela) e entra em um visual de livro: uma coluna, preto no branco, nada flutuando. As regras ficam no fim de `app/globals.css`, em CSS simples de propósito. Mudou o desenho de uma página importante? Confira em um leitor de verdade.
- **EPUB.** Cada trilha com aula escrita tem um livro para baixar na própria página da trilha. Os arquivos são refeitos a cada montagem do site.
- **Aplicativo.** O site é instalável ("Adicionar à tela inicial") no Android e no iPhone e abre sem internet o que já foi visitado. Para o aplicativo de Android abrir o site como dele e usar a entrada pela digital, o site declara que confia nele no arquivo `public/.well-known/assetlinks.json` (nome do pacote e impressão SHA-256 de cada certificado que assina o aplicativo: o de teste e o da loja). Mudou a assinatura? Acrescente a impressão nova ao arquivo, publique e confira `https://SEU-DOMINIO/.well-known/assetlinks.json`. Detalhes em `docs/biometria-setup.md`.

## 17. Giro de notícias

A página **Notícias** lê os endereços de distribuição (RSS) dos veículos listados em `content/noticias.json` e mostra só título, data e link. Para acrescentar um veículo, inclua nome, site e endereço do feed; o link de cada manchete só é aceito se apontar para o próprio site do veículo. Veículo fora do ar some da página e volta sozinho.

## 18. Histórico público

A página de histórico (`/historico`) e o quadro de novidades da página inicial mostram o que mudou no conteúdo desde a data de `historyFrom`, em `lib/site.ts` (deixe vazio para desligar). Nada de processo interno aparece: commits de junção (merge) são ignorados, o assunto dos commits nunca é mostrado, e só contam os arquivos das coleções de estudo e leitura (aulas, acervo, catálogo, autores, memorial, glossário, jornal, checagens, debates, vídeos, galeria, rádios e afins). Páginas legais (privacidade, termos), o aviso de abertura e arquivos de funcionamento ficam de fora. Cada dia vira um resumo gerado a partir dos arquivos ("9 aulas novas em Geografia · 191 obras novas no acervo"), com os títulos de algumas aulas. A lista de pastas e os textos ficam em `lib/history.ts` e no objeto `history` dos dicionários. Em clones rasos (como o da Vercel), o registro mais antigo que veio no clone, a "fronteira", fica de fora: senão ele apareceria como se tivesse criado o acervo inteiro naquele dia.

## Serviços abertos de fora

Algumas partes do site usam dados de serviços públicos e abertos. Todos são consultados pelo **servidor do site** (rotas em `app/api/` e `lib/dados.ts`, com a lista de destinos permitidos em `lib/externo.ts`), nunca pelo navegador de quem visita: o visitante só fala com o nosso domínio, a política de segurança das páginas continua igual e nenhum serviço de fora fica sabendo quem leu o quê. Cada resposta fica guardada no servidor por horas ou dias, para não sobrecarregar ninguém. Se um serviço não responde, a parte dele some ou avisa; nada quebra e nenhum número é inventado.

| Onde aparece | Serviço | Chave |
| --- | --- | --- |
| Página **Dados do povo** (`/dados`) | Banco Central (SGS: salário mínimo 1619, IPCA 12 meses 13522, meta Selic 432, desocupação 24369), IBGE (estimativa da população, tabela 6579), Câmara dos Deputados (votações do Plenário) | não |
| Quadro **Neste dia** na página inicial (`/api/neste-dia`) | Wikipédia (feed "On this day"), texto CC BY-SA | não |
| Ferramenta **Dicionário** (`/api/dicionario`) | Dicionário Aberto (português, verbetes de 1913) e Free Dictionary API (inglês) | não |
| Ferramenta **Frases traduzidas** (`/api/frases`) | Tatoeba, CC BY 2.0 FR (autor e link de cada frase à vista) | não |
| Ferramenta **Gráficos e álgebra** | math.js, roda no próprio navegador | não |
| Fórmulas nas aulas | KaTeX, no próprio site. Escreva entre `$$` e `$$` (no meio da frase ou em bloco); um cifrão sozinho continua sendo dinheiro | não |
| Painel → **Fontes abertas** (`/api/fontes`) | Internet Archive, Open Library, Project Gutenberg (Gutendex), Wikipédia, Wikidata, Wikisource, Wikimedia Commons | não |
| Painel → Rádio → **Sugerir uma emissora** (`/api/radios`) | Radio Browser (diretório aberto; só emissoras do Brasil com transmissão https) | não |
| Criar conta e trocar senha (`/api/senha-vazada`) | Have I Been Pwned, Pwned Passwords: o navegador manda só os 5 primeiros caracteres do SHA-1 da senha | não |
| Página **Checagens** → "Já foi checado?" (`/api/checagens`) | Google Fact Check Tools | sim: `GOOGLE_FACTCHECK_KEY` nas variáveis do servidor (Vercel), nunca com `NEXT_PUBLIC_`. Sem ela, a busca não aparece |
| Comunidade, segunda avaliação | OpenAI Moderation e Google Safe Browsing (acima) | segredos da função `avaliar-comunidade` |
| Assistente de reforço (seção 15b) | Claude, da Anthropic (pago por pergunta; nasce desligado) | segredos da função `assistente`: `ANTHROPIC_API_KEY` e, opcional, `ASSISTENTE_MODELO` |

Para acrescentar outro serviço: inclua o endereço dele na lista de `lib/externo.ts` e consulte sempre por `buscarJson` ou `buscarTexto`, que já têm prazo, limite de tamanho e guarda.

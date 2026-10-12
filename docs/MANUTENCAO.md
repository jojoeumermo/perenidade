# Guia de manutenção do Instituto Lúcia

Este é o documento de referência do projeto: como ele é organizado, como se escreve conteúdo, como ligar as contas de voluntários e o que fazer quando algo dá errado.

## 1. A ideia em três frases

1. **O site publicado é feito só de arquivos.** Tudo o que o visitante lê vem da pasta `content/`. Cada mudança fica no histórico de versões e pode ser desfeita.
2. **O banco de dados é um apoio, não o acervo.** Ele guarda contas, a fila de contribuições, as conversas da comunidade e a programação da rádio. Se ele cair ou for invadido, as aulas continuam no ar.
3. **Nada entra sem aprovação.** Contribuições ficam na fila do painel; depois de aprovadas, uma rotina automática as transforma em arquivos de `content/`.

## 2. Regras da casa

- **Design:** não se mexe em fontes, cores nem no texto central da página inicial. Novas páginas reaproveitam as peças que já existem.
- **Simplicidade:** o foco é o ensino. Fórum, jornal e rádio são complementos e ficam fora do caminho de quem só quer estudar.
- **Palavras:** no site se fala em *coordenador, vice-coordenador, curadoria, educador, revisor, tradutor, jornalista, voluntário*. Não se usam "administrador", "moderador" nem "líder".
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

### Demais fichas

| Coleção | Campos do cabeçalho |
| --- | --- |
| `acervo` | `titulo, autor, area, licenca, fonte, url, idioma`, opcionais `ano`, `autores: [slug]`; o texto é a sinopse |
| `autores` | `nome, anos, origem`, opcionais `arquivo` (https), `arquivo_fonte`; o texto é a biografia |
| `memorial` | `nome, nascimento, morte, local`, opcionais `foto` (em `/imagens/memorial/`), `foto_credito` e `foto_fonte`; o texto é a homenagem |
| `glossario` | `termo, resumo`; texto opcional |
| `jornal` | `titulo, autor, data (AAAA-MM-DD), fontes`, opcionais `subtitulo`, `editoria` |
| `checagens` | `alegacao, veredito (Falso, Enganoso, Falta contexto ou Verdadeiro), data, fontes` |
| `debates` | `afirmacao, resposta, fontes`; texto opcional |
| `videos` | `titulo, canal, url, area, idioma`; o texto diz por que vale assistir |

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
6. Em **Authentication → Sign In / Providers → Email**: deixe o e-mail ligado, **desligue "Confirm email"** (o convite já prova quem é a pessoa) e deixe ligado "Allow new users to sign up" (quem barra o cadastro é o banco: sem convite válido, a conta não é criada). Ponha o tamanho mínimo da senha em 12.
7. **A primeira conta (a sua).** Em **Authentication → Users → Add user → Create new user**, digite o seu e-mail e a sua senha e marque "Auto Confirm User". Enquanto não existe coordenação, essa criação é livre. Depois, no **SQL Editor**, rode:

   ```sql
   select public.promover_coordenacao('seu-email@exemplo.com');
   ```

   A partir daí o painel mostra as abas da coordenação, e **nenhuma conta nova é criada sem convite**. A senha nunca é escrita em arquivo, mensagem ou código: só nesse campo do painel do serviço de contas.

   **Convites.** No painel, aba **Voluntários → Convites**: o convite pessoal leva o e-mail da pessoa e, se quiser, a função; o convite da comunidade vale para várias pessoas, sem função. O endereço aparece uma única vez. Quem recebe abre o endereço, cria a própria senha e entra.

   **Senha perdida.** O site não tem "esqueci minha senha". A coordenação resolve em **Authentication → Users**: nos três pontinhos da pessoa, "Send password recovery" (precisa de SMTP configurado; o link abre a tela de senha nova do site) ou apaga a conta e manda um convite novo.

   **Ninguém consegue entrar no painel?** No SQL Editor: `select public.convidar_pelo_banco('email@exemplo.com');` devolve o final do endereço de um convite pessoal, válido por dois dias.
8. Para a publicação automática (seção 7), cadastre nos segredos do repositório `SUPABASE_URL` (a mesma *Project URL*) e `SUPABASE_SERVICE_ROLE_KEY` (a chave *service_role*). **Essa chave nunca vai para o site nem para o `.env` de ninguém.** Depois crie, na aba *Variables* da mesma tela, a variável `PUBLICAR` com o valor `sim`: é ela que liga a rotina de hora em hora.
9. Opcional — entrada com o Google: ligue o provedor em **Authentication → Providers → Google** e crie a variável `NEXT_PUBLIC_AUTH_GOOGLE=1`.
10. **Proteção contra robôs (Cloudflare Turnstile).** Crie o widget no painel da Cloudflare. A *site key* (pública) vai para a variável `NEXT_PUBLIC_TURNSTILE_SITE_KEY` na hospedagem. A *secret key* vai **somente** em **Authentication → Attack Protection → Enable Captcha protection → Turnstile**, no Supabase. Ela nunca entra no repositório, em `.env` nem em mensagem. Ordem certa: primeiro publique o site com a *site key*; só depois ligue a proteção no Supabase. Na ordem inversa ninguém consegue entrar até o site novo subir.
11. **Segundo fator.** Em **Authentication → Sign In / Providers → Multi-Factor**, ligue o TOTP (aplicativo autenticador). Cada pessoa da equipe cadastra o seu no painel, em **Minha conta → Segundo fator**. Depois que a coordenação tiver cadastrado o próprio, pode ligar na aba **Segurança e sucessão** a exigência de segundo fator para todas as funções com poder de decisão. Se a coordenação perder o aparelho e ficar trancada do lado de fora, rode no **SQL Editor**:

    ```sql
    update interno.configuracoes set valor = '{"exigir_2fa": false}' where chave = 'seguranca';
    ```
12. Opcional — faxina automática: se a extensão `pg_cron` estiver ligada (**Database → Extensions**) quando o `install.sql` rodar, o banco descarta sozinho, toda madrugada, o que ficou velho: contadores de limite, avisos lidos há mais de 30 dias, aparelhos sem uso há 180 dias, pedidos de reforço encerrados, denúncias resolvidas há mais de um ano e registro de atividades com mais de 400 dias. Sem ela, nada quebra; só não há descarte.

### O painel

O painel (`/painel`) é um ambiente à parte do site: ocupa a tela inteira, sem cabeçalho, rodapé, rádio nem menu do site público (quem esconde isso é `components/OutsidePanel.tsx`, usado no layout), e tem um único caminho de volta, "Voltar ao site". O menu lateral é dividido por área:

| Área | Seções | Quem vê |
| --- | --- | --- |
| (início) | Mesa, Conversas, Mural da equipe | todos; conversas e mural, só quem tem função |
| Produção | Escrever, Meus envios, Compartilhadas comigo, Fila de revisão, Materiais e arquivos | conforme a função |
| Atendimento | Comunidade, Aula de reforço, Mural dos Trabalhadores, Boletim do jornal | conforme a função; o mural, só coordenação |
| Pessoas | Voluntários e convites, Horas e certificados | a primeira, só coordenação |
| Site | Controles do site, Aviso de abertura, Rádio, Apoiadores | só coordenação |
| Segurança | Segurança e sucessão, Registro de atividades | só coordenação |
| Você | Minha conta (nome, senha, segundo fator, aparelhos) | todos |

A lista de seções e a regra de quem vê cada uma estão em um só lugar, no começo de `Dentro`, em `components/painel/Painel.tsx`. Para criar uma seção nova: escreva o componente em `components/painel/`, acrescente uma linha a essa lista e a linha que o mostra logo abaixo. Sem ninguém mexer por meia hora, o painel fecha a sessão sozinho.

**Controles do site** (só coordenação) mudam o site inteiro na hora, sem publicar nada: o texto da **faixa do alto** e a **pausa geral de envios**, que fecha tudo o que o público pode enviar (mural, reforço, boletim, contribuições, comunidade) enquanto a equipe continua trabalhando. A pausa é conferida no banco (gatilho `lucia_pausa`), não só na tela. O site público lê isso pela função `site()` (`components/Strip.tsx`), no máximo de dez em dez minutos por visitante.

**Trabalho em conjunto.** Quem enviou uma contribuição (ou a curadoria) chama um colega específico em *Meus envios → abrir → Trabalho em conjunto*. A pessoa chamada recebe um recado na hora, vê a contribuição em *Compartilhadas comigo* e pode abrir e editar só aquela, só enquanto está pendente; o acesso é tirado por quem liberou ou pela própria pessoa. São no máximo cinco por contribuição. Não é edição simultânea letra a letra: cada um guarda a sua vez, a tela se atualiza sozinha a cada vinte segundos, e se alguém guardou enquanto outro editava, o segundo é avisado e nada é sobrescrito (campo `versao`).

### Papéis

Cada pessoa vê no painel só as seções da sua função. O banco confere a função de novo em cada pedido: esconder a seção é conforto, não é a proteção.

| Papel (nome no banco) | Nome no site | O que pode |
| --- | --- | --- |
| `coordenacao` | coordenador | tudo: aprova voluntários, distribui funções e disciplinas, decide publicações, cuida do mural e da rádio, define a sucessão, lê o registro de atividades. Só existe um |
| `vice` | vice-coordenador | o mesmo que a coordenação, menos: nomear ou tirar vice, passar a coordenação, mexer na sucessão, mudar a exigência de segundo fator, definir a sala da equipe e emitir certificados |
| `curadoria` | curadoria | lê a fila inteira, edita e decide; cuida da comunidade (mensagens retidas, palavras vetadas) |
| `educacao` (por disciplina) | educador | escreve aulas da sua disciplina, vê a fila dela e dá parecer nas matérias do jornal |
| `revisao` | revisor | lê a fila e dá parecer |
| `traducao` | tradutor | envia traduções |
| `jornalismo` | jornalista | escreve matérias para o jornal |
| `mentoria` (por disciplina) | mentor | responde pedidos de aula de reforço da sua disciplina |
| `design` | designer | envia materiais para imprimir (zines, cartazes) e imagens |
| `desenvolvimento` | desenvolvedor | vê o mural interno da equipe; não tem poder sobre conteúdo nem sobre pessoas |

Quem contribui sem conta, pela página Contribuir, entra na mesma fila.

### Conversas e Mural da equipe

**Conversas** é o bate-papo: privado (duas pessoas) ou em grupo. Qualquer pessoa da equipe procura outra pelo nome e começa uma conversa, ou cria um grupo e escolhe quem entra (dá para marcar de uma vez todos de uma função). Só quem participa de uma conversa a lê: nem a coordenação abre conversa alheia. Aparece quem está online (painel aberto nos últimos dois minutos) e o "visto por último" de cada um. Não há canal aberto permanente com o banco: a conversa aberta se atualiza a cada três segundos e a lista a cada oito, o que na prática é tempo real. As mensagens usam a mesma chave da equipe do mural, somem em trinta dias, e o botão "Apagar todas as conversas agora" do coordenador leva tudo junto. Como a chave é uma só para a equipe, quem tem a frase **e** acesso direto ao banco conseguiria abrir mensagens alheias; pelo painel, não.

O **Mural da equipe** é um mural de publicações e comentários, com um canal para todos, um por função e um de pedidos de ajuda entre funções, e a lista de quem está na equipe ao lado. As mensagens são cifradas no navegador de quem escreve, com uma chave derivada de uma **frase da equipe**. O banco recusa texto aberto e guarda só o resultado cifrado. O coordenador define a frase no **Mural da equipe** ou em **Conversas** e a passa aos demais por fora do site. A frase não fica guardada em lugar nenhum: se for perdida, define-se outra (e as conversas guardadas são apagadas). Tudo some sozinho depois de trinta dias, e o coordenador tem o botão "Apagar todas as conversas agora". Troque a frase sempre que alguém sair da equipe.

### Imagens e arquivos

Quem envia uma imagem ou um PDF não publica sozinho: o arquivo aparece no **Mural da equipe** para os colegas olharem e apoiarem. Com dois apoios, a coordenação pode aprovar (o coordenador pode aprovar sem esperar; recusar, qualquer um dos dois pode).

### Sucessão

A coordenação indica, na aba **Segurança e sucessão**, uma lista ordenada de sucessores. Se o coordenador ficar **90 dias** sem entrar no painel, a coordenação passa sozinha para a primeira pessoa da lista que tenha entrado nos últimos 30 dias; o antigo coordenador vira vice. A troca fica no registro de atividades e todos da coordenação são avisados. O coordenador também pode passar o cargo na hora, pelo mesmo painel.

A sucessão do banco não resolve a da **infraestrutura**: domínio, hospedagem, Cloudflare, Supabase e repositório estão em contas pessoais. Guarde essas senhas em um gerenciador com acesso de emergência para a pessoa de confiança.

### Registro de atividades

Toda decisão (aprovar, recusar, dar ou tirar função, suspender, mudar configuração, emitir certificado, passar a coordenação) é gravada com autor, data e o que mudou. A coordenação lê na aba **Registro de atividades**. Ninguém apaga nem edita o registro pelo painel; a faxina automática (seção 6, item 12) descarta só o que tem mais de 400 dias.

## 7. Como uma contribuição vira página

1. Alguém envia (pela página Contribuir ou pelo painel). O banco confere tamanho, campos, fonte obrigatória e limite de envios.
2. A coordenação ou a curadoria aprova no painel. Nada muda no site ainda.
3. De hora em hora, a rotina **Publicar contribuições aprovadas** roda `scripts/sincronizar.mjs`: busca os itens aprovados, confere tudo de novo, grava os arquivos em `content/`, monta o site para validar e registra a mudança no histórico.
4. Só então o painel marca o item como publicado.

**Imagens e PDFs** seguem o mesmo caminho. Quem envia uma imagem pelo editor tem o arquivo refeito no próprio navegador (vira WebP novo, sem localização, sem modelo de câmera, sem nome de autor) antes de sair do aparelho. O arquivo fica em um depósito fechado até a curadoria aprovar. Na publicação, a rotina baixa só os aprovados, confere pelos primeiros bytes se o arquivo é mesmo o que diz ser, recusa imagem que ainda traga dados embutidos, limpa os PDFs e grava em `public/arquivos/` com um nome derivado do conteúdo. **Vídeo não é hospedado:** a aula aponta para o endereço do vídeo, que só carrega quando a pessoa clica.

Para publicar na hora, rode a rotina manualmente. Para pausar as publicações, apague a variável `PUBLICAR`.

## 8. Segurança: o que protege o quê

- **Tabelas fechadas.** Ficam no esquema `interno`, sem nenhuma permissão direta. A única entrada são as funções do esquema `public`, e cada uma confere quem está chamando.
- **Chaves.** A chave *anon* é pública por natureza e não abre nada sozinha. A *service_role* existe só nos segredos da publicação automática.
- **Texto, não código.** O conteúdo é Markdown sem HTML; links só http(s); imagens só as que estão em `public/arquivos/` e `public/imagens/`. Os cabeçalhos de segurança (`next.config.ts`) impedem scripts de fora.
- **Limites.** Envios anônimos têm limite por origem, campo-isca contra robôs e tamanho máximo. A entrada (pedido de link, senha da equipe e cadastro) passa pela verificação do Turnstile, conferida pelo próprio serviço de contas. Os formulários abertos (contribuir, mural, denúncia, reforço) são protegidos pelo limite de envios e pelo campo-isca, dentro do banco.
- **Segundo fator** para as funções com poder de decisão (seção 6) e **aviso de aparelho novo**: quando uma conta da equipe entra de um aparelho que nunca usou, a pessoa e a coordenação são avisadas no painel.
- **Iscas.** Endereços que só robôs de invasão procuram (`/wp-admin`, `/.env`, `/phpmyadmin`, arquivos `.php`, `.sql`, `.bak`…) respondem "não encontrado" sem gastar nada, e a visita fica no **Registro de atividades** como `isca` (só o caminho e o programa usado, sem endereço de rede, por trinta dias). No banco existem funções com nomes tentadores (`exportar_usuarios`, `admin_senhas`, `chaves_api`) que não devolvem nada: quem chama fica registrado e a coordenação é avisada.
- **Filtro do que vem de fora.** Na comunidade, mensagem com termo da lista vetada fica retida até a curadoria olhar. Nos envios de quem não tem conta (anúncio do mural, pedido de reforço, contribuição), o texto com termo vetado é recusado na hora; o reforço também recusa endereços de sites e nomes de arquivos. A lista se edita na aba **Comunidade**, em *Filtro de palavras*. Filtro de palavra é a primeira barreira, não a única: nada de fora vai ao ar sem uma pessoa da equipe ler.
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

## 10. Antes de publicar uma mudança

```bash
npm run lint
npm run typecheck
npm run conferir:i18n
npm run testar:banco
npm run build
```

Mudou a interface? Rode `npm run dev:local` e confira no navegador, inclusive no tamanho de celular e nos cinco idiomas. No banco de teste, o código do segundo fator é sempre `123456`.

O modo sem internet (`public/sw.js`) só funciona no site montado (`npm run build` e `npm run start`), nunca no modo de desenvolvimento. Se mudar o que ele guarda, troque o número da versão no começo do arquivo, senão os aparelhos continuam com a cópia antiga.

## 11. Rádio

O tocador tem duas partes. As **rádios populares** vêm de `content/radios.json`: só entram emissoras com transmissão aberta em https, conferida na hora de cadastrar; as que não deixam tocar de fora aparecem como link para o site delas. Rode `npm run conferir:links` de tempos em tempos, porque endereço de transmissão muda sem aviso.

A **rádio própria** fica "Em breve" para o público até a coordenação clicar em **Pôr no ar** na aba Rádio do painel. Os áudios são enviados pelo próprio painel ou indicados por endereço. Só publique gravações próprias, em domínio público ou com licença que permita a transmissão: música comercial exige licenciamento.

## 12. Apoio financeiro

O endereço da campanha fica em `lib/site.ts`. O mural de apoiadores é preenchido pela coordenação na aba Apoiadores do painel; só entra o nome de quem autorizou.

## 13. Voluntariado, horas e certificados

O voluntário aceita no painel um termo de adesão baseado na Lei nº 9.608/1998 (serviço voluntário: sem salário e sem vínculo de emprego). Depois registra as horas, que a coordenação confere. O certificado de horas é aberto pelo coordenador (nunca para si mesmo) e leva sempre **três assinaturas eletrônicas**: a de um educador, a do vice-coordenador e, por último, a do coordenador, que é a emissão. Cada um assina na própria conta, em *Horas e certificados*; fica guardado quem assinou, em nome de que função, o dia e a hora. Ninguém assina o próprio certificado, e sem vice-coordenador nomeado não se emite. A folha é única (`components/painel/Certificado.tsx`, estilo em `app/globals.css`): A4 deitada, salva em PDF pelo navegador, com o número do certificado e uma impressão digital (SHA-256) do que ele afirma. É assinatura eletrônica simples, feita dentro do site; quem precisar de mais força pode, além disso, assinar o PDF em um serviço de assinatura como o do gov.br. Qualquer pessoa confere a autenticidade em `/certificado`, com o código impresso.

Enquanto o instituto não tiver CNPJ, o certificado é uma **declaração de um projeto comunitário**, assinada por pessoa física. Vale como comprovação de atividade; cada escola ou empresa decide se aceita como hora complementar. Não prometa mais do que isso.

## 14. Aviso de abertura e período eleitoral

O aviso que aparece ao abrir o site sai de `content/abertura.json`, tem data para sumir sozinho e só aparece em português. A coordenação pode trocá-lo ou desligá-lo na aba **Aviso de abertura**, sem publicar o site de novo.

Manifestação de apoio a candidatura na internet é livre para pessoa física, mas a lei eleitoral proíbe o anonimato: o aviso precisa dizer quem assina. Propaganda eleitoral em site de **pessoa jurídica** é proibida: se o instituto virar associação com CNPJ, esse tipo de aviso sai do ar. No dia da votação, não se publica conteúdo novo de campanha. Nada de ofensa a adversário: fato documentado e linguagem sóbria.

## 15. Mural dos Trabalhadores

Qualquer pessoa anuncia, sem conta: escolhe o tipo, escreve o ofício, o título, a descrição, a **cidade**, o **estado** e o contato. O anúncio passa pelo filtro de palavras e fica esperando: **só a coordenação (coordenador e vice) aprova**, na aba **Mural** do painel. Aprovado, fica no ar por 180 dias. Quem anunciou sem conta recebe um código para retirar o anúncio quando quiser. Quem procura filtra por estado, cidade, tipo e palavra.

## 16. Leitor digital, livro em EPUB e aplicativo

- **Kindle e outros leitores de tinta eletrônica.** O site reconhece o aparelho (pelo nome do navegador e pelo tipo de tela) e entra em um visual de livro: uma coluna, preto no branco, nada flutuando. As regras ficam no fim de `app/globals.css`, em CSS simples de propósito. Mudou o desenho de uma página importante? Confira em um leitor de verdade.
- **EPUB.** Cada trilha com aula escrita tem um livro para baixar na própria página da trilha. Os arquivos são refeitos a cada montagem do site.
- **Aplicativo.** O site é instalável ("Adicionar à tela inicial") no Android e no iPhone e abre sem internet o que já foi visitado. Para publicar como aplicativo de Android, o site precisa declarar que confia no aplicativo: preencha `ANDROID_PACKAGE` e `ANDROID_SHA256` na hospedagem e confira `https://SEU-DOMINIO/.well-known/assetlinks.json`.

## 17. Giro de notícias

A página **Notícias** lê os endereços de distribuição (RSS) dos veículos listados em `content/noticias.json` e mostra só título, data e link. Para acrescentar um veículo, inclua nome, site e endereço do feed; o link de cada manchete só é aceito se apontar para o próprio site do veículo. Veículo fora do ar some da página e volta sozinho.

## 18. Histórico público

A página de histórico de mudanças está **desligada**. Para ligá-la, ponha uma data em `historyFrom`, em `lib/site.ts`: ela volta ao ar mostrando só o que mudou daquele dia em diante.

# Podcast — o que configurar fora do código

O código do podcast está pronto. Para ele funcionar no site de produção faltam alguns passos que só a coordenação consegue
fazer (porque dependem das contas do instituto). Em ordem:

## 1. Atualizar o banco (obrigatório)

1. Abra o projeto de produção no Supabase → **SQL Editor** → **New query**.
2. Cole o arquivo `supabase/install.sql` inteiro e clique em **Run**. Pode rodar de novo sem medo: ele não apaga nada.
3. Confira em **Storage** que apareceram dois depósitos:
   - `podcast` (público): o áudio final que toca no site e as capas;
   - `podcast-producao` (fechado): versões de trabalho, trilhas, termos dos convidados e perguntas gravadas.

Antes deste passo, a página `/podcasts` mostra "Em breve" e a área Podcast do painel dá erro. Nada mais do site é afetado.

O plano gratuito do Supabase aceita arquivos de até 50 MB. Um episódio de uma hora em MP3 de 96 kbps fica com uns 43 MB.
Arquivos maiores (bruto em WAV, vídeo) entram no painel como link (Internet Archive, Drive).

## 2. Quem faz o quê

- Dê a função **Jornalismo, rádio e podcast** a quem vai produzir (Painel → Voluntários e convites). Sem mais nada, essa
  pessoa faz produção e edição.
- Em **Podcast → Ajustes → Quem faz o quê no podcast**, marque quem é da **supervisão** (aprova os episódios). Pode ser
  alguém de fora do jornalismo, da curadoria por exemplo. Ninguém aprova o que ele mesmo enviou; a coordenação e a vice
  aprovam qualquer um.
- Na mesma tela dá para separar tarefas: uma pessoa só da edição de áudio, por exemplo.
- O design recebe os pedidos de arte em **Podcast → Pedidos de arte** e pode pôr a capa direto no episódio.
- A mediação e a curadoria leem os episódios em andamento e comentam com a marcação de tempo.

## 3. O programa no feed

Em **Podcast → Ajustes**, preencha:

- nome, descrição e autor do programa;
- **e-mail do dono do feed**: o Spotify e a Apple mandam o código de confirmação para ele;
- categoria (Education ou Society & Culture) e subcategoria;
- a **capa do programa** (3000 × 3000), feita com um dos modelos ou enviada pronta.

## 4. Cadastrar o podcast nas plataformas

O endereço do feed é **https://institutolucia.org/podcast.xml**. Ele só precisa ser cadastrado uma vez em cada plataforma:
depois disso, cada episódio publicado no painel chega sozinho a todas (em até quinze minutos o feed se atualiza; cada
plataforma lê o feed no próprio ritmo, de minutos a algumas horas).

Publique o primeiro episódio antes: as plataformas recusam feed vazio.

- **Spotify**: creators.spotify.com → Começar → "Encontrar um podcast existente" (ou "I already have a podcast") → cole o
  endereço do feed → confirme pelo código enviado ao e-mail do dono do feed.
- **Apple Podcasts**: podcastsconnect.apple.com (com uma conta Apple) → **+** → Novo programa → "Adicionar um programa com
  feed RSS" → cole o endereço. A Apple revisa em um ou dois dias.
- **YouTube Music**: YouTube Studio do canal do instituto → Criar → Novo podcast → "Enviar feed RSS" → cole o endereço.
- **Deezer**: podcasters.deezer.com → Submit your podcast.
- **Amazon Music**: podcasters.amazon.com → Add your podcast.
- **Podcast Index** (alimenta os aplicativos livres): podcastindex.org/add.

Quando cada um aprovar, copie o link do programa na plataforma e cole em **Podcast → Ajustes → Link no …**: os botões
aparecem na página do site.

## 5. Cópia de fora no Internet Archive (recomendado)

O depósito do site guarda o áudio dos episódios mais recentes (10, ajustável em Ajustes). Quando sai um novo, o mais antigo
libera o espaço. Para ele continuar tocando no site e no feed para sempre, cadastre uma cópia de fora:

1. Crie uma conta do instituto em archive.org.
2. Upload → escolha o MP3 final → título do episódio, coleção "Community Audio", licença **CC BY-SA 4.0**.
3. Abra o item, clique com o botão direito no arquivo .mp3 (em "Download options") e copie o endereço.
4. No painel, episódio → **Publicação → Cópia de fora** → cole o endereço e guarde.

Aproveite para guardar lá também o bruto, como cópia de segurança.

O painel avisa, em **Podcast → Ajustes → Depósito**, quais episódios saem do depósito na próxima publicação e se eles já
têm cópia de fora. Sem cópia, o episódio some do site e do feed (a página, as notas e a transcrição continuam no banco e
voltam quando a cópia for cadastrada).

## 6. Transcrição automática (opcional)

O botão **Transcrever** (episódio → Publicação) usa o Whisper por um serviço com cota gratuita. Sem esta configuração, a
equipe gera a transcrição no computador com o programa **Buzz** (de graça, roda o Whisper sem internet) e importa o
arquivo `.srt` ou `.vtt`.

1. Crie uma conta em console.groq.com e gere uma chave em **API Keys**. O plano gratuito aceita arquivos de até 25 MB
   (para um episódio de uma hora, exporte o MP3 final em 48 a 64 kbps mono, ou use o Buzz).
2. No Supabase: **Edge Functions → Secrets** → crie `TRANSCRICAO_CHAVE` com a chave da Groq.
   (Para usar outro serviço no formato da OpenAI, crie também `TRANSCRICAO_URL` e `TRANSCRICAO_MODELO`.)
3. Publique a função pelo terminal, na pasta do projeto: `supabase functions deploy transcrever-podcast`.

A função só atende quem pode editar o episódio (o banco confere com a sessão da pessoa) e devolve o texto para o painel; a
transcrição só vale depois que a pessoa revisa e guarda.

## 7. Faxina diária (opcional)

Se o agendador do banco (pg_cron) estiver ligado (**Database → Extensions → pg_cron**), rode o `install.sql` de novo: ele
agenda a faxina do podcast para toda madrugada. Ela marca para sair do depósito as versões de trabalho dos episódios que
estão no ar há mais de 30 dias e o áudio das perguntas antigas, e vence os links de convidado e de revisão. O botão
**Liberar espaço agora** (Ajustes → Depósito) faz o mesmo na hora.

## Conferir

- `npm run testar:podcast` prova as regras do banco (quem pode o quê, aprovação, lista de conferência, rodízio, votação,
  perguntas) num banco de teste local.
- `npm run dev:local` sobe o site com contas de teste: entre como `jornal@local` (jornalismo) e `coord@local`
  (coordenação, código do segundo fator 123456) para fazer o caminho todo, da pauta à publicação.
- Com `SEMEAR_PODCAST=1 npm run dev:local`, o teste já nasce com um episódio no ar (capítulos, legendas e áudio de
  silêncio), uma pauta anotada e `revisor@local` na supervisão.

## Privacidade

O site conta quantas vezes cada episódio começou a tocar, por dia, sem guardar quem ouviu nem de onde. As perguntas gravadas
só a equipe do podcast ouve. O contato dos convidados só a produção e a supervisão veem. O termo de cessão fica com data,
nome digitado e uma marca da origem que não permite descobrir o endereço de ninguém.

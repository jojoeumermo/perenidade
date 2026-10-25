# YouTube do instituto

As aulas em vídeo aprovadas ganham uma cópia no canal do instituto no YouTube, e as aulas ao vivo podem ser transmitidas
por ele. Quem fala com o YouTube é só a função `youtube` do Supabase (`supabase/functions/youtube`). A autorização do
canal fica guardada nos segredos do Supabase. **Ninguém da equipe recebe a senha nem o acesso ao canal.**

## Como funciona

- **Aula em vídeo.** A curadoria aprova no painel e a aula sobe sozinha para o canal, como **não listada**. A
  descrição leva o crédito de quem gravou, as fontes e o link da aula no site; as legendas revisadas vão junto. No site,
  o tocador do YouTube aparece primeiro e só carrega depois do clique, pelo domínio sem cookies de propaganda. A cópia
  do instituto (no Supabase) fica a um clique, para quem não quer usar o Google e para quando o YouTube sair do ar. O
  arquivo original nunca é apagado: ele é o espelho fora do YouTube.
- **Aula ao vivo.** Em Aulas ao vivo, quem conduz a aula aperta "Criar a transmissão e a chave desta aula" e recebe só o
  endereço do servidor e a chave **daquela aula**. Essa pessoa transmite pelo OBS (computador) ou pelo Larix Broadcaster
  (celular). A transmissão começa sozinha quando o programa manda imagem e termina quando ele para. A sala do site
  mostra o tocador e mantém o bate-papo do site. Quando a aula é encerrada, a gravação do YouTube vira a gravação da aula.
- **No painel**, a aba "No ar" das aulas em vídeo mostra se o canal está ligado e a situação de cada cópia, com os
  botões "Mandar ao YouTube" e "Conferir de novo se o Google liberou".

## Ligar (feito uma vez, pela conta do instituto)

Faça tudo logado na conta Google do canal do instituto.

1. **Projeto no Google Cloud.** Em console.cloud.google.com, crie um projeto (por exemplo, "Instituto Lúcia").
2. **API do YouTube.** Em APIs e serviços › Biblioteca, ative a **YouTube Data API v3**.
3. **Tela de consentimento.** Em APIs e serviços › Tela de consentimento OAuth, escolha "Externo". Preencha o nome do
   app e o e-mail de contato e adicione o escopo `https://www.googleapis.com/auth/youtube.force-ssl`. Depois aperte
   **Publicar o app** (status "Em produção"). Em "Teste", a autorização vence em 7 dias. O aviso de "app não verificado"
   não atrapalha: só a conta do instituto vai usar.
4. **Credencial.** Em Credenciais › Criar credenciais › ID do cliente OAuth, escolha "Aplicativo da Web" e adicione o
   URI de redirecionamento `https://developers.google.com/oauthplayground`. Guarde o ID do cliente e a chave secreta.
5. **Autorização do canal.** Abra developers.google.com/oauthplayground e siga estes passos:
   1. Na engrenagem, marque "Use your own OAuth credentials" e cole o ID e a chave do passo 4.
   2. No campo de escopo, escreva `https://www.googleapis.com/auth/youtube.force-ssl` e aperte "Authorize APIs". Entre
      com a conta do canal e permita.
   3. Aperte "Exchange authorization code for tokens" e copie o **refresh token**.
6. **Segredos no Supabase.** Em Project Settings › Edge Functions › Secrets, crie:
   - `YOUTUBE_CLIENT_ID`: o ID do cliente;
   - `YOUTUBE_CLIENT_SECRET`: a chave secreta;
   - `YOUTUBE_REFRESH_TOKEN`: o refresh token;
   - `YOUTUBE_PRIVACIDADE`: opcional. `unlisted` (não listado) é o padrão; também aceita `public` ou `private`.
   - `SITE_URL`: opcional. O padrão é `https://institutolucia.org`.
7. **Publicar a função.** A ação "Publicar funções do Supabase" do GitHub publica sozinha quando a variável `FUNCOES`
   vale `sim`. Sem ela, rode `supabase functions deploy youtube`.
8. **Transmissões ao vivo.** No YouTube Studio, ative as transmissões ao vivo (Criar › Transmitir ao vivo). Na primeira
   vez, o canal precisa do telefone verificado e o YouTube leva até 24 horas para liberar.
9. **Auditoria do Google.** O Google deixa **privados** os vídeos enviados pela API de projetos que ainda não passaram
   na auditoria dele. Peça a auditoria pelo formulário "YouTube API Services - Audit and Quota Extension Form", que é
   gratuito. Enquanto ela não sai:
   - a aula aparece no painel como "travada";
   - o site toca a cópia do instituto;
   - depois da aprovação, use "Conferir de novo se o Google liberou" em cada aula travada.

## Limites

- A cota grátis da API é de 10 mil unidades por dia. Cada envio de vídeo gasta cerca de 1.600 e cada legenda, 400.
  Isso dá umas cinco aulas por dia. Se passar, o painel avisa e é só tentar no dia seguinte.
- A função roda por até 150 segundos. Os vídeos têm até 50 MB, então cabem com folga.
- A chave de transmissão vale para uma aula só. Se vazar, a coordenação apaga a transmissão no YouTube Studio
  (Conteúdo › Ao vivo) e, no painel, quem conduz apaga a aula e marca de novo para receber outra chave.

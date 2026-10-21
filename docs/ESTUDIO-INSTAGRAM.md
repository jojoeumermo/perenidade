# Publicar no Instagram pelo estúdio

O estúdio de design publica no perfil do instituto pela API oficial do Instagram (Instagram Graph API, da Meta): uma
imagem ou um carrossel de até 10, com a legenda, agora ou agendado. Quem publica é a coordenação ou o marketing; o
banco confere. Sem as chaves abaixo, o estúdio só avisa que a conta não está ligada, e o caminho continua sendo
**Baixar** e postar pelo aplicativo.

## O que é preciso

1. **Conta profissional no Instagram** (comercial ou de criador), ligada a uma **página do Facebook**.
2. Um **aplicativo na Meta** (developers.facebook.com → Meus aplicativos → Criar aplicativo → tipo "Empresa"), com o
   produto **Instagram** (API com login do Facebook) e as permissões `instagram_basic`,
   `instagram_content_publish`, `pages_show_list` e `pages_read_engagement`.
3. Um **token de acesso de longa duração** (60 dias) da página, gerado no Explorador da Graph API e trocado por um de
   longa duração. Anote também o **número da conta do Instagram** (o campo `instagram_business_account` da página).

## Ligar a publicação

Na Vercel (Settings → Environment Variables), em Production:

| Variável | Valor |
| --- | --- |
| `INSTAGRAM_USER_ID` | o número da conta do Instagram |
| `INSTAGRAM_TOKEN` | o token de longa duração |

Depois de salvar, faça um novo deploy (Deployments → Redeploy). No estúdio, **Mais → Publicar no Instagram** passa a
publicar. O token vence em 60 dias: renove antes e troque o valor na Vercel.

## Ligar o agendamento

O agendamento usa uma chave secreta comum ao site, ao banco e à rotina do GitHub.

1. Gere uma chave longa (32 caracteres ou mais), por exemplo com `openssl rand -hex 24`.
2. Na **Vercel**, crie `CRON_SECRET` com essa chave (Production) e faça um novo deploy.
3. No **Supabase** (SQL Editor), guarde a mesma chave:

   ```sql
   insert into interno.segredos (nome, valor) values ('cron', 'COLE_A_CHAVE_AQUI')
   on conflict (nome) do update set valor = excluded.valor;
   ```

4. No **GitHub** (Settings → Secrets and variables → Actions): o segredo `ESTUDIO_CRON_SECRET` com a mesma chave, e a
   variável `AGENDA_INSTAGRAM` com o valor `sim`. A rotina "Publicações agendadas do estúdio" passa a rodar de 15 em
   15 minutos (o post sai na primeira rodada depois do horário marcado). Para pausar, apague a variável.

## Banco

As tabelas e funções desta parte (lixeira, revisão, comentários, versões, biblioteca, modelos mais usados, alcance e
publicações) e o depósito público `estudio-publicacoes` estão no `supabase/install.sql`. Para atualizar a produção:
Supabase → SQL Editor → cole o arquivo inteiro → Run. O script não apaga dados; troca só a função `designs_listar`
pela versão nova (com a lixeira).

## Segurança

- A chave do Instagram só existe no servidor; o navegador nunca a vê.
- A rota confere o token da sessão de quem pede e o banco confere o papel (coordenação ou marketing).
- As imagens precisam estar no depósito público de publicações, na pasta de quem publica; endereço de fora é recusado.
- O depósito público só recebe JPEG, de quem pode publicar, cada um na própria pasta.

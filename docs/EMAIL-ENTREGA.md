# E-mails na caixa de entrada: SPF, DKIM e DMARC

Os e-mails automáticos e o boletim saem pelo Resend em nome de `institutolucia.org`. Três registros no DNS (na Cloudflare)
dizem aos provedores (Gmail, Outlook, Yahoo…) que esses e-mails são do instituto de verdade. Sem eles, boa parte vai para
o spam. **Os valores exatos vêm do próprio Resend: copie de lá.**

## Como está hoje (conferido no DNS público em 20/10/2026)

| Registro | Situação |
| --- | --- |
| DKIM `resend._domainkey` | Publicado. |
| SPF e MX do subdomínio de envio `send` | Publicados (apontam para o serviço de envio do Resend). |
| SPF da raiz | `v=spf1 include:_spf.mx.cloudflare.net ~all`, do Email Routing da Cloudflare. Não atrapalha o Resend, que envia pelo subdomínio `send`. |
| DMARC `_dmarc` | `v=DMARC1; p=none;`: **sem `rua`**, então ninguém recebe os relatórios. Veja o passo 2. |

Ou seja, a autenticação está no lugar. Quando um e-mail autenticado ainda cai no spam do Gmail, a causa costuma ser
a **reputação** de um domínio novo, que ainda manda poucos e-mails. Ela melhora com o tempo e com os passos 5 e 6.

## 1. SPF e DKIM

1. No Resend, abra **Domains → institutolucia.org**.
2. Ele mostra os registros do domínio: um TXT de SPF e um MX no subdomínio de envio, e um TXT de DKIM em `resend._domainkey`.
3. Na Cloudflare, em **DNS → Records**, crie cada um exatamente como aparece no Resend, com o **proxy desligado**
   (nuvem cinza, "DNS only").
4. Volte ao Resend e clique em **Verify**. Os registros precisam ficar como **Verified** (pode levar alguns minutos).

## 2. DMARC

Na Cloudflare, crie um registro:

| Tipo | Nome | Valor |
| --- | --- | --- |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:institutolucia@tutamail.com` |

Hoje o registro existe, mas sem o `rua`: edite o valor para o da tabela. Com `p=none` nada é bloqueado: os provedores
só mandam relatórios para o endereço do `rua`. Depois de duas a quatro semanas sem falhas nos relatórios, troque para
`p=quarantine` (e, mais tarde, se tudo seguir certo, `p=reject`). Um DMARC mais firme é um dos sinais que o Gmail usa
para confiar no domínio.

## 3. Conferir

1. No painel, em **Boletim do jornal → Nova edição**, use **Enviar teste para mim** com uma conta do Gmail.
2. Na mensagem recebida, abra **⋮ → Mostrar original**.
3. **SPF**, **DKIM** e **DMARC** precisam aparecer como **PASS**.

## 4. No provedor de envio

- `EMAIL_REMETENTE` (segredo da função e da rotina de envio) sempre com um endereço do domínio verificado,
  por exemplo `Instituto Lúcia <noreply@institutolucia.org>`.
- `EMAIL_RESPOSTA` numa caixa que alguém lê (hoje `institutolucia@tutamail.com`).
- Se o Resend mostrar reclamações de spam ou muitos endereços inválidos, limpe a lista em **Boletim → Lista → Com problema**.

## 5. Google Postmaster Tools

1. Abra [postmaster.google.com](https://postmaster.google.com) com a conta Google do instituto e acrescente `institutolucia.org`.
2. Ele pede um TXT de verificação: crie na Cloudflare como os outros.
3. Depois de alguns dias de envio, ele mostra a reputação do domínio, a taxa de spam e se a autenticação passa. Se a
   reputação estiver "baixa" ou "ruim", segure o boletim por umas semanas e mande só os e-mails de conta.

## 6. Ajudar a reputação

- No Resend, deixe **desligados** o rastreio de abertura e de clique (Domains → institutolucia.org → Configuration).
  Rastreio troca os links por endereços de outro domínio, o que pesa contra.
- Peça a quem recebe o primeiro e-mail no spam: **Não é spam**, e acrescente `noreply@institutolucia.org` aos contatos.
  Cada "não é spam" conta a favor do domínio inteiro.
- Na própria caixa do Gmail da equipe, um filtro ajuda só quem o cria: **Configurações → Filtros → Criar filtro**, em
  "De" `@institutolucia.org`, marque **Nunca enviar para spam**.
- Mande o boletim só para quem confirmou a inscrição (o site já faz assim) e com frequência regular.

## O que o código já faz

- Todo boletim leva os cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post` (RFC 8058): o botão "cancelar inscrição"
  do Gmail tira a pessoa da lista com um clique, sem abrir o site (`app/api/boletim/sair`). O link **Sair da lista** no
  rodapé continua.
- Todo e-mail vai também em texto simples.
- Nenhuma imagem de fora e nenhum rastreio de abertura ou de clique.
- Endereço que falha três vezes seguidas para de receber até alguém reativar.
- No máximo uma edição do boletim a cada seis horas; o envio de teste não conta.

# E-mails na caixa de entrada: SPF, DKIM e DMARC

Os e-mails automáticos e o boletim saem pelo Resend em nome de `institutolucia.org`. Três registros no DNS (na Cloudflare)
dizem aos provedores (Gmail, Outlook, Yahoo…) que esses e-mails são do instituto de verdade. Sem eles, boa parte vai para
o spam. **Os valores exatos vêm do próprio Resend: copie de lá.**

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

Com `p=none` nada é bloqueado: os provedores só mandam relatórios para o endereço do `rua`. Depois de duas a quatro
semanas sem falhas nos relatórios, troque para `p=quarantine` (e, mais tarde, se tudo seguir certo, `p=reject`).

## 3. Conferir

1. No painel, em **Boletim do jornal → Nova edição**, use **Enviar teste para mim** com uma conta do Gmail.
2. Na mensagem recebida, abra **⋮ → Mostrar original**.
3. **SPF**, **DKIM** e **DMARC** precisam aparecer como **PASS**.

## 4. No provedor de envio

- `EMAIL_REMETENTE` (segredo da função e da rotina de envio) sempre com um endereço do domínio verificado,
  por exemplo `Instituto Lúcia <noreply@institutolucia.org>`.
- `EMAIL_RESPOSTA` numa caixa que alguém lê (hoje `institutolucia@tutamail.com`).
- Se o Resend mostrar reclamações de spam ou muitos endereços inválidos, limpe a lista em **Boletim → Lista → Com problema**.

## O que o código já faz

- Todo boletim leva o cabeçalho `List-Unsubscribe` (o botão "cancelar inscrição" dos leitores) e o link **Sair da lista**.
- Todo e-mail vai também em texto simples.
- Nenhuma imagem de fora e nenhum rastreio de abertura ou de clique.
- Endereço que falha três vezes seguidas para de receber até alguém reativar.
- No máximo uma edição do boletim a cada seis horas; o envio de teste não conta.

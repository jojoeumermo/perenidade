# Rede Lúcia v2: avisos (R4, itens 41 a 44)

Pacote **avisos**. Contrato geral em `docs/rede/V2.md`; especificação em `docs/rede/ESPEC.md`. Tudo atrás do recurso `rede-v2` (só liga pelo nome). Com ele desligado, nada daqui aparece e a Rede de hoje segue como está.

## 1. O que existe

| Item | Onde |
| --- | --- |
| Migração (banco) | `supabase/migracoes/2026-11-rede-avisos.sql` (depois de comunidades, antes de moderacao) |
| Tela `/[lang]/comunidade/avisos` | `components/rede/avisos/Tela.tsx` (sob demanda, pelo registro), rota `app/[lang]/comunidade/avisos/page.tsx` |
| Aviso no celular (navegador) | `components/rede/avisos/push.ts` e `public/sw.js` (blocos `push` e `notificationclick`) |
| Envio do push (servidor) | `supabase/functions/enviar-push/index.ts` e `supabase/functions/_shared/push.mjs` |
| Resumo por e-mail | `interno.rede3_aviso_resumo_semanal()` enfileira em `interno.emails`; quem envia é a função `enviar-emails` de sempre (e a reserva `emails.yml`) |
| Textos | `i18n/rede/avisos/{pt,en,es,fr,ru,zh}.json` (pt final; os outros cinco são rascunho marcado), carregador `lib/rede/textos-avisos.ts` |
| Cliente e tipos | `lib/rede/cliente-avisos.ts`, `lib/rede/tipos-avisos.ts` |
| Teste | `npm run testar:rede-avisos` |

### Funções públicas (`public.*`, todas pedem conta)

`rede_aviso_listar(p_cursor text, p_limite int)` · `rede_aviso_contar()` · `rede_aviso_ler(p_id uuid)` · `rede_aviso_prefs_ver()` · `rede_aviso_prefs_salvar(p_tipo, p_canal, p_ligado)` · `rede_aviso_resumo_ver()` · `rede_aviso_push_assinar(p_endpoint, p_p256dh, p_auth, p_lang)` · `rede_aviso_push_cancelar(p_endpoint)`. Só a chave de serviço: `rede_aviso_push_pendentes(p_limite)` e `rede_aviso_push_resultado(p_id, p_ok, p_gone)`.

### Porta para os outros pacotes

`interno.rede3_aviso_criar(p_para, p_tipo, p_post, p_alvo, p_ator, p_texto)`. Tipos: `resposta`, `mencao`, `citacao`, `seguidor`, `chamado`, `nucleo`, `moderacao`, `apoio`. Quem cria um aviso da Rede (comunidades, moderação, conversa) deve chamar esta função em vez de `avisar_em`: ela não avisa a si mesmo, não avisa quem bloqueou ou foi bloqueado, respeita a preferência "no site" (menos moderação) e grava tipo, post, alvo e ator para o agrupamento. O pacote conversa já a usa quando existe. `p_texto` é o texto de reserva e **nunca deve levar trecho de post** (o aviso de `chamado`, `nucleo` e `moderacao` é mostrado com esse texto). Para `moderacao`, o aviso chega mesmo que o post tenha sido removido: o texto é o da moderação (protocolo e caminho do recurso).

Os avisos antigos (`avisar_em(..., 'rede')`, sem tipo) continuam aparecendo, com o texto, sem agrupar. O aviso de resposta que a fundação, consertos e publicar gravam ("Fulana respondeu ao seu post na Rede Lúcia: …") é reconhecido por um gatilho e ganha tipo, post, alvo e ator, **sem mudar o texto** (a Rede de hoje continua mostrando o mesmo).

## 2. Decisões

1. **Agrupar sem expor.** "Ana e mais 3 responderam" usa só codinomes de quem respondeu, que já aparecem na conversa. **Apoio nunca leva nome**: a ESPEC (decisão 3) diz que ninguém vê lista de quem apoiou, e um aviso "Ana e mais 3 apoiaram" seria essa lista. O aviso de apoio diz só a quantidade ("3 pessoas apoiaram o seu post"), e a quantidade já é só do autor. Desfazer o apoio tira o aviso, sem rastro. (Se a coordenação quiser nomes em apoio, é decisão de produto que muda a decisão 3.)
2. **A matriz vale para o aviso.** Cada linha passa por `interno.rede_ve`: aviso de post removido, retido, apagado, silenciado ou fora do alcance da pessoa não aparece nem entra no contador, no resumo ou no push. A moderação é a exceção (o autor precisa saber o que houve com o post removido) e nunca se desliga no site.
3. **Nenhum trecho de post em lugar nenhum.** A lista devolve tipo, contagem, codinomes e o título do post que a pessoa já pode ver; o resumo por e-mail leva contagens e, no máximo, 5 títulos de conversas **para a internet**, sem link (`interno.sem_link`) e sem nome; o push leva só o número.
4. **Padrões.** No site, tudo ligado. E-mail (resumo semanal) e celular **desligados** até a pessoa ligar, e só quem já entrou na Rede (18+ com consentimento em vigor) consegue ligar.
5. **Resumo semanal.** Segunda, 8h de Brasília (`pg_cron`, agendamento `lucia-rede-resumo`), só para quem ligou, no máximo um a cada 6 dias, só se houver aviso novo não lido dos últimos 7 dias, em português. Entra na fila `interno.emails` pelo `interno.email()` de sempre (respeita "e-mails desligados" de Minha conta, tipo `rede_resumo`). O botão "Ver o que seria enviado agora" mostra o texto antes de ligar.
6. **Push sem conteúdo.** O navegador recebe `{"n": 3, "l": "pt"}` cifrado (RFC 8291) e o service worker monta "Você tem 3 avisos na Rede." no idioma da assinatura. Máximo de um envio a cada 10 minutos por pessoa; só avisos criados depois de ligar o aparelho; só dos tipos que a pessoa ligou para o celular (ao ligar pela primeira vez: resposta, menção, chamado e moderação).
7. **SSRF.** O servidor chama o endereço que o navegador entrega. `rede_aviso_push_assinar` só aceita https de serviços de entrega conhecidos (Google FCM, Mozilla, Apple, Microsoft WNS). Se surgir outro serviço legítimo, acrescentar o domínio na expressão da função.
8. **Desligar apaga.** Desligar o aparelho, 404/410 do serviço de entrega, 5 falhas seguidas ou apagar a conta removem a assinatura.

## 3. Leis (conferidas no planalto.gov.br em 04/11/2026)

- **LGPD (Lei 13.709/2018)**: art. 7º, I e art. 8º (consentimento: e-mail e celular só depois que a pessoa liga); art. 6º, III (necessidade: o push leva um número, o e-mail leva contagens); art. 11 (os avisos não revelam opinião política ou filiação, que é dado sensível: só contagem e título de conversa pública); art. 18, IX (revogação do consentimento: desligar apaga a assinatura e o resumo para na hora).
- **Marco Civil (Lei 12.965/2014)**: art. 7º, VII (nenhum dado de aviso vai a terceiro além do serviço de entrega do navegador, que só recebe o número cifrado).
- **ECA Digital (Lei 15.211/2025) e ECA (Lei 8.069/1990)**: a Rede é só 18+ (`rede2_membro`), então a Rede não manda aviso, e-mail nem push a menor. Lembrete já registrado em `docs/rede/V2.md`: a idade é autodeclarada, ponto de revisão jurídica antes de ligar para todos.
- **Código Penal, arts. 138 a 140**: o aviso de moderação sempre chega ao autor e leva o protocolo, para não haver "sumiço" sem explicação.

## 4. O que o Jonathan precisa criar (segredos e configuração)

Nada disto é obrigatório para o resto da Rede funcionar: sem eles, os avisos no site e as preferências funcionam, o resumo por e-mail depende só de e-mail (item 4.4) e o aviso no celular aparece como "ainda não foi ligado neste site".

### 4.1. O par de chaves VAPID (uma vez só)

```
node -e "const c=require('crypto');const e=c.createECDH('prime256v1');e.generateKeys();const b=x=>x.toString('base64url');console.log('VAPID_PUBLIC_KEY='+b(e.getPublicKey()));console.log('VAPID_PRIVATE_KEY='+b(e.getPrivateKey()))"
```

Guarde a **privada** só no cofre de segredos. Nunca vá para o repositório, para o chat nem para o navegador.

### 4.2. Variável pública do site: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

No Vercel (Settings → Environment Variables, Production e Preview): `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = o valor de `VAPID_PUBLIC_KEY`. Ela é pública por natureza (vai no navegador) e é lida **na hora da construção**: depois de criar, publique de novo. Sem ela, o botão "Avisar neste aparelho" não aparece.

### 4.3. A função `enviar-push` no Supabase

1. Segredos da função (Edge Functions → Secrets, ou `supabase secrets set`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_ASSUNTO` (`mailto:institutolucia@tutamail.com`) e `PUSH_SEGREDO` (um texto longo sorteado, opcional, recomendado). `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` o Supabase já entrega.
2. Publicar: `supabase functions deploy enviar-push`.
3. Dizer ao banco onde ela está (SQL Editor, uma vez; o mesmo desenho de `enviar-emails`):
   ```sql
   insert into interno.configuracoes (chave, valor)
   values ('push', jsonb_build_object(
     'funcao', 'https://<projeto>.supabase.co/functions/v1/enviar-push',
     'chave_publica', '<a chave anon do projeto>',
     'segredo', '<o mesmo valor de PUSH_SEGREDO>'))
   on conflict (chave) do update set valor = excluded.valor;
   ```
4. O agendamento `lucia-rede-push` (a cada 2 minutos) é criado pela própria migração quando `pg_cron` e `pg_net` estão ligados (já estão, por causa dos e-mails). Para pausar o push inteiro, apague a linha `push` de `interno.configuracoes`.

### 4.4. O resumo semanal por e-mail

Reusa o envio de e-mails que já existe: `RESEND_API_KEY` (segredo da função `enviar-emails`), `EMAIL_REMETENTE`, `EMAIL_RESPOSTA` e, na reserva, a variável `EMAILS` = `sim` do workflow `emails.yml`. **Nada novo para criar** se os e-mails já estão no ar. O agendamento `lucia-rede-resumo` (segunda, 11h UTC) vem da migração. Para rodar à mão: `select interno.rede3_aviso_resumo_semanal();`. Para pausar para todos: `select cron.unschedule('lucia-rede-resumo');`.

### 4.5. Ordem para ligar

1. Rodar a migração (junto com as outras da Rede, na ordem de `docs/rede/V2.md`).
2. 4.4 já vale (e-mail), mas só para quem ligar.
3. 4.1 a 4.3 para o push; publicar o site de novo depois de 4.2.
4. Ligar `rede-v2` pelo nome. Em iPhone/iPad o push só funciona com o site adicionado à tela de início (a tela avisa).

## 5. Limites conhecidos

- O resumo semanal sai em português (todos os e-mails do instituto saem em português hoje).
- Os 200 avisos mais novos de cada pessoa entram no agrupamento; o resto fica só no banco até a faxina (lidos há mais de 120 dias saem na rotina semanal).
- Sair da conta não desliga o push do aparelho: quem usa aparelho compartilhado deve tocar em "Desligar neste aparelho" antes de sair. (Pedido de integração: chamar `rede_aviso_push_cancelar` no sair, se houver gancho.)
- O evento `pushsubscriptionchange` não é tratado: se o navegador trocar a assinatura sozinho, a pessoa liga de novo.
- Os textos em en, es, fr, ru e zh são rascunho (`_rascunho: true`), sem revisão.
- `rede_avisos_prefs` teve a conferência de `tipo` trocada por uma que aceita também `apoio` e `resumo`. Se outro pacote mexer nessa conferência, deve manter esses dois valores.

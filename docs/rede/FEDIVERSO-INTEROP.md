# Fediverso: roteiro de interoperabilidade

Como provar, de fora, que a Alumia se comporta como um servidor do Fediverso. São quatro etapas: a **A** é automática (um
comando, sem conta nenhuma); a **B**, a **C** e a **D** são manuais, com contas que já existem em outros servidores. Cada
rodada fica registrada na tabela do fim.

O plano de origem é `docs/plano-2026-11/PLANO-FEDIVERSO.md`, seção 6. O que a Alumia publica e aceita está em
`docs/rede/FEDIVERSO.md`.

## Limites de quem executa

- **Não criar conta** em servidor nenhum. As etapas manuais usam contas que o dono do projeto já tem (Mastodon, Lemmy e, se
  houver, Misskey/Sharkey ou GoToSocial), com a sessão aberta no navegador dele.
- **Não publicar nada fora da Alumia** sem o dono dizer que pode. Os cliques de publicar, seguir e denunciar lá fora são dele.
- Do lado da Alumia, usar uma **conta de teste do próprio projeto**, com a federação ligada no perfil.
- **Threads e Bridgy Fed não entram como servidor de teste.** Por decisão do Instituto, o Threads não entra (bloqueio fixo,
  sem interruptor desde 12/11/2026) e o Bridgy Fed fica desligado. Os dois só aparecem aqui como **teste negativo**: a caixa de entrada
  tem de responder `403 instancia_bloqueada` (passo A12). Ninguém segue, busca ou publica para `threads.net` ou `brid.gy`
  durante o roteiro.

## Antes de começar

| O que | Como conferir |
|---|---|
| A versão com o Fediverso total está publicada e a migração do banco foi rodada | `docs/rede/FEDIVERSO.md` |
| `fediverso-total` ligado | painel de recursos |
| A conta de teste da Alumia ligou a federação (consentimento atual) | perfil da conta de teste |
| `threads.net` e `brid.gy` estão na lista de instâncias bloqueadas | mediação da Alumia |
| O Cloudflare não desafia `/.well-known/*` nem `/api/fediverso/*` | o passo A13 acusa se desafiar |

## Etapa A: caixa-preta (automática, sem conta)

```
npm run testar:fediverso-interop -- https://alumia.institutolucia.org --conta <teste>
```

ou, direto: `node scripts/fediverso-interop.mjs https://alumia.institutolucia.org --conta <teste>`.

`<teste>` é o @ local da conta de teste (só o nome, sem domínio). O comando termina com
`N conferências certas, M com problema` e sai com código diferente de zero se algo falhar. Opções: `--tudo` lista também o que
deu certo; `--json` devolve tudo em JSON (para guardar junto da rodada); `--autoteste` roda as conferências contra uma Alumia
simulada, sem rede, para provar o próprio conferidor.

O que o comando faz e o que não faz:

- Só faz pedidos HTTP **à própria Alumia** (o host dela e o domínio curto). Um endereço de outro host que apareça numa resposta
  não é pedido.
- Não cria conta, não segue, não publica, não manda nada a terceiros.
- Os POSTs à caixa de entrada usam como ator o **ator da própria instância** e uma chave gerada na hora e jogada fora. Todos têm
  de ser **recusados**; nada é gravado.
- Os POSTs do bloqueio (A12) vão sem assinatura: a caixa confere o bloqueio antes de tudo, então a Alumia responde sem buscar
  nada em `threads.net` nem em `brid.gy`.
- Os pedidos saem com User-Agent de servidor do Fediverso (não de navegador): é assim que o Cloudflare decide se desafia.

| # | Pedido | Esperado |
|---|---|---|
| A1 | `GET /.well-known/webfinger?resource=acct:<teste>@institutolucia.org` nos **dois** hosts | 200 `application/jrd+json`; `subject` canônico no domínio curto; `self` = ator; `Vary: Host` |
| A2 | `GET` do ator com `Accept: application/activity+json`; e de novo com `Accept: text/html` | `Person` com `inbox`, `outbox`, `followers`, `following`, `publicKey.owner` = id; `Content-Type: application/activity+json`; `Vary: Accept`; como navegador, redireciona para `/@<teste>` |
| A3 | `/.well-known/nodeinfo` → documentos 2.1 e 2.0 | cada um passa no esquema oficial (`scripts/dados/nodeinfo-2.*.schema.json`), com o `profile` certo |
| A4 | `POST /api/fediverso/inbox` sem assinatura | `401 sem_assinatura` |
| A5 | POST assinado com chave descartável e Digest que não é o do corpo | `401 digest_diferente` |
| A6 | **Manual:** `https://verify.funfedi.dev` e `https://webfinger.net` com a conta de teste | sem erro |
| A7 | `GET /.well-known/host-meta` nos dois hosts | 200 `application/xrd+xml`; cada host aponta o próprio WebFinger |
| A8 | Ator da instância (`/api/fediverso/ator`), o WebFinger dele e a caixa de saída dele | `Application` com `inbox` e `publicKey.owner` = id; caixa de saída vazia |
| A9 | Caixa de saída da conta de teste e a primeira página | `OrderedCollection` com `totalItems` e `first`; a página só traz `Create` do próprio ator |
| A10 | POST assinado com data de 13 horas atrás | `401 data_fora_da_janela` |
| A11 | POST bem formado, assinado com chave que não é a do ator | `401 assinatura_invalida` |
| A12 | **Prova do bloqueio:** POST com ator em `threads.net`, em `www.threads.net` e em `bsky.brid.gy` | `403 instancia_bloqueada` nos três |
| A13 | Todos os pedidos acima, olhados de novo | nenhum caiu em página de desafio do Cloudflare |

Como ler as falhas mais comuns:

| Falha | O que costuma ser |
|---|---|
| A1 certo no host da Alumia e errado no domínio curto | o domínio curto não chega a este app (a ponte do Cloudflare ou a Caddy desviam `/.well-known/` dele) |
| A5, A10 ou A11 voltam `chave_desconhecida` | a Alumia não conseguiu ler o próprio ator da instância para conferir a assinatura (ver A8) |
| A12 volta `401 sem_assinatura` | o domínio não está na lista de instâncias bloqueadas (rode de novo `20261110-fediverso-bloqueio-padrao.sql`, que põe o Threads e o Bridgy Fed como bloqueios fixos) |
| A13, ou qualquer passo com "o Cloudflare respondeu no lugar da Alumia" | Bot Fight Mode ou regra do WAF barrando servidor que não é navegador: ver o item do Cloudflare em `docs/rede/FEDIVERSO.md` |
| Vários `429` | o teto de pedidos por endereço de rede: esperar um minuto e rodar de novo |

## Etapa B: Mastodon público (manual)

Com a conta do Mastodon que o dono já tem (por exemplo em `mastodon.social`). `<teste>` é a conta de teste da Alumia;
`<conta-mastodon>` é a conta de lá.

| # | Ação | Onde conferir | Esperado |
|---|---|---|---|
| B1 | No Mastodon, buscar `@<teste>@institutolucia.org` | busca do Mastodon | o perfil aparece com nome, bio e avatar |
| B2 | Seguir pelo Mastodon | Alumia: aviso `fed_seguidor`; banco: `rede_fed_fila` com `accept`, `feito_em` preenchido e `erro=''` | o botão vira "Seguindo" (não "Pedido") |
| B3 | Na Alumia, publicar um post público com `#teste`, uma imagem com texto alternativo e menção `@<conta-mastodon>@mastodon.social` | Mastodon: linha inicial e notificação de menção | chega em até 2 min; hashtag clicável; imagem com o texto alternativo; menção notificada |
| B4 | Editar o post na Alumia | Mastodon | aparece "editado" |
| B5 | No Mastodon, responder, favoritar e impulsionar o post | Alumia: o fio do post e os avisos `fed_resposta`, `fed_curtida`, `fed_impulso` | tudo no mesmo fio e nos mesmos avisos |
| B6 | No Mastodon, desfazer o favorito e o impulso | Alumia | os avisos somem ou o total cai |
| B7 | Na Alumia, buscar `@<conta-mastodon>@mastodon.social` e seguir | `rede_fed_seguindo.aceito = true` | o perfil remoto abre em `/alumia/fediverso?conta=@<conta-mastodon>@mastodon.social` |
| B8 | No Mastodon, publicar um post público | Alumia: início | aparece no início, no mesmo cartão dos posts daqui |
| B9 | Na Alumia, curtir, impulsionar e responder esse post | Mastodon: notificações e o fio | a resposta aparece em fio no Mastodon |
| B10 | No Mastodon, publicar um post **só-seguidores** e um **direto** para a conta da Alumia | Alumia | o só-seguidores aparece só para a conta que segue; o direto **não** aparece em lugar nenhum |
| B11 | No Mastodon, denunciar o post da Alumia marcando "encaminhar ao servidor remoto" | mediação da Alumia | chega uma denúncia com protocolo |
| B12 | Na Alumia, apagar o post | Mastodon | o post some |
| B13 | Na Alumia, desligar a federação da conta de teste | Mastodon | o perfil some ou dá 410; os posts somem; o seguir cai |
| B14 | A mediação bloqueia `mastodon.social` e depois desbloqueia | `rede_fed_fila` sem entregas para o domínio; a caixa responde 403 | nada entra nem sai enquanto está bloqueado; volta ao normal depois |

Para repetir a etapa depois do B13, ligar de novo a federação da conta de teste.

## Etapa C: Lemmy (manual)

Com a conta do Lemmy que o dono já tem (por exemplo em `lemmy.ml`).

| # | Ação | Onde conferir | Esperado |
|---|---|---|---|
| C1 | Na Alumia, buscar `@<comunidade>@lemmy.ml` (um Group) e seguir | Alumia: `/alumia/fediverso?conta=@<comunidade>@lemmy.ml` | a comunidade abre como perfil remoto e o seguir é aceito |
| C2 | Esperar um post novo na comunidade do Lemmy (ou o dono publica um) | Alumia: início | o post (Page) aparece, e os comentários (Note) entram como fio dele |
| C3 | Só com `fediverso-grupos` ligado: no Lemmy, buscar `!<comunidade-aberta>@institutolucia.org` | busca do Lemmy | a comunidade da Alumia aparece |
| C4 | Só com `fediverso-grupos` ligado: no Lemmy, seguir a comunidade e publicar nela pela Alumia | Lemmy: a comunidade | os posts da comunidade chegam (Announce do Group) |

## Etapa D: Misskey/Sharkey e GoToSocial (manual, opcional)

São os mais rígidos com assinatura e WebFinger. Só se o dono já tiver conta num deles. Repetir os passos **B1, B2, B3, B7 e B8**
da etapa B, trocando o Mastodon pelo servidor da vez, e registrar como D1 a D5.

| # | Passo repetido | Esperado |
|---|---|---|
| D1 | B1 (buscar a conta de teste) | o perfil aparece |
| D2 | B2 (seguir a conta de teste) | o seguir é aceito |
| D3 | B3 (post da Alumia com hashtag, imagem e menção) | chega, com imagem e menção |
| D4 | B7 (seguir de dentro da Alumia) | o perfil remoto abre em `/alumia/fediverso?conta=@…` e o seguir é aceito |
| D5 | B8 (post de lá) | aparece no início da Alumia |

## Como registrar

Uma tabela por rodada. A versão do servidor de fora sai do NodeInfo dele (`/.well-known/nodeinfo` do servidor). Num passo que
falhou, anotar a linha de `rede_fed_fila.erro` ou o motivo devolvido pela caixa. Uma falha vira item para quem cuida daquela
parte (saída, entrada, banco ou tela). Na etapa A, basta anotar a linha final do comando e, se houver, os passos com problema.

**A Alumia é um servidor do Fediverso quando:** A1 a A13, B1 a B14 e C1 e C2 passam (C3 e C4 quando `fediverso-grupos` estiver
ligado), sem nenhuma aba "Fediverso" à parte na interface.

### Rodada 1

| Campo | Valor |
|---|---|
| Data | |
| Versão publicada da Alumia | |
| Conta de teste da Alumia | |
| Etapa A: linha final do comando | |

| Etapa | Servidor | Versão do servidor | # do passo | Resultado (ok / falhou / não feito) | Erro ou motivo devolvido |
|---|---|---|---|---|---|
| A | Alumia | | A1 a A5, A7 a A13 | | |
| A | verify.funfedi.dev / webfinger.net | | A6 | | |
| A | Alumia (teste negativo: Threads) | | A12 | | |
| A | Alumia (teste negativo: Bridgy Fed) | | A12 | | |
| B | | | B1 | | |
| B | | | B2 | | |
| B | | | B3 | | |
| B | | | B4 | | |
| B | | | B5 | | |
| B | | | B6 | | |
| B | | | B7 | | |
| B | | | B8 | | |
| B | | | B9 | | |
| B | | | B10 | | |
| B | | | B11 | | |
| B | | | B12 | | |
| B | | | B13 | | |
| B | | | B14 | | |
| C | | | C1 | | |
| C | | | C2 | | |
| C | | | C3 | | |
| C | | | C4 | | |
| D | | | D1 | | |
| D | | | D2 | | |
| D | | | D3 | | |
| D | | | D4 | | |
| D | | | D5 | | |

Para uma rodada nova, copiar as duas tabelas acima com o título "Rodada 2", "Rodada 3" e assim por diante. Não apagar as
rodadas antigas: elas mostram o que já passou e quando.

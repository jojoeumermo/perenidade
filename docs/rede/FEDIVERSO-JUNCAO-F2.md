# Fediverso: nota de junção da frente F2 (entrada, interações e fila)

O que a F2 combina com as outras frentes além da seção 3 do `PLANO-FEDIVERSO.md`. Vale para quem junta a F2 com a F1 (saída e
identidade), a F3 (banco) e a F4 (tela). Tudo isto fica atrás de `fediverso-total` (e de `fediverso-grupos`, no caso do Group).

## 1. Ações de `public.rede_fed_servidor` (F3)

A F2 segue o que a migração da F3 (`supabase/migracoes/20261109-fediverso-total.sql`) já faz. Os pontos que divergiam da seção 3.1:

| ação | o que a F2 manda | situação |
|---|---|---|
| `fila_pegar` | lê também `comunidade` e `assinante` (`pessoa`, `grupo`, `instancia`) | igual à F3 |
| `fila_feito` | `{id, ok, definitivo, erro, status, dominio}` e, no 429, `espera` (segundos) | igual à F3. A F2 tirou `adiar_ate`, `sem_tentativa` e `sumiu` |
| `fila_feito` (devolver sem gastar tentativa) | `status: 429`, `espera` e `erro` = `dominio_morto` ou `sem_tempo` | usa o caminho do 429 da F3, que devolve a tentativa. Se a F3 preferir um campo próprio, trocar em `entrega.ts` (`devolver`) |
| `fila_feito` (circuito) | lê `morto_ate` na resposta | igual à F3 (devolve na 5ª falha) |
| `interacao` (Announce de nota de fora) | `{tipo:'announce', ator, atividade_id, post_local: <url da nota de fora>, sim:true}` **antes** de buscar a nota | igual à F3: ela só aceita se alguém daqui segue quem impulsionou. Sem isso, a F2 não toca na rede |
| `interacao` (Undo só com id) | `{ator, atividade_id, sim:false}`, sem `tipo` | a F3 aceita `tipo` nulo no Undo e apaga por `(atividade, ator)` |
| `nota_recebida` | `impulso: {ator, atividade_id}` | **pendente na F3.** Hoje ela só guarda se alguém segue o AUTOR da nota. Pedido: guardar também quando já existe em `fediverso_interacoes` um `announce` de entrada com aquele `atividade_id` (a `interacao` acima só o grava se alguém segue quem impulsionou). Sem isso, o impulso entra em `fediverso_interacoes`, mas a linha mista não o mostra, porque a nota não está em `rede_fed_recebidos` |
| `nota_recebida` | `comunidade: <slug>` | **pendente na F3** (ela ignora). A F2 só manda quando a nota chegou na caixa do Group **e** é endereçada a ele (`to`, `cc` ou `audience`). Enquanto o Group tem `postingRestrictedToMods` (F1), ignorar é o certo |
| `comunidade_seguidor` | `{slug, ator, inbox, compartilhada, pedido, sim}` | igual à F3. O nome antigo `grupo_seguidor` saiu |
| `comunidade`, `comunidade_chaves` | `{slug}` e `{slug, publica, privada}` | igual à F3 e à F1. A caixa `c/[slug]/inbox` só existe para `estado = 'ligado'` |
| `ator`, `chaves` | como antes | a F2 chama `atorComChaves` antes de seguir, curtir ou responder, e na fila quando falta a chave |

## 2. Funções da tela (F3) e rotas (F4)

- `rede_fed_eu` recebe `p_acao` `interagir`, `responder` e `remoto` (a F3 já aceita). As rotas recusam com 409 quem tem `ligado = false`
  e conferem de novo pela ação `ator`, que também olha o impedimento.
- **A tela (F4) não chama `rede_fed_linha_mista` direto.** Ela chama `GET /api/fediverso/remoto?linha=1&cursor=…&limite=…`, que devolve
  `{itens, proximo}` com `avatar` e `midia[].url` trocados pela rota-proxy assinada. O `?midia=` saiu: nenhuma rota assina URL que a
  tela manda.
- As URLs da rota-proxy (`/api/fediverso/midia?u=…&e=…&s=…`) vencem em 7 a 14 dias. Quem guarda a página por mais tempo pede a linha de novo.

## 3. Chaves do Group (F1 e F3)

- `keyId` do Group: `<base>/api/fediverso/c/<slug>#main-key` (`enderecos.chaveDaComunidade`, da F1). A F2 assina os `group-announce` e
  `group-accept` com ele.
- A chave da comunidade é gerada em JavaScript (RSA não se gera no SQL) por quem precisar primeiro: a rota do Group (F1), ao ser lida,
  ou a fila (F2, `comunidadeComChaves` em `lib/rede/fediverso/servidor.ts`). As duas usam `comunidade_chaves`, que grava só se ainda
  não há chave. Assim, as duas nunca ficam com pares diferentes.
- O `group-announce` de um post apagado sai como `Announce(Delete)` com o próprio Group de ator (o item da fila não traz o autor).
  Conferir com o Lemmy na fase de interoperabilidade.

## 4. O que o teste da F2 não prova (repetir com o SQL real em `scripts/testar-fediverso-banco.mjs`)

`scripts/testar-fediverso-entrada.mjs` usa um banco dublê. Ele prova que o código manda os campos certos e reage ao que o banco
devolve. As regras abaixo são do banco e precisam de teste com o SQL de verdade:

1. `fila_feito` com status 410 apaga o seguidor (das pessoas e das comunidades) daquela caixa.
2. O circuito conta as falhas de conexão entre as chamadas, mata o domínio na 5ª (1 h, 6 h, 24 h) e `fila_pegar` não entrega o domínio morto.
3. O 429 devolve a tentativa e respeita `espera`.
4. Nota só-seguidores só é guardada com seguidor daqui e só é mostrada a ele. Nota direta nunca é guardada.
5. `interacao` com nota de fora só aceita o impulso de quem alguém daqui segue.
6. `ator` não devolve chave a quem desligou a federação ou tem impedimento.

## 5. Fica para a próxima rodada

- RFC 9421 na entrada (o plano marca como opcional nesta rodada). A entrada aceita só a assinatura cavage, como o Mastodon 4.5 ainda manda.
- `Move` com `alsoKnownAs` (opcional no plano).
- `app/api/fediverso/buscar/route.ts`: a busca continua só em texto e não mostra avatar. Na próxima rodada, ela passa a usar o formato de
  `remoto/route.ts` (avatar por `urlDaMidia`).
- As rotas novas são de API (`/api/fediverso/...`), não páginas. Por isso não entram em `lib/interdicao.ts`, como as rotas da
  federação que já existem. A página que as usa (F4) entra na área `comunidade`.

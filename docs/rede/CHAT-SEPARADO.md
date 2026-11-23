# Alumia: o chat como sistema separado

**Situação em 19/11/2026 (onda R3, item 3.1):** o servidor do chat existe como sistema próprio, com código, banco e segredos próprios,
fora do Supabase da rede social. Está **pronto e provado em contêiner, e não está no ar**: o chat continua nas rotas do site (o modo da
R2) até a troca, que é por configuração. Este documento descreve o servidor, a interface pequena entre os dois sistemas e o que cada
um vê.

Testes: `scripts/testar-r3-servidor.mjs` (o banco próprio, num Postgres local, rodado duas vezes), `scripts/testar-r3-servidor-interface.mjs`
(a interface do lado do site: a pergunta da franquia, o endereço do servidor e o registro), e a prova em contêiner
`scripts/r3-servidor-conteiner.mjs` (o servidor de verdade, com o cliente de sempre, os passes, a franquia e o aceite do administrador
da rede; com `--duas`, o chat entre instâncias, `docs/rede/INSTANCIAS.md`). `scripts/testar-r3-passes.mjs` cobre os passes por RSA
cego.

## Onde fica

| O quê | Onde |
|---|---|
| Servidor (Rust: `axum`, `tokio`, `tokio-postgres`, `ring`, `rustls`) | `nativo/servidor-chat/src/` |
| Banco próprio (Postgres 17: esquema `chat`) | `nativo/servidor-chat/banco/001-chat.sql` |
| Imagem (duas etapas, imagens fixadas por resumo) | `nativo/servidor-chat/Dockerfile` |
| Onde o aparelho fala com o chat (configuração, registro, adaptador) | `lib/rede/caixas/servidor-do-chat.ts` |
| A pergunta da franquia (o lado do site) | `lib/rede/caixas/franquia-servidor.ts`, `app/api/alumia/franquia/denunciar/route.ts` |
| Passes por RSA cego (emitidos pelo site, conferidos com a chave pública) | `lib/rede/passes/`, `app/api/alumia/passes/` |

## O servidor

As rotas das caixas têm **o mesmo JSON** das rotas da R2 (`/api/alumia/caixa/*`), sem o `/api/alumia` do começo:

| Rota | Corpo | O que paga |
|---|---|---|
| `POST /caixa/lote` | `{itens:[{acao:'criar'│'depositar'│'pedido', …}]}` | criar: um passe ou a prova de trabalho de fora; pedido: passe + prova de 20 bits, ou só a prova de fora (22 bits) |
| `POST /caixa/buscar`, `/caixa/confirmar`, `/caixa/trocar`, `/caixa/apagar` | `{id, pl, …}` | o passe de leitura da caixa |
| `POST /cofre/ler`, `/cofre/gravar`, `/cofre/apagar` | `{id, pl}` / `{id, pd, versao, blob}` | o cofre anônimo: criar (versão 0) paga como criar caixa |
| `GET /desafio` | — | o desafio da prova de trabalho: `{desafio, bits, bits_com_passe}` |
| `GET /saude` | — | — |
| `POST /interno/franquia/conferir` | `{marcas:[{c, id_h, pd_h, dia, marca}]}` → `{confere:[bool]}` | o token da interface (só a rede social) |

Regras de todas: pedido com cookie de sessão ou com `Authorization` que não seja um passe é recusado (`sem_sessao_aqui`), então o JWT
de serviço da rede social não abre nada; sem cache; sem log de pedido, de corpo nem de endereço de rede; corpo com teto. O servidor não
tem conta, sessão, diretório nem registro: não sabe de quem é caixa nenhuma.

O **cofre anônimo** guarda a lista sincronizada e a cópia de segurança fora da conta: uma caixa de um lugar só, com o id e os passes
tirados da chave de sincronia do aparelho (rótulos `alumia/r3/cofre-anonimo/{caixa,deposito,leitura}/v1`). O servidor não sabe de qual
conta é. No modo de hoje (sem servidor separado) a lista continua em `rede_cofres_da_conta` (R2).

### O banco próprio

Esquema `chat`: `caixas`, `pacotes`, `caixa_contagem`, `passes_gastos`, `cofres`. Nenhuma coluna de conta, de hora (só o dia) ou de
endereço; os ids das caixas são resumos (SHA-256 com rótulo) e os passes ficam só como resumos. As funções do lote são as da R2
(`20261124-r2-caixas.sql`), portadas: uma transação por lote, em ordem sorteada (o mesmo `xmin` para todos), passe de depósito errado
igual ao certo, teto por caixa, um depósito "único" por caixa de época. O servidor entra com o papel `chat_servidor`, que **só executa
as funções** (não lê tabela nenhuma); a limpeza roda a cada 6 horas (pacotes de 30 dias, caixas vencidas, passes gastos velhos).

### Os segredos

`CHAT_FRANQUIA_SEGREDO` (a marca da franquia e a chave do desafio da prova de trabalho), `CHAT_INTERFACE_TOKEN` (a pergunta da
franquia) e a senha do banco dele. **Nenhum segredo da rede social.** Rotação: `CHAT_FRANQUIA_SEGREDO_ANTERIOR` confere marcas feitas
antes da troca pelos 90 dias do prazo da denúncia (marca nova sai sempre com o segredo novo); `CHAT_INTERFACE_TOKEN_ANTERIOR` vale
junto durante a troca do token. As comparações são em tempo constante.

### Os passes

A rede social **emite** os passes (com a sessão da conta aprovada, como na R2); o servidor do chat os **confere só com a chave pública**
da semana (RFC 9578, tipo `0x0002`: RSA cego, RSA-PSS com SHA-384), lida da rota pública da rede (`GET /api/alumia/passes/chave`), com
o id da chave conferido. Vale a chave da semana e a da anterior; o passe gasto vira um resumo no banco do chat (repetido, recusado). A
chave privada da semana fica selada no banco da rede com `ALUMIA_PASSES_SEGREDO` e é publicada no registro de transparência; na troca
desse segredo, `ALUMIA_PASSES_SEGREDO_ANTERIOR` ainda abre a chave da semana (a emissão não para).

### O contêiner

Usuário sem privilégios (`10001:10001`), sistema de arquivos só de leitura, nenhuma capacidade do kernel, sem ganhar privilégio, numa
rede interna só com o banco do chat e a borda. A prova em contêiner confere isso no Docker (não só pede): escrever no disco é
recusado, sair para a internet não acontece, nenhuma porta é publicada.

## A interface com a rede social (pequena, de propósito)

- **Rede → chat**: nenhuma chamada no caminho da mensagem. Só a denúncia com prova: a denúncia é de uma conta e continua no site (a
  autoria, o compromisso e o trecho são conferidos lá); o site pergunta ao servidor do chat se cada **marca** confere
  (`POST /interno/franquia/conferir`, cabeçalho `Authorization: AlumiaInterface <token>`). A pergunta leva só as marcas, nenhum campo
  de conta; a resposta é "confere" ou "não confere" para cada uma. Sem resposta, a denúncia responde `sem_servico` (nunca "confere"
  por falta de resposta). No site: `ALUMIA_CHAT_INTERNO` (o endereço interno do servidor do chat) e `CHAT_INTERFACE_TOKEN`.
- **Chat → rede**: `GET` da chave pública dos passes da semana. Só isso.

## Como o aparelho escolhe o servidor

`NEXT_PUBLIC_ALUMIA_CHAT_SERVIDOR`: vazio = o próprio site (o modo da R2, como hoje); senão, o endereço do servidor do chat (https, sem
barra no fim). Endereço torto na configuração vira "o próprio site", nunca um lugar inesperado. O endereço também vai ao registro
público de transparência (linha `servidor-chat`, `sc1:<endereço>`, anotada só pelo dono do banco): o aparelho **só aceita o último
endereço anotado lá** (`sc1:` vazio = o chat voltou para o site). Quem troca o endereço no site ou no build sem passar pelo registro
não leva as conversas para outro lugar sem que o registro mostre.

Com o servidor separado, o transporte das caixas passa pelo adaptador `fetchDoChat`: as chamadas a `/api/alumia/caixa/*` vão a
`<servidor>/caixa/*`, e o resto (emitir passes, o diretório, a denúncia) continua no site. O pedido de conversa vai direto à caixa de
pedidos da pessoa no servidor do chat (o id e o passe de depósito vêm do diretório, como na R2).

**Registro e configuração diferentes: nada sai.** Se o registro conferido aponta um servidor separado e o aparelho está configurado
para outro lugar (inclusive o próprio site), ou o contrário, as rotas das caixas são **recusadas** (`servidor_do_chat_fora`), em vez de
cair no site em silêncio. Assim um aparelho que ficou para trás não deposita onde ninguém lê.

**Os apps ainda não falam com o servidor separado.** O fetch nativo do Android só aceita a origem do site, o do computador (Rust) só
`ORIGEM_DA_REDE`, e a casca dos apps não recebe o endereço do servidor do chat no build. Com o servidor separado anotado no registro,
os apps recusam as caixas (acima) até isto ser feito: liberar no nativo (Android e Rust) o endereço que a vista do registro conferiu,
levar o endereço ao build da casca e provar app ↔ servidor em contêiner. Ligar o servidor separado antes disso tira o chat dos apps.

## O que cada um vê

| Quem | Vê | Não vê |
|---|---|---|
| O servidor do chat | caixas (por resumo), pacotes cifrados de tamanho fixo, o dia, quantos pacotes por caixa por dia, passes e desafios gastos (por resumo), o endereço de rede de quem chama (a via Tor/mixnet tira) | conta, codinome, diretório, quem é dono de qual caixa, o conteúdo, a hora |
| A rede social | as contas, o diretório, a emissão dos passes (quem pegou o lote do dia), a denúncia com prova (feita por uma conta) | as caixas, os pacotes, quem fala com quem, o segredo da franquia, as credenciais do chat |
| O administrador da rede social, com a chave de serviço e o banco inteiro | o mesmo que a rede social | **nenhuma linha do chat** (as caixas do banco da rede ficam vazias), **nenhuma credencial do chat** (o JWT de serviço e o cookie são recusados em todas as rotas), e **não apaga nada** (apagar pede o passe de leitura da caixa) |

## Limites, ditos sem rodeio

- **Não está no ar** nesta onda. Até a troca, o chat roda nas rotas do site e o banco da rede guarda as caixas (como na R2).
- A rede social **emite** os passes: quem toma a rede pode criar passes à vontade. Isso dá spam (caixas e pedidos), não leitura.
- O servidor do chat vê o endereço de rede de quem chama, como qualquer servidor; a via Tor/mixnet (`lib/rede/caixas/vias.ts`) tira.
- A conexão do servidor com o banco dele é sem TLS, dentro da rede interna do contêiner.
- O desafio da prova de trabalho e a marca da franquia saem do mesmo segredo, por rótulos diferentes (HKDF); trocar o segredo invalida
  os desafios abertos (10 minutos).

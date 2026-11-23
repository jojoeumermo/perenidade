# Alumia: chat entre instâncias

**Situação em 19/11/2026 (onda R3, item 2.7):** organizações parceiras podem rodar a própria Alumia, e o chat passa de uma instância
para a outra pelas **caixas anônimas**, sem que uma instância aprenda quem da outra fala com quem. O protocolo está pronto e provado
com duas instâncias em contêiner; ele **pede o servidor do chat separado** (`docs/rede/CHAT-SEPARADO.md`), que ainda não está no ar.
Desligado enquanto `ALUMIA_INSTANCIA` não estiver configurado.

Testes: `scripts/testar-r3-instancias.mjs` (o endereço, o registro da outra instância, o diretório e as pré-chaves de fora, com as
rotas de verdade do site) e, com os dois servidores do chat em contêiner, `scripts/r3-servidor-conteiner.mjs --duas` (a conversa
inteira e o que cada instância guardou).

## Onde fica

| O quê | Onde |
|---|---|
| O endereço `codinome@instancia` | `lib/rede/instancias/endereco.ts` |
| Conhecer a outra instância, o diretório e as caixas de fora | `lib/rede/instancias/cliente.ts` |
| O cartão da instância (nome, servidor do chat, registro) | `app/api/alumia/instancia/route.ts` |
| Pré-chaves pagas com prova de trabalho de fora | `app/api/alumia/diretorio/reivindicar/route.ts` |

## O endereço

`codinome@instancia`: o codinome com a regra de sempre e a instância como o nome do site da organização (só o nome: sem esquema, porta,
caminho, usuário ou endereço IP). A última `@` separa.

## O protocolo

A Ana é da instância A; a Bia, da B. O aparelho da Ana fala **direto com a B**, sem passar pela A:

1. **Conhecer a B**: `GET https://<B>/api/alumia/instancia?desde=<n>` → `{v: 1, nome, chat, ponta, linhas}`: o nome da instância, o
   servidor do chat dela e o registro público de transparência dela (as mesmas linhas de `rede_kt_trecho`). O aparelho confere a
   corrente a partir da vista que já guardava da B: na **primeira vez**, aceita o que vê (confiança na primeira vez, dito na tela);
   depois, só aceita a continuação (passado reescrito = `kt_quebrado`). O servidor do chat da B tem de ser o **último anotado no
   registro da B** (`servidor-chat`); a B sem chat separado não fala com outras instâncias.
2. **O diretório da Bia na B**: a rota anônima de sempre (`POST /api/alumia/diretorio/ler`). A identidade da conta da Bia é conferida
   no registro **da B** (chave fora do registro: recusada).
3. **As pré-chaves da Bia**: `POST /api/alumia/diretorio/reivindicar` **sem passe**, com `{desafio, nonce}`: o desafio do pedido de
   conversa da B (`GET /api/alumia/pedido/desafio`) resolvido com **22 bits** de prova de trabalho. O resumo do desafio é gasto no lugar
   do passe (repetido, recusado). Só com o chat entre instâncias ligado na B.
4. **As caixas**: a Ana cria, no servidor do chat da B, a caixa onde vai ler as respostas, e deposita o pedido de conversa na caixa de
   pedidos da Bia; as duas coisas pagam com prova de trabalho de fora (`GET <chat>/desafio`: 22 bits por padrão, a B pode pedir até
   24, o aparelho não resolve mais que isso). Daí em diante a conversa segue nas caixas da B, como qualquer conversa: a cifra é a de
   sempre (Proteus dentro do envelope X-Wing; `docs/rede/CHAT-PRIVADO.md`).

5. **Quem pede**: o pedido de conversa é o de sempre (`lib/rede/chat/r2/pedido.ts`: HPKE X-Wing para a chave de pedidos da Bia,
   assinado pela identidade da Ana) com mais um campo **dentro do assinado**: `instancia` (o nome da A). O aparelho da Bia confere a
   assinatura e depois confere que essa identidade é a da conta do codinome **no diretório e no registro da A**
   (`conferirRemetenteDeFora`): pedido de fora com outra identidade, ou sem `instancia`, é recusado. Daí em diante, cada depósito leva o
   compromisso da franquia (`c`) e a busca o devolve, como na mesma instância: sem `c`, o envelope da conversa não abre.

**Situação do protocolo:** a conversa com a pilha de verdade (o pedido assinado e conferido no registro da A; Proteus + SPQR + X-Wing
com a franquia nas caixas de fora) está provada em `scripts/testar-r3-instancias.mjs` (parte 4b) sobre um servidor do chat de mentira
com o mesmo JSON do de verdade; a prova em contêiner (parte 5) cobre o **transporte** entre os dois servidores do chat de verdade, com um
envelope de teste. **Ainda não está ligada na tela de conversas**: ligar é passo seguinte, junto do servidor do chat separado no ar.

**Por que sem passe:** um passe da A diria à B de qual instância a pessoa vem (e a B nem tem como conferir passe da A). A prova de
trabalho não diz nada de quem paga; o teto por caixa continua valendo.

Todas as chamadas vão sem cookie, sem sessão e sem referência de página, pela via escolhida (direta, Tor ou mixnet).

## O que cada instância vê

| Quem | Vê | Não vê |
|---|---|---|
| A instância da Ana (A) | nada da conversa: o aparelho não conta à A com quem fala, nem que fala com alguém de fora | a outra instância, a Bia, as caixas, os pacotes |
| A instância da Bia (B) | o que vê de qualquer remetente: alguém leu o diretório de um codinome, alguém reivindicou pré-chaves, uma caixa foi criada, uma caixa recebeu um pacote; o endereço de rede de quem chama (a via Tor/mixnet tira) | a conta da Ana, de qual instância ela vem, quem é o dono da caixa de respostas, o conteúdo |

A prova em contêiner confere, depois de uma conversa: o aparelho da Ana não falou com a A nem uma vez; nenhuma linha do banco do chat
da B tem a conta da Ana, o nome da A, a caixa da Ana na A ou os passes crus dela (e o banco nem tem coluna onde guardar origem, conta ou
endereço); o banco do chat da A não ganhou nada.

## Limites

- **Confiança na primeira vez**: um aparelho que nunca viu a B aceita o registro que a B mostrar. Comparar o código de segurança com a
  Bia por outro canal fecha isso, como na conversa dentro da mesma instância.
- A B vê o endereço de rede da Ana sem a via Tor/mixnet.
- A prova de trabalho encarece, não impede: quem gasta processamento pode criar caixas e pedidos de fora (o teto por caixa segura a
  enxurrada numa caixa só) e esgotar as pré-chaves de alguém (como quem tem passes, dentro da instância).
- Quando a Bia confere quem é a Ana, o aparelho dela faz o mesmo caminho na A (lê o diretório da Ana na A): a A vê que alguém leu o
  diretório da Ana, não quem.
- Sem o servidor do chat separado no ar, o chat entre instâncias não liga.

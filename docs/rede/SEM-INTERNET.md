# Mensagens sem internet

Quando a internet cai num ato (antena lotada, bloqueio, área sem sinal), o app da Alumia para Android pode passar **mensagens curtas,
o Farol do ato e o "Estou bem"** de celular em celular, por Bluetooth. Cada celular guarda e repassa pacotes cifrados que ele não
abre: não sabe de quem são nem para quem vão.

Este documento é público e descreve o desenho como ele está no código (`lib/rede/malha/`). As provas formais do protocolo estão em
[`provas/`](../../provas/LEIA-ME.md).

## Só liga quando a pessoa liga

- Fica **desligado** por padrão, e desligado de novo cada vez que o app abre. Nada fica gravado dizendo "ligue sozinho".
- Para ligar, na tela do modo ato ("Perto, sem internet"), a pessoa marca o aviso: **celulares próximos percebem que há um aparelho
  participando**. Sem o aviso marcado, o botão não liga (e o código recusa: `ligarMalha` exige o aviso).
- Desligar apaga tudo o que o celular estava guardando de outras pessoas.
- Só no app Android. No site, o cartão só explica; o código das cifras da malha nem é baixado.

## O pacote

Todo pacote tem **3254 bytes**, sempre:

```
0x4D ‖ versão(1) ‖ validade (hora UTC, 4 bytes) ‖ nonce(16, sorteado) ‖ etiqueta(16) ‖ corpo(3216)
```

- **Validade**: até 24 horas, arredondada à hora. Todo pacote que a Alumia faz leva a mesma validade (24 h), para a validade não
  separar tipos. Vencido, some.
- **Etiqueta**: `HMAC-SHA-256(k, "alumia/r3/malha/etiqueta/v1" ‖ nonce ‖ validade ‖ SHA-256(corpo))`, cortada em 16 bytes. Só quem
  tem `k` reconhece o pacote. Como o nonce é sorteado a cada pacote, dois pacotes para o mesmo destino não se parecem. Como a etiqueta
  prende a validade **e o corpo**, ninguém no caminho troca a validade de um pacote velho para ele durar mais (veja "O que as provas
  acharam").
- **Mensagem**: dentro do corpo vai o **mesmo depósito** que iria à caixa de entrada no servidor (o compromisso da franquia e o
  envelope X-Wing + Proteus da conversa a dois, no menor bloco), **cifrado mais uma vez para a malha** (XChaCha20, com uma chave tirada
  do id da caixa por HKDF com rótulo próprio e o nonce do pacote). `k` sai do mesmo id da caixa de entrada de quem recebe, que só quem
  manda e quem recebe têm. Quem recebe tira a camada e abre pelo **mesmo** caminho da caixa, com as **mesmas sessões**.
- **Por que a camada a mais**: com internet, o app também deposita a mesma mensagem na caixa. Sem a camada, os bytes que passam por
  qualquer celular por perto seriam iguais aos que o servidor guarda; quem repassa **e** tem o banco (a polícia num ato, com o servidor
  tomado ou intimado) ligaria aquele depósito a um lugar, a uma hora e à cadeia de celulares. Com a camada, quem não tem o id da caixa
  vê bytes sorteados, que não batem com nada do servidor. A integridade fica com a etiqueta (o HMAC é sobre o corpo cifrado).
- **Farol do ato**: `k` sai da chave do ato (`k_ato`), que só quem confirmou presença ou coordena recebeu, com internet, antes do
  ato. O corpo é um envelope HPKE (RFC 9180, KEM híbrido X-Wing) para uma chave do ato derivada de `k_ato`, com a mesma camada da
  malha por cima (chave tirada de `k_ato` com outro rótulo).
- **Cobertura**: a cada encontro, cada celular faz também um pacote de cobertura (etiqueta e corpo sorteados). Com o corpo da
  mensagem e do farol cifrado pela camada da malha, para quem não tem a chave cobertura, mensagem e farol são iguais.

Nada de cifra feita à mão: HMAC, HKDF e SHA-256 da `@noble/hashes`, XChaCha20 da `@noble/ciphers`, Ed25519 da `@noble/curves`, HPKE da `@hpke/core` com
`@hpke/hybridkem-x-wing`, e o Proteus do `@wireapp/core-crypto` (os mesmos do chat).

### Por que o farol vai em HPKE

O primeiro desenho cifrava o farol com XChaCha20-Poly1305 direto com a chave do ato. Funcionaria, mas o corpo teria outro formato que
o da mensagem (que leva um envelope X-Wing, com uma chave X25519 dentro, e uma chave X25519 tem um bit que um sorteio puro não tem).
Um celular por perto separaria "farol" de "mensagem" e saberia que há um ato com farol ali. Com o farol no mesmo envelope HPKE X-Wing,
os três tipos (mensagem, farol, cobertura) têm o mesmo formato; com a camada da malha por cima, a mesma distribuição de bytes (sorteio).

## Guardar e repassar

- Cada celular com o modo ligado guarda até **500** pacotes. Cheio, sai o de validade mais curta (entre os de mesma validade, um
  sorteado). Vencidos saem.
- **Não repete**: o resumo de cada corpo visto fica numa lista até a validade dele. O mesmo pacote (ou o mesmo corpo com outro
  cabeçalho) não é repassado nem entregue de novo.
- **A lista dos vistos tem teto** (50 000). Cheia, o celular **recusa pacote novo** de vizinho até os vistos vencerem; nunca esquece
  um visto antes da validade (esquecer deixaria uma enxurrada de pacotes inventados fazer um pacote real ser repassado e entregue de
  novo). O preço: quem inventa pacotes por cerca de 400 encontros (128 por encontro) para a malha daquele celular até os pacotes
  inventados vencerem (no máximo 24 horas). O endereço Bluetooth muda, então não há teto "por vizinho".
- A cada encontro, cada lado manda **até 64** pacotes, em **ordem sorteada**, e aceita até 128 do outro lado.
- **Sem contador de saltos** e sem lista de quem passou o pacote: nada diz de onde ele veio nem a que distância está a origem.
- O pacote que é para este celular **continua** sendo repassado (parar de repassar diria "era para mim").
- Pacote malformado, de tamanho errado, de versão desconhecida, vencido ou com validade além de 24 horas: some, e nada cai.
- Quem tem internet também deposita na caixa. A mensagem que chegar pelos dois caminhos é "repetida" na segunda vez e some (a ordem
  da conversa cuida disso).

## O Farol do ato

Com internet, o farol só muda quando **duas** pessoas da coordenação pedem o mesmo estado (o banco conta as duas). Sem internet não há
banco, então:

- Antes do ato, cada pessoa da coordenação cria no aparelho uma chave Ed25519 do farol daquele ato e publica só a parte pública,
  com a sessão dela. **Uma chave por pessoa** (publicar de novo troca a dela): ninguém tem duas chaves para assinar sozinha. A chave
  **não** leva assinatura da identidade da conta: quem recebe a lista conferiria essa assinatura contra o diretório do chat e saberia
  **quem** coordena. Quem garante que a chave é de quem coordena é o servidor (só aceita da sessão de quem coordena o ato).
- Quem confirmou presença ou coordena recebe, com internet, a chave do ato e a lista de chaves do farol. A lista tem **sempre 8**
  chaves. As que ninguém publicou são preenchimento **sorteado pelo banco**. Quem recebe não sabe quantas pessoas publicaram nem quem são.
- **Decisão (22/11/2026, achado Strix do PR #45):** o banco **recusa iscas vindas do cliente** (`p_iscas` tem de vir vazio). Antes, quem
  coordenava mandava chaves Ed25519 "sem dono" e jogava a semente fora, mas nada impedia de **guardar** a semente: com a chave real e uma
  "isca" ela assinava o farol sozinha e passava como duas pessoas, quebrando a regra acima. **Contrapartida de privacidade:** o
  preenchimento do banco são 32 bytes sorteados, e só metade deles é ponto da curva Ed25519; quem recebe a lista consegue contar quantas
  chaves reais há (quantas pessoas coordenam), sem saber quem. Isso é menos grave do que assinar sozinha. **Enquanto o cliente do farol não
  existir** (hoje nenhum app chama a publicação da chave), fica assim. Quando existir, as iscas válidas devem ser geradas pelo **servidor
  do site** (semente descartada na hora) e entrar por uma função só do serviço, para as duas garantias valerem juntas.
- Sem internet, o farol só vale com **duas assinaturas de chaves diferentes da lista**. Com uma só, é um **pedido**: viaja do mesmo
  jeito, e só a coordenação faz algo com ele.
- Um farol mais velho que o último aceito do mesmo ato é ignorado (um celular que guarda um farol velho e o solta depois não volta o
  estado), e um farol com hora muito no futuro também.
- O material do ato fica **só na memória** do app aberto. Fechar o app esquece; abrir com internet busca de novo.
- Quem não confirmou presença não reconhece o pacote do farol: para essa pessoa (e para quem só repassa), é um pacote como outro.

## O "Estou bem"

O "Estou bem" é um bloco de controle da conversa a dois, mandado aos contatos de segurança **que já têm conversa no chat** com a
pessoa. Pela malha, ele vai como qualquer mensagem curta. Sem uma conversa já começada (com internet), não há como mandar sem
internet: a tela diz isso.

## O que quem está perto vê e não vê

| Vê | Não vê |
|---|---|
| Que há um celular com o modo ligado por perto (por isso o aviso) | Quem é a pessoa, a conta, o codinome |
| Quantos pacotes cada celular troca num encontro | De quem é cada pacote e para quem vai |
| O tamanho (sempre 3254) e a validade (sempre 24 h, arredondada à hora) | Se o pacote é mensagem, farol ou cobertura |
| | Se dois pacotes vão para o mesmo destino ou vêm do mesmo remetente |
| | Qual ato (o farol só é reconhecido por quem tem a chave do ato) |
| | A distância até quem mandou (não há contador de saltos) |
| | Nada que bata com o que o servidor guarda: quem repassa **e** tem o banco não liga o pacote a um depósito da caixa |

O servidor não participa da malha. Ele vê só o que já via com internet: quem confirmou presença num ato (para entregar a chave do ato
a essa pessoa) e as chaves públicas do farol de quem coordena, **com quem publicou cada uma** (é assim que ele garante "uma por
pessoa") e quais linhas da lista são iscas. Quem tem o banco sabe, então, quem da coordenação publicou chave para cada ato; quem
coordena o ato o banco já sabia (a organização e as pessoas que a gerem).

## Limites (ditos sem rodeio)

- **Quem está perto sabe que há um aparelho participando.** É inevitável num rádio: o aviso existe por isso.
- **O endereço Bluetooth** é o aleatório do Android, que muda de tempos em tempos; o UUID de serviço da Alumia diz "é a Alumia".
- **Quem tem a chave do ato** (todo mundo que confirmou presença) reconhece os pacotes do farol daquele ato quando passam, e sabe que
  há um farol circulando. Não consegue fazer um farol que valha (precisa de duas chaves da coordenação).
- **O servidor entrega a lista de chaves do farol.** Quem tomar o servidor antes do ato pode pôr duas chaves dele na lista e assinar
  um farol falso. Isso não é pior que com internet (onde é o próprio servidor que conta as duas pessoas), mas também não é melhor.
- **Quem repassa e também tem o servidor**: a camada da malha impede comparar os bytes; o que sobra é o tempo (um depósito na caixa e
  um pacote no rádio na mesma hora). O modelo formal ainda não tem o servidor como observador da malha: essa junção está coberta pelo
  teste (`scripts/testar-r3-malha.mjs`, "ataque servidor + vizinho"), não pelo ProVerif.
- **Só mensagens curtas** (o menor bloco da conversa a dois). Foto, áudio e texto longo vão só pela internet.
- **Repetição e ordem** ficam com o código (o resumo do corpo, o contador e o `anterior` da conversa); o modelo formal não cobre
  estado guardado.
- **Bluetooth LE só**, sem Nearby (precisa do Google Play Services, código fechado) e sem Wi-Fi Direct nesta versão.
- **O iPhone** não tem app; a malha é só no Android.

## Testes e provas

- `scripts/testar-r3-malha.mjs`: Ana → R1 → R2 → Bia sem internet, cada par só se encontra em sequência; a mensagem chega e abre com
  as mesmas sessões; R1 e R2 não abrem nada e não distinguem o pacote da Ana de cobertura; vencido, repetido, malformado (10⁴ casos
  com fast-check), de tamanho errado e de outro ato recusados sem derrubar nada; o celular malicioso por perto não identifica o ato,
  não repete pacotes, não volta o farol e não forja o farol com uma assinatura.
- `scripts/testar-r3-malha-ativacao.mjs`: só liga com o aviso; desligado ao abrir; desligar apaga; o transporte sobre o plugin do
  Android aguenta o que chegar torto.
- `scripts/testar-r3-malha-atos.mjs`: o material do ato e o farol de ponta a ponta no aparelho.
- `scripts/testar-r3-malha-banco.mjs`: quem recebe a chave do ato, a lista sempre com 8, uma chave por pessoa.
- `provas/sem-internet*.pv` (ProVerif): sigilo e autenticação pela malha; a validade não se estende; o farol exige duas assinaturas;
  quem repassa não distingue destino, remetente, nem mensagem de farol e de cobertura.

### O que as provas acharam

A primeira versão da etiqueta não levava o resumo do corpo. O modelo formal achou o ataque: quem repassa guarda um pacote velho e,
quando passa um novo para a mesma caixa, põe o cabeçalho do novo no corpo do velho; o destino reconhecia e abria a mensagem velha com
uma validade que ninguém deu. Consertado (a etiqueta leva o SHA-256 do corpo); o ataque virou teste e a versão de antes ficou como
controle em `provas/controles/sem-internet-etiqueta-sem-corpo.pv`.

# Alumia: chat privado (mensagens diretas)

**Situação em 18/11/2026 (onda R2):** a conversa a dois foi refeita. Cada mensagem é cifrada por um **Double Ratchet** (o Proteus da
biblioteca `@wireapp/core-crypto`, o mesmo desenho do Signal) **por aparelho**, dentro de um **envelope pós-quântico** (HPKE com o
KEM híbrido X-Wing: X25519 + ML-KEM-768), e entregue em **caixas anônimas**: o servidor não sabe quem conversa com quem. A
biblioteca do Matrix (Olm), a caixa selada por conta, o formato "c3" e as tabelas `rede_dm_*`, `rede_olm_*` e `rede_sel_*` saíram
(`supabase/migracoes/20261124-r2-dupla.sql`). As conversas do beta são apagadas no dia da troca, com aviso na tela antes, com a data.

**Onda R3:** cada mensagem ganha uma **segunda cifra pós-quântica que muda durante a conversa**: o SPQR do Signal ("triple
ratchet", biblioteca `spqr` 1.7.0, com o ML-KEM-768 formalmente verificado da libcrux), compilado para WebAssembly, por cima do
Proteus ("Camada pós-quântica", abaixo). As caixas passam a falar por uma **via** (direta, Tor ou mixnet; a mixnet está preparada e
**desligada**) e o tráfego segue **um ritmo só** em todos os tipos de app, com a cobertura sempre ligada ("Por onde as mensagens
passam" e "Horário e volume"). Testes: `scripts/testar-r3-pq.mjs`, `scripts/testar-r3-pq-vetores.mjs`,
`scripts/testar-r3-pq-grupos.mjs`, `scripts/testar-r3-mixnet.mjs` e `scripts/testar-r3-ritmo.mjs`.

Testes: `scripts/testar-r2-dupla.mjs` (as peças: bloco, envelope, Proteus, certificados, ordem, ataques),
`scripts/testar-r2-dupla-servico.mjs` (de ponta a ponta, com um servidor de caixas em memória e quem tem o servidor inteiro
procurando metadado), `scripts/testar-r2-dupla-roubo.mjs` (estado roubado, no navegador), `scripts/testar-r2-dupla-navegador.mjs`
(lojas no navegador, limpeza do beta, Sair rápido), `scripts/testar-r2-aparelhos.mjs` (ligar por QR e cópia de segurança) e
`scripts/testar-r2-dupla-banco.mjs` (o banco, com o beta dentro, depois da migração).

## Onde fica

| O quê | Onde |
|---|---|
| Bloco (o que vai dentro da cifra) | `lib/rede/chat/r2/bloco.ts` |
| Envelope X-Wing de cada mensagem | `lib/rede/chat/r2/envelope.ts` |
| Double Ratchet (Proteus) por aparelho | `lib/rede/chat/r2/proteus.ts` |
| Certificados, código de segurança, declaração de quem escreve | `lib/rede/chat/r2/certificados.ts` |
| Repetição, falta e ordem | `lib/rede/chat/r2/ordem.ts` |
| Pedido de conversa | `lib/rede/chat/r2/pedido.ts` |
| O chat no aparelho (pedir, aceitar, mandar, receber, bloquear, lista) | `lib/rede/chat/r2/servico.ts` |
| Montagem no navegador (motor, loja selada, transporte) | `lib/rede/chat/r2/navegador.ts`, `loja.ts`, `limpeza.ts`, `troca.ts` |
| Vários aparelhos (QR) e cópia de segurança | `lib/rede/aparelhos/` e `components/rede/chat/Aparelhos.tsx` |
| Registro público das chaves | `lib/rede/chat/transparencia.ts` |
| Telas | `components/rede/chat/` (a forma de antes, por `lib/rede/chat-chaveiro.ts` e `lib/rede/cliente-chat.ts`) |
| Caixas anônimas, diretório e passes | módulo das caixas (`lib/rede/caixas/`, `supabase/migracoes/20261124-r2-caixas.sql`) |

## A tecnologia

### Chaves

- **Identidade da conta** (Ed25519, `@noble/curves`): a mesma em todos os aparelhos da pessoa; vai de um aparelho a outro só pelo
  QR de ligar ou pela cópia de segurança. É ela que entra no código de segurança e no registro público.
- **Cada aparelho** tem chave própria (Ed25519), identidade Proteus própria, pré-chaves Proteus (assinadas pela chave do aparelho:
  o Proteus não assina pré-chave, a Alumia assina por fora) e uma chave X-Wing **da semana** (assinada pela chave do aparelho). A
  identidade da conta assina o **certificado** de cada aparelho. Um aparelho que o servidor inventasse não tem certificado.
- **Chave de pedidos** (X-Wing, assinada pela identidade) e **chave de sincronia** (32 bytes, só nos aparelhos da pessoa).

Todas as assinaturas e resumos levam um rótulo por finalidade (`lib/rede/chat/r2/rotulos.ts`): uma assinatura de um uso nunca
vale em outro.

### Uma mensagem

```
bloco    = versão | tipo | conversa | id | contador | anterior | prazo | kf | corpo        (dentro da cifra)
proteus  = Double Ratchet (sessão com AQUELE aparelho)
camada   = 0x51 | 8 | 8 mensagens do SPQR | nonce | XChaCha20-Poly1305(chave do SPQR, proteus)          (onda R3)
dentro   = 0x03 | tipo do envelope | aparelho que manda | início | [auth_key] | camada  → completado a 2, 4, 8, 16, 24 ou 32 KB
pacote   = HPKE X-Wing para a chave da semana do aparelho de destino (aad: a caixa, o compromisso, a semana)
```

- **Remetente selado:** quem mandou vai dentro do envelope; o servidor vê só a caixa.
- **Tamanhos fixos:** seis tamanhos; o servidor não sabe o tamanho do texto.
- **Sigilo para a frente e cura:** a chave do Proteus muda a cada ida e volta (troca de DH). Quem roubar o estado da sessão num
  momento lê até a próxima troca, não depois (teste no navegador, com a loja do motor copiada).
- **Pós-quântico:** quem gravar o tráfego e quebrar só o X25519 (o do Proteus e o do X-Wing) continua sem o segredo do ML-KEM-768 de
  cada envelope, e não vê nem a primeira mensagem. O envelope tem sigilo para a frente **por semana** (a vida da chave X-Wing); desde
  a onda R3, a camada do SPQR dá a proteção pós-quântica **durante a conversa** (abaixo).

### Camada pós-quântica (onda R3)

O Proteus é clássico (X25519) e a biblioteca não expõe a chave de cada mensagem, então a camada vai **por fora** dele: o cifrado do
Proteus é fechado de novo com XChaCha20-Poly1305 (libsodium), com uma chave que só sai do **SPQR** do Signal (o "Sparse Post-Quantum
Ratchet", `github.com/signalapp/SparsePostQuantumRatchet`, tag v1.7.0, AGPL-3.0-only), que troca chaves ML-KEM-768 em pedaços
pequenos ao longo da conversa. Para ler uma mensagem é preciso quebrar **as duas**: o Proteus (clássico) e o SPQR (pós-quântico).

- **Por pacote, 8 mensagens do SPQR** (de 4 a 37 bytes cada; cabem no bloco de 2 KB com um texto curto). A chave da camada é
  `HKDF-SHA-256(k1 ‖ … ‖ k8, sal = 32 zeros, info = "alumia/r3/pq/camada/v1")`; o aad leva `"alumia/r3/pq/aad/v1"` e o aparelho que
  manda. Os tamanhos dos pacotes não mudam (o banco aceita os mesmos).
- **Começo:** quem começa a sessão sorteia a `auth_key` (32 bytes) do SPQR e a manda **dentro** do primeiro pacote (dentro do envelope
  X-Wing e do Proteus), até a primeira resposta. Começo dos dois ao mesmo tempo: vale o do aparelho de menor chave.
- **Estado:** na loja cifrada do aparelho, gravado **antes** do depósito; não vai para a cópia de segurança (como as sessões do
  Proteus); sai no "Sair rápido".
- **Sem volta ao formato antigo:** `dentro` 0x02 (só o Proteus) é recusado.
- **O WebAssembly:** `nativo/spqr-wasm` (o crate `spqr` mais uma cola de cinco funções), montado num contêiner Linux com a imagem
  fixada pelo digest (`nativo/spqr-wasm/MONTAR.md`); o sha256 do arquivo vai dentro do código do chat, que confere antes de carregar.
- **Garantias, como teste** (`scripts/testar-r3-pq.mjs`): com **todos** os segredos clássicos dos dois lados (o X25519 quebrado, mesmo
  no meio da conversa), nenhuma camada abre; quem copiou o aparelho inteiro numa volta deixa de ler **9 idas e voltas** depois (o
  teste aceita até 12); repetida, fora de ordem, perdida que chega tarde, campo adulterado, `auth_key` trocada e o formato 0x02
  são tratados. O ML-KEM de dentro do WebAssembly passa por 10 000 vetores acumulados e bate com o `@noble/post-quantum`
  (`scripts/testar-r3-pq-vetores.mjs`).
- **Limites:** a cura não é na hora (o SPQR precisa de idas e voltas; conversa de um lado só não cura); se o aparelho cair entre abrir
  e gravar, a mensagem se perde (o aviso "faltou mensagem" aparece), como antes.
  **A janela do começo:** enquanto o primeiro pacote deste aparelho não teve resposta e o outro aparelho tem a chave menor (o
  desempate do começo dos dois ao mesmo tempo), um pacote que traz outra `auth_key` toma o lugar da minha. Quem já quebrou o X25519 e
  forja o Proteus dessa conversa nessa janela põe a `auth_key` dele e passa a ler o SPQR dali em diante. Fora dessa janela (sessão
  confirmada) a troca é recusada. É o mesmo limite de qualquer começo de sessão com autenticação clássica (o PQXDH do Signal também
  não autentica de forma pós-quântica); o modelo formal (`provas/camada-pq.pv`) ainda não tem essa janela (auditoria interna da R3).
- **Grupos (MLS):** a suíte 0xF002 já é híbrida pós-quântica e cura a cada atualização; cada aparelho troca a própria folha quando
  ela tem mais de 7 dias **ou** 200 mensagens mandadas, também quem só lê (`scripts/testar-r3-pq-grupos.mjs`).
- **Repetida, faltando, fora de ordem:** a biblioteca recusa a mensagem repetida; o contador e o `anterior` (o resumo do bloco
  anterior do mesmo aparelho), dentro do cifrado, dão os avisos de "faltou mensagem" e "fora de ordem".
- **Um tipo não passa por outro:** o tipo do envelope e o do bloco estão dentro do cifrado autenticado.
- **Semana:** o aparelho aceita a chave da semana e as 5 anteriores (o pacote vive 30 dias); mais velha é recusada e a privada é
  apagada. Não dá para forçar a volta a uma chave velha. Sessão sem resposta por 30 dias é refeita com pré-chave nova.

### Caixas anônimas

Cada aparelho tem uma **caixa de entrada por conversa** (identificador de 256 bits sorteado no aparelho, sem conta), mais uma
**caixa de sincronia** (para as cópias do que os outros aparelhos da mesma pessoa mandaram). Depositar exige o passe de depósito;
buscar, o de leitura; o banco guarda só os resumos. **Quem escreve é dono do passe**: cada pessoa sorteia o passe de escrita da
conversa e entrega à outra só o resumo, com que a outra cria as caixas dela; e assina, para cada caixa em que escreve, a
**declaração** "este passe é meu" (contrato com a denúncia com prova). Assim quem lê uma caixa não deposita nela fingindo ser a
outra pessoa.

### Por onde as mensagens passam (onda R3)

Os pedidos **anônimos** das caixas (depositar, buscar, criar, apagar) saem por uma **via** (`lib/rede/caixas/vias.ts`); o cliente das
caixas não sabe qual é. Os pedidos com a sessão da conta (emitir passes, publicar no diretório) seguem diretos: eles já dizem quem é.

| Via | O servidor vê o endereço de rede? | Quem vigia a rede inteira liga depósito e busca? | Quando |
|---|---|---|---|
| **direta** | sim | sim, pelo horário | o padrão hoje |
| **Tor** | não | sim, pelo horário | a página aberta pelo endereço .onion; nos apps, quando a pessoa liga o Tor |
| **mixnet** | não | **não** (simulação abaixo) | **desligada** nesta versão |

- **A mixnet escolhida é a Nym** (rede compartilhada com o mundo: a multidão é maior que a da Alumia; modelo Loopix, com atraso
  sorteado em cada nó e cobertura; cliente de navegador `@nymproject/mix-fetch`, Apache-2.0). O Katzenpost (pós-quântico,
  autohospedável) fica como plano B atrás do mesmo contrato: exigiria uma rede própria, com multidão pequena, e um processo nativo.
- **Preparada e desligada:** o adaptador (`lib/rede/mixnet/nym.ts`) não importa o pacote da Nym (18 MB que entrariam no site sem uso);
  o `fetch` da mixnet entra injetado quando ela for ligada, por configuração (`NEXT_PUBLIC_ALUMIA_MIXNET=nym`). Se a rede da Nym
  falhar, as caixas seguem pela via de antes e a tela diz. Pela mixnet, todo pedido leva os mesmos cabeçalhos fixos dos apps.
- **Modo rápido:** com a mixnet ligada, a pessoa pode escolher "só Tor" nos ajustes do chat; a tela diz o que se perde (quem vigia a
  rede inteira volta a poder ligar, pelo horário, o envio à busca). Enquanto a mixnet está desligada, a escolha aparece desativada,
  com o aviso.
- **A prova, como teste** (`scripts/testar-r3-mixnet.mjs`): uma simulação da rede inteira (3 camadas de nós com atraso exponencial,
  cobertura, 50 aparelhos, 30 rodadas) com um observador que vê **todas** as ligações com o horário exato e tenta ligar cada
  depósito a quem depositou e cada busca a quem buscou. Com a mixnet e a cobertura, ele acerta dentro do intervalo de 99% do acaso
  (1 em 50); o **mesmo** observador acerta 100% pela via direta e cerca de 69% pela mixnet sem cobertura (prova que ele funciona e que
  a cobertura é parte da proteção).
- **Limites:** é simulação, não a rede da Nym de verdade (os números da rede entram quando ela for ligada); com a mixnet, a Nym vê
  tráfego cifrado e o nó de saída fala com o nosso servidor (sem ler o pedido: TLS por dentro).

### Horário e volume (onda R3)

Um **ritmo só** (`lib/rede/caixas/ritmo.ts`), o mesmo código no site, no app do Android e no do computador:

- **Depósitos num processo de Poisson:** em cada instante sorteado sai **um** pacote do tamanho da mensagem curta: a mensagem de
  verdade mais antiga que esperava, ou, sem nenhuma, um pacote de **cobertura** (falso, numa caixa de cobertura). A mensagem de
  verdade sai **no lugar** da cobertura: o número de pacotes por hora não muda quando a pessoa escreve.
- **A taxa depende do estado do aparelho:** chat aberto (em média um pacote a cada 8 s), em segundo plano (10 min) e bateria abaixo de
  20% sem carregar (30 min). Mudou o estado, o próximo instante é sorteado de novo (o processo não tem memória: não deixa marca). O
  site lê a visibilidade da página e a bateria do navegador; os apps, o ciclo de vida do app.
- **A cobertura é sempre ligada** (a tela não oferece mais desligar); o teto de banda do dia (5 MB) continua.
- **Teto de espera:** a primeira mensagem da fila não espera mais que 30 s; se esperar, sai na hora e o processo recomeça dali (o
  instante forçado toma o lugar do sorteado; nunca saem várias de uma vez). As cópias de uma mensagem para vários aparelhos saem em
  instantes diferentes.
- **Buscas:** cada caixa (pedidos, sincronia, cada conversa) é buscada no **seu** horário, em intervalo fixo do estado (1 min aberto,
  15 min no fundo, 30 min com a bateria fraca), com deslocamento sorteado por caixa. A tela não puxa as caixas todas de uma vez ao
  abrir uma conversa: só lê o que já chegou.
- **Os apps** mandam os mesmos cabeçalhos (HTTP nativo, sem `Origin`, `User-Agent: alumia/1`).
- **A prova, como teste** (`scripts/testar-r3-ritmo.mjs`): com o relógio simulado, os três tipos de aparelho têm a mesma distribuição
  de intervalos em cada estado (Kolmogorov–Smirnov, p > 0,01) e o mesmo tamanho; com e sem mensagens de verdade, os intervalos têm a
  mesma distribuição e o número de pacotes por hora não sobe; com mensagem esperando, nunca passam mais de 30 s sem depósito.
- **Limites:** a mensagem pode levar até uns 30 s para sair (a tela diz); passado o teto de banda do dia, a cobertura para e o que sai
  é de verdade; o site, quando o chat web estiver ligado, manda `Origin` (o servidor distingue "site" de "app"); a impressão do TLS
  do Android e a do computador são diferentes; uma conversa muito animada (mais de uma mensagem a cada poucos segundos) enche a fila
  e as mensagens saem pelo teto, num ritmo que já não é o sorteado.

### Pedido de conversa, sem lista

A Ana lê o diretório da Bia (sem sessão), confere a identidade no registro público e deposita, na **caixa de pedidos** da Bia (a
única caixa ligada a uma conta, de propósito: diz "a Bia recebe pedidos", não de quem), um pedido cifrado para a chave de pedidos
dela, **assinado pela identidade da Ana**, com a caixa de resposta. O aparelho da Bia confere, no aparelho: a assinatura, a
identidade contra o diretório e o registro, **"quem pode me chamar"** (todos, só quem eu sigo, ninguém), o **bloqueio** e a
**recusa de 30 dias**. O que não passa some em silêncio. De quem a Bia segue, a conversa abre direto. Aceitando, o aparelho da Bia
abre as sessões, cria a caixa dela e manda o aceite pela caixa de resposta; a caixa de resposta passa a aceitar só o passe da Bia.

### Vários aparelhos e cópia de segurança

- **Ligar por QR:** o aparelho novo mostra um QR (canal anônimo, chave X-Wing de uma vez, segredo de 32 bytes); o aparelho velho,
  na mesma conta, lê e manda as chaves da CONTA cifradas pelo canal. O servidor nunca vê o QR. QR de outra conta é recusado. O
  aparelho novo gera as próprias chaves de aparelho; os contatos refazem as sessões.
- **Cada mensagem vai para todos os aparelhos confiáveis** da outra pessoa (certificados pela identidade conhecida) que já
  anunciaram a caixa, e para os meus outros aparelhos, pela caixa de sincronia.
- **Lista de conversas só no aparelho:** contatos, conversas, recusas, bloqueios e preferências moram nos aparelhos; para
  sincronizar, o servidor guarda **um arquivo cifrado** (libsodium, secretstream) com a chave de sincronia, de tamanho em faixas.
- **Cópia de segurança (opcional):** o mesmo formato, cifrado no aparelho com **24 palavras** (BIP39 em português) ou com o
  **Argon2id** de uma frase (64 MiB, 3 passadas). O servidor guarda só o arquivo. A cópia **não leva** sessão, chave de aparelho nem
  chave da semana: restaurar cria um aparelho novo, e nenhuma chave velha volta à vida. Riscos ditos na tela: quem tiver as
  palavras e a conta abre; perdeu as palavras, perdeu a cópia.

### Bloqueio sem o servidor saber

Bloquear troca o passe de depósito das minhas caixas daquela conversa (em todos os meus aparelhos, pela lista), sem avisar: o
depósito de quem foi bloqueado continua respondendo "ok" e cai fora. Os freios **20 bloqueios por hora** e **desbloquear só
depois de 3 horas** valem no aparelho. É o bloqueio do chat; o bloqueio da rede (perfil, linha do tempo) continua o de sempre.

### Registro público das chaves

O registro (`interno.rede_kt`) anota a identidade da conta e os aparelhos (linhas com tipo, na R2). O aparelho refaz a corrente de
resumos e só manda mensagem se a identidade que o diretório mostra for a última do registro. Se a corrente não fecha, nada sai.

### Identidade trocada e código de segurança

Se o diretório mostrar outra identidade de um contato, nada sai até a pessoa aceitar; se a conversa estava verificada, só
comparando o código de novo. O código (60 algarismos, SHA-512 iterado como o do Signal) é da identidade da conta: não muda quando
a pessoa liga outro aparelho. Comparar por números ou pelo QR, como antes.

### Histórico no aparelho, temporárias e ver uma vez

O histórico fica só no aparelho, cifrado (`lib/rede/chat/historico.ts`), com a trava opcional por senha. O prazo (1, 7 ou 30
dias), a temporária (minutos) e o "ver uma vez" vão dentro do cifrado. Nada impede uma foto da tela.

### Áudio e vídeo

Atrás de `alumia-p4-anexo-cifrado` (Prompt 4, itens 137 e 138; desligado por padrão). Um áudio gravado no aparelho ou um vídeo curto
(até 1 minuto; áudio até 3 MB, vídeo até 10 MB, MP4 ou WebM) segue este caminho:

1. no aparelho, o tipo é conferido pelos primeiros bytes; o vídeo tem as caixas de metadado (lugar, câmera, data) neutralizadas
   (`lib/rede/midia/limpar-video.ts`, a mesma limpeza do vídeo do post); o arquivo ganha zeros até o próximo múltiplo de 64 KiB e é
   cifrado com uma chave AES-256-GCM só dele, presa à conversa (`lib/rede/chat/anexo-cifrado.ts`);
2. só o cifrado sobe (`app/api/alumia/anexo`), **sem a sessão da conta** e com um passe anônimo, como a criação de caixa; a rota
   sorteia um endereço de 128 bits; o banco guarda o resumo dele, o tamanho arredondado e o **dia** do vencimento (o prazo da
   conversa: 1, 7 ou 30 dias), e nada mais (`supabase/migracoes/20261127-p4-anexo-cifrado.sql`);
3. a chave, o tamanho de verdade, os resumos e o endereço viajam num bloco do tipo `anexo` (3) na conversa a dois, ou como conteúdo
   `anexo` dentro da mensagem do MLS no grupo: o mesmo envelope de tamanho fixo e o mesmo ritmo do texto curto. O tamanho do arquivo
   não aparece no envelope;
4. quem recebe só baixa quando toca em "Ouvir" ou "Ver vídeo", sem sessão; confere o resumo do cifrado, abre e confere o resumo do
   arquivo. "Ver uma vez" e "apagar para todos" pedem ao depósito que apague na hora; o vencido sai na faxina diária.

Limites, ditos sem rodeio: o servidor vê o degrau do tamanho (de 64 em 64 KiB) e a hora em que o cifrado subiu e foi baixado (não
fica gravada); cada envio gasta um dos passes anônimos do dia; quem sabe o endereço (só quem está na conversa) pode baixar o cifrado
ou pedir para apagar. O anexo não entra na denúncia com prova (a prova dele exigiria entregar a chave do arquivo à moderação).

### O que fica neste aparelho, e o "Sair rápido"

O estado do chat (chaves da conta e do aparelho, lista, caixas) fica no IndexedDB `lucia-alumia-r2`, selado com AES-256-GCM por
uma chave **não exportável**; as sessões Proteus ficam na loja do motor, no OPFS, cifradas pelo motor. Sem senha do chat, isso
protege contra leitura casual do disco, não contra quem roda código na página com o aparelho destravado. O "Sair rápido" e o
pânico apagam tudo isso, o histórico e a memória da aba, em menos de meio segundo.

### O que um script rodando na página consegue (XSS na mesma origem)

"Não exportável" impede copiar uma chave, não usar. Um script que rode na página do chat consegue ler o que está na tela,
escrever em nome da pessoa e, enquanto roda, usar as chaves deste aparelho. A defesa é não ter XSS: nada de script de fora, a
política de conteúdo mais fechada do site no chat. Um servidor tomado poderia entregar código alterado: é o limite de todo chat
na web. O manifesto do chat (`scripts/manifesto-do-chat.mjs`) publica fora do servidor o resumo dos arquivos entregues, para
qualquer pessoa conferir (`node scripts/manifesto-do-chat.mjs conferir --site <endereço>`); ele prova o que o site entregou àquele
pedido, não o que entregou a outra pessoa.

### Carona de um ato

"Combinar pelo chat" pede ao servidor só o **codinome** de quem publicou a carona (`public.rede_carona_contato`, com as regras de
antes: o ato vale para quem pede, não passou, a pessoa não está bloqueada nem invisível, 30 por dia). O pedido de conversa sai do
aparelho como qualquer outro.

## O que o servidor vê e não vê

| Vê | Não vê |
|---|---|
| Caixas sem conta (resumos do id e dos passes), pacotes de tamanho fixo, o **dia** de cada pacote | Quem conversa com quem, quem pediu conversa a quem, quem bloqueou quem |
| O diretório público de cada conta (identidade, aparelhos, chaves públicas, a **semana** em que cada aparelho entrou), por codinome | A lista de conversas, os contatos, as recusas, as preferências do chat |
| A caixa de pedidos de cada conta (é a única ligada a uma conta) e **quantos pedidos esperam leitura nela** agora: quem tem o banco sabe quantos pedidos de conversa a pessoa tem sem ler (o pedido sai quando ela lê). Nenhuma contagem por dia fica gravada (a de antes dizia quantos pedidos cada conta recebia por dia; saiu na auditoria interna da R3) | De quem é cada pedido, quantos pedidos a pessoa recebeu em cada dia |
| Um arquivo cifrado por conta (lista e cópia): tipo, versão, faixa do tamanho, dia | O texto, o remetente de cada pacote, quantas conversas a pessoa tem |
| Ao vivo (não no banco): o endereço de rede e a hora de cada chamada (pelo Tor, o endereço não; pela mixnet, nem a ligação pelo horário) | As chaves privadas, as 24 palavras, a frase da cópia |
| Um pacote a cada instante sorteado, do mesmo tamanho, de cada aparelho com o chat pronto | Quais pacotes são mensagens de verdade e quais são cobertura |
| Com áudio e vídeo ligados: arquivos cifrados sem dono, o tamanho de 64 em 64 KiB e o dia em que vencem | O áudio, o vídeo, a chave, de quem é e para quem vai |

### Limites do diretório (ditos sem rodeio)

- **Quem existe**: o diretório é lido sem sessão, pelo codinome; ele responde se aquele codinome tem conta aprovada com o chat novo.
  É o preço de começar conversa sem pedir licença ao servidor. O freio é por endereço de rede e por processo do site (120 por
  minuto em cada processo).
- **O id da conta**: a resposta traz o id interno da conta (o certificado de cada aparelho e o registro de transparência são presos a
  ele). Trocar por um id só do diretório é uma decisão em aberto.
- **Quando a pessoa troca de aparelho**: o diretório mostra só a semana (a segunda-feira) em que cada aparelho entrou, não o dia.

## Retenção mínima e apagar

O pacote some ao ser entregue; o que ninguém buscou some em 30 dias (rotina diária das caixas). Apagar uma mensagem
manda o pedido de apagar aos outros aparelhos; apagar a conversa tira da lista de todos os meus aparelhos e apaga as minhas caixas
dela; apagar tudo do chat, idem para todas.

## LGPD (Lei 13.709/2018) e outras leis

| Artigo | Como o chat cumpre |
|---|---|
| LGPD art. 6º, I a III | O servidor guarda só o necessário para entregar: caixas sem conta, pacotes cifrados de tamanho fixo e o dia. |
| LGPD art. 6º, VII e VIII; art. 46 | Cifra de ponta a ponta por aparelho, envelope pós-quântico, nenhuma linha que ligue conta a conversa. |
| LGPD art. 11 | Conversas podem revelar dado sensível: só as duas pessoas leem, e o servidor nem sabe que conversam. |
| LGPD art. 15, 16 e 18, VI | Prazo das mensagens, pacote apagado na entrega e em 30 dias, apagar mensagem, conversa ou tudo. |
| LGPD art. 48 | Um banco vazado não tem texto nem a ligação entre contas e conversas. |
| Marco Civil art. 7º, II e III; art. 10 | Sigilo do fluxo e do conteúdo: o instituto não tem nem o conteúdo nem a lista de quem fala com quem. |

## O que o chat NÃO faz (de propósito)

- Não mostra "online", "visto por último", "digitando" nem confirmação de leitura.
- Não aparece em busca nem em notificação com conteúdo.
- Não assina mensagem com a identidade: a autoria só se prova na denúncia, com a declaração do passe e a franquia, e com os trechos
  que quem denuncia escolhe.
- A voz não passa pelo Tor (UDP).

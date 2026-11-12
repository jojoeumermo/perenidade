# Alumia: chat privado (mensagens diretas)

**Situação em 10/11/2026:** implementado e testado no banco local (`npm run testar:rede-chat`). Fica no ar junto com a Alumia
(recurso `rede-v2`, ligado): não tem chave liga/desliga própria. Nenhuma chave nova, nenhuma variável de ambiente nova, nenhum
serviço de fora, nenhuma biblioteca nova.

**Falta aplicar em produção**, nesta ordem: `supabase/migracoes/20261106-t19-rede-chat-privado.sql`,
`supabase/migracoes/20261107-t33-seguranca.sql` e, por último, `supabase/migracoes/20261110-chat-blocos.sql` (o formato "c3"
descrito abaixo). O passo a passo está no fim deste documento.

Pedido da coordenação (T19): "o chat privado no Alumia", com "TODAS as regras de segurança possíveis", "a mesma tecnologia que já
temos no chat interno", "nada pode vazar, nem de dentro nem de fora", seguindo a LGPD. Em 10/11/2026 o chat foi endurecido
(mensagens em blocos de tamanho fixo, sem assinatura, com repetição e ordem conferidas, chave com prazo também no banco), sem
trocar de tecnologia. Em 13/11/2026 a cifra passou para a biblioteca do Matrix (veja "A tecnologia").

## Onde fica

| Peça | Arquivo |
|---|---|
| Tela `/alumia/conversas` (menu "Conversas" da casca, só para quem entrou) | `app/[lang]/alumia/conversas/page.tsx` → `components/rede/chat/Tela.tsx` |
| Uma conversa aberta (ler, escrever, prazo, código de segurança e QR, bloquear, denunciar, apagar) | `components/rede/chat/Conversa.tsx` |
| QR do código de segurança (desenhar e ler com a câmera) | `components/rede/chat/Qr.tsx` |
| Denúncia com trechos escolhidos | `components/rede/chat/Denuncia.tsx` |
| Ajustes (quem pode me chamar, prazo padrão, apagar tudo do chat) | `components/rede/chat/Ajustes.tsx` |
| O que o chat pendura no "Sair rápido" | `components/rede/chat/encaixe.tsx` |
| Botão "Mensagem privada" no perfil (`?com=@handle`) | `components/rede/perfil/TelaDoPerfil.tsx` |
| A cifra (sem navegador além do WebCrypto; roda no Node nos testes) | `lib/rede/chat-privado.ts` (usa `lib/sigilo.ts`) |
| O formato "c3" das mensagens | `lib/rede/chat/c3.ts` |
| O preenchimento em blocos | `lib/rede/chat/padding.ts` |
| Repetição e ordem | `lib/rede/chat/ordem.ts` |
| Comparar o código (QR e a metade da outra pessoa, digitada) | `lib/rede/chat/verificacao.ts` |
| O que fica guardado neste aparelho (IndexedDB próprio, `lucia-alumia-chat`) e o "apagar tudo" | `lib/rede/chat/gaveta.ts` |
| O chaveiro deste aparelho (sessões, envio, leitura) | `lib/rede/chat-chaveiro.ts` |
| As chamadas ao banco | `lib/rede/cliente-chat.ts` |
| Textos (pt final; en, es, fr, ru, zh em rascunho) carregados sob demanda | `i18n/rede/chat/*.json`, `lib/rede/textos-chat.ts` |
| Banco: tabelas, regras, permissões | `supabase/migracoes/20261106-t19-rede-chat-privado.sql`, `20261107-t33-seguranca.sql`, `20261110-chat-blocos.sql` |
| Testes | `scripts/testar-rede-chat.mjs` (`npm run testar:rede-chat`) |

Componentes próprios (`components/rede/chat/`), carregados só quando a tela é aberta (`dynamic(..., { ssr: false })` no
`components/rede/registro.tsx`): não pesam nas outras páginas da Alumia e não dependem do visual que a Alumia estiver usando.

## A tecnologia

**Desde 13/11/2026 a cifra é a da biblioteca do Matrix** (`@matrix-org/matrix-sdk-crypto-wasm` 19.0.1, a do Element; por dentro,
o vodozemac, auditado), em `lib/rede/chat/olm.ts`. Nada de cifra feita à mão no caminho das mensagens. Migração:
`supabase/migracoes/20261113-chat-olm.sql` (depois da `20261110-chat-blocos.sql`); teste: `npm run testar:chat-olm`.

- **Olm** (Double Ratchet, o mesmo desenho do Signal) entre os dois aparelhos: entrega as chaves das sessões. O banco só guarda a
  chave pública do aparelho, as chaves de uso único e uma caixa de recados cifrados (`rede_olm_*`), e só entrega a chave do
  aparelho de alguém a quem tem conversa aberta com a pessoa, sem bloqueio.
- **Megolm** nas mensagens: cada mensagem tem chave própria, que anda para a frente e não volta (**sigilo para a frente**). Cada
  versão da conversa é uma sessão nova; dentro de uma versão, a sessão troca sozinha a cada 100 mensagens ou 7 dias.
- **Identidade:** a chave ed25519 do aparelho (o banco guarda `"o" + chave`). O código de segurança e o QR são calculados dela.
  "Confiar na primeira vez, avisar quando mudar" continua igual: o aparelho só entrega chave ao aparelho cuja identidade ele já
  conhece da pessoa, e só abre mensagem cuja sessão veio desse aparelho, direto (nada encaminhado por terceiro).
- **Formato "m1":** `m1.<versão>.<sessão>.<cifrado Megolm>`. Por dentro vai o mesmo bloco de tamanho fixo do "c3" (identificador,
  contador, "até onde eu já tinha recebido" e o texto), então repetição, buraco e ordem continuam sendo notados como antes, e o
  tamanho no banco continua em sete faixas fixas (723, 1192, 2088, 3923, 7550, 11198 ou 14846 caracteres no cifrado). O banco
  recusa qualquer outro tamanho e, de conta que já está na biblioteca, recusa "c3".
- **No aparelho:** as sessões da biblioteca ficam num IndexedDB dela (`lucia-alumia-olm-<conta>`), **cifrado** com uma senha que
  ninguém guarda: ela é calculada, a cada abertura, por uma chave HMAC **não exportável** deste aparelho. O "Sair rápido" apaga
  esse banco junto com o do chat.
- **WebAssembly:** a biblioteca é WebAssembly; a política de segurança das páginas ganhou `'wasm-unsafe-eval'` (só compilar
  WebAssembly; não libera `eval` de JavaScript).

O texto abaixo descreve o formato "c3" anterior, que fica no banco **só para leitura** até vencer (as contas que ativarem o chat
de novo passam para a biblioteca). As regras de bloco, ordem, repetição, rotação e identidade trocada valem iguais para o "m1".

### O formato das mensagens: "c3"

```
corpo     c3.<versão>.<vetor de 12 bytes>.<cifrado>            (base64url, sem "=")
cifrado   AES-GCM-256, com a chave da conversa, sobre um BLOCO de tamanho fixo
bloco     [4 bytes: comprimento do conteúdo][conteúdo][zeros até o fim do bloco]
conteúdo  [16 bytes: identificador sorteado][4 bytes: contador][8 bytes: até onde eu já tinha recebido][texto em UTF-8]
amarra    alumia-dm:c3:<conversa>:<autor>:v<versão>            (dado autenticado do AES-GCM)
```

**Blocos.** Antes de cifrar, a mensagem é completada até o menor bloco em que cabe: 256, 512, 1024 ou 2048 bytes; acima disso,
de 2048 em 2048 até 8192 (4096, 6144, 8192). O AES-GCM acrescenta 16 bytes. Em base64url, a última parte do corpo fica com
exatamente um destes tamanhos:

| Bloco (bytes) | Cifrado (bytes) | Caracteres no banco | Cabe um texto de até |
|---|---|---|---|
| 256 | 272 | 363 | 224 bytes |
| 512 | 528 | 704 | 480 bytes |
| 1024 | 1040 | 1387 | 992 bytes |
| 2048 | 2064 | 2752 | 2016 bytes |
| 4096 | 4112 | 5483 | 4064 bytes |
| 6144 | 6160 | 8214 | 6112 bytes |
| 8192 | 8208 | 10944 | 8160 bytes (o chat aceita até 8000) |

O banco **recusa** corpo "c3" com qualquer outro tamanho (regra na tabela e na função de enviar). O corpo inteiro tem no máximo
10972 caracteres. Ao abrir, o aparelho confere o bloco todo: tamanho da lista, comprimento que bate, o menor bloco possível, sobra
só com zeros. Qualquer diferença e a mensagem não abre.

O que isso esconde: o tamanho do que foi escrito, dentro de cada faixa (um "ok" e um parágrafo curto ficam iguais). O que **não**
esconde: quantas mensagens foram trocadas, quando, e em qual das sete faixas cada uma caiu.

**O formato antigo, "c2"** (assinado, de tamanho livre), continua na tabela **só para leitura**: o aparelho abre e confere a
assinatura como antes, e o banco recusa "c2" novo. Como toda mensagem vence em no máximo 30 dias, em 30 dias depois da migração
não sobra nenhuma.

### Negabilidade: sem assinatura nas mensagens

Mensagens "c3" **não levam a assinatura** de quem escreve. O que garante a origem é a chave da conversa:

- **O que garante.** A chave de cada versão só existe embrulhada para as duas pessoas, e o aparelho só embrulha para chave
  certificada pela identidade em que confia. Então uma mensagem que abre foi cifrada por quem tem a chave: uma das duas. O
  servidor, que não tem a chave, não consegue escrever mensagem, mudar uma, trocar de conversa, de versão ou de autor (a amarra do
  AES-GCM leva tudo isso e o formato): qualquer mexida e ela não abre. Quem recebe sabe que veio da outra pessoa.
- **O que não garante, de propósito.** Numa conversa a dois, a chave é das duas. Qualquer uma poderia ter escrito qualquer
  mensagem da conversa, inclusive uma que abre "como da outra" (o teste prova isso). Por isso **nenhuma mensagem serve de prova,
  para terceiros, de quem escreveu**: não há nada nela que só uma das duas pudesse ter feito. É isso a negabilidade.
- **Os limites.** O banco continua sabendo quem enviou cada linha e quando (ele precisa disso para entregar e para o bloqueio):
  a negabilidade é sobre o conteúdo, não sobre o fato de ter havido conversa. Um print da tela ou um trecho numa denúncia é a
  palavra de quem mostra, como sempre foi. As mensagens antigas "c2" continuam assinadas até vencerem. O certificado (a
  identidade assinando a chave do aparelho) continua existindo: ele prova de quem é a chave, não o que foi dito com ela.
- **O que ainda não há.** Sigilo para a frente dentro de uma versão: quem conseguir usar a chave privada de um aparelho abre as
  versões cujo embrulho ainda está no banco (por isso os embrulhos antigos são apagados logo; veja "Rotação"). Isso fica para a
  etapa da biblioteca do Matrix.

### Repetição e ordem

Cada mensagem "c3" leva, **dentro do cifrado**, um identificador sorteado e um contador por autor e versão da chave. O servidor
não vê nenhum dos dois.

- **Repetição.** O aparelho guarda, por conversa, autor e versão, quais identificadores já viu e em qual mensagem do servidor.
  Se o mesmo identificador aparecer como outra mensagem (alguém regravando uma mensagem antiga como se fosse nova), ela **não é
  mostrada de novo**: fica só a linha discreta "Mensagem repetida". Depois de 45 dias a lista de uma versão é apagada e fica só
  um piso. Mensagem que aparecer depois numa versão já fechada **é mostrada, com aviso**: o aparelho não tem mais como saber se
  é repetida ("Este aparelho não consegue conferir se esta mensagem é repetida"). O mesmo vale para mensagem antiga ("c2") que
  chega fora de hora.
- **Ordem.** Se falta um contador entre duas mensagens que chegaram, a tela mostra, discreta, "Pode faltar mensagem aqui". O
  aparelho não sabe se a mensagem foi apagada por quem escreveu, venceu, ou foi retida no caminho: por isso é um aviso, não um
  erro. O começo da conversa (mensagens antigas já vencidas) não conta como buraco.
- **Ordem da tela.** Dentro de cada pessoa, a tela usa a ordem em que ela escreveu (versão da chave e contador), que o servidor
  não consegue mexer; a hora do servidor só decide como as duas pessoas se intercalam. Onde a hora discorda da ordem escrita, a
  mensagem ganha o aviso "Fora de ordem".
- **Resposta antes da pergunta.** Cada mensagem leva, dentro do cifrado, até onde quem escreveu já tinha recebido da outra
  pessoa (versão e contador). Se a mensagem diz que já tinha recebido uma que aparece DEPOIS dela, ganha "Fora de ordem". E,
  do lado de quem escreveu, as mensagens que a outra pessoa ainda não tinha recebido quando escreveu a última dela ganham uma
  linha discreta ("ainda não tinha recebido esta"): é sinal de mensagem retida no caminho, e some sozinho quando ela responder
  depois de receber.
- **Os limites.** A memória é do aparelho: num aparelho novo, ou depois do "Sair rápido", ela começa do zero. Se o servidor
  segurar as últimas mensagens, o aparelho só nota quando chegar uma posterior. A hora mostrada em cada mensagem é a do servidor.
  Sem IndexedDB (alguns modos privados), a conferência vale só enquanto a aba está aberta.
- No aparelho ficam só identificadores e contadores, nunca texto.

### Rotação da chave

- O aparelho faz versão nova quando alguém troca de aparelho e quando a versão atual passa de **7 dias**. Isso é conferido ao
  abrir a conversa **e de novo a cada envio** (a conversa pode ficar aberta por dias).
- O banco recusa envio em versão com mais de **8 dias** (um dia de folga para relógio e conversa aberta): o aparelho faz a versão
  nova e tenta de novo.
- **Faxina certa, sem sorteio:** a cada envio, a cada versão nova e a cada leitura da conversa, somem as mensagens vencidas
  daquela conversa e os **embrulhos das versões antigas que não têm mais mensagem viva**. Sem o embrulho, aquela chave não pode
  mais ser entregue a ninguém. A faxina geral antiga (por sorteio, de todas as conversas) continua como rede de segurança.

### Identidade trocada

- **Pessoa não verificada:** como antes. A conversa avisa que a chave de segurança mudou, nada é enviado, e a pessoa confirma
  ("Confio na chave nova") depois de falar com a outra por outro canal.
- **Pessoa que estava VERIFICADA:** a marca de verificado **some na hora**, com aviso claro, e o envio fica retido. **Um clique
  não basta:** a tela só segue quando a pessoa compara o código de novo, de um destes jeitos: lendo com a câmera o QR da outra
  pessoa, ou digitando os **seis grupos que a tela da outra pessoa marca como "os seus grupos"** (em Opções, embaixo do
  código: a metade que vem da identidade DELA, calculada da chave do aparelho dela, que o servidor não troca). A tela de quem
  confere compara com a metade calculada da identidade que recebeu, em qualquer posição. Três portas fechadas: (1) não é um grupo
  sorteado, porque a metade que vem da MINHA identidade não muda quando o servidor troca a da outra e conferiria com qualquer
  identidade falsa; (2) não são cinco algarismos, que se acertam fabricando cerca de cem mil identidades, e sim trinta; (3) não é
  "os grupos tal a tal da sua tela": se o servidor puser a MESMA identidade falsa no lugar das duas pessoas, a tela de cada uma
  mostra a metade dela, às vezes na mesma posição, e quem ditasse por posição leria a metade falsa. O QR, com os sessenta
  números, também serve. Conferiu, a
  conversa volta a ficar verificada. A exigência vale também depois de recarregar a página, e o chaveiro recusa a confirmação
  sem comparação mesmo que a tela tente.
- **A PRÓPRIA conta:** se o servidor mostra para a conta uma chave que não é a deste aparelho, a tela não oferece mais "usar este
  aparelho" num clique. Ela explica o risco (quem conversa com a pessoa recebe aviso, as conversas verificadas perdem a marca, o
  que foi escrito antes não abre aqui) e pede um "entendi" antes. Se este aparelho **tinha** a chave do chat, há um alerta a
  mais: se não foi a própria pessoa que ativou o chat em outro lugar, alguém pode ter entrado na conta, e é para trocar a senha
  antes.

### Código de segurança e QR

Sessenta números (o mesmo `codigoDeSeguranca` da equipe), iguais na tela das duas pessoas. Na conversa, em "Opções", aparecem os
números e o **QR** do código. Uma pessoa mostra, a outra toca em "Ler o QR da outra pessoa": se confere, a conversa fica
verificada; se não confere, a tela diz para não marcar. A **câmera só liga com o toque** e desliga ao fechar, ao ler, ao sair da
tela e quando a aba vai para o fundo. A imagem não sai do aparelho: lê o leitor do próprio navegador ou, na falta dele, a
biblioteca `jsqr`, que já era do site (como a `qrcode`, que desenha).

### O que fica neste aparelho, e o "Sair rápido"

No IndexedDB do chat (`lucia-alumia-chat`) ficam: a chave do aparelho e a identidade (não exportáveis), as identidades conhecidas
de cada pessoa (e se foram verificadas) e a memória de repetição e ordem (identificadores e contadores). **Mensagem aberta,
rascunho e chave de conversa nunca são gravados**: vivem só na memória da aba. Não há fila de envio.

O **"Sair rápido" da Alumia apaga tudo isso** (`apagarTudoDoChat`): o banco IndexedDB inteiro, de todas as contas deste aparelho,
e o que estiver na memória (chaves de conversa, rascunho, mensagens abertas). Termina em menos de meio segundo, dentro do teto de
0,8 s do "Sair rápido", e nunca lança. **Consequência, dita na tela de Ajustes:** depois do "Sair rápido" é preciso ativar o chat
de novo neste aparelho; a chave nova muda o código de segurança (as outras pessoas recebem o aviso de chave trocada) e o que foi
escrito antes não abre mais aqui. É o preço de não deixar a chave num aparelho que pode ser tomado.

O "apagar tudo" vale para **todas as abas**: a aba que apertou avisa as outras (BroadcastChannel), e cada uma apaga a própria
memória e para de gravar. O banco só é criado na ativação do chat; se uma leitura atrasada encontra o banco sumido, ela não o
recria e a página se limpa também. Isso cobre também a saída do site (três Esc), que apaga o banco do chat por fora.

**Dois limites, ditos na tela de Ajustes:**
- **As verificações se perdem.** O aparelho não guarda a lista de contatos depois do "Sair rápido" (seria a prova de com quem
  a pessoa conversa). Ao reativar, cada conversa volta a "confiar na primeira vez", e uma identidade falsa entregue pelo servidor
  não daria aviso. Por isso Ajustes diz para comparar o código de novo com cada pessoa antes de escrever algo sensível, e a
  conversa mostra "Não verificada neste aparelho" em destaque enquanto não for comparada.
- **A conta continua aberta.** O "Sair rápido" da Alumia apaga o chat, mas a sessão da conta mora em outra chave do navegador.
  Quem pegar o aparelho abre a Alumia já dentro da conta, vê com quem a pessoa conversa (a lista vem do servidor) e pode ativar o
  chat de novo. Ajustes diz isso e aponta "Sair da conta". O conserto é da Faixa 1 (pedido P17 em
  `docs/rede/PEDIDOS-ENTRE-FAIXAS.md`): o "Sair rápido" encerrar a sessão, como a saída do site faz.

Diferenças de propósito em relação à equipe (menos comodidade, menos coisa que pode vazar): **um aparelho por conta**, sem cópia
de recuperação e sem aprovação de outro aparelho.

### "Combinar pelo chat" das caronas do ato

O quadro de caronas de um ato (Faixa 1, `components/rede/atos/Caronas.tsx`) abre a conversa privada com quem publicou a carona
pelo encaixe `lib/rede/atos/combinar.ts`. A Faixa 2 registra ali `abrirConversaDaCarona` (`lib/rede/chat/carona.ts`), que manda
só o id da carona para `public.rede_dm_abrir_carona` (`supabase/migracoes/20261111-chat-caronas.sql`). **Quem publicou é achado
no servidor:** a tela das caronas nunca recebe o id nem o codinome dessa pessoa. As regras são as de `rede_dm_abrir`, sem
exceção (membro 18+ dos dois lados, bloqueio, perfil invisível, recusa recente, "quem pode me chamar", limite de pedidos):
oferecer carona não abre o chat de ninguém à força. Antes, o ato precisa valer para quem pede (a regra de quem escreve no ato:
vê o ato, não oculto, retido nem apagado, não cancelado, não passou há mais de 6 horas): depois do ato não se abre mais nada. A
tela vai para `/alumia/conversas?conversa=<id da conversa>` (nunca o @ da pessoa no endereço), e a tela das conversas tira o id
do endereço ao abrir; se a pessoa tinha apagado aquela conversa da lista, ou se é um pedido que a outra mandou, a tela diz isso.
Um limite próprio (30 por dia) vale para TODA tentativa: acerto, conversa que já existia e recusa. A recusa por causa da pessoa
vem como resposta (`{erro: "dm_fechada"}`), não como exceção, para o limite não ser desfeito junto. Assim ninguém descobre de
graça, uma carona por vez, de quem é cada uma. Limite que continua (da lista das caronas, Faixa 1, pedido P20): bloquear alguém e
recarregar a lista ainda mostra quais caronas eram dela.

## As regras, todas conferidas no servidor

1. **Só entre membros da Alumia:** 18+, consentimento em vigor, conta não suspensa (`interno.rede2_membro`). Visitante (`anon`)
   não chama nenhuma função. A Alumia não tem menores (LGPD art. 14; ECA art. 241-D), e o chat privado também não.
2. **Pedido de conversa.** Se a outra pessoa **segue você**, a conversa abre direto. Se não segue, vira **pedido** ("fulana quer
   conversar", sem mensagem nenhuma): ninguém escreve até ser aceito. Cada pessoa escolhe quem pode chamá-la: pedidos de qualquer
   membro (padrão), só de quem ela segue, ou ninguém. Perfil invisível não recebe pedido. Pedido recusado não se repete por
   30 dias; pedido sem resposta some em 30 dias.
3. **Bloquear** (o mesmo bloqueio da Alumia, `interno.rede_bloqueios`) corta tudo: não pede, não envia, não lê chave nem mensagem.
4. **Denunciar:** quem denuncia **escolhe os trechos** e eles são decifrados no aparelho dela (a moderação nunca tem a chave da
   conversa). **A tela diz com todas as letras que os trechos marcados saem do cifrado e vão em texto aberto para a moderação**;
   o resto da conversa continua cifrado. Vai para a fila de denúncias da Alumia como denúncia do perfil, com a prioridade da
   categoria; quem denuncia nunca é revelado; pode bloquear junto.
5. **Limite de envio** por pessoa (`interno.limite`): 120 mensagens por hora, 20 pedidos por dia, 10 trocas de chave e 10
   denúncias por dia, 20 versões novas por hora; conta com menos de 3 dias tem metade.
6. **Resposta igual para tudo o que é fechado:** bloqueio, preferência da pessoa, perfil invisível, não membro, recusa recente,
   @ inexistente: o mesmo erro `dm_fechada`. Conversa alheia e conversa inexistente: o mesmo `nao_encontrado`. Nada revela algo da
   outra pessoa.
7. **RLS estrita:** as tabelas `interno.rede_dm_*` têm RLS ligada **sem política nenhuma** e nenhum privilégio para `anon` ou
   `authenticated`: ninguém lê tabela. Só as funções (`security definer`) conferem que quem chama é participante. O embrulho feito
   para a outra pessoa nunca sai.
8. **Só cifrado, só em bloco:** a tabela recusa texto aberto, recusa "c3" fora dos sete tamanhos, e a função de enviar recusa
   também "c2" novo e versão da chave com mais de 8 dias.
9. **Nada em log:** as funções do chat não chamam o registro de atividades (`interno.registrar`), não mandam avisos com conteúdo e
   não fazem `raise notice`. As telas não escrevem no console e não chamam nenhum serviço de fora.
10. **Nada federado:** mensagem privada **não vai ao Fediverso**. Nenhuma função do Fediverso no banco e nenhum código em
    `lib/rede/fediverso`, `app/api/fediverso` ou `.well-known` toca nas tabelas do chat (conferido no teste).
11. **Metadados mínimos:** o chat mostra da outra pessoa só codinome, @handle e rosto (nunca nome do painel nem e-mail). A página
    não é indexada (`robots: noindex`) e não leva nada nos metadados. Não há "visto por último", "digitando" nem confirmação de
    leitura para a outra pessoa; só a contagem de não lidas para a própria pessoa.

## Retenção mínima e apagar

- Toda mensagem nasce com **prazo**: 1, 7 ou 30 dias (padrão 7, escolhido por cada pessoa nos Ajustes e por conversa). Encurtar o
  prazo vale para as mensagens novas (T33: ninguém apaga as provas do que já escreveu). Venceu, some: as leituras já filtram, a
  faxina da conversa apaga de vez a cada uso e a faxina geral (`interno.rede_dm_faxina`) cobre as conversas paradas. Embrulhos
  de versões antigas sem mensagem viva somem junto.
- **Apagar a mensagem** (quem escreveu): some para os dois. Depois de bloqueio (de qualquer lado) ou com denúncia aberta da
  outra pessoa, não: a mensagem é prova e some sozinha no prazo (T33).
- **Apagar a conversa** (qualquer participante): sai da lista de quem apaga, e o que veio antes some para essa pessoa. A outra
  continua com as mensagens até o prazo delas e pode denunciar; quando as duas apagam, mensagens e chaves embrulhadas somem
  de vez (T33: antes, quem assediava apagava as provas antes da denúncia).
- **Apagar tudo do chat** (Ajustes): tira todas as conversas da lista, apaga a chave pública, as preferências e as recusas que a
  pessoa fez, e o que o chat guardou desta conta neste aparelho. As recusas que OUTRAS pessoas fizeram contra ela ficam até
  vencer (são delas).
- **Sair rápido:** apaga do aparelho tudo do chat, de todas as contas (veja acima). Não apaga nada no servidor.
- **Apagar a conta:** chave estrangeira com `on delete cascade` em tudo (`interno.perfis`): mensagens, conversas, chaves e
  preferências somem junto.

## LGPD (Lei 13.709/2018) e outras leis, artigo por artigo

Conferido em 06/11/2026.

| Artigo | Como o chat cumpre |
|---|---|
| LGPD art. 6º, I a III (finalidade, adequação, necessidade) | Guarda só o necessário para entregar a mensagem: chaves públicas, embrulhos, o cifrado (em tamanhos fixos) e as datas. Nada de IP, aparelho, localização ou lista de contatos. |
| LGPD art. 6º, VII e VIII (segurança, prevenção) | Cifra de ponta a ponta; o servidor não consegue ler. RLS sem política, funções que conferem o participante, limite de envio, aviso de troca de identidade, chave com prazo. |
| LGPD art. 6º, X (responsabilização) | Testes automáticos provam o sigilo (`npm run testar:rede-chat`) e este documento descreve cada regra. |
| LGPD art. 7º, I e V; art. 8º | Base: o consentimento da Alumia (`rede2_membro`) e a execução do serviço que a própria pessoa pede (ativar o chat, abrir a conversa). |
| LGPD art. 11 | Conversas podem revelar dado sensível (saúde, orientação, opinião política): por isso ninguém além dos dois consegue ler, nem a equipe. |
| LGPD art. 14 | Sem crianças e adolescentes: só membros 18+ da Alumia. |
| LGPD art. 15 e 16 | Término do tratamento: prazo de 1/7/30 dias, faxina a cada uso; nada guardado depois do fim da finalidade. |
| LGPD art. 18, VI | Eliminação a pedido: apagar mensagem, conversa, tudo do chat, ou a conta (cascata). |
| LGPD art. 46 e 47 | Medidas técnicas de segurança desde a concepção (cifra, RLS, sem log de conteúdo). |
| LGPD art. 48 | Em incidente, o banco vazado só tem cifrado em blocos e chaves públicas; o texto não pode ser lido sem os aparelhos. |
| Marco Civil (Lei 12.965/2014) art. 7º, II e III; art. 10 | Sigilo das comunicações privadas: o conteúdo não é acessível ao instituto. Por isso não há como entregar conteúdo a terceiros; só o que o banco tem (cifrado e datas), e só por ordem judicial. |
| Marco Civil art. 19 e 21 | Denúncia com os trechos que a própria vítima escolhe mostrar; moderação age no perfil (suspender, bloquear). |
| ECA (Lei 8.069/1990) art. 241-D | Sem menores no chat; denúncia com categoria "menores" tem a maior prioridade na fila. |

## O que o chat NÃO faz (de propósito)

- Não manda arquivo, foto, áudio ou link com prévia (prévia de link faria o servidor ou o aparelho buscar endereço de fora).
- Não tem grupo: só duas pessoas por conversa (grupos ficam nos núcleos e comunidades).
- Não mostra "online", "visto por último", "digitando" nem confirmação de leitura.
- Não guarda cópia em nuvem nem recuperação de chave.
- Não aparece em busca, notificação por e-mail ou push com conteúdo.
- Não assina mensagem: nenhuma serve de prova de autoria para terceiros.

## Para aplicar em produção

1. No Supabase (SQL editor), rodar `supabase/migracoes/20261106-t19-rede-chat-privado.sql` e depois
   `supabase/migracoes/20261107-t33-seguranca.sql` (as duas acrescentáveis: podem rodar de novo). Se já foram aplicadas, não
   precisa repetir.
2. Seguir o passo a passo abaixo para a migração dos blocos.
3. **Caronas pelo chat:** depois da migração B1 dos atos da Faixa 1 (`20261110-alumia-b1-atos.sql`, que cria
   `interno.rede_ato_caronas`), rodar `supabase/migracoes/20261111-chat-caronas.sql`. Sem a tabela das caronas, ela recusa rodar
   e avisa qual migração falta. No `install.sql`, o bloco entra depois do bloco B1 dos atos (quem junta as frentes cola).
4. Publicar a imagem do site como de costume (`docs/HOSPEDAGEM.md`). Nenhuma variável nova em `/opt/lucia/site.env`.

### PASSO A PASSO PARA O DONO: migração `20261110-chat-blocos.sql`

**Antes.** A migração e o site novo andam juntos. O site antigo envia "c2", que o banco novo recusa; o site novo envia "c3", que
o banco antigo recusa. Em qualquer ordem há um intervalo em que enviar mensagem dá erro (ler continua funcionando, e nada se
perde). Para o intervalo ser de minutos: deixe a imagem nova do site pronta para publicar e só então rode a migração.

**Ordem.**

1. Confirme que as duas anteriores já estão aplicadas (a consulta abaixo precisa devolver 1):
   ```sql
   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'interno' and p.proname = 'rede_dm_podar';
   ```
2. No SQL editor do Supabase, cole e rode o arquivo `supabase/migracoes/20261110-chat-blocos.sql` inteiro. Pode rodar de novo
   sem medo: não apaga dado nenhum e não cria coluna nem tabela.
3. Publique o site novo em seguida.
4. Se algum dia a T19 ou a T33 forem rodadas de novo, rode esta de novo logo depois (ela redefine três funções daquelas duas;
   sem isso, enviar voltaria a aceitar só "c2" e o site novo pararia de enviar).

**Consulta de conferência** (depois do passo 2):

```sql
-- 1) A regra nova da tabela: precisa vir UMA linha, com o nome rede_dm_mensagens_corpo_formato e os sete tamanhos.
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'interno.rede_dm_mensagens'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%c3%';

-- 2) As duas funções novas existem e a de enviar já é a nova: precisa vir "2" e "t".
select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'interno' and p.proname in ('rede_dm_corpo_c3', 'rede_dm_faxina_da_conversa')) as novas,
       (select pg_get_functiondef(p.oid) like '%rede_dm_corpo_c3%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'rede_dm_enviar') as enviar_novo;

-- 3) Visitante não chama, quem entrou chama: precisa vir "f" e "t".
select has_function_privilege('anon', 'public.rede_dm_enviar(uuid, integer, text)', 'execute') as visitante,
       has_function_privilege('authenticated', 'public.rede_dm_enviar(uuid, integer, text)', 'execute') as quem_entrou;
```

Depois de publicar o site, mande uma mensagem de teste entre duas contas: ela precisa chegar, e no banco o corpo começa com `c3.`.

**Como desfazer.** Volte o site para a imagem anterior e rode de novo só as três funções que esta migração redefiniu, copiando
cada `create or replace function … $$;` do arquivo de origem: `public.rede_dm_enviar` de `20261106-t19-rede-chat-privado.sql`
(seção 6), e `public.rede_dm_mensagens` e `public.rede_dm_nova_versao` de `20261107-t33-seguranca.sql` (seção 4). Não rode a
T33 inteira para isso: ela mexe em funções de outras áreas, que migrações mais novas podem ter mudado. Com as três de volta,
enviar volta a aceitar só "c2". Depois, só se quiser, apague as duas funções novas:

```sql
drop function if exists interno.rede_dm_corpo_c3(text, integer);
drop function if exists interno.rede_dm_faxina_da_conversa(uuid);
```

**Não mexa na regra da tabela** ao desfazer: ela aceita os dois formatos e não atrapalha o site antigo. As mensagens "c3" já
enviadas ficam no banco até vencerem (no máximo 30 dias); o site antigo não as abre e mostra "não dá para abrir neste aparelho".
Nenhuma mensagem "c2" é perdida em nenhum dos dois sentidos.

**Para o integrador.** O arquivo `supabase/migracoes/20261110-chat-blocos.sql` inteiro vai colado no fim do
`supabase/install.sql`, depois do bloco da T33 (e de qualquer outro bloco que redefina funções `rede_dm_*`).

# Alumia: chat privado (mensagens diretas)

**Situação em 11/11/2026:** implementado e testado no banco local (`npm run testar:rede-chat`). Fica no ar junto com a Alumia
(recurso `rede-v2`, ligado): não tem chave liga/desliga própria. Nenhuma chave nova, nenhuma variável de ambiente nova, nenhum
serviço de fora, nenhuma biblioteca nova.

**Falta aplicar em produção**, nesta ordem: `supabase/migracoes/20261106-t19-rede-chat-privado.sql`,
`supabase/migracoes/20261107-t33-seguranca.sql` e, por último, `supabase/migracoes/20261110-chat-blocos.sql` (o formato "c3"
descrito abaixo). O passo a passo está no fim deste documento.

Pedido da coordenação (T19): "o chat privado no Alumia", com "TODAS as regras de segurança possíveis", "a mesma tecnologia que já
temos no chat interno", "nada pode vazar, nem de dentro nem de fora", seguindo a LGPD. Em 10/11/2026 o chat foi endurecido
(mensagens em blocos de tamanho fixo, sem assinatura, com repetição e ordem conferidas, chave com prazo também no banco), sem
trocar de tecnologia. Uma biblioteca de sigilo para a frente (a do Matrix) fica para uma etapa posterior.

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

A base é a das conversas da equipe (`lib/sigilo.ts`, `docs/RELATORIO-CHAT-E-CARGOS.md`, `npm run testar:sigilo`): WebCrypto puro,
sem biblioteca de fora.

- **Chave do aparelho:** par ECDH P-256 criado no navegador, parte privada **não exportável** (o próprio navegador não deixa
  ler), guardada no IndexedDB.
- **Identidade:** par ECDSA P-256, também não exportável, que **assina (certifica) a chave do aparelho**, e só ela. O banco
  guarda só as partes públicas e o certificado.
- **Chave da conversa:** AES-GCM-256, uma por versão, **embrulhada** (ECDH + HKDF-SHA-256 + AES-GCM) para a chave de cada um dos
  dois participantes. O embrulho é amarrado à conversa, à versão, a quem recebe e à versão da chave de quem recebe. O aparelho só
  embrulha para chave certificada pela identidade em que ele confia.
- **Confiar na primeira vez, avisar quando mudar:** o aparelho guarda a identidade e a chave do aparelho de cada pessoa com quem
  conversou. Se uma delas mudar, a conversa avisa e **não entrega chave nem envia nada** até a pessoa confirmar (veja "Identidade
  trocada"). **No primeiro contato não há o que comparar:** quem controla o servidor nesse momento pode entregar uma identidade
  falsa, e só a comparação do código (QR ou números, pessoalmente) descobre.
- **Contextos próprios** (`alumia-dm:…`): nada assinado ou cifrado no chat da Alumia serve nas conversas da equipe, nem o contrário.

### O formato das mensagens: "c3"

```
corpo     c3.<versão>.<vetor de 12 bytes>.<cifrado>            (base64url, sem "=")
cifrado   AES-GCM-256, com a chave da conversa, sobre um BLOCO de tamanho fixo
bloco     [4 bytes: comprimento do conteúdo][conteúdo][zeros até o fim do bloco]
conteúdo  [16 bytes: identificador sorteado][4 bytes: contador][8 bytes: até onde eu já tinha recebido][texto em UTF-8]
amarra    alumia-dm:c3:<conversa>:<autor>:v<versão>            (dado autenticado do AES-GCM)
```

"Até onde eu já tinha recebido" são a versão da chave e o contador (4 bytes cada) da última mensagem da OUTRA pessoa que o
aparelho de quem escreve já tinha quando escreveu (zero e zero se nenhuma). Veja "Repetição e ordem".

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

(O texto que cabe é o bloco menos 4 bytes do comprimento e 28 do começo do conteúdo.)

O banco **recusa** corpo "c3" com qualquer outro tamanho (regra na tabela e na função de enviar). O corpo inteiro tem no máximo
10972 caracteres. Ao abrir, o aparelho confere o bloco todo: tamanho da lista, comprimento que bate, o menor bloco possível, sobra
só com zeros. Qualquer diferença e a mensagem não abre.

O que isso esconde: o tamanho do que foi escrito, dentro de cada faixa (um "ok" e um parágrafo curto ficam iguais). O que **não**
esconde: quantas mensagens foram trocadas, quando, e em qual das sete faixas cada uma caiu.

**O formato antigo, "c2"** (assinado, de tamanho livre), continua na tabela **só para leitura**: o aparelho abre e confere a
assinatura como antes, e o banco recusa "c2" novo. Como toda mensagem vence em no máximo 30 dias, em 30 dias depois da migração
não sobra nenhuma legítima. O aparelho não depende de o servidor apagar: o c2 não tem identificador nem contador, então o
servidor poderia regravar uma c2 antiga quantas vezes quisesse. Por isso o aparelho (a) guarda o resumo (SHA-256) de cada corpo
c2 que já viu e trata o mesmo corpo como outra mensagem como **repetida**; (b) mostra **com aviso** a c2 que chega numa versão em
que o mesmo autor já mandou c3; e (c) **deixa de abrir toda c2 depois de `C2_ABRE_ATE`** (`lib/rede/chat-privado.ts`, hoje
20/12/2026: a migração mais 30 dias). Se a migração for aplicada depois de 20/11/2026, mude essa data no código (o passo a
passo diz a linha e a conta). A regra da tabela também amarra a versão escrita no corpo à coluna `versao`, nos dois formatos.

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
  mostrada de novo**: fica só a linha discreta "Mensagem repetida". A mesma linha devolvida duas vezes pelo servidor sai uma
  vez só. Depois de 45 dias a lista de uma versão ANTIGA é apagada e fica só um piso; mensagem que aparecer depois numa versão
  fechada é mostrada **com aviso** ("este aparelho não consegue conferir se é nova ou repetida"), nunca escondida. A versão
  atual nunca fecha.
- **Relógio do aparelho.** Ele não é de confiança (rede hostil, relógio sem bateria). Nenhum registro vence numa leitura em que
  a hora andou para trás ou saltou mais de 2 dias desde a leitura anterior, **nem nas leituras seguintes**: o salto fica
  anotado no aparelho (a "suspeita", junto da marca das versões) e só deixa de valer depois de 45 dias contados a partir dele,
  sem outro salto. (Antes, a segunda leitura depois do salto já confiava no relógio mexido, porque a hora da primeira tinha
  sido gravada.) O contador de quem escreve nunca recomeça. Consequência aceita: quem fica mais de 2 dias sem abrir uma
  conversa tem a limpeza das listas antigas dela adiada em 45 dias; a lista só guarda identificadores e contadores.
- **Buraco.** Se falta um contador entre duas mensagens que chegaram, a tela mostra, discreta, "Pode faltar mensagem aqui". O
  aparelho não sabe se a mensagem foi apagada por quem escreveu, venceu, ou foi retida no caminho: por isso é um aviso, não um
  erro. O começo da conversa (mensagens antigas já vencidas) não conta como buraco.
- **Ordem.** Dentro de cada pessoa a tela usa a ordem em que ela escreveu (versão da chave e contador, que o servidor não
  mexe); a hora do servidor só decide como as duas pessoas se intercalam. Quando a hora do servidor discorda, a mensagem ganha
  o aviso "a ordem desta mensagem não bate com a hora do servidor". Cada mensagem leva também "até onde eu já tinha recebido":
  se uma resposta aparece antes da mensagem que quem respondeu já tinha recebido, ela ganha o mesmo aviso; e as minhas
  mensagens que a outra pessoa ainda não tinha recebido quando escreveu a última dela ganham "ainda não tinha recebido esta".
- **Limite do relógio.** Quem controla o relógio do aparelho o tempo todo e o adianta aos poucos (menos de 2 dias por
  leitura, até somar mais de 45 dias) ainda consegue fechar uma versão antiga. O efeito é o do item acima: a
  mensagem antiga regravada aparece **com aviso**, nunca como nova sem aviso.
- **Os limites (o que continua SEM aviso).** O servidor ainda consegue, sem que o aparelho note: segurar as últimas mensagens
  enquanto nenhuma posterior chega; sumir com o começo de uma versão (o começo não é buraco); sumir com uma versão inteira de
  uma pessoa que não foi respondida; e atrasar a entrega. A memória é do aparelho: num aparelho novo, ou depois do "Sair
  rápido", ela começa do zero. A hora mostrada em cada mensagem é a do servidor. Sem IndexedDB (alguns modos privados), a
  conferência vale só enquanto a aba está aberta.
- No aparelho ficam só identificadores, contadores e resumos de corpo cifrado, nunca texto.

### Rotação da chave

- O aparelho faz versão nova quando alguém troca de aparelho e quando a versão atual passa de **7 dias**. Isso é conferido ao
  abrir a conversa **e de novo a cada envio** (a conversa pode ficar aberta por dias).
- O banco recusa envio em versão com mais de **8 dias** (um dia de folga para relógio e conversa aberta): o aparelho faz a versão
  nova **sem olhar o próprio relógio** (ele pode estar atrasado) e tenta de novo, uma vez.
- **A troca não depende só da palavra do servidor.** O aparelho guarda, por conversa, a maior versão da chave que já viu e
  quando a viu (pela hora dele). Versão menor que uma já vista é recusada ("dm_versao_voltou"): o servidor não faz o aparelho
  voltar a escrever numa chave antiga. E se, pela conta do aparelho, a versão atual passou de 7 dias e o servidor não deixa
  fazer a nova (ou mente a idade dela), **nada é enviado** ("dm_versao_presa").
- O envio trava a linha da conversa no banco (`for update`, como a versão nova): uma versão nova não confirma nem apaga os
  embrulhos da versão conferida no meio de um envio.
- **Faxina certa, sem sorteio:** a cada envio, a cada versão nova e a cada leitura da conversa, somem as mensagens vencidas
  daquela conversa e os **embrulhos das versões antigas que não têm mais mensagem viva**. Sem o embrulho, aquela chave não pode
  mais ser entregue a ninguém. A faxina geral antiga (por sorteio, de todas as conversas) continua como rede de segurança.

### Identidade trocada

- **Pessoa não verificada:** como antes. A conversa avisa que a chave de segurança mudou, nada é enviado, e a pessoa confirma
  ("Confio na chave nova") depois de falar com a outra por outro canal.
- **Pessoa que estava VERIFICADA:** a marca de verificado **some na hora**, com aviso claro, e o envio fica retido. **Um clique
  não basta:** a tela só segue quando a pessoa compara o código de novo, de um destes jeitos: lendo com a câmera o QR da outra
  pessoa (os sessenta números), ou digitando os **seis grupos da metade da outra pessoa** (trinta números), que ficam escondidos
  na própria tela e ela precisa ouvir da outra. Conferiu, a conversa volta a ficar verificada. A exigência vale também depois de
  recarregar a página, e o chaveiro recusa a confirmação sem comparação mesmo que a tela tente.
  - *Por que a metade inteira da outra pessoa.* O código é a metade de cada identidade, em ordem fixa. A minha metade não muda
    quando o servidor troca a identidade da outra pessoa: um grupo da minha metade confere com qualquer identidade falsa (a
    regra antiga sorteava entre os doze grupos e passava em metade das vezes). E um grupo só (cinco algarismos) é pouco: quem
    fabrica identidades acerta um grupo em cerca de cem mil tentativas. Trinta algarismos não se acertam assim.
  - O que fica confiado é a identidade **para a qual o código comparado foi calculado**. Se o servidor trocar a identidade de
    novo entre a comparação e o clique, o chaveiro recusa ("a chave de segurança mudou de novo enquanto você comparava").
- **Chave do aparelho trocada com a MESMA identidade:** neste chat a identidade e a chave do aparelho nascem juntas, então isso
  nunca é legítimo. É o que conseguiria quem rodou um script na página da pessoa uma vez (veja abaixo) e fez a identidade dela
  assinar a chave dele. O aparelho guarda também a chave do aparelho de cada pessoa e, se ela mudar sem a identidade mudar, a
  conversa avisa, **nada é enviado nem aberto com essa chave e não há botão de aceitar**: só a pessoa ativando o chat de novo
  (o que muda a identidade e cai no caso acima).
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

**Limite do QR:** o código é calculável por qualquer um que conheça as duas identidades públicas, inclusive o servidor. O QR só
prova alguma coisa quando é lido **na tela da outra pessoa, pessoalmente**: um QR mandado por mensagem, foto ou print pode ter
sido feito por quem está no meio. A tela diz isso junto do QR.

### O que fica neste aparelho, e o "Sair rápido"

No IndexedDB do chat (`lucia-alumia-chat`) ficam: a chave do aparelho e a identidade (não exportáveis), as identidades conhecidas
de cada pessoa (e se foram verificadas) e a memória de repetição e ordem (identificadores e contadores). **Mensagem aberta,
rascunho e chave de conversa nunca são gravados**: vivem só na memória da aba. Não há fila de envio.

O **"Sair rápido" da Alumia encerra a sessão da conta e apaga tudo isso** (`apagarTudoDoChat`): o banco IndexedDB inteiro, de
todas as contas deste aparelho, e o que estiver na memória (chaves de conversa, rascunho, mensagens abertas). Termina em menos de meio segundo, dentro do teto de
0,8 s do "Sair rápido", e nunca lança. Três cuidados para o apagar valer de verdade (`lib/rede/chat/gaveta.ts`, testados com
duas abas sobre o mesmo IndexedDB):

1. **As outras abas** são avisadas (BroadcastChannel, sem dado nenhum no aviso) e cada uma apaga a própria memória, fecha a
   conversa aberta, esquece a lista de conversas e volta à ativação.
2. **O banco só é criado na ativação.** Qualquer outra leitura ou gravação que encontre o banco sumido desfaz a criação; e a
   página que já tinha visto o banco entende que ele foi apagado por fora (outra aba, ou a saída do site, três Esc, em
   `lib/modo-seguro.ts`) e se limpa também. Uma busca que estava no caminho não recria o banco com ids de conversa e de pessoa.
3. Depois de apagar, a página não grava mais nada até a pessoa ativar o chat de novo.

**A sessão sai junto (P17, 11/11/2026).** O "Sair rápido" (`lib/rede/saida.ts`) revoga a sessão no servidor, com o mesmo pedido
da saída do site (`revogarSessao`, em `lib/modo-seguro.ts`: só esta sessão, com `keepalive`), e apaga do aparelho as chaves
dela (`lucia:sessao`, `lucia:nome`, `lucia:avatar`), antes e depois das limpezas. Quem pega o aparelho depois não abre a Alumia
dentro da conta: não vê a lista de conversas nem consegue ativar o chat com chave nova em nome da pessoa. Limite: sem rede, o
pedido de revogar não chega; a sessão some do aparelho do mesmo jeito, mas quem tivesse copiado o token antes ainda o usaria
até ele vencer.

**A saída do site (três Esc) roda a mesma limpeza (P16, 11/11/2026).** `sairRapido` de `lib/modo-seguro.ts` chama
`apagarTudoDoChat(300)` antes de apagar as bases, com teto próprio de 350 ms (contando baixar o módulo) dentro dos 700 ms da
saída: a trava liga nesta aba e as outras abas apagam a memória delas na hora, e não só quando notarem que o banco sumiu.

**"Apagar tudo do chat" (Ajustes) avisa as outras abas.** Ele apaga só os registros da conta (o banco das outras contas do
aparelho fica), e usa o mesmo aviso entre abas do pânico: uma aba esquecida aberta na conversa apaga as chaves da memória,
fecha a conversa e para de gravar.

**A tela depois do pânico.** A aba que viu o chat ser apagado volta à ativação com texto próprio ("O chat foi apagado deste
aparelho"), e não com o de "ativo em outro aparelho". Criar a chave nova continua pedindo o "entendi" do risco. Depois de
recarregar a página (ou de entrar de novo), o aparelho não tem como saber que houve pânico (não guarda marca nenhuma, de
propósito): aí a tela é a de "ativo em outro aparelho", sem o alerta de "este aparelho já tinha a chave".

**Consequências, ditas na tela de Ajustes:** depois do "Sair rápido" é preciso ativar o chat de novo neste aparelho; a chave nova
muda o código de segurança (as outras pessoas recebem o aviso de chave trocada) e o que foi escrito antes não abre mais aqui.
**E todas as verificações se perdem:** o aparelho esquece as identidades que conhecia (guardá-las seria deixar a lista de
contatos no aparelho). Ao reativar, cada conversa volta a "confiar na primeira vez": se o servidor entregar nesse momento uma
identidade falsa de alguém que estava verificado, **não aparece aviso nenhum**. Por isso a conversa mostra "não verificado"
no alto, e os Ajustes pedem para comparar o código de novo com cada pessoa antes de escrever algo sensível. É o preço de não
deixar a chave num aparelho que pode ser tomado.

**Limites que continuam:**

- Apagar o IndexedDB não garante que os arquivos do navegador no disco não guardem restos até a compactação. Não é testável
  aqui.
- O "Sair rápido" não apaga nada no servidor (as mensagens cifradas ficam lá até o prazo delas) e não mexe em outras sessões
  da conta abertas em outros aparelhos.

Os dois limites que estavam aqui (o "Sair rápido" não encerrava a sessão; a saída do site não rodava a limpeza do chat) foram
resolvidos em 11/11/2026: pedidos P17 e P16 em `docs/rede/PEDIDOS-ENTRE-FAIXAS.md`.

Diferenças de propósito em relação à equipe (menos comodidade, menos coisa que pode vazar): **um aparelho por conta**, sem cópia
de recuperação e sem aprovação de outro aparelho.

### O que um script rodando na página consegue (XSS na mesma origem)

O formato c3 não muda nada contra isto. "Não exportável" impede COPIAR a chave do aparelho e a identidade, não USAR. Um script
que rode **uma vez** na página do chat (uma falha de XSS no site, uma extensão do navegador com acesso à página) consegue:

1. tirar, com a chave do aparelho, o segredo ECDH cru com a chave de cada contato (`deriveBits`) e, com ele e o que está no
   banco, abrir os embrulhos **passados e futuros** daquela conversa sem voltar ao aparelho, até alguém ativar o chat de novo;
2. fazer a identidade assinar um certificado para uma chave do atacante. Isso o aparelho da outra pessoa agora nota (chave do
   aparelho trocada com a mesma identidade: aviso, nada sai, sem botão de aceitar), **mas só se ela já conhecia a chave antiga**:
   no primeiro contato, ou depois de um "Sair rápido" dela, a chave do atacante é aceita como a primeira;
3. ler as chaves de conversa da memória e as mensagens abertas na tela, e escrever em nome da pessoa.

Trocar o uso da chave para só `deriveKey` ajudaria pouco: o script ainda derivaria de antemão as chaves das versões seguintes.
O conserto de verdade é a etapa da biblioteca do Matrix (Olm par-a-par, num Worker em origem própria). Até lá, a defesa contra
isto é não ter XSS: a CSP do site e a revisão das telas.

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
8. **Só cifrado, só em bloco:** a tabela recusa texto aberto, recusa "c3" fora dos sete tamanhos e recusa linha em que a versão
   escrita no corpo não é a da coluna `versao` (nos dois formatos, também para o "c2" que já estava lá); a função de enviar
   recusa também "c2" novo e versão da chave com mais de 8 dias.
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
  pessoa fez, e o que o chat guardou desta conta neste aparelho (as outras abas são avisadas e apagam a memória delas). As recusas que OUTRAS pessoas fizeram contra ela ficam até
  vencer (são delas).
- **Sair rápido:** encerra a sessão da conta e apaga do aparelho tudo do chat, de todas as contas (veja acima). Não apaga
  nada no servidor.
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
3. Publicar a imagem do site como de costume (`docs/HOSPEDAGEM.md`). Nenhuma variável nova em `/opt/lucia/site.env`.

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
   E confira que nenhuma mensagem guardada tem uma versão na coluna e outra no corpo (precisa devolver 0; a regra nova da
   tabela exige as duas iguais):
   ```sql
   select count(*) from interno.rede_dm_mensagens where split_part(corpo, '.', 2) <> versao::text;
   ```
   Se vier outro número, a migração para no começo, com erro de "check", **sem mudar nada** (a regra antiga continua de pé).
   Linha assim não abre em aparelho nenhum (a chave da coluna não é a do corpo): não é mensagem legítima. Avise antes de
   apagar; para seguir, apague só essas linhas e rode a migração de novo:
   ```sql
   delete from interno.rede_dm_mensagens where split_part(corpo, '.', 2) <> versao::text;
   ```
2. No SQL editor do Supabase, cole e rode o arquivo `supabase/migracoes/20261110-chat-blocos.sql` inteiro. Pode rodar de novo
   sem medo: não apaga dado nenhum e não cria coluna nem tabela.
3. Publique o site novo em seguida. **Se a migração for aplicada depois de 20/11/2026**, antes de publicar mude a data de
   `C2_ABRE_ATE`, que está fixa no código. É uma linha só, em `lib/rede/chat-privado.ts` (perto da linha 159):
   ```ts
   export const C2_ABRE_ATE = Date.parse("2026-12-20T00:00:00Z");
   ```
   Troque `2026-12-20` pelo **dia em que a migração rodou mais 30 dias** (por exemplo: migração em 25/11/2026, a linha fica
   `Date.parse("2026-12-25T00:00:00Z")`). Só a data muda; grave, publique o site e rode `npm run testar:rede-chat` antes (o
   teste não depende da data). Por que importa: depois dessa data o aparelho deixa de abrir mensagem no formato antigo. Com a
   data de hoje e a migração atrasada, as últimas mensagens antigas (enviadas até o dia da migração, com prazo de 30 dias)
   deixariam de abrir antes de vencer. Se a migração rodar até 20/11/2026, não mexa em nada. Data mais tarde que o necessário
   não quebra nada: só estica o tempo em que uma mensagem antiga regravada pelo servidor ainda abriria (com os avisos de
   repetida e de formato antigo valendo).
4. Se algum dia a T19 ou a T33 forem rodadas de novo, rode esta de novo logo depois (ela redefine três funções daquelas duas;
   sem isso, enviar voltaria a aceitar só "c2" e o site novo pararia de enviar).

**Consulta de conferência** (depois do passo 2):

```sql
-- 1) A regra nova da tabela: precisa vir UMA linha, com o nome rede_dm_mensagens_corpo_formato, os sete tamanhos e a
--    comparação da versão do corpo com a coluna (split_part(corpo, '.', 2) = versao).
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

**Não mexa na regra da tabela** ao desfazer: ela aceita os dois formatos e não atrapalha o site antigo (que sempre gravou a
versão do corpo igual à da coluna). As mensagens "c3" já
enviadas ficam no banco até vencerem (no máximo 30 dias); o site antigo não as abre e mostra "não dá para abrir neste aparelho".
Nenhuma mensagem "c2" é perdida em nenhum dos dois sentidos.

**Para o integrador.** O arquivo `supabase/migracoes/20261110-chat-blocos.sql` inteiro vai colado no fim do
`supabase/install.sql`, depois do bloco da T33 (e de qualquer outro bloco que redefina funções `rede_dm_*`).

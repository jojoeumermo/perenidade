# Alumia: sala de voz cifrada (núcleos e comunidades fechadas)

Testada com `npm run testar:voz`. Usa a chave TURN da Cloudflare que a aula ao vivo já usa (`CLOUDFLARE_TURN_KEY_ID` e
`CLOUDFLARE_TURN_TOKEN`, variáveis do servidor).

## Onde fica

| Peça | Arquivo |
|---|---|
| A sala (combinação cifrada, ligações, teto de 8) | `lib/rede/voz/sala.ts` |
| No navegador (Realtime, microfone, chave do grupo) | `lib/rede/voz/navegador.ts` |
| A chave da sala, tirada do MLS do grupo (OpenMLS, suíte híbrida pós-quântica) | `lib/rede/grupos/chaveiro.ts` (`chaveDeVoz`), `lib/rede/grupos/epoca.ts` |
| Credenciais curtas do servidor de retransmissão | `app/api/alumia/voz/retransmissao/route.ts`, `lib/rede/voz/retransmissao.ts` |
| A tela | `components/rede/voz/SalaDeVoz.tsx` (textos em `i18n/rede/chat/*.json`, seção `voz`) |
| Teste | `scripts/testar-voz.mjs` |

## Como funciona

- **Sem servidor de mídia no meio.** Cada pessoa liga direto para cada outra (até 8 na sala). O áudio vai por WebRTC, cifrado
  ponto a ponto (DTLS-SRTP).
- **Sempre por retransmissão** (`iceTransportPolicy: "relay"`). O áudio passa pelo servidor TURN, que só repassa pacotes que não
  consegue ouvir. Ninguém na sala vê o endereço de rede de ninguém. Candidato com o endereço da pessoa (host, srflx) nunca é usado,
  mesmo que alguém mande. Sem servidor de retransmissão, a sala **não abre**.
- **A combinação da chamada** (ofertas, respostas, candidatos, com a impressão digital DTLS de cada aparelho) vai cifrada
  (AES-256-GCM) com uma chave tirada do segredo MLS da época do grupo (*exporter* do MLS, depois HKDF com um rótulo só da voz e
  o nome da sala: a chave da voz é outra que a dos posts). Quem saiu do grupo não tira a chave da época seguinte. Quem não é do grupo não entra
  no meio da ligação nem vê quem está na sala. O canal de combinação (Realtime do serviço, com nome sorteado) só vê blocos
  cifrados. Recado mexido ou com mais de 1 minuto é descartado.
- **Credenciais do TURN**: curtas (1 hora), pedidas pela rota do site só por quem é membro do grupo (conferido no banco).
- **Microfone** só liga no toque em "Entrar", e desliga ao sair, ao fechar a página e no "Sair rápido".

## Limites, ditos com franqueza

- **Até 8 pessoas.** Cada uma manda o áudio para cada outra; acima disso o celular não aguenta.
- **Palco** (poucas falam, muitas ouvem) precisa de um servidor de mídia (SFU) com cifra de ponta a ponta por quadro (SFrame /
  insertable streams). Não está feito: fica para quando houver um SFU próprio. O Galène da aula ao vivo não cifra de ponta a ponta.
- **Dentro do grupo, um membro pode se passar por outro na combinação** (a chave é do grupo, não de cada pessoa, e o "de quem"
  vai dentro do recado, sem assinatura). Na prática, um membro que esteja no grupo pode trocar a impressão da conexão de outra
  pessoa pela dele e ficar no meio da conversa de áudio entre duas pessoas (ouvir e repassar), e pode repetir um recado dentro
  do prazo de 60 segundos. Quem é de fora do grupo não consegue nada disso. O nome mostrado vem da lista do grupo. Mandar a
  combinação como mensagem de aplicação do MLS (assinada por quem manda) está na lista.
- A Cloudflare (o TURN) vê que endereços falam com o servidor dela e quanto tráfego passa; não o conteúdo.

## Chamada da conversa a dois (Prompt 4, itens 139 e 140)

Atrás do interruptor `alumia-p4-chamadas` (só pelo nome, desligado). Testada com `npm run testar:p4-chamadas`.

| Peça | Arquivo |
|---|---|
| O toque (chave, id, voz ou vídeo) e as chaves tiradas dele | `lib/rede/chamada/toque.ts` |
| O toque dentro do cifrado da conversa (controle `chamada`) | `lib/rede/chat/r2/servico.ts` (`mandarChamada`) |
| A sala (a de voz, com teto de 2 e câmera) | `lib/rede/chamada/sala.ts`, `lib/rede/voz/sala.ts` |
| O andamento (ligar, tocar, atender, recusar, desligar) e o navegador | `lib/rede/chamada/painel.ts`, `lib/rede/chamada/cliente.ts`, `lib/rede/chamada/guarda.ts` |
| A tela | `components/rede/chamada/` (botões no alto da conversa e o cartão em toda tela) |

- **O toque é conteúdo da conversa cifrada.** Vai como um tipo novo de conteúdo dentro do cifrado do chat a dois (mesma cifra,
  mesmo envelope de tamanho fixo, mesmo ritmo do texto). O servidor do chat não sabe que houve chamada. Ele leva uma chave de 32
  bytes sorteada no aparelho de quem liga; dela saem a chave da combinação (AES-256-GCM, como a da sala do grupo) e o nome do canal
  de combinação. Só os aparelhos das duas pessoas recebem o toque.
- **A sala é a de voz.** Ligação direta, sempre por retransmissão, combinação cifrada, no máximo 2 pessoas (o primeiro aparelho que
  atende fica; quem ligou avisa os outros aparelhos que a chamada foi atendida). O canal de combinação entra sem a sessão da conta, e
  a retransmissão vem por passe anônimo: o serviço vê um canal com nome sorteado, não as duas contas.
- **Vídeo:** a câmera só vai numa sala de até 4 pessoas. Com mais gente, a câmera de cada uma desliga no próprio aparelho e a sala
  segue só com voz (volta sozinha quando cabe de novo). Na chamada a dois isso nunca acontece.
- **Nenhum registro.** Nada vai ao disco nem ao banco: nem chamada feita, nem recebida, nem perdida. O que está tocando fica só na
  memória da aba, e o "Sair rápido" apaga.
- **A combinação aqui não tem o problema da sala do grupo.** Na sala do grupo, a chave é de todos os membros, e um membro pode se
  passar por outro (veja "Limites"). Na chamada a dois, só as duas pessoas têm a chave. Quem poderia "se passar" pela outra é a
  própria outra. Quem é de fora não tem a chave.

Limites, ditos com franqueza:

- **O toque só chega com a Alumia aberta** no aparelho da outra pessoa (a busca das caixas segue o ritmo do chat: até 1 minuto com a
  tela à vista, e o depósito pode esperar até 30 s). O toque vale 2 minutos. Não há notificação de chamada no celular: o servidor
  não sabe que houve chamada para poder avisar. Tocar com o app fechado é pendência dos apps (`[N]`).
- **A chamada de grupo está desligada.** Ela usaria a chave do grupo, com o mesmo problema da sala do grupo (um membro se passar
  por outro). Corrigir pede que a combinação vá como mensagem de aplicação do MLS, assinada por quem manda: isso mexe no protocolo
  da voz e fica para depois. Até lá, em grupo, só a sala de voz que já existe, com o limite dito acima.
- O serviço do canal de combinação e a Cloudflare (o TURN) veem os endereços de rede que entram no canal e na retransmissão, e
  quanto tráfego passa; não o conteúdo.

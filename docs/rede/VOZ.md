# Alumia: sala de voz cifrada (núcleos e comunidades fechadas)

**Situação em 13/11/2026:** pronta e testada (`npm run testar:voz`). Falta a Faixa 1 pôr o componente na página do grupo (pedido
P22 em `docs/rede/PEDIDOS-ENTRE-FAIXAS.md`). Nenhuma migração nova. Nenhuma chave nova na VPS: usa a chave TURN da Cloudflare que
a aula ao vivo já usa (`CLOUDFLARE_TURN_KEY_ID` e `CLOUDFLARE_TURN_TOKEN` em `/opt/lucia/site.env`).

## Onde fica

| Peça | Arquivo |
|---|---|
| A sala (combinação cifrada, ligações, teto de 8) | `lib/rede/voz/sala.ts` |
| No navegador (Realtime, microfone, chave do grupo) | `lib/rede/voz/navegador.ts` |
| A chave da sala, tirada do MLS do grupo | `lib/rede/grupo-mls.ts` (`chaveDeVoz`) |
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
  (AES-256-GCM) com uma chave tirada do segredo MLS da época do grupo (HKDF, com o nome da sala). Quem não é do grupo não entra
  no meio da ligação nem vê quem está na sala. O canal de combinação (Realtime do serviço, com nome sorteado) só vê blocos
  cifrados. Recado mexido ou com mais de 1 minuto é descartado.
- **Credenciais do TURN**: curtas (1 hora), pedidas pela rota do site só por quem é membro do grupo (conferido no banco).
- **Microfone** só liga no toque em "Entrar", e desliga ao sair, ao fechar a página e no "Sair rápido".

## Limites, ditos com franqueza

- **Até 8 pessoas.** Cada uma manda o áudio para cada outra; acima disso o celular não aguenta.
- **Palco** (poucas falam, muitas ouvem) precisa de um servidor de mídia (SFU) com cifra de ponta a ponta por quadro (SFrame /
  insertable streams). Não está feito: fica para quando houver um SFU próprio. O Galène da aula ao vivo não cifra de ponta a ponta.
- Dentro do grupo, um membro poderia se passar por outro na combinação (a chave é do grupo, não de cada pessoa). Quem é de fora,
  não. O nome mostrado vem da lista do grupo.
- A Cloudflare (o TURN) vê que endereços falam com o servidor dela e quanto tráfego passa; não o conteúdo.

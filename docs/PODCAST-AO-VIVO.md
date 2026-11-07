# Podcast imersivo e ao vivo (T17, 06/11/2026)

Pedido da coordenação (NOVAS-TAREFAS, imagem 17): o podcast com escuta imersiva enquanto a pessoa navega ou só deixa a
página aberta, e transmissão ao vivo com vídeo feita pelas pessoas do podcast.

## 1. Áudio espacial (binaural, aberto)

Dolby Atmos é proprietário (licença, codificador e decodificador fechados). O equivalente aberto daqui usa só a
Web Audio API do navegador, sem biblioteca e sem arquivo baixado:

- **Espacialização binaural:** o som estéreo é separado em dois alto-falantes virtuais (`PannerNode` com
  `panningModel = "HRTF"`) a ±30° à frente de quem ouve. Com fones, a voz sai "de fora da cabeça".
- **Ambiência leve:** um `ConvolverNode` com resposta ao impulso **gerada no próprio navegador** (ruído com decaimento,
  semente fixa, normalizada, pré-atraso), em três ambientes: estúdio, sala e auditório. Nenhum arquivo de impulso é
  baixado; a mistura fica baixa para a voz continuar clara.
- **Liga e desliga** no tocador (botão de fones) e no cartão da página `/podcasts`. A escolha fica no próprio aparelho
  (`localStorage`, só "ligado" e "ambiente"; nada vai para o servidor).
- **Continua navegando:** o tocador (`components/RadioPlayer.tsx`) é montado no layout `app/[lang]/layout.tsx`, então o
  som e o modo seguem entre páginas. Com a aba em segundo plano, o tocador retoma o `AudioContext` se o navegador o
  suspender (`statechange`).
- **Som de fora:** um áudio de servidor que não permite processamento (sem CORS) toca normal, sem o modo, e a tela diz
  isso; o elemento `<audio>` é trocado para não "mutar" o som (regra da Web Audio com mídia de outra origem).
- **Honestidade na tela:** o nome é "Áudio espacial (binaural, aberto)". A palavra "Dolby" não aparece na interface (o
  teste confere nos seis idiomas).

Arquivos: `lib/audio-imersivo.ts` (puro: impulso, posições, montagem da cadeia, escolha guardada) ·
`components/podcast/AudioEspacial.tsx` · `components/RadioPlayer.tsx`.

## 2. Podcast ao vivo, com vídeo

Quem faz o podcast (`interno.podcaster()`: coordenação, comunicação/jornalismo e quem tem a função do podcast no painel)
vê na página `/podcasts` o **Estúdio ao vivo**. Para o público, o bloco só aparece quando há transmissão no ar.

Dois jeitos, ambos reaproveitando o que o site já tem para as aulas ao vivo (`docs/AULA-AO-VIVO.md`):

| Modo | Como | Para quantas pessoas |
| --- | --- | --- |
| **Câmera deste navegador** | WebRTC direto do navegador de quem transmite, com a sala e a transmissão de `lib/tempo-real.ts` e `lib/aovivo.ts` (presença assinada: quem assiste só aceita vídeo da chave pública registrada no banco para aquela sala) e o TURN da Cloudflare de `/api/aovivo/rede` quando configurado (o vídeo passa pelo servidor e ninguém vê o endereço de rede de ninguém). Câmera, tela ou só áudio; microfone silenciável. | Até **15** pessoas (`LIMITE_DIRETO` em `lib/podcast-ao-vivo.ts`): cada pessoa recebe uma cópia saindo da conexão de quem transmite (720p ≈ 1,5 Mbit/s cada, ≈ 22 Mbit/s de subida). Quem chega depois recebe o aviso de sala cheia e, se houver, a transmissão aberta de reserva. |
| **Transmissão aberta** | OBS (ou o app do celular) → PeerTube da lista do instituto (`NEXT_PUBLIC_VIDEO_HOSTS`) ou YouTube. A página embute o tocador **só depois do clique** (PeerTube sem P2P; YouTube pelo endereço sem cookies de publicidade). Outro endereço https vira só link. | Quanta gente o PeerTube/YouTube aguentar: é **a opção que escala** e a recomendada para muita gente. |

Por que não a sala Galène ou o Jitsi: a Galène do instituto é a sala das aulas (com gravação no servidor e máquina
própria) e o Jitsi serve chamadas pequenas; nenhum dos dois distribui para centenas. A transmissão aberta no PeerTube
já é o caminho que escala no projeto (o mesmo das gravações e do plano B das aulas).

### Privacidade e consentimento

- **Consentimento de imagem e voz (LGPD, art. 7º, I; menores: LGPD art. 14 e ECA art. 17):** começar exige marcar que
  todas as pessoas que aparecem ou falam concordaram e que ninguém menor de 18 anos aparece sem autorização de quem
  responde por ela. O banco recusa sem isso (`consentimento`) e guarda só a hora da confirmação.
- **Aviso a quem assiste:** sem gravação pelo site, sem rastreio, e pedido para não gravar nem republicar a imagem ou a
  voz de ninguém sem autorização.
- **Sem gravação e sem rastreio por padrão:** o site não grava; nada de quem assiste é guardado (quem assiste entra na
  sala com uma chave sorteada na hora, sem nome). O estado público não diz quem começou a transmissão.
- **Necessidade (LGPD art. 6º, III):** enquanto está no ar, o banco guarda título, modo, endereço, a sala sorteada, a
  chave pública da aba e quem começou; ao encerrar, sala, chave e endereço são apagados.
- Quem assiste não liga câmera nem microfone.

### Regras no banco

Migração `supabase/migracoes/20261106-t17-podcast-ao-vivo.sql` (também no `supabase/install.sql`). **Não aplicada em
produção.** Uma transmissão por vez; outra pessoa do podcast só toma o lugar quando a atual cai (ou pela coordenação).
Pelo navegador, a página de quem transmite dá sinal de vida a cada minuto (`podcast_ao_vivo_pulso`); três minutos sem
sinal, sai do ar sozinha. Por link, sai do ar em 12 horas se ninguém encerrar. Limite de 30 inícios por dia por pessoa.

Funções: `podcast_ao_vivo_estado`, `podcast_ao_vivo_iniciar`, `podcast_ao_vivo_chave`, `podcast_ao_vivo_pulso`,
`podcast_ao_vivo_encerrar`.

### Variáveis

Nenhuma nova. Usa as que já existem: `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_TOKEN` (e as do teto de gasto) para o
TURN, e `NEXT_PUBLIC_VIDEO_HOSTS` para os PeerTube aceitos. Sem o TURN (chaves ausentes, Cloudflare fora do ar ou teto
do mês, hoje 600 GB), o podcast NÃO liga direto (T33): quem transmite é avisado e a transmissão pelo navegador sai do ar, e
quem assiste vê a transmissão aberta de reserva, se houver. A ligação direta mostraria o endereço de rede de quem transmite
a qualquer visitante, e o de quem assiste a quem transmite. A rota do TURN tem limite por pessoa e entrega uma credencial
por sala a cada 5 minutos.

### Peso

A página carrega só a consulta do estado (uma chamada pequena a cada 30 s com a aba visível). O WebRTC
(`components/podcast/AoVivoSala.tsx`) só baixa ao clicar em "Assistir ao vivo" ou ao começar a transmitir; o tocador
do PeerTube/YouTube, só depois do clique.

### Arquivos

`lib/podcast-ao-vivo.ts` · `components/podcast/AoVivo.tsx` · `components/podcast/AoVivoSala.tsx` ·
`app/api/aovivo/rede/route.ts` (aceita `?podcast=<sala>`) · `app/[lang]/podcasts/page.tsx` · textos em
`i18n/*.json` (`podcast.aoVivo`, `radio.espacial`).

### Testes

`npm run testar:podcast`: as regras do banco (`scripts/testar-podcast.mjs`, inclusive o ao vivo) e, sem navegador, o
áudio espacial e as regras puras do ao vivo (`scripts/testar-podcast-imersivo.mjs`).

### Pendências

Teste de campo com transmissão real (câmera, 3G, sala cheia com 15 pessoas, TURN ligado). Abrir a migração no Supabase.

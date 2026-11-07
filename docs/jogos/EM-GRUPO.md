# Jogos em grupo e palco dos jogos (T23)

Pedido da coordenação (NOVAS TAREFAS, leva 2): "deixa os jogos mais imersivos, adiciona mais jogos de mais de 1 jogador.
Muito mais. Pq podemos ter um grupo de 10 pessoas estudando juntos através dos jogos."

Teste: `npm run testar:jogos-em-grupo` (sala, apelido e filtro de contato, banco tirado do conteúdo do site, regras dos oito
jogos no motor, o que a vista pública esconde, privacidade, leveza, textos nos 6 idiomas).

## O que entrou

### 1. Palco dos jogos (todos os jogos de `/jogos`)

`components/jogos/Imersao.tsx` envolve qualquer jogo aberto na página:

- **Tela cheia** (Fullscreen API do navegador). O botão só aparece onde ela existe; o "Voltar aos jogos" fica dentro.
- **Som opcional, desligado por padrão.** Notas sintetizadas no aparelho com WebAudio (`components/jogos/audio.ts`, os
  mesmos sons dos jogos das crianças): acerto, erro, "sua vez", tique nos últimos 5 segundos e o arpejo do fim. Nenhum
  arquivo de áudio, nada de terceiros. O módulo de som só é baixado quando o som é ligado. A escolha fica em
  `lib/storage.ts` (`lucia:jogos-som`), só neste aparelho.
- **Retorno visual:** clarão verde/vermelho/dourado na borda a cada acerto, erro ou vez; uma chuva curta de estrelas no fim;
  a peça que muda (resposta revelada, letra, carta posta) ganha um realce. CSS puro em `app/globals.css` (bloco
  "Palco dos jogos e jogos-em-grupo"). Com `prefers-reduced-motion: reduce` ou nos modos leve e e-ink, fica só a cor da
  borda, sem deslocamento nem estrelas.
- O aviso escrito (`role="status"`) continua sendo o retorno principal; som e animação só acompanham.
- Os jogos de treino ligam o retorno pelo `tom` do `Aviso` (`components/jogos/comum.tsx`): cruzadas, caça-palavras, ditado,
  forca, jogo da velha, memória e quebra-cabeça. Os jogos do Instituto e os das crianças seguem como eram, já dentro do palco
  (tela cheia e o botão de som).

### 2. Jogos em grupo (categoria nova "Jogos em grupo")

De 2 a 12 pessoas (o grupo de ~10 do pedido, com folga), cada uma no seu aparelho.

| Jogo | Motor | Conteúdo (do próprio site) | Como se joga |
|---|---|---|---|
| Corrida de perguntas | perguntas, individual, rapidez | exercícios das aulas por disciplina (`content/exercicios`, agrupados pela área da trilha) ou o glossário | quem acerta primeiro ganha 3, o segundo 2, os outros certos 1 |
| Quiz em equipe | perguntas, equipes | o mesmo | 2 a 4 equipes; vale a resposta mais votada dentro de cada equipe (empate: quem respondeu antes) |
| Quem disse? em roda | perguntas | `content/frases.json` | a frase e quatro autores do mesmo arquivo |
| Fato ou boato? em roda | perguntas | as checagens (`content/checagens`) | só as de veredito claro: fato, boato ou enganosa |
| Assembleia | debate | os cartões de `/debates` | opinião secreta → argumentos sem nome (até 2 por pessoa) → voto no mais forte (não no seu) → resultado com a resposta do instituto e as fontes → segunda opinião |
| Forca coletiva | forca | glossário (palavras de 5 a 12 letras) | uma letra por pessoa, na vez dela; o grupo salva a palavra junto (6 erros) |
| Bingo de conceitos | bingo | glossário (termos curtos, a definição com o termo escondido) | cartela 3×3 (18 conceitos) ou 4×4 (30); bingo só vale com a linha toda de conceitos já chamados |
| Fio da história | fio | `content/neste-dia.json` | o grupo vota onde cada carta entra na linha do tempo; a carta entra no lugar certo mesmo se o grupo errar |

Todos são originais (regras e desenho próprios); nenhum copia jogo comercial. A forca coletiva usa uma faixa de protesto que
se rasga, desenhada em vetor aqui.

Opções do saguão: disciplina (Corrida e Quiz em equipe), rodadas (5, 8, 12, 20), tempo por rodada (sem relógio, 15 a 60 s;
o padrão é **sem relógio**, quem anima a sala avança: WCAG 2.2.1), número de equipes e "eu também jogo" (desligado, quem
criou só apresenta, por exemplo num telão em sala de aula).

Pontos: só da partida em curso, para o quadro do fim. Nada é somado entre partidas, nada fica guardado, não há ranking.
Os jogos de grupo (forca, fio) dão ponto ao grupo, não a pessoas.

## Como a sala funciona

```
quem cria (anfitrião)                      quem entra
  estado inteiro (motor.ts)  ◀── ações ──   "respondi a 2", "a letra A"
  aplica as regras                         
  vista pública  ───────── broadcast ──▶   desenha a vista
```

- **Tecnologia de tempo real:** a mesma das aulas ao vivo e do painel, o Realtime do serviço de contas (Supabase), por
  WebSocket: mensagens *broadcast* e *presença* num canal `jogo:<CÓDIGO>`. Nada passa por tabela, nada é gravado; entra-se
  com a chave pública do site, sem conta. Não precisou de migração de banco nem de chave nova.
- **Sem o serviço** (cópia local sem banco), a sala funciona entre abas do mesmo navegador (`BroadcastChannel`), o que serve
  para testar e para jogar num computador com várias janelas. A tela avisa.
- **Código curto:** 5 caracteres de um alfabeto sem 0/O, 1/I/L (dá para ditar em voz alta), cerca de 29 milhões de
  combinações. O convite é `/jogos#sala=ABC23`: o código vai depois do `#`, que não sai do navegador.
- **Anfitrião:** guarda o estado e só transmite a vista pública (sem a resposta certa antes da revelação, sem o ano da carta,
  sem a palavra da forca, sem quem escreveu cada argumento, sem a lista de quem foi tirado da sala). O relógio da rodada roda
  no anfitrião; a cada 5 s ele retransmite a sala (cura mensagem perdida e acerta quem chegou).
- **Se o anfitrião sai**, quem chegou antes entre os presentes assume a sala (turma e equipes ficam; a partida volta ao
  saguão, porque as respostas escondidas estavam só com ele).
- **Desconfiança:** toda ação que chega pela rede passa pelo motor, que confere tipo, tamanho e faixa de cada campo; ações de
  quem anima a sala (começar, avançar, esconder argumento, tirar da sala) só valem do anfitrião.
- **Limite honesto:** o canal é aberto (qualquer um com a chave pública e o código entra). Um participante mal-intencionado
  com conhecimento técnico pode se passar por outro participante da mesma sala (os ids são públicos na vista). Para um jogo de
  estudo sem pontos guardados, o risco é pequeno; o anfitrião pode tirar a pessoa da sala. Se um dia virar problema: canal
  privado com autorização do Realtime (`private: true` + política em `realtime.messages`), o que exigiria migração.

## Privacidade (LGPD e ECA)

- Sem conta, sem cadastro: entra-se com um **apelido** (sorteado de árvores, rios e bichos do Brasil, ou escrito pela pessoa,
  até 20 caracteres). O apelido existe só enquanto a aba está aberta; não é guardado no aparelho nem no servidor
  (LGPD, art. 6º, III: só o necessário).
- Como crianças e adolescentes também jogam, o apelido e os argumentos da Assembleia **recusam telefone, e-mail, endereço de
  site e @ de rede social** (`temContato` em `lib/jogos/grupo/sala.ts`): ninguém usa o jogo para puxar contato fora dele
  (ECA, art. 17, preservação da imagem e da identidade, e o cuidado do art. 241-D). A pessoa que tentou recebe um recado só
  para ela.
- Os argumentos da Assembleia circulam **sem o nome de quem escreveu**; quem anima a sala pode escondê-los (moderação).
- O id de cada participante é sorteado por aba (não identifica pessoa nem aparelho) e some ao fechar.
- Nenhum rastreio, nenhuma chamada a terceiros: o banco de questões vem do próprio site (`/api/jogos-em-grupo/<banco>`, um
  arquivo estático gerado na montagem, igual para todos, baixado só por quem anima a sala, sem cookie: `credentials: "omit"`).

## Leveza

- A categoria "Jogos em grupo" na página só tem os cartões (dados). A sala (`components/jogos/grupo/*`, o motor, o canal) só é
  baixada quando alguém abre um desses jogos (`next/dynamic`); o cliente de tempo real (`@supabase/supabase-js`) só quando a
  sala conecta.
- O som só é baixado quando é ligado. Nenhuma imagem, nenhuma fonte, nenhum arquivo de som.
- O banco de cada disciplina tem no máximo 160 questões (`MAXIMO_POR_DISCIPLINA`) e só aparecem as disciplinas com pelo
  menos 8 (`MINIMO_POR_DISCIPLINA`).

## Arquivos

- `lib/jogos/grupo/sala.ts`: código, apelido, filtro de contato, cores, equipes (puro).
- `lib/jogos/grupo/banco.ts`: transforma o conteúdo do site em perguntas, cartas, palavras e conceitos (puro).
- `lib/jogos/grupo/motor.ts`: as regras dos oito jogos, a vista pública, a sucessão do anfitrião (puro).
- `lib/jogos/banco-em-grupo.ts`: só servidor; as questões por disciplina e os temas de debate.
- `app/api/jogos-em-grupo/[banco]/route.ts`: o banco estático (`force-static`).
- `components/jogos/grupo/canal.ts`, `useSala.ts`, `preparar.ts`, `JogosEmGrupo.tsx`, `Partidas.tsx`: a sala no navegador.
- `components/jogos/Imersao.tsx`: o palco (som, tela cheia, retorno visual).

## Textos

`i18n/jogos/<idioma>.json`, chaves `imersao` e `grupo`, nos 6 idiomas. Como o resto da página, só o português é texto final;
as perguntas, frases, debates e datas vêm do conteúdo em português (a página avisa fora do português). Os recados do motor
(argumento recusado, bingo antes da hora, troca de anfitrião) estão em português.

## Pendências e ideias

- Testar com 10+ pessoas reais no Realtime de produção (o limite do plano do Supabase é de mensagens por segundo por
  projeto; uma sala de 12 com relógio fica bem abaixo).
- Jogos de cartas com mão escondida por pessoa (exigiria mensagens individuais cifradas, ou canal privado).
- Traduzir os recados do motor.

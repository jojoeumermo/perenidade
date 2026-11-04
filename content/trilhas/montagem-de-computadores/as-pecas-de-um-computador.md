---
titulo: "As peças de um computador"
resumo: "O que faz cada peça, da placa-mãe à fonte, como elas trabalham juntas e o que olhar quando o computador está lento."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Organização Estruturada de Computadores"
    autor: "Andrew S. Tanenbaum"
    ano: "1976 (1ª edição)"
  - titulo: "First Draft of a Report on the EDVAC"
    autor: "John von Neumann"
    ano: "1945"
  - titulo: "iFixit: guias de reparo gratuitos"
    autor: "iFixit"
    url: "https://pt.ifixit.com/"
quiz:
  - pergunta: "Qual peça executa as instruções dos programas?"
    opcoes: ["A fonte", "O processador", "O gabinete"]
    resposta: 1
    explicacao: "O processador (CPU) faz as contas e segue as instruções, bilhões delas por segundo."
  - pergunta: "O que acontece com o que está na memória RAM quando o computador é desligado?"
    opcoes: ["Fica guardado para sempre", "Some: a RAM só guarda enquanto há energia", "Vai para a fonte"]
    resposta: 1
    explicacao: "Por isso um texto não salvo se perde quando falta luz. O que fica guardado é o que foi gravado no armazenamento."
  - pergunta: "Qual é a principal vantagem do SSD sobre o HD?"
    opcoes: ["É muito mais rápido e não tem partes que se movem", "É sempre maior", "Não precisa de energia"]
    resposta: 0
    explicacao: "O HD tem discos girando e uma agulha de leitura. O SSD guarda os dados em chips, e por isso é mais rápido e resiste melhor a quedas."
  - pergunta: "O que faz a fonte de alimentação?"
    opcoes: ["Guarda os arquivos", "Transforma a energia da tomada na energia que as peças usam", "Mostra a imagem no monitor"]
    resposta: 1
    explicacao: "Ela converte a corrente alternada da tomada em corrente contínua de baixa tensão."
modelo: 9
---
## O que você vai aprender

Ao fim desta aula você vai saber nomear as principais peças de um computador e o que cada uma faz, diferenciar RAM de armazenamento e HD de SSD e decidir o que trocar quando ele está lento.

```suarealidade
Que computador ou celular você usa no trabalho ou nos estudos? O que o deixa lento ou limita o que você consegue fazer com ele?
```



## Uma cozinha

Um computador faz três coisas: **recebe** informação, **processa** e **devolve**. Para entender as peças, pense em uma cozinha de restaurante.

| Na cozinha | No computador | O que faz |
| --- | --- | --- |
| A cozinheira | **Processador** (CPU) | Segue as receitas, uma instrução de cada vez, muito depressa |
| A bancada | **Memória RAM** | Onde fica o que está sendo usado agora |
| A despensa | **Armazenamento** (HD ou SSD) | Onde tudo fica guardado, mesmo com a cozinha fechada |
| O prédio, com os canos e os fios | **Placa-mãe** | Liga todas as peças entre si |
| O gás e a luz | **Fonte** | Entrega energia do jeito que cada peça precisa |
| O exaustor | **Cooler** e ventoinhas | Tiram o calor |
| A janela por onde saem os pratos | **Placa de vídeo** e monitor | Mostram o resultado |

Esse desenho geral, com um processador, uma memória, o armazenamento e as entradas e saídas, vem dos anos 1940 e continua valendo do computador de mesa ao celular.

## Placa-mãe

É a placa grande à qual tudo se conecta. Nela ficam o **soquete** do processador, os **encaixes de memória**, os conectores do armazenamento e as portas de trás do gabinete: USB, rede, som, vídeo.

A placa-mãe decide quais peças servem. **Processador e memória precisam ser compatíveis com ela**: um processador só entra no soquete para o qual foi feito, e cada geração de memória tem um encaixe diferente. É o primeiro ponto a conferir antes de comprar qualquer peça.

Na placa-mãe há também um pequeno programa gravado, a **BIOS** ou **UEFI**, que é o primeiro a rodar quando se aperta o botão de ligar.

## Processador (CPU)

É a peça que executa as instruções dos programas. Dois números aparecem em qualquer anúncio:

- **Núcleos**: quantas tarefas ele consegue tocar ao mesmo tempo. Quatro núcleos são quatro cozinheiras.
- **Frequência**, em gigahertz (GHz): o ritmo de cada núcleo.

Comparar processadores só por esses dois números engana: um modelo novo com frequência menor pode ser bem mais rápido do que um antigo. O que vale é comparar o modelo exato.

O processador esquenta muito. Por isso leva em cima um **dissipador** de metal com uma ventoinha (o conjunto é o **cooler**) e, entre os dois, uma camada fina de **pasta térmica**, que ajuda o calor a passar.

## Memória RAM

É a bancada: o espaço onde ficam os programas e arquivos **abertos neste momento**. É muito rápida e **volátil**, isto é, perde tudo quando falta energia.

Quando a bancada enche, o sistema passa a guardar parte das coisas no armazenamento, que é bem mais lento. É quando o computador "engasga" ao trocar de janela. Pouca RAM é uma das causas mais comuns de lentidão.

A RAM vem em **pentes** e se mede em gigabytes (GB).

```verificar
Faltou luz no meio de um trabalho que ainda não tinha sido salvo. Onde estava o texto?
- No HD
+ Na memória RAM, que se apaga sem energia
- Na fonte
> Qual peça só guarda enquanto está ligada?
```

## Armazenamento: HD e SSD

É a despensa: guarda o sistema, os programas e os seus arquivos **mesmo com o computador desligado**.

| | HD (disco rígido) | SSD |
| --- | --- | --- |
| Como guarda | Discos magnéticos que giram, lidos por um braço mecânico | Chips de memória, sem partes móveis |
| Velocidade | Mais lento | Muito mais rápido |
| Barulho e quedas | Faz ruído e é sensível a pancadas | Silencioso e mais resistente |
| Preço por gigabyte | Mais barato | Mais caro |

Também se mede em gigabytes (GB) e terabytes (TB). Um terabyte são mil gigabytes.

### RAM e armazenamento não são a mesma coisa

É a confusão mais comum, porque as duas se medem em gigabytes. "Meu celular tem 128 giga" fala do armazenamento. "Tem 6 giga de RAM" fala da bancada. Um não substitui o outro.

## Placa de vídeo

Calcula as imagens que vão para o monitor. Existe de dois jeitos:

- **Integrada**: fica dentro do processador ou da placa-mãe e usa parte da memória RAM. Basta para internet, textos, vídeos e aulas.
- **Dedicada**: é uma placa separada, com processador e memória próprios. Serve para jogos pesados, edição de vídeo, modelagem em três dimensões. Gasta mais energia e esquenta mais.

Para estudar e trabalhar com textos, a integrada resolve.

## Fonte

Transforma a energia da tomada, em corrente alternada de 127 ou 220 volts, na corrente contínua de baixa tensão que as peças usam. A potência se mede em **watts** (W) e precisa cobrir o consumo de todas as peças, com folga.

Uma fonte ruim é a peça que mais põe as outras em risco: quando ela falha, pode queimar o que estiver ligado nela. É o último lugar para economizar.

## Gabinete e refrigeração

O gabinete é a caixa. Além de segurar tudo no lugar, ele organiza a **passagem do ar**: ventoinhas puxam ar fresco por um lado e empurram ar quente pelo outro. Poeira acumulada tapa esse caminho, e computador que esquenta demais fica lento e desliga sozinho.

## Entradas e saídas

Teclado, mouse, microfone e câmera são **entradas**. Monitor, caixas de som e impressora são **saídas**. Pen drive, rede e tela sensível ao toque fazem os dois papéis.

## E o notebook? E o celular?

Têm as mesmas peças, só que menores e, em boa parte, soldadas umas às outras. No celular, processador, vídeo e outros componentes vêm juntos em um único chip. Por isso o computador de mesa é o mais fácil de consertar e melhorar: abre-se com uma chave de fenda e cada peça sai inteira.

Em muitos notebooks ainda dá para trocar a memória e o armazenamento. Vale conferir antes de comprar.

## O computador está lento: por onde olhar

Em um computador antigo, as duas melhorias que mais fazem diferença, e que custam menos, costumam ser:

1. **trocar o HD por um SSD**;
2. **aumentar a memória RAM**, se a placa-mãe aceitar.

E, antes de gastar qualquer dinheiro: limpar a poeira e instalar um sistema mais leve. A trilha de Linux e software livre mostra como.

```verificar
Um computador de dez anos demora cinco minutos para ligar, mas depois funciona razoavelmente. Qual troca tende a ajudar mais?
- Um gabinete novo
+ Um SSD no lugar do HD
- Um monitor maior
> Ligar é, quase todo, ler arquivos da despensa.
```

## Antes de abrir

Não abra nada ainda. **Tire o computador da tomada antes de mexer** e nunca abra a fonte: ela guarda carga mesmo desligada. A próxima aula trata de segurança, eletricidade estática e ferramentas.

## Exemplo resolvido: "128 giga" ou "6 giga"? E o que trocar?

Pergunta 1: um celular tem "128 giga" e "6 giga de RAM". Qual número é qual?

1. A RAM é a bancada: guarda o que está aberto agora e se apaga sem energia. Os 6 GB são a RAM.
2. O armazenamento é a despensa: guarda sistema, programas e arquivos mesmo desligado. Os 128 GB são o armazenamento.
3. Um não substitui o outro, embora os dois se meçam em gigabytes.

Pergunta 2: um computador de dez anos demora cinco minutos para ligar, mas depois funciona razoavelmente. O que trocar?

1. Ligar é, quase todo, ler arquivos da despensa (o armazenamento).
2. O HD tem discos que giram e um braço mecânico; o SSD usa chips, sem partes móveis, e é muito mais rápido.
3. Troque o HD por um SSD. Antes de gastar, limpe a poeira e considere um sistema mais leve.

Confira: a troca que mais ajuda é a que ataca o gargalo, e aqui o gargalo era o armazenamento.

```outrolado
# O argumento mais forte de quem discorda
Muita gente defende que, em computador antigo, não vale a pena trocar peças: o equipamento esquenta mais, gasta mais energia e fica sem atualizações de segurança do fabricante. A Microsoft encerrou o suporte do Windows 10 em 14 de outubro de 2025, e muitos computadores de dez anos não atendem aos requisitos do Windows 11; para quem pensa assim, comprar um computador novo é a opção mais segura.
---
Como você responderia, com respeito e com fatos? Pense no que a aula diz sobre sistemas mais leves e sobre o que custa trocar só uma peça.
---
Uma resposta possível: o argumento tem razão ao lembrar que um sistema sem atualizações é um risco, e que a decisão deve olhar a segurança. A aula, porém, aponta um caminho: trocar o HD por um SSD, aumentar a RAM se a placa-mãe aceitar e instalar um sistema mais leve, como os da trilha de Linux e software livre, que continuam recebendo atualizações. Vale comparar o custo das duas saídas antes de decidir.
```

```agir
# Esta semana
Sem abrir o computador nem o celular, descubra e anote num papel: o modelo, a quantidade de RAM e o tipo e o tamanho do armazenamento do aparelho que você mais usa (em Configurações, na parte "Sobre"). Depois escreva qual das peças você acha que limita o aparelho.
```

## Resumo

- Cozinha: processador (a cozinheira), RAM (a bancada), armazenamento (a despensa), placa-mãe (o prédio), fonte (gás e luz), cooler (exaustor) e placa de vídeo com monitor (a janela).
- A placa-mãe decide quais peças servem: processador e memória precisam ser compatíveis com ela.
- A RAM é rápida e volátil; o armazenamento guarda mesmo desligado. HD é mais barato e lento; SSD, muito mais rápido e silencioso.
- Placa de vídeo integrada basta para estudo e trabalho com texto; a dedicada serve para jogos pesados, edição de vídeo e modelagem 3D.
- Para um computador antigo e lento: SSD no lugar do HD, mais RAM (se a placa-mãe aceitar), limpeza e sistema mais leve.
- Tire o computador da tomada antes de mexer e nunca abra a fonte.

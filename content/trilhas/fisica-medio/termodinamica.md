---
titulo: "Termodinâmica"
resumo: "Objetivo: entender as leis que regem as trocas de calor e trabalho, calcular o rendimento de uma máquina térmica e explicar por que nenhuma máquina aproveita toda a energia que recebe."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 12.2, First Law of Thermodynamics: Thermal Energy and Work"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/12-2-first-law-of-thermodynamics-thermal-energy-and-work"
  - titulo: "Physics, seção 12.3, Second Law of Thermodynamics: Entropy"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/12-3-second-law-of-thermodynamics-entropy"
  - titulo: "Physics, seção 12.4, Applications of Thermodynamics: Heat Engines, Heat Pumps, and Refrigerators"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/12-4-applications-of-thermodynamics-heat-engines-heat-pumps-and-refrigerators"
quiz:
  - pergunta: "O que afirma a primeira lei da termodinâmica?"
    opcoes: ["Que o calor sempre sobe", "Que a energia se conserva: o calor recebido se divide entre aumento da energia interna e trabalho realizado", "Que toda máquina tem rendimento de 100%"]
    resposta: 1
    explicacao: "É o princípio da conservação da energia aplicado às trocas de calor e trabalho."
  - pergunta: "Uma máquina térmica recebe 1 000 J de calor e rejeita 700 J. Qual é o seu rendimento?"
    opcoes: ["70%", "30%", "100%"]
    resposta: 1
    explicacao: "O trabalho útil é 1 000 − 700 = 300 J; o rendimento é 300 ÷ 1 000."
  - pergunta: "Segundo a segunda lei, o calor passa espontaneamente:"
    opcoes: ["Do corpo mais quente para o mais frio", "Do corpo mais frio para o mais quente", "Em qualquer sentido, tanto faz"]
    resposta: 0
    explicacao: "Para fazer o contrário, como na geladeira, é preciso gastar energia."
  - pergunta: "Como a geladeira esfria o interior?"
    opcoes: ["Criando frio", "Retirando calor de dentro e lançando-o para fora, com gasto de energia elétrica", "Bloqueando a entrada de luz"]
    resposta: 1
    explicacao: "A grade atrás da geladeira é quente porque é por ali que o calor sai."
---

## A ciência das máquinas a vapor

A **termodinâmica** nasceu de um problema prático. No século XVIII, as máquinas a vapor moviam as minas e as fábricas da Revolução Industrial, e consumiam montanhas de carvão. A pergunta era: **quanto trabalho se pode tirar de certa quantidade de calor?**

A resposta levou a algumas das leis mais gerais da física. Esta aula parte do que foi visto em [Calor e temperatura](/trilhas/fisica-fundamental/calor-e-temperatura).

## Três ideias de partida

- **Temperatura**: mede o grau de agitação das partículas de um corpo.
- **Calor** (Q): energia que passa de um corpo a outro por causa de uma diferença de temperatura.
- **Energia interna** (U): a soma das energias das partículas de um corpo.

Na termodinâmica, usa-se a escala **kelvin**: **T (K) = T (°C) + 273**. O zero kelvin, ou **zero absoluto** (−273 °C), é a temperatura mais baixa que pode existir.

### A lei zero

Se dois corpos estão em equilíbrio térmico com um terceiro, estão em equilíbrio entre si. Parece óbvio, mas é o que permite existir o **termômetro**.

## Primeira lei: a energia se conserva

Um gás dentro de um cilindro com pistão pode receber calor e pode empurrar o pistão, realizando trabalho. A primeira lei faz o balanço:

**ΔU = Q − W**

- Q: calor **recebido** pelo gás;
- W: trabalho **realizado** pelo gás;
- ΔU: variação da energia interna.

```conta
Um gás recebe 500 J de calor e realiza 200 J de trabalho ao empurrar o pistão.
ΔU = 500 − 200 = 300 J
A energia interna (e a temperatura) do gás aumentou.
```

A primeira lei é a **conservação da energia**: não se cria energia do nada. Ela enterra o sonho da máquina que produziria trabalho sem consumir nada, o chamado **moto-perpétuo**.

Foi o inglês **James Joule**, na década de 1840, quem mostrou com experimentos que calor e trabalho são duas formas da mesma coisa: energia.

### A bomba de bicicleta e o desodorante

- Ao **comprimir** o ar depressa na bomba, você realiza trabalho sobre ele; a energia interna sobe e a bomba **esquenta**.
- Ao **expandir-se** depressa, o gás do aerossol realiza trabalho à custa da própria energia interna e **esfria**. É o princípio usado na geladeira.

## Segunda lei: o sentido das coisas

A primeira lei não proíbe que o café esquente sozinho tirando calor do ar da cozinha: a energia se conservaria. Mas isso nunca acontece. A **segunda lei** explica por quê. Ela pode ser dita de dois jeitos:

> O calor passa espontaneamente do corpo mais quente para o mais frio, nunca o contrário.

> Nenhuma máquina que funcione em ciclos transforma **todo** o calor que recebe em trabalho.

Sempre sobra uma parte que tem de ser jogada fora, em um ambiente mais frio.

### Entropia

A segunda lei também se expressa com a **entropia**, uma medida da **desordem** ou do espalhamento da energia. Em um sistema isolado, a entropia nunca diminui. Um copo quebra, e os cacos não se juntam sozinhos; a fumaça se espalha, e não volta para o cigarro. A energia continua toda lá, mas cada vez mais espalhada e menos aproveitável.

## Máquinas térmicas

Uma **máquina térmica** recebe calor de uma **fonte quente** (Qq), transforma uma parte em trabalho (W) e rejeita o resto para uma **fonte fria** (Qf).

**W = Qq − Qf**

O **rendimento** é a fração aproveitada:

**η = W ÷ Qq**

```conta
Um motor recebe 1 000 J da queima do combustível e rejeita 700 J pelo escapamento e pelo radiador.
W = 1 000 − 700 = 300 J
η = 300 ÷ 1 000 = 0,30 = 30%
```

São máquinas térmicas o motor do carro, a locomotiva a vapor e as turbinas das usinas termelétricas e nucleares.

### O limite de Carnot

Em **1824**, o engenheiro francês **Sadi Carnot** mostrou que existe um rendimento **máximo**, que nenhuma máquina térmica pode ultrapassar, por mais bem construída que seja. Ele depende só das temperaturas das fontes, em kelvin:

**η máximo = 1 − Tf ÷ Tq**

```conta
Máquina operando entre 500 K (227 °C) e 300 K (27 °C).
η máximo = 1 − 300 ÷ 500 = 0,40 = 40%
```

As máquinas reais ficam abaixo desse teto. O desperdício não é só defeito de projeto: é lei da natureza.

```verificar
O que aumenta o rendimento máximo de uma máquina térmica?
- Aproximar as temperaturas da fonte quente e da fonte fria
+ Aumentar a diferença entre a temperatura da fonte quente e a da fonte fria
- Usar um combustível mais caro
> Veja a fórmula de Carnot: quanto menor a razão Tf ÷ Tq, maior o rendimento.
```

## A geladeira: a máquina ao contrário

A geladeira **não cria frio**. Ela retira calor do interior (a fonte fria) e o lança na cozinha (a fonte quente). Como isso contraria o sentido espontâneo, é preciso **gastar energia**: a eletricidade que move o compressor.

- A grade atrás da geladeira é **quente**: é por ali que sai o calor retirado dos alimentos.
- Deixar a porta da geladeira aberta **não refresca** a cozinha: o calor tirado da frente sai por trás, somado ao do motor. A cozinha esquenta.
- O **ar-condicionado** faz o mesmo com a sala: joga o calor para a rua.

## Por que isso importa

A termodinâmica mostra que a energia tem **qualidade**. A eletricidade pode virar quase inteiramente movimento em um motor elétrico. Já o calor só vira trabalho em parte. Queimar combustível para mover um carro desperdiça a maior parte da energia como calor. É uma das razões técnicas a favor do transporte sobre trilhos eletrificado e da economia de energia como política pública.

## Para praticar

1. Um gás recebe 800 J de calor e sua energia interna aumenta 500 J. Que trabalho ele realizou?
2. Uma usina termelétrica recebe 2 000 J de calor para cada 700 J de energia elétrica produzida. Qual é o rendimento? Para onde vai o resto?
3. Calcule o rendimento máximo de uma máquina que opera entre 600 K e 300 K.
4. Explique, com a segunda lei, por que o gelo derrete no copo e a bebida esfria, e nunca o contrário.

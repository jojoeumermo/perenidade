---
titulo: "Vetores"
resumo: "Objetivo: distinguir grandezas escalares e vetoriais, somar vetores e decompor um vetor em componentes, aplicando isso a forças e velocidades."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 5.1, Vector Addition and Subtraction: Graphical Methods"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/5-1-vector-addition-and-subtraction-graphical-methods"
  - titulo: "Physics, seção 5.2, Vector Addition and Subtraction: Analytical Methods"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/5-2-vector-addition-and-subtraction-analytical-methods"
quiz:
  - pergunta: "Qual destas grandezas é vetorial?"
    opcoes: ["Massa", "Temperatura", "Força"]
    resposta: 2
    explicacao: "Para descrever uma força é preciso dizer a intensidade, a direção e o sentido."
  - pergunta: "Duas forças de 30 N e 40 N agem sobre um corpo em direções perpendiculares. Qual é a intensidade da resultante?"
    opcoes: ["70 N", "50 N", "10 N"]
    resposta: 1
    explicacao: "Pelo teorema de Pitágoras: R² = 30² + 40² = 2 500, logo R = 50 N."
  - pergunta: "Duas pessoas puxam uma corda em sentidos opostos, com 200 N e 150 N. Qual é a resultante?"
    opcoes: ["350 N", "50 N, no sentido da força maior", "Zero"]
    resposta: 1
    explicacao: "Vetores de mesma direção e sentidos opostos se subtraem."
  - pergunta: "Uma força de 100 N faz ângulo de 30° com a horizontal. Qual é a componente vertical? (sen 30° = 0,5)"
    opcoes: ["50 N", "100 N", "87 N"]
    resposta: 0
    explicacao: "A componente vertical é F·sen 30° = 100 × 0,5 = 50 N."
---

## Quando o número não basta

Se alguém diz "a massa do saco é 50 kg", a informação está completa. Mas se diz "empurre o carro com 500 N", falta saber: **para onde?**

- **Grandezas escalares** ficam definidas por um número e uma unidade: massa, tempo, temperatura, energia, volume.
- **Grandezas vetoriais** precisam também de **direção** e **sentido**: deslocamento, velocidade, aceleração, força.

Para representar as vetoriais, usa-se o **vetor**: uma seta.

| Na seta | Representa |
| --- | --- |
| comprimento | a **intensidade** (ou módulo) |
| a reta em que está | a **direção** (horizontal, vertical, inclinada) |
| a ponta | o **sentido** (para a direita, para cima) |

Direção e sentido não são a mesma coisa: uma rua tem uma direção e dois sentidos.

## Somar vetores

Somar vetores não é somar números. O resultado, chamado **vetor resultante**, depende de como as setas estão orientadas.

### Mesma direção e mesmo sentido

As intensidades **se somam**. Duas pessoas empurrando um carro para a frente, com 300 N e 200 N: resultante de 500 N.

### Mesma direção e sentidos opostos

As intensidades **se subtraem**, e a resultante aponta para o lado do maior. No cabo de guerra, 200 N contra 150 N: resultante de 50 N.

### Direções perpendiculares

Os dois vetores formam os catetos de um triângulo retângulo, e a resultante é a hipotenusa. Vale o **teorema de Pitágoras**:

**R² = a² + b²**

```conta
Um barco atravessa um rio apontando para a outra margem, a 4 m/s.
A correnteza o arrasta rio abaixo a 3 m/s.
R² = 4² + 3² = 16 + 9 = 25
R = 5 m/s
```

O barco anda a 5 m/s em relação à margem, em uma direção inclinada: chega do outro lado, mas mais abaixo. O barqueiro experiente sabe disso sem fazer conta, e aponta a proa um pouco rio acima.

### O caso geral

Para somar dois vetores em qualquer ângulo, desenha-se o segundo a partir da ponta do primeiro. A resultante vai do começo do primeiro à ponta do segundo. É a **regra do polígono**, que vale para qualquer quantidade de vetores.

A resultante de duas forças nunca é maior que a soma das intensidades nem menor que a diferença.

```verificar
Duas forças de 6 N e 8 N agem sobre o mesmo corpo. Qual destes valores a resultante NÃO pode ter?
- 2 N
- 10 N
+ 15 N
> O máximo é a soma (14 N) e o mínimo é a diferença (2 N).
```

## Decompor um vetor

O caminho inverso também é útil: trocar um vetor inclinado por dois, um **horizontal** e um **vertical**, que juntos fazem o mesmo efeito. São as **componentes**.

Se o vetor F faz um ângulo θ com a horizontal:

- componente horizontal: **Fx = F · cos θ**
- componente vertical: **Fy = F · sen θ**

| Ângulo | seno | cosseno |
| --- | --- | --- |
| 30° | 0,50 | 0,87 |
| 45° | 0,71 | 0,71 |
| 60° | 0,87 | 0,50 |

```conta
Um trabalhador puxa um carrinho por uma corda inclinada 30° acima da horizontal, com força de 100 N.
Fx = 100 × cos 30° = 100 × 0,87 = 87 N   (puxa o carrinho para a frente)
Fy = 100 × sen 30° = 100 × 0,50 = 50 N   (alivia o peso sobre o chão)
```

Dos 100 N de esforço, só 87 N servem para mover o carrinho. Quanto mais inclinada a corda, menos força útil para a frente.

## Onde isso aparece

- **Na construção**: o peso de um telhado inclinado se divide em uma parte que comprime as paredes e outra que as empurra para fora. É por isso que existem as tesouras e os tirantes.
- **Na navegação e na aviação**: o vento e a correnteza se somam à velocidade do barco ou do avião.
- **No corpo**: carregar um balde com o braço afastado do tronco exige mais dos músculos do que com o braço junto ao corpo.
- **No plano inclinado**: o peso se decompõe em uma parte que aperta o corpo contra a rampa e outra que o puxa rampa abaixo.

## Para praticar

1. Classifique em escalar ou vetorial: tempo, velocidade, energia, peso, volume, deslocamento.
2. Uma pessoa caminha 300 m para o leste e depois 400 m para o norte. Qual foi a distância percorrida? E o deslocamento?
3. Um avião voa a 200 km/h para o norte com vento de 50 km/h soprando para o sul. Qual é a velocidade em relação ao solo?
4. Decomponha uma força de 200 N que faz 60° com a horizontal.

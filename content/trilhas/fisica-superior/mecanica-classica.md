---
titulo: "Mecânica clássica"
resumo: "Objetivo: rever as leis de Newton com ferramentas do cálculo, aplicar os teoremas de conservação de energia, de momento linear e de momento angular e entender a rotação dos corpos rígidos."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "University Physics, volume 1, seção 3.6, Finding Velocity and Displacement from Acceleration"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-1/pages/3-6-finding-velocity-and-displacement-from-acceleration"
  - titulo: "University Physics, volume 1, seção 8.2, Conservative and Non-Conservative Forces"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-1/pages/8-2-conservative-and-non-conservative-forces"
  - titulo: "University Physics, volume 1, seção 10.7, Newton's Second Law for Rotation"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-1/pages/10-7-newtons-second-law-for-rotation"
  - titulo: "University Physics, volume 1, seção 11.3, Conservation of Angular Momentum"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-1/pages/11-3-conservation-of-angular-momentum"
quiz:
  - pergunta: "Se a posição de um corpo é x(t) = 3t², qual é a sua velocidade em t = 2 s?"
    opcoes: ["6 m/s", "12 m/s", "3 m/s"]
    resposta: 1
    explicacao: "A velocidade é a derivada da posição: v(t) = 6t; em t = 2 s, v = 12 m/s."
  - pergunta: "O que caracteriza uma força conservativa?"
    opcoes: ["O trabalho que ela realiza entre dois pontos não depende do caminho", "Ela nunca realiza trabalho", "Ela sempre dissipa energia em calor"]
    resposta: 0
    explicacao: "A gravidade e a força elástica são conservativas; o atrito não é."
  - pergunta: "Qual é o análogo rotacional da massa?"
    opcoes: ["O torque", "O momento de inércia", "A velocidade angular"]
    resposta: 1
    explicacao: "Assim como F = m·a, na rotação vale τ = I·α."
  - pergunta: "Uma patinadora que gira encolhe os braços. O que acontece com a sua velocidade de rotação?"
    opcoes: ["Diminui", "Aumenta, porque o momento angular se conserva e o momento de inércia diminuiu", "Não muda"]
    resposta: 1
    explicacao: "L = I·ω é constante: se I cai, ω sobe."
---

## O que muda no nível superior

No ensino médio, as leis de Newton aparecem com aceleração constante e fórmulas prontas. A mecânica clássica no nível superior usa o **cálculo** para tratar qualquer movimento, e organiza tudo em torno de **leis de conservação**. Convém ter visto [Limites](/trilhas/matematica-superior/limites), [Derivadas](/trilhas/matematica-superior/derivadas) e [Integrais](/trilhas/matematica-superior/integrais), além da [Dinâmica do ensino médio](/trilhas/fisica-medio/dinamica-aplicacoes-das-leis-de-newton).

## Cinemática com cálculo

A velocidade é a **derivada** da posição em relação ao tempo; a aceleração, a derivada da velocidade:

**v(t) = dx/dt · a(t) = dv/dt**

O caminho inverso é a **integral**: conhecendo a aceleração e as condições iniciais, obtém-se a velocidade e a posição.

```conta
x(t) = 3t² (metros)
v(t) = dx/dt = 6t
a(t) = dv/dt = 6 m/s²
em t = 2 s: v = 12 m/s
```

As fórmulas do movimento uniformemente variado (v = v₀ + at; x = x₀ + v₀t + at²/2) são apenas o caso particular em que a aceleração é constante. Com o cálculo, o mesmo método serve para acelerações que variam no tempo.

## A segunda lei em forma geral

**F resultante = dp/dt**, em que **p = m·v** é o momento linear.

Quando a massa é constante, isso se reduz a F = m·a. A forma com o momento vale também para sistemas que ganham ou perdem massa, como o foguete que queima combustível.

Os problemas seguem um roteiro: isolar o corpo, desenhar o **diagrama de corpo livre**, escolher eixos e escrever a segunda lei em cada direção. O resultado é, em geral, uma **equação diferencial** cuja solução dá o movimento.

## Trabalho e energia

O trabalho de uma força ao longo de um caminho é a integral

**W = ∫ F · dr**

e o **teorema trabalho-energia** diz que o trabalho total é igual à variação da energia cinética, K = mv²/2.

### Forças conservativas e energia potencial

Uma força é **conservativa** quando o trabalho que realiza entre dois pontos **não depende do caminho**. A gravidade e a força da mola são conservativas; o atrito não é: arrastar uma caixa por um caminho mais longo gasta mais energia.

Para as forças conservativas, define-se uma **energia potencial** U, tal que a força é a derivada de U com sinal trocado (em uma dimensão, F = −dU/dx).

| Força | Energia potencial |
| --- | --- |
| Peso, perto da superfície | U = m·g·h |
| Mola | U = k·x²/2 |
| Gravitação, a qualquer distância | U = −G·M·m/r |

Se só forças conservativas realizam trabalho, a **energia mecânica** K + U se conserva. Se há atrito, a diferença aparece como energia térmica: a energia total continua conservada.

```verificar
Uma bola é solta de uma altura e desce por dois tobogãs diferentes, um reto e um sinuoso, sem atrito. Em qual ela chega embaixo mais rápida?
- No reto
- No sinuoso
+ Chega com a mesma velocidade nos dois
> A gravidade é conservativa: o trabalho depende só da diferença de altura.
```

## Sistemas de partículas

O **centro de massa** de um sistema se move como se toda a massa estivesse concentrada nele e todas as forças externas agissem ali. As forças internas (as que as partes fazem umas nas outras) se cancelam aos pares, pela terceira lei.

Consequência: se a força externa resultante é zero, o **momento linear total se conserva**. É o que governa as colisões e a propulsão de foguetes, vistas em [Quantidade de movimento](/trilhas/fisica-medio/quantidade-de-movimento).

## Rotação

Para corpos que giram, cada grandeza do movimento em linha reta tem uma análoga:

| Translação | Rotação |
| --- | --- |
| posição x | ângulo θ |
| velocidade v | velocidade angular ω |
| aceleração a | aceleração angular α |
| massa m | **momento de inércia** I |
| força F | **torque** τ |
| F = m·a | **τ = I·α** |
| K = m·v²/2 | K = I·ω²/2 |
| momento linear p = m·v | **momento angular** L = I·ω |

O **momento de inércia** mede a resistência a mudar a rotação e depende de **como a massa se distribui**: massa longe do eixo pesa mais. Por isso é mais fácil girar uma barra pelo meio do que pela ponta.

O **torque** é a "força de girar": τ = r · F · sen θ. A maçaneta fica longe da dobradiça para que a mesma força produza mais torque.

### Conservação do momento angular

Se o torque externo é zero, o momento angular L = I·ω se conserva.

- A patinadora encolhe os braços: I diminui, ω aumenta.
- O mergulhador se encolhe no ar para dar mais voltas e se estica antes de entrar na água.
- Um planeta anda mais depressa perto do Sol: é a segunda lei de Kepler, vista em [Gravitação universal](/trilhas/fisica-medio/gravitacao-universal), consequência dessa conservação.

## As três conservações

Toda a mecânica clássica se apoia em três princípios de conservação: **energia**, **momento linear** e **momento angular**. Eles valem muito além da mecânica de Newton e continuam válidos na relatividade e na física quântica, o que mostra o quanto são profundos.

## Os limites da mecânica clássica

A mecânica de Newton funciona com enorme precisão para corpos de tamanho comum e velocidades bem menores que a da luz. Falha em dois extremos: velocidades próximas à da luz ([relatividade](/trilhas/fisica-superior/relatividade-restrita)) e escalas atômicas ([mecânica quântica](/trilhas/fisica-superior/mecanica-quantica-os-fundamentos)).

## Para praticar

1. Se x(t) = 2t³ − 4t, encontre v(t) e a(t). Em que instante a velocidade é zero?
2. Uma mola de constante k = 200 N/m é comprimida 0,1 m e solta um bloco de 0,5 kg sem atrito. Qual é a velocidade do bloco ao deixar a mola?
3. Explique, com o momento de inércia, por que um equilibrista usa uma vara longa.
4. Uma roda de momento de inércia 2 kg·m² gira a 10 rad/s. Que torque constante a para em 5 s?

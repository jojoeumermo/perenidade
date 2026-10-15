---
titulo: "Termodinâmica e física estatística"
resumo: "Objetivo: ligar o mundo microscópico das moléculas às grandezas macroscópicas, usando a teoria cinética dos gases, a primeira e a segunda leis da termodinâmica e a interpretação estatística da entropia."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "University Physics, volume 2, seção 2.2, Pressure, Temperature, and RMS Speed"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-2/pages/2-2-pressure-temperature-and-rms-speed"
  - titulo: "University Physics, volume 2, seção 3.4, Thermodynamic Processes"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-2/pages/3-4-thermodynamic-processes"
  - titulo: "University Physics, volume 2, seção 4.5, The Carnot Cycle"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-2/pages/4-5-the-carnot-cycle"
  - titulo: "University Physics, volume 2, seção 4.7, Entropy on a Microscopic Scale"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-2/pages/4-7-entropy-on-a-microscopic-scale"
quiz:
  - pergunta: "Na teoria cinética dos gases, a temperatura absoluta é proporcional a quê?"
    opcoes: ["À energia cinética média das moléculas", "Ao número de moléculas", "Ao volume do recipiente"]
    resposta: 0
    explicacao: "A energia cinética média de translação de uma molécula é (3/2)·k·T."
  - pergunta: "Em uma transformação isotérmica de um gás ideal, o que permanece constante?"
    opcoes: ["A pressão", "A temperatura", "O volume"]
    resposta: 1
    explicacao: "Isotérmica: mesma temperatura. Isobárica: mesma pressão. Isocórica: mesmo volume. Adiabática: sem troca de calor."
  - pergunta: "Na fórmula de Boltzmann, S = k·ln W, o que é W?"
    opcoes: ["O trabalho realizado", "O número de microestados compatíveis com o estado macroscópico", "A temperatura"]
    resposta: 1
    explicacao: "Quanto mais modos microscópicos de realizar o mesmo estado, maior a entropia."
  - pergunta: "Por que a entropia de um sistema isolado tende a aumentar?"
    opcoes: ["Porque a energia é destruída", "Porque os estados desordenados têm muito mais microestados, e por isso são esmagadoramente mais prováveis", "Porque a temperatura sempre cai"]
    resposta: 1
    explicacao: "A segunda lei, vista estatisticamente, é uma lei de probabilidades."
---

## Do micro ao macro

Um litro de ar contém cerca de 10²² moléculas, cada uma se movendo em uma direção, batendo nas outras bilhões de vezes por segundo. Ninguém consegue acompanhar uma a uma. Mas a pressão, a temperatura e o volume desse ar obedecem a leis simples. A ponte entre as duas descrições é a **física estatística**.

Esta aula parte de [Termodinâmica](/trilhas/fisica-medio/termodinamica), do ensino médio.

## O gás ideal

Para gases rarefeitos, vale a **equação de estado do gás ideal**:

**p·V = n·R·T**

- p: pressão (Pa); V: volume (m³); T: temperatura absoluta (K);
- n: quantidade de matéria (mol);
- R = 8,31 J/(mol·K), a constante dos gases.

Escrita por molécula: **p·V = N·k·T**, com N o número de moléculas e **k = 1,38 × 10⁻²³ J/K**, a constante de Boltzmann.

## Teoria cinética: o que é temperatura

Imagine as moléculas batendo nas paredes do recipiente. Cada choque empurra a parede. A soma desses empurrões, por unidade de área, é a **pressão**. Fazendo a conta com as leis de Newton, chega-se a:

**energia cinética média de uma molécula = (3/2) · k · T**

Isso dá à **temperatura** um significado microscópico: ela mede a **energia cinética média** das moléculas. No zero absoluto, o movimento térmico seria o mínimo possível.

```conta
Velocidade quadrática média de moléculas de nitrogênio (massa molar 0,028 kg/mol) a 300 K:
v = √(3·R·T ÷ M) = √(3 × 8,31 × 300 ÷ 0,028) ≈ √267 000 ≈ 517 m/s
```

As moléculas do ar à nossa volta andam a centenas de metros por segundo. Não todas iguais: as velocidades se distribuem segundo uma curva, a **distribuição de Maxwell-Boltzmann**, que se alarga e se desloca para valores maiores quando a temperatura sobe.

## A primeira lei e os processos

**ΔU = Q − W**

O trabalho realizado por um gás que muda de volume é a integral **W = ∫ p dV**: a área sob a curva no diagrama pressão × volume.

| Processo | O que fica constante | Consequência |
| --- | --- | --- |
| **Isotérmico** | temperatura | ΔU = 0, logo Q = W |
| **Isobárico** | pressão | W = p·ΔV |
| **Isocórico** | volume | W = 0, logo ΔU = Q |
| **Adiabático** | não há troca de calor (Q = 0) | ΔU = −W: o gás esfria ao se expandir |

A expansão adiabática explica por que o ar que sobe pelas encostas esfria e forma nuvens, e por que o gás da lata de aerossol sai gelado.

```verificar
Um gás se expande rapidamente, sem tempo para trocar calor com o ambiente. O que acontece com a sua temperatura?
- Aumenta
+ Diminui, porque o gás realiza trabalho à custa da própria energia interna
- Não muda
> Processo adiabático: Q = 0. Se W é positivo, qual é o sinal de ΔU?
```

## A segunda lei e o ciclo de Carnot

Uma máquina térmica opera em ciclos, recebe calor de uma fonte quente, realiza trabalho e rejeita calor para uma fonte fria. O **ciclo de Carnot**, formado por duas isotérmicas e duas adiabáticas reversíveis, é o mais eficiente possível entre duas temperaturas:

**η de Carnot = 1 − T fria / T quente**

Nenhuma máquina real o supera. A segunda lei, na forma de Kelvin-Planck, diz que é impossível construir uma máquina cíclica que converta integralmente calor em trabalho.

## Entropia

Para um processo reversível, a variação de entropia é **dS = dQ/T**. Em um sistema isolado, **a entropia nunca diminui**.

### A interpretação estatística

No século XIX, o austríaco **Ludwig Boltzmann** deu à entropia um sentido microscópico:

**S = k · ln W**

em que **W** é o número de **microestados** (arranjos detalhados das moléculas) que produzem o mesmo **macroestado** (os mesmos p, V e T).

Pense em quatro moedas. Há só 1 jeito de dar quatro caras, mas 6 jeitos de dar duas caras e duas coroas. O resultado "misturado" é mais provável porque há mais maneiras de obtê-lo.

```conta
4 moedas: total de 2⁴ = 16 resultados possíveis
4 caras: 1 jeito
3 caras e 1 coroa: 4 jeitos
2 caras e 2 coroas: 6 jeitos
1 cara e 3 coroas: 4 jeitos
4 coroas: 1 jeito
```

Com 10²³ moléculas em vez de 4 moedas, os estados "misturados" são tão esmagadoramente mais numerosos que a chance de todas as moléculas do ar se juntarem em um canto da sala é, na prática, zero. A segunda lei não proíbe isso por decreto: torna absurdamente improvável.

É por isso que o calor passa do quente para o frio, que o perfume se espalha e não volta ao frasco, que o copo quebra e não se remonta. A **flecha do tempo** que percebemos tem raiz estatística.

Boltzmann enfrentou forte oposição de colegas que não aceitavam a existência real dos átomos. A sua fórmula está gravada no seu túmulo, em Viena.

## Para praticar

1. Quantos mols de gás há em 24 litros a 1 atm (101 000 Pa) e 293 K?
2. Calcule a energia cinética média de uma molécula a 27 °C.
3. Em um processo isocórico, um gás recebe 300 J de calor. Quanto vale o trabalho? E a variação da energia interna?
4. Com 6 moedas, quantos microestados correspondem a 3 caras e 3 coroas? Compare com o de 6 caras.

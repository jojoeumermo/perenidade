---
titulo: "Circuitos elétricos"
resumo: "Objetivo: relacionar corrente, tensão e resistência pela lei de Ohm, calcular associações em série e em paralelo e a potência elétrica, aplicando isso à instalação de uma casa."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 19.1, Ohm's Law"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-1-ohms-law"
  - titulo: "Physics, seção 19.2, Series Circuits"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-2-series-circuits"
  - titulo: "Physics, seção 19.3, Parallel Circuits"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-3-parallel-circuits"
  - titulo: "Physics, seção 19.4, Electric Power"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-4-electric-power"
quiz:
  - pergunta: "Um resistor de 10 Ω é ligado a uma bateria de 20 V. Qual é a corrente?"
    opcoes: ["2 A", "200 A", "0,5 A"]
    resposta: 0
    explicacao: "Pela lei de Ohm, i = U ÷ R = 20 ÷ 10 = 2 A."
  - pergunta: "Como são ligados os aparelhos em uma casa?"
    opcoes: ["Em série", "Em paralelo", "Cada um com um gerador próprio"]
    resposta: 1
    explicacao: "Em paralelo, todos recebem a mesma tensão e cada um funciona independentemente dos outros."
  - pergunta: "Um chuveiro de 5 500 W ligado em 220 V é percorrido por qual corrente?"
    opcoes: ["25 A", "2,5 A", "40 A"]
    resposta: 0
    explicacao: "i = P ÷ U = 5 500 ÷ 220 = 25 A."
  - pergunta: "Qual é a resistência equivalente de dois resistores de 6 Ω e 3 Ω ligados em paralelo?"
    opcoes: ["9 Ω", "2 Ω", "4,5 Ω"]
    resposta: 1
    explicacao: "1 ÷ R = 1 ÷ 6 + 1 ÷ 3 = 3 ÷ 6, logo R = 2 Ω. Em paralelo, a equivalente é sempre menor que a menor das resistências."
---

## Cargas em movimento

Na [eletrostática](/trilhas/fisica-medio/eletrostatica), as cargas estavam paradas. Agora elas andam. Um **circuito elétrico** é um caminho fechado por onde as cargas circulam. Esta aula aprofunda [Eletricidade em casa](/trilhas/fisica-fundamental/eletricidade-em-casa).

## As três grandezas

| Grandeza | Símbolo | O que é | Unidade |
| --- | --- | --- | --- |
| **Corrente** | i | a quantidade de carga que passa por segundo | ampere (A) |
| **Tensão** (ou diferença de potencial) | U | o "desnível" elétrico que empurra as cargas | volt (V) |
| **Resistência** | R | a dificuldade que o material opõe à passagem da corrente | ohm (Ω) |

Uma comparação útil é com a água em um encanamento: a **tensão** é como a diferença de altura entre a caixa-d'água e a torneira; a **corrente**, a vazão; a **resistência**, o estreitamento do cano.

A corrente é definida por **i = Q ÷ Δt**: um ampere é um coulomb por segundo.

## A lei de Ohm

**U = R · i**

Para uma mesma tensão, quanto maior a resistência, menor a corrente.

```conta
Um resistor de 10 Ω ligado a 20 V:
i = U ÷ R = 20 ÷ 10 = 2 A
```

A resistência de um fio depende do **material** (o cobre conduz melhor que o ferro), do **comprimento** (quanto mais longo, maior a resistência) e da **espessura** (quanto mais grosso, menor a resistência).

## Associação em série

Os componentes ficam **um depois do outro**, em um único caminho.

- A **corrente** é a mesma em todos.
- A **tensão** se divide entre eles.
- A resistência equivalente é a **soma**: **R = R₁ + R₂ + …**

```conta
Resistores de 6 Ω e 3 Ω em série, ligados a 18 V.
R = 6 + 3 = 9 Ω
i = 18 ÷ 9 = 2 A
tensão no de 6 Ω: 6 × 2 = 12 V
tensão no de 3 Ω: 3 × 2 = 6 V
```

Se um componente queima, o caminho se interrompe e **todos param**. Era o que acontecia com os antigos pisca-piscas de Natal.

## Associação em paralelo

Cada componente fica em um **ramo próprio**, ligado diretamente aos dois polos da fonte.

- A **tensão** é a mesma em todos.
- A **corrente** total é a soma das correntes dos ramos.
- A resistência equivalente obedece a: **1 ÷ R = 1 ÷ R₁ + 1 ÷ R₂ + …**

```conta
Os mesmos resistores, de 6 Ω e 3 Ω, em paralelo, ligados a 18 V.
1 ÷ R = 1 ÷ 6 + 1 ÷ 3 = 1 ÷ 6 + 2 ÷ 6 = 3 ÷ 6
R = 2 Ω
corrente no de 6 Ω: 18 ÷ 6 = 3 A
corrente no de 3 Ω: 18 ÷ 3 = 6 A
corrente total: 9 A
```

Em paralelo, a resistência equivalente é **menor** que a menor das resistências: cada ramo novo é mais um caminho para a corrente.

**A instalação de uma casa é em paralelo.** Por isso cada aparelho recebe a tensão inteira da rede (127 V ou 220 V) e a lâmpada da sala continua acesa quando a do quarto queima.

```verificar
Em uma casa, ligam-se cada vez mais aparelhos ao mesmo tempo. O que acontece com a corrente total que passa pelos fios de entrada?
- Diminui
+ Aumenta
- Não muda
> Em paralelo, a corrente total é a soma das correntes de cada ramo.
```

## Potência elétrica

A **potência** é a energia transformada por segundo:

**P = U · i**

Combinando com a lei de Ohm, obtêm-se duas outras formas: **P = R · i²** e **P = U² ÷ R**.

```conta
Chuveiro de 5 500 W.
em 220 V: i = 5 500 ÷ 220 = 25 A
em 127 V: i = 5 500 ÷ 127 ≈ 43 A
```

Para a mesma potência, a rede de 127 V exige quase o dobro da corrente, e, portanto, **fios mais grossos**. O consumo de energia e o valor na conta são os mesmos nas duas tensões: o que se paga é a energia (potência × tempo), não a corrente.

### Efeito Joule

Todo fio percorrido por corrente **esquenta**: a energia elétrica vira calor. É o **efeito Joule**, e a potência dissipada é P = R · i².

- É **desejado** no chuveiro, no ferro de passar, no forno elétrico.
- É **perigoso** na fiação: fio fino demais para a corrente que passa esquenta, derrete o isolamento e pode causar incêndio.

Como a potência dissipada cresce com o **quadrado** da corrente, dobrar a corrente no mesmo fio **quadruplica** o aquecimento.

## Segurança na instalação

- **Benjamins e extensões**: vários aparelhos na mesma tomada somam as suas correntes no mesmo fio. É uma das causas mais comuns de incêndio doméstico.
- **Curto-circuito**: quando os dois fios se tocam sem um aparelho entre eles, a resistência fica quase nula e a corrente dispara.
- **Disjuntor**: desliga o circuito quando a corrente passa do limite que a fiação suporta. Se ele desarma sempre, o problema é excesso de carga ou defeito. Trocar por um disjuntor "mais forte" sem trocar a fiação **tira a proteção**.
- **Dispositivo DR**: desliga o circuito quando percebe fuga de corrente, como a que atravessa o corpo de uma pessoa em um choque.
- **Fio terra**: dá um caminho seguro para a corrente em caso de defeito no aparelho.

O choque é a passagem de **corrente pelo corpo**. Correntes de centésimos de ampere que atravessem o peito já podem ser fatais. Corpo molhado tem resistência menor e deixa passar mais corrente.

Instalação malfeita, com fio fino, emendas e "gatos", é comum onde o poder público não chega e a moradia é precária. Incêndio por sobrecarga em bairro pobre raramente é fatalidade: é consequência dessa falta.

## Para praticar

1. Uma lâmpada tem resistência de 240 Ω e é ligada em 120 V. Qual é a corrente? E a potência?
2. Três resistores de 12 Ω são ligados em série; depois, em paralelo. Calcule a resistência equivalente em cada caso.
3. Em uma tomada de 127 V com fiação que suporta 10 A, pode-se ligar ao mesmo tempo um micro-ondas de 1 200 W e uma cafeteira de 600 W?
4. Calcule o consumo mensal, em kWh, de um chuveiro de 5 500 W usado 30 minutos por dia.

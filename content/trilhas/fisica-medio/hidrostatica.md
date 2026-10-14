---
titulo: "Hidrostática"
resumo: "Objetivo: calcular densidade e pressão, entender como a pressão varia com a profundidade e aplicar os princípios de Pascal e de Arquimedes."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "College Physics 2e, seção 11.3, Pressure"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/11-3-pressure"
  - titulo: "College Physics 2e, seção 11.4, Variation of Pressure with Depth in a Fluid"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/11-4-variation-of-pressure-with-depth-in-a-fluid"
  - titulo: "College Physics 2e, seção 11.5, Pascal's Principle"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/11-5-pascals-principle"
  - titulo: "College Physics 2e, seção 11.7, Archimedes' Principle"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/11-7-archimedes-principle"
quiz:
  - pergunta: "Por que uma faca afiada corta melhor que uma cega, com a mesma força?"
    opcoes: ["Porque a área de contato é menor, e a pressão, maior", "Porque a faca afiada é mais pesada", "Porque a força aumenta"]
    resposta: 0
    explicacao: "Pressão é força dividida por área: área menor, pressão maior."
  - pergunta: "De que depende a pressão da água em uma torneira ligada a uma caixa-d'água?"
    opcoes: ["Do volume de água da caixa", "Da altura da superfície da água acima da torneira", "Da largura da caixa"]
    resposta: 1
    explicacao: "A pressão de uma coluna de líquido depende da altura, não da quantidade."
  - pergunta: "Em uma prensa hidráulica, o pistão maior tem área 50 vezes maior que o menor. Uma força de 100 N no pistão menor produz, no maior:"
    opcoes: ["100 N", "5 000 N", "2 N"]
    resposta: 1
    explicacao: "A pressão é a mesma nos dois pistões; a força é multiplicada pela razão das áreas."
  - pergunta: "Quando um corpo flutua parado na água, o empuxo é:"
    opcoes: ["Maior que o peso do corpo", "Igual ao peso do corpo", "Zero"]
    resposta: 1
    explicacao: "Se o corpo está em equilíbrio, as forças se anulam."
---

## Fluidos em repouso

A **hidrostática** estuda os fluidos (líquidos e gases) **parados**. Dela dependem a caixa-d'água, o freio do carro, o navio, a barragem e a medida da pressão arterial.

## Densidade

A **densidade** diz quanta massa cabe em certo volume:

**d = m ÷ V**

| Material | Densidade (kg/m³) |
| --- | --- |
| Ar (ao nível do mar) | cerca de 1,2 |
| Gelo | cerca de 920 |
| Água | 1 000 |
| Água do mar | cerca de 1 025 |
| Ferro | cerca de 7 900 |
| Mercúrio | cerca de 13 600 |

A densidade da água, 1 000 kg/m³, é o mesmo que **1 g/cm³** ou **1 kg por litro**.

## Pressão

**Pressão** é a força dividida pela área em que ela se distribui:

**p = F ÷ A**

A unidade é o **pascal** (Pa): 1 Pa = 1 N/m².

A mesma força pode produzir pressões muito diferentes:

- a **faca afiada** e o **prego pontudo** concentram a força em uma área minúscula: pressão enorme;
- o **trator de esteira** e a **raquete de neve** espalham o peso em uma área grande: pressão pequena, e não afundam.

```conta
Uma pessoa de 60 kg (peso de 600 N).
apoiada nos dois pés (área total de 300 cm² = 0,03 m²): p = 600 ÷ 0,03 = 20 000 Pa
apoiada em um salto fino (1 cm² = 0,0001 m²): p = 600 ÷ 0,0001 = 6 000 000 Pa
```

## Pressão atmosférica

Vivemos no fundo de um oceano de ar. O peso desse ar exerce, ao nível do mar, uma pressão de cerca de **101 000 Pa**, valor chamado de **1 atmosfera** (1 atm). É como ter o peso de 10 toneladas sobre cada metro quadrado. Não somos esmagados porque a pressão dentro do corpo equilibra a de fora.

Em **1643**, o italiano **Evangelista Torricelli** mediu essa pressão: virou um tubo cheio de mercúrio em uma cuba e viu que a coluna se sustentava a cerca de **76 cm** de altura. Era a atmosfera, empurrando o mercúrio da cuba, que segurava a coluna.

Quanto maior a altitude, menos ar por cima e **menor a pressão**. É por isso que os ouvidos "estalam" na serra.

## Pressão em um líquido

Dentro de um líquido, a pressão aumenta com a profundidade (princípio de **Stevin**):

**p = p atmosférica + d · g · h**

em que d é a densidade do líquido e h é a profundidade.

```conta
Quanto a pressão aumenta a 10 m de profundidade na água?
d·g·h = 1 000 × 10 × 10 = 100 000 Pa ≈ 1 atm
```

A cada **10 metros** de água, a pressão sobe cerca de **1 atmosfera**. Um mergulhador a 30 m suporta 4 atm: 1 do ar e 3 da água. Por isso as barragens são mais grossas embaixo.

### A caixa-d'água

A pressão na torneira depende apenas da **altura** entre a superfície da água na caixa e a torneira, e não do tamanho da caixa.

```conta
Caixa-d'água 5 m acima do chuveiro.
pressão da água: 1 000 × 10 × 5 = 50 000 Pa (meia atmosfera acima da pressão do ar)
```

É por isso que a caixa fica no ponto mais alto da casa, que o chuveiro do andar de cima é mais fraco e que as cidades constroem reservatórios elevados.

### Vasos comunicantes

Em recipientes ligados entre si, o mesmo líquido em repouso fica **no mesmo nível** em todos. O pedreiro usa isso com a **mangueira de nível**: uma mangueira transparente com água marca, nas duas pontas, pontos exatamente na mesma altura, mesmo de um lado a outro do terreno.

```verificar
Duas caixas-d'água estão na mesma altura: uma de 500 litros e outra de 5 000 litros. Em qual delas a torneira do térreo tem mais pressão?
- Na de 5 000 litros
- Na de 500 litros
+ A pressão é a mesma
> Releia a fórmula: aparecem a densidade, a gravidade e a altura. O volume não entra.
```

## Princípio de Pascal

> A pressão aplicada a um líquido fechado se transmite por igual a todos os pontos do líquido.

É o princípio da **prensa hidráulica**. Dois pistões, um pequeno e um grande, ligados por um líquido. Como a pressão é a mesma nos dois:

**F₁ ÷ A₁ = F₂ ÷ A₂**

```conta
Pistão maior com área 50 vezes a do menor. Força de 100 N no menor.
F₂ = 100 × 50 = 5 000 N
```

Não há mágica: para o pistão grande subir 1 cm, o pequeno tem de descer 50 cm. Ganha-se força, perde-se deslocamento, e o trabalho é o mesmo. O princípio está no **freio hidráulico** dos carros, no **macaco hidráulico**, no elevador da oficina e nas escavadeiras.

## Princípio de Arquimedes

> Todo corpo mergulhado em um fluido recebe uma força para cima, o **empuxo**, igual ao peso do fluido que ele desloca.

**E = d do fluido · V submerso · g**

Três situações:

| Comparação | O que acontece |
| --- | --- |
| densidade do corpo **maior** que a do líquido | afunda |
| densidade do corpo **igual** à do líquido | fica em equilíbrio em qualquer profundidade |
| densidade do corpo **menor** que a do líquido | sobe e flutua, com parte para fora |

Um navio de aço flutua porque é **oco**: o conjunto de aço e ar tem densidade média menor que a da água. O gelo, com densidade de cerca de nove décimos da densidade da água, flutua com perto de **nove décimos** do volume submersos: daí a expressão "a ponta do iceberg".

É mais fácil boiar no mar do que no rio: a água salgada é mais densa, e o empuxo é maior para o mesmo volume submerso.

```conta
Um bloco de 2 litros (0,002 m³) totalmente mergulhado em água.
E = 1 000 × 0,002 × 10 = 20 N
Se o bloco pesa 15 N, sobe e flutua. Se pesa 50 N, afunda, mas "pesa" só 30 N dentro da água.
```

## Para praticar

1. Um tijolo pesa 30 N. Calcule a pressão sobre o chão quando ele está apoiado em uma face de 0,02 m² e em uma face de 0,01 m².
2. Qual é a pressão total sobre um mergulhador a 20 m de profundidade, em atmosferas?
3. Em um macaco hidráulico, o pistão maior tem 100 cm² e o menor, 2 cm². Que força é preciso aplicar para erguer um carro de 10 000 N?
4. Um pedaço de madeira flutua com metade do volume fora da água. Qual é a densidade da madeira?

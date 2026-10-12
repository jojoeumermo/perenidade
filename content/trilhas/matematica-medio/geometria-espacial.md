---
titulo: "Geometria espacial"
resumo: "Prismas, cilindros, pirâmides, cones e esferas: como calcular volume e superfície, da caixa-d'água à laje."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 9.6, Solve Geometry Applications: Volume and Surface Area"
    autor: "Lynn Marecek e outros (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-6-solve-geometry-applications-volume-and-surface-area"
  - titulo: "Um Milhão de Cisternas (P1MC)"
    autor: "Articulação Semiárido Brasileiro (ASA)"
    url: "https://www.asabrasil.org.br/acoes/p1mc"
quiz:
  - pergunta: "Quantos litros cabem em uma caixa de 2 m de comprimento, 1,5 m de largura e 1 m de altura?"
    opcoes: ["300 litros", "3.000 litros", "4.500 litros"]
    resposta: 1
    explicacao: "2 × 1,5 × 1 = 3 m³. Cada metro cúbico tem 1.000 litros."
  - pergunta: "Um cone e um cilindro têm a mesma base e a mesma altura. O volume do cone é:"
    opcoes: ["igual ao do cilindro", "a metade do volume do cilindro", "um terço do volume do cilindro"]
    resposta: 2
    explicacao: "Pirâmides e cones têm um terço do volume do prisma ou do cilindro de mesma base e altura."
  - pergunta: "Se todas as medidas de uma caixa dobram, o volume fica multiplicado por:"
    opcoes: ["2", "4", "8"]
    resposta: 2
    explicacao: "Dobra no comprimento, na largura e na altura: 2 × 2 × 2 = 8."
---

## Três dimensões

As figuras planas têm comprimento e largura. Os **sólidos** têm também altura. Deles interessam duas medidas:

- o **volume**: o espaço que ocupam, ou o quanto cabe dentro. Mede-se em metros cúbicos (m³);
- a **área da superfície**: o tamanho da "casca". Mede-se em metros quadrados (m²). É o que se calcula para saber quanto material é preciso para fazer ou revestir o sólido.

## Volume e litros

| Volume | Capacidade |
| --- | --- |
| 1 m³ | 1.000 litros |
| 1 dm³ (um cubo de 10 cm de aresta) | 1 litro |
| 1 cm³ | 1 mililitro |

## Prismas e cilindros: base vezes altura

Um **prisma** é um sólido com duas bases iguais e paralelas, ligadas por faces retangulares. A caixa de sapato (o **paralelepípedo**) e o **cubo** são prismas. O **cilindro** segue a mesma ideia, com bases circulares.

Para todos eles:

**volume = área da base × altura**

Imagine a base como uma folha e o sólido como uma pilha de folhas iguais.

**Paralelepípedo:** volume = comprimento × largura × altura.

Uma laje de 5 m por 4 m, com 10 cm de espessura, leva:

```conta
5 × 4 × 0,10
= 2 m³ de concreto
```

Repare que a espessura entrou em metros (0,10), e não em centímetros. Misturar unidades é o erro mais caro da obra.

**Cilindro:** volume = π × raio² × altura.

Uma caixa-d'água cilíndrica com 0,60 m de raio e 0,90 m de altura:

```conta
3,14 × 0,60² × 0,90
= 3,14 × 0,36 × 0,90
= cerca de 1,017 m³, ou 1.017 litros
```

## Pirâmides e cones: um terço

A **pirâmide** tem uma base e faces triangulares que se encontram em um ponto. O **cone** é a versão de base circular.

**volume = área da base × altura ÷ 3**

Se você encher de areia um cone e despejar em um cilindro de mesma base e mesma altura, precisará de exatamente três cones para enchê-lo.

Um monte de areia em forma de cone, com 1 m de raio e 1,5 m de altura, tem 3,14 × 1² × 1,5 ÷ 3 = 1,57 m³.

## Esfera

**volume = 4/3 × π × raio³**

**área da superfície = 4 × π × raio²**

O grego Arquimedes, no século III a.C., demonstrou que a esfera ocupa exatamente dois terços do volume do cilindro em que ela cabe justa.

```verificar
Um caminhão-pipa tem um tanque cilíndrico com 1 m de raio e 4 m de comprimento. Quantos litros ele leva, aproximadamente?
- 1.256 litros
+ 12.560 litros
- 125.600 litros
> Volume = 3,14 × 1² × 4, em metros cúbicos. Depois, multiplique por 1.000.
```

## A casca: área da superfície

Para achar a área da superfície, "desmonte" o sólido e some as áreas das faces.

- **Cubo** de aresta a: 6 faces quadradas. Área = 6 × a².
- **Paralelepípedo:** três pares de retângulos iguais.
- **Cilindro:** duas tampas circulares e a lateral, que, aberta, é um retângulo cuja base é a circunferência. Área lateral = 2 × π × raio × altura.

Para revestir por dentro uma cisterna, pintar um reservatório ou calcular a chapa de um tambor, é essa a conta.

## A cisterna do semiárido

No semiárido brasileiro, centenas de milhares de famílias guardam a água da chuva em cisternas de placas de cimento, construídas ao lado da casa pelas pessoas da própria comunidade, dentro do Programa Um Milhão de Cisternas, da Articulação Semiárido Brasileiro (ASA). Cada cisterna guarda **16 mil litros**, isto é, 16 m³.

De onde vem essa água? Do telhado. Cada milímetro de chuva que cai sobre um metro quadrado de telhado é um litro de água. Um telhado de 40 m², em uma região onde chovem 500 mm por ano, recebe:

```conta
40 × 500
= 20.000 litros por ano
```

Mesmo com as perdas, é o bastante para encher a cisterna. A geometria aqui não é exercício: é o cálculo que mostra que a convivência com o semiárido é possível.

## Poliedros e a relação de Euler

Os sólidos formados só por faces planas chamam-se **poliedros**. Neles se contam os vértices (V, as pontas), as arestas (A, as quinas) e as faces (F). O matemático suíço Leonhard Euler mostrou, no século XVIII, que em todo poliedro convexo:

**V − A + F = 2**

No cubo: 8 vértices, 12 arestas e 6 faces. 8 − 12 + 6 = 2.

## Quando tudo dobra

Dobrando todas as medidas de um sólido, a área da superfície fica 4 vezes maior e o **volume, 8 vezes maior** (2 × 2 × 2). Uma caixa-d'água com o dobro da largura, do comprimento e da altura guarda oito vezes mais água, e pesa oito vezes mais.

## Para praticar

1. Calcule o volume e a área da superfície de um cubo de 3 m de aresta.
2. Quantos litros cabem em uma caixa de 2 m × 1,5 m × 1 m?
3. Um cilindro tem 1 m de raio e 2 m de altura. Qual é o volume? E o de um cone com a mesma base e a mesma altura?
4. Quantos metros cúbicos de concreto leva um piso de 6 m × 3 m com 8 cm de espessura?
5. Para tirar 32 m³ de entulho com uma caçamba de 5 m³, quantas viagens são necessárias?
6. Calcule o volume de uma esfera de 3 m de raio.

**Respostas:** 1) 27 m³ e 54 m². 2) 3.000 litros. 3) 6,28 m³ e cerca de 2,09 m³. 4) 1,44 m³. 5) 7 viagens. 6) Cerca de 113,04 m³.

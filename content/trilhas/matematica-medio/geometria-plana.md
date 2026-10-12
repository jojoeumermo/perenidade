---
titulo: "Geometria plana"
resumo: "Ângulos, triângulos, polígonos e semelhança: as propriedades das figuras e o hábito de demonstrar."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 9.3, Use Properties of Angles, Triangles, and the Pythagorean Theorem"
    autor: "Lynn Marecek e outros (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-3-use-properties-of-angles-triangles-and-the-pythagorean-theorem"
  - titulo: "Prealgebra 2e, seção 9.4, Use Properties of Rectangles, Triangles, and Trapezoids"
    autor: "Lynn Marecek e outros (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-4-use-properties-of-rectangles-triangles-and-trapezoids"
  - titulo: "Os Elementos"
    autor: "Euclides"
    ano: "c. 300 a.C."
quiz:
  - pergunta: "Dois ângulos de um triângulo medem 50° e 60°. Quanto mede o terceiro?"
    opcoes: ["70°", "110°", "90°"]
    resposta: 0
    explicacao: "Os três somam 180°. 180 − 50 − 60 = 70."
  - pergunta: "Quanto vale a soma dos ângulos internos de um hexágono?"
    opcoes: ["360°", "540°", "720°"]
    resposta: 2
    explicacao: "(6 − 2) × 180° = 720°. Um hexágono se divide em 4 triângulos."
  - pergunta: "Uma vara de 2 m faz sombra de 1,5 m. Na mesma hora, um prédio faz sombra de 15 m. Qual é a altura do prédio?"
    opcoes: ["11,25 m", "20 m", "30 m"]
    resposta: 1
    explicacao: "A sombra do prédio é 10 vezes a da vara; a altura também: 2 × 10 = 20 m."
---

## Medir a terra

A palavra **geometria** vem do grego e quer dizer "medida da terra". Segundo o historiador grego Heródoto, ela teria nascido no Egito, da necessidade de remarcar os terrenos depois de cada cheia do rio Nilo. Era um saber prático, de agrimensores e construtores.

Por volta de 300 a.C., em Alexandria, **Euclides** reuniu o conhecimento da época em *Os Elementos*. A novidade estava no método: partir de poucas afirmações aceitas sem prova e **demonstrar** todas as outras, uma a uma, por raciocínio. Esse jeito de pensar (não aceitar nada só porque parece verdade) é talvez a maior herança da geometria.

## Ângulos

Um **ângulo** mede a abertura entre duas semirretas que partem do mesmo ponto. A volta inteira tem 360 graus.

| Tipo | Medida |
| --- | --- |
| agudo | menor que 90° |
| reto | exatamente 90° |
| obtuso | entre 90° e 180° |
| raso | 180° (meia volta) |

Duas retas que se cruzam em ângulo reto são **perpendiculares**. Duas retas do mesmo plano que nunca se cruzam são **paralelas**.

Quando duas retas se cruzam, os ângulos opostos pelo vértice são iguais. Quando uma reta corta duas paralelas, os ângulos na mesma posição em cada cruzamento também são iguais. Parece detalhe, mas é com isso que se prova o resultado seguinte.

## A soma dos ângulos do triângulo

**Em todo triângulo, os três ângulos internos somam 180°.**

Dá para ver com papel: recorte um triângulo qualquer, rasgue os três cantos e junte as pontas. Eles formam uma linha reta, um ângulo raso.

E dá para demonstrar: trace, por um dos vértices, uma reta paralela ao lado oposto. Junto a esse vértice aparecem três ângulos que, lado a lado, formam meia volta. Um é o próprio ângulo do triângulo; os outros dois são iguais aos outros dois ângulos do triângulo, por causa das paralelas. Logo, os três somam 180°. O recorte convence; a demonstração garante que vale para **todos** os triângulos, inclusive os que ninguém desenhou.

## Tipos de triângulo

Pelos lados: **equilátero** (três lados iguais, três ângulos de 60°), **isósceles** (dois lados iguais) e **escaleno** (três lados diferentes).

Pelos ângulos: **acutângulo** (três agudos), **retângulo** (um reto) e **obtusângulo** (um obtuso).

O triângulo tem uma propriedade que nenhum outro polígono tem: é **rígido**. Com três varetas presas pelas pontas, a forma não muda. Com quatro, a figura balança. Por isso as tesouras de telhado, as torres de transmissão e as pontes metálicas são feitas de triângulos, e por isso se prega uma ripa atravessada no portão para ele não cair.

## Polígonos

Um polígono de n lados pode ser dividido em n − 2 triângulos, traçando diagonais a partir de um vértice. Então:

**soma dos ângulos internos = (n − 2) × 180°**

| Polígono | Lados | Soma dos ângulos |
| --- | --- | --- |
| triângulo | 3 | 180° |
| quadrilátero | 4 | 360° |
| pentágono | 5 | 540° |
| hexágono | 6 | 720° |

Em um polígono **regular** (lados e ângulos iguais), cada ângulo é a soma dividida por n. No hexágono regular: 720° ÷ 6 = 120°. Três hexágonos se encaixam em volta de um ponto sem deixar buraco, porque 3 × 120° = 360°. É o desenho do favo de mel.

```verificar
Quanto mede cada ângulo interno de um pentágono regular?
- 72°
+ 108°
- 120°
> A soma é (5 − 2) × 180° = 540°. Divida pelos 5 ângulos.
```

## Semelhança

Duas figuras são **semelhantes** quando têm a mesma forma, ainda que tamanhos diferentes: uma é ampliação da outra. Os ângulos são iguais e os lados são **proporcionais**. Uma foto e a sua ampliação, uma planta e a casa, um mapa e o terreno.

Em triângulos, basta que os ângulos sejam iguais para haver semelhança.

### A sombra

Conta-se que Tales de Mileto, no século VI a.C., mediu a altura de uma pirâmide do Egito sem subir nela, comparando a sombra da pirâmide com a sombra de um bastão fincado no chão. Como os raios do Sol chegam paralelos, o bastão com a sua sombra e a pirâmide com a dela formam triângulos semelhantes.

Faça o mesmo. Uma pessoa de 1,70 m projeta uma sombra de 2 m. Na mesma hora, uma árvore projeta uma sombra de 6 m.

```conta
altura da árvore ÷ 6 = 1,70 ÷ 2
altura da árvore = 6 × 0,85
= 5,1 m
```

### Lados dobram, área quadruplica

Se você dobra todas as medidas de uma figura, o perímetro dobra, mas a **área fica quatro vezes maior** (2 × 2). Triplicando, fica nove vezes maior. Uma pizza de 40 cm de diâmetro tem quatro vezes a área de uma de 20 cm, e não o dobro. Vale lembrar disso ao comparar preços.

## Para praticar

1. Um triângulo retângulo tem um ângulo de 35°. Quanto mede o outro ângulo agudo?
2. Qual é a soma dos ângulos internos de um octógono (8 lados)?
3. Em um triângulo isósceles, o ângulo diferente mede 40°. Quanto medem os outros dois?
4. Um poste de 6 m faz sombra de 4 m. Na mesma hora, quanto mede a sombra de uma pessoa de 1,80 m?
5. Uma planta está na escala 1:100. Um cômodo ocupa 12 cm² no papel. Qual é a área real?
6. Uma pizza de 30 cm custa R$ 40 e uma de 45 cm custa R$ 70. Qual sai mais em conta por área?

**Respostas:** 1) 55°. 2) 1.080°. 3) 70° cada. 4) 1,20 m. 5) 12 m² (a área cresce 100 × 100 = 10.000 vezes: 120.000 cm²). 6) A de 45 cm: ela tem 2,25 vezes a área da menor e custa 1,75 vez o preço.

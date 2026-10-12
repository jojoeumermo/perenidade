---
titulo: "Matrizes e sistemas lineares"
resumo: "Resolver várias equações ao mesmo tempo e organizar números em tabelas que se somam e se multiplicam."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 11.1, Systems of Linear Equations: Two Variables"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/11-1-systems-of-linear-equations-two-variables"
  - titulo: "Algebra and Trigonometry 2e, seção 11.5, Matrices and Matrix Operations"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/11-5-matrices-and-matrix-operations"
  - titulo: "Algebra and Trigonometry 2e, seção 11.6, Solving Systems with Gaussian Elimination"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/11-6-solving-systems-with-gaussian-elimination"
quiz:
  - pergunta: "Qual é a solução do sistema x + y = 10 e x − y = 4?"
    opcoes: ["x = 6 e y = 4", "x = 7 e y = 3", "x = 5 e y = 5"]
    resposta: 1
    explicacao: "Somando as duas equações: 2x = 14, então x = 7. Voltando à primeira: y = 3."
  - pergunta: "O sistema x + y = 5 e x + y = 7 tem quantas soluções?"
    opcoes: ["Uma", "Infinitas", "Nenhuma"]
    resposta: 2
    explicacao: "A mesma soma não pode valer 5 e 7 ao mesmo tempo. O sistema é impossível."
  - pergunta: "Qual é o determinante da matriz de linhas (1, 2) e (3, 4)?"
    opcoes: ["−2", "10", "2"]
    resposta: 0
    explicacao: "1 × 4 − 2 × 3 = 4 − 6 = −2."
---

## Duas perguntas ao mesmo tempo

Na feira, Dona Lúcia comprou 2 kg de arroz e 1 kg de feijão e pagou R$ 19. A vizinha comprou 1 kg de arroz e 2 kg de feijão, na mesma banca, e pagou R$ 23. Quanto custa o quilo de cada um?

Há **duas incógnitas** (o preço do arroz, a, e o do feijão, f), e uma equação só não resolve. São precisas duas, verdadeiras ao mesmo tempo. Isso é um **sistema de equações**:

```
2a + f = 19
a + 2f = 23
```

É **linear** porque as incógnitas aparecem sozinhas, sem quadrado e sem estarem multiplicadas uma pela outra.

## Método da substituição

Isole uma incógnita em uma equação e substitua na outra.

Da primeira: f = 19 − 2a. Pondo na segunda:

```conta
a + 2 × (19 − 2a) = 23
a + 38 − 4a = 23
−3a = −15
= a = 5
```

Voltando: f = 19 − 2 × 5 = 9. O arroz custa R$ 5 e o feijão, R$ 9.

**Confira nas duas equações:** 2 × 5 + 9 = 19 e 5 + 2 × 9 = 23.

## Método da adição

Some ou subtraia as equações de modo que uma incógnita desapareça. Às vezes é preciso multiplicar uma delas antes.

```
x + y = 10
x − y = 4
```

Somando as duas, o y some: 2x = 14, logo x = 7. E y = 10 − 7 = 3.

```verificar
Resolva o sistema 3x + 2y = 16 e x + y = 6.
+ x = 4 e y = 2
- x = 2 e y = 4
- x = 3 e y = 3
> Da segunda, y = 6 − x. Substitua na primeira.
```

## Nem todo sistema tem uma solução só

Cada equação linear com duas incógnitas é uma reta no plano. Resolver o sistema é achar onde as retas se encontram.

| O sistema é | As retas | Exemplo |
| --- | --- | --- |
| possível e determinado (uma solução) | se cruzam em um ponto | x + y = 10 e x − y = 4 |
| possível e indeterminado (infinitas soluções) | são a mesma reta | x + y = 5 e 2x + 2y = 10 |
| impossível (nenhuma solução) | são paralelas | x + y = 5 e x + y = 7 |

No segundo caso, a segunda equação é a primeira multiplicada por 2: não traz informação nova. No terceiro, as duas se contradizem.

## Matrizes

Uma **matriz** é uma tabela de números organizada em linhas e colunas. Uma matriz com 2 linhas e 3 colunas é dita "2 por 3".

A produção de duas hortas comunitárias em dois meses, em quilos (dados de exemplo):

```
           alface  tomate
Horta 1      40      80        em março
Horta 2      30      50

Horta 1      50      70        em abril
Horta 2      35      60
```

Cada tabela é uma matriz 2 por 2. Chamando-as de M e A:

**Somar matrizes** é somar posição por posição. M + A dá a produção dos dois meses:

```
90   150
65   110
```

**Multiplicar uma matriz por um número** é multiplicar todas as posições. Se a meta é dobrar a produção de março, a matriz da meta é 2 × M: 80, 160, 60 e 100.

## Multiplicar matriz por matriz

Aqui a regra é outra: multiplica-se **linha por coluna**, somando os produtos.

Volte à feira. As compras formam uma matriz de quantidades (cada linha é uma freguesa) e os preços formam uma coluna:

```
quantidades        preços
  2   1              5
  1   2              9
```

```conta
1ª linha: 2 × 5 + 1 × 9 = 19
2ª linha: 1 × 5 + 2 × 9 = 23
= o resultado é a coluna dos totais pagos: 19 e 23
```

O sistema de equações do começo é exatamente essa multiplicação, com os preços desconhecidos. Todo sistema linear pode ser escrito como "matriz × incógnitas = resultados".

Duas diferenças importantes em relação aos números comuns: só dá para multiplicar quando o número de colunas da primeira matriz é igual ao de linhas da segunda; e **a ordem importa**, pois em geral A × B é diferente de B × A.

## Determinante

Para uma matriz 2 por 2, o **determinante** é o produto da diagonal principal menos o produto da outra diagonal:

```
a   b
c   d        determinante = a × d − b × c
```

Para a matriz das quantidades: 2 × 2 − 1 × 1 = 3.

Se o determinante é **diferente de zero**, o sistema tem uma solução única. Se é **zero**, o sistema é indeterminado ou impossível. Em x + y = 5 e 2x + 2y = 10, o determinante é 1 × 2 − 1 × 2 = 0.

## Para sistemas maiores

Com três, dez ou mil incógnitas, usa-se o **escalonamento**: combinam-se as linhas, como no método da adição, até que cada equação tenha uma incógnita a menos que a anterior. O método costuma levar o nome do alemão Gauss, mas um procedimento do mesmo tipo já aparece em um texto chinês de cerca de dois mil anos atrás, *Os Nove Capítulos sobre a Arte Matemática*.

Hoje é assim que os computadores trabalham. Uma imagem digital é uma matriz de pontos de cor; uma planilha é uma matriz; a previsão do tempo e o cálculo de uma ponte dependem de sistemas com milhões de equações. Na economia, o economista de origem russa Wassily Leontief organizou em matrizes as trocas entre os setores de um país (quanto de aço a indústria de máquinas consome, quanto de energia a siderurgia consome) para calcular o que cada setor precisa produzir. O trabalho lhe valeu o prêmio de economia em memória de Alfred Nobel, em 1973, e é usado até hoje nas contas nacionais e no planejamento econômico.

## Para praticar

1. Resolva: x + y = 12 e x − y = 2.
2. Resolva: 2x + y = 11 e x + 3y = 13.
3. Dois cadernos e uma caneta custam R$ 28. Um caderno e três canetas custam R$ 24. Quanto custa cada um?
4. Com A de linhas (1, 2) e (3, 4) e B de linhas (0, 1) e (5, 2), calcule A + B.
5. Calcule o determinante de A e o produto de A pela coluna (1, 1).
6. Classifique o sistema: x + 2y = 4 e 3x + 6y = 12.

**Respostas:** 1) x = 7 e y = 5. 2) x = 4 e y = 3. 3) Caderno R$ 12 e caneta R$ 4. 4) Linhas (1, 3) e (8, 6). 5) −2; coluna (3, 7). 6) Possível e indeterminado: a segunda equação é a primeira multiplicada por 3.

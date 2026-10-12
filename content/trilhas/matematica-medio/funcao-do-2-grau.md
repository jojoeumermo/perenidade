---
titulo: "Função do 2º grau"
resumo: "A parábola: raízes, vértice e o problema de achar o maior ou o menor valor possível."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 5.1, Quadratic Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/5-1-quadratic-functions"
  - titulo: "Algebra and Trigonometry 2e, seção 2.5, Quadratic Equations"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/2-5-quadratic-equations"
quiz:
  - pergunta: "Quais são as raízes de x² − 5x + 6 = 0?"
    opcoes: ["2 e 3", "−2 e −3", "1 e 6"]
    resposta: 0
    explicacao: "Δ = 25 − 24 = 1. x = (5 ± 1) ÷ 2, isto é, 3 ou 2. Conferindo: 2 × 3 = 6 e 2 + 3 = 5."
  - pergunta: "Se o discriminante (Δ) é negativo, quantas raízes reais a equação tem?"
    opcoes: ["Duas", "Uma", "Nenhuma"]
    resposta: 2
    explicacao: "Não existe raiz quadrada real de número negativo. A parábola não toca o eixo x."
  - pergunta: "Com 40 m de tela, qual é o retângulo de maior área que se pode cercar?"
    opcoes: ["Um de 15 m por 5 m", "Um quadrado de 10 m de lado", "Um de 19 m por 1 m"]
    resposta: 1
    explicacao: "A área x(20 − x) é máxima no vértice, x = 10: um quadrado de 100 m²."
---

## Quando a mudança muda

Na função do 1º grau, o passo é sempre o mesmo. Em muitos fenômenos não é assim: uma bola jogada para cima sobe cada vez mais devagar, para e desce cada vez mais rápido. Para descrever isso usa-se a **função do 2º grau** (ou quadrática):

f(x) = ax² + bx + c, com a diferente de zero

O gráfico é uma curva chamada **parábola**.

- Se **a é positivo**, a parábola abre para cima, como uma tigela: a função tem um **valor mínimo**.
- Se **a é negativo**, abre para baixo, como um morro: a função tem um **valor máximo**.
- O **c** é onde a curva corta o eixo y, pois f(0) = c.

## As raízes

As raízes são os valores de x que zeram a função: os pontos em que a parábola cruza o eixo x. Para achá-las, resolve-se a equação ax² + bx + c = 0.

Primeiro calcula-se o **discriminante**, representado pela letra grega delta:

Δ = b² − 4ac

Depois:

x = (−b ± √Δ) ÷ (2a)

O sinal ± indica duas contas: uma com mais, outra com menos.

**Exemplo:** x² − 5x + 6 = 0. Aqui a = 1, b = −5 e c = 6.

```conta
Δ = (−5)² − 4 × 1 × 6 = 25 − 24 = 1
x = (5 ± 1) ÷ 2
= x = 3 ou x = 2
```

Conferindo: 3² − 5 × 3 + 6 = 9 − 15 + 6 = 0.

No Brasil, essa fórmula é chamada de **fórmula de Bhaskara**, em homenagem a um matemático indiano do século XII. O nome é costume nosso: a regra já era conhecida muito antes dele, e escribas da Mesopotâmia resolviam problemas desse tipo quase dois mil anos antes de Cristo.

## O que o delta conta

| Δ | Raízes reais | A parábola |
| --- | --- | --- |
| positivo | duas diferentes | corta o eixo x em dois pontos |
| zero | uma só | encosta no eixo x em um ponto |
| negativo | nenhuma | não toca o eixo x |

```verificar
Quantas raízes reais tem x² + 2x + 5 = 0?
- Duas
- Uma
+ Nenhuma
> Calcule Δ = b² − 4ac com a = 1, b = 2 e c = 5.
```

## O vértice

O ponto mais baixo (ou mais alto) da parábola é o **vértice**. A coordenada x dele fica exatamente no meio das raízes:

x do vértice = −b ÷ (2a)

Para achar o y, é só calcular a função nesse x.

Em f(x) = x² − 5x + 6: x do vértice = 5 ÷ 2 = 2,5, e f(2,5) = 6,25 − 12,5 + 6 = −0,25. O menor valor que a função atinge é −0,25.

## Máximos e mínimos

É aqui que a função do 2º grau mostra para que serve.

### A maior área

Você tem 40 metros de tela para cercar um canteiro retangular. Que medidas dão a maior área? Se um lado mede x, o outro mede 20 − x (porque os dois juntos são metade do perímetro). A área é:

A(x) = x × (20 − x) = −x² + 20x

Como a é negativo, existe um máximo, e ele está no vértice:

```conta
x do vértice = −20 ÷ (2 × (−1)) = 10
A(10) = 10 × 10 = 100
= a maior área é a do quadrado de 10 m de lado: 100 m²
```

### A bola no ar

A altura de uma bola chutada para cima, em metros, depois de t segundos, pode ser descrita aproximadamente por h(t) = −5t² + 20t.

- Ela volta ao chão quando h(t) = 0: −5t × (t − 4) = 0, isto é, em t = 0 (o chute) e t = 4 segundos.
- A altura máxima está no meio, em t = 2: h(2) = −20 + 40 = 20 metros.

### O preço que rende mais

Uma barraca vende 100 lanches por dia a R$ 10. A dona percebe que, a cada R$ 1 de aumento, perde 5 fregueses. Se o aumento for de x reais, a receita será:

R(x) = (10 + x) × (100 − 5x) = −5x² + 50x + 1.000

O vértice está em x = −50 ÷ (2 × (−5)) = 5. Com o lanche a R$ 15, ela vende 75 e arrecada 15 × 75 = R$ 1.125, o máximo possível. Acima disso, o aumento de preço não compensa a perda de fregueses.

A conta mostra o máximo da **receita** da barraca. Ela não diz nada sobre quem deixou de comer porque o preço subiu. O que se escolhe maximizar é uma decisão humana, anterior à matemática.

## Para praticar

1. Resolva x² − 7x + 10 = 0.
2. Resolva x² − 6x + 9 = 0. O que o delta indica?
3. Ache o vértice de f(x) = x² − 4x + 1. É máximo ou mínimo?
4. A parábola de f(x) = −x² + 4x abre para cima ou para baixo? Quais são as raízes?
5. Com 60 m de tela, qual é a maior área retangular que se pode cercar?

**Respostas:** 1) 2 e 5. 2) x = 3; Δ = 0, uma raiz só. 3) (2, −3); é mínimo. 4) Para baixo; 0 e 4. 5) 225 m² (quadrado de 15 m de lado).

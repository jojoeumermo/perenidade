---
titulo: "Álgebra linear: vetores e matrizes"
resumo: "Setas, tabelas e transformações: a matemática que está por trás das imagens, dos buscadores e do planejamento."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 10.8, Vectors"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/10-8-vectors"
  - titulo: "Algebra and Trigonometry 2e, seção 11.5, Matrices and Matrix Operations"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/11-5-matrices-and-matrix-operations"
  - titulo: "Algebra and Trigonometry 2e, seção 11.7, Solving Systems with Inverses"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/11-7-solving-systems-with-inverses"
quiz:
  - pergunta: "Qual é o módulo (comprimento) do vetor (3, 4)?"
    opcoes: ["7", "5", "12"]
    resposta: 1
    explicacao: "Pelo teorema de Pitágoras: a raiz de 3² + 4² = 25 é 5."
  - pergunta: "Os vetores (2, 3) e (−3, 2) são perpendiculares?"
    opcoes: ["Sim, porque o produto escalar é zero", "Não, porque têm o mesmo comprimento", "Não dá para saber"]
    resposta: 0
    explicacao: "2 × (−3) + 3 × 2 = −6 + 6 = 0. Produto escalar nulo indica ângulo reto."
  - pergunta: "O que é um autovetor de uma matriz?"
    opcoes: ["Um vetor que a matriz transforma em zero", "Um vetor que a matriz só estica ou encolhe, sem mudar de direção", "A primeira coluna da matriz"]
    resposta: 1
    explicacao: "Para um autovetor v, vale A × v = λ × v. O número λ é o autovalor."
---

A aula [Matrizes e sistemas lineares](/trilhas/matematica-medio/matrizes-e-sistemas-lineares) apresenta as contas básicas. Aqui o assunto é o que elas **significam**.

## Vetores

Algumas grandezas ficam bem descritas por um número: massa, temperatura, preço. Outras precisam também de direção e sentido: um deslocamento, uma força, uma velocidade. Essas são representadas por **vetores**, desenhados como setas.

No plano, um vetor é um par de números, as suas componentes: v = (3, 4) quer dizer "3 para a direita e 4 para cima". No espaço, são três componentes. E nada impede que sejam cem ou um milhão: a ficha de uma pessoa em uma pesquisa (idade, renda, anos de estudo...) também é um vetor, embora não dê para desenhá-lo.

**Operações:**

- **soma:** componente a componente. (3, 4) + (1, −2) = (4, 2). É fazer um deslocamento depois do outro;
- **multiplicação por número:** 2 × (3, 4) = (6, 8). Estica o vetor; se o número for negativo, inverte o sentido;
- **módulo** (comprimento): pelo teorema de Pitágoras, o módulo de (3, 4) é √(9 + 16) = 5.

## Produto escalar

O **produto escalar** de dois vetores é a soma dos produtos das componentes correspondentes:

(3, 4) · (1, −2) = 3 × 1 + 4 × (−2) = −5

O resultado é um número, e ele informa sobre o **ângulo** entre os vetores:

- positivo: apontam, em linhas gerais, para o mesmo lado;
- **zero: são perpendiculares**;
- negativo: apontam para lados opostos.

Dividindo o produto escalar pelos dois módulos, obtém-se o cosseno do ângulo. Em muitas dimensões, onde não há desenho, esse número serve como medida de **semelhança**: dois textos, duas músicas ou dois perfis de consumo são "parecidos" quando os vetores que os representam apontam em direções próximas. É assim que funcionam, em linhas gerais, os sistemas de recomendação e os buscadores.

## Combinações lineares

Com os vetores (1, 0) e (0, 1), qualquer vetor do plano pode ser montado: (3, 4) = 3 × (1, 0) + 4 × (0, 1). Uma soma de vetores multiplicados por números é uma **combinação linear**.

Um conjunto de vetores com o qual se monta todo o espaço, sem nenhum sobrando, é uma **base**. O número de vetores da base é a **dimensão**: 2 para o plano, 3 para o espaço.

Vetores são **linearmente dependentes** quando um deles pode ser montado com os outros, isto é, não traz direção nova. (1, 2) e (2, 4) são dependentes: o segundo é o dobro do primeiro. Em um sistema de equações, é o caso da equação repetida, que não acrescenta informação.

## Matrizes como transformações

Uma matriz não é só uma tabela. Multiplicar uma matriz por um vetor **transforma** o vetor em outro. A matriz

```
0  −1
1   0
```

leva (1, 0) em (0, 1) e leva (0, 1) em (−1, 0): gira tudo 90 graus no sentido anti-horário. Aplicada ao vetor (2, 1), dá (−1, 2).

Outras matrizes esticam, achatam, espelham, inclinam. Toda vez que uma imagem gira ou muda de tamanho na tela do celular, uma matriz está sendo multiplicada pelas coordenadas de cada ponto. Multiplicar duas matrizes é fazer uma transformação depois da outra, o que explica por que a ordem importa: girar e depois esticar não é o mesmo que esticar e depois girar.

O **determinante** ganha sentido: ele é o fator pelo qual a transformação multiplica as áreas. Determinante 3: as áreas triplicam. Determinante zero: a transformação esmaga o plano em uma reta, e não há como desfazê-la.

```verificar
A matriz de linhas (2, 0) e (0, 2) multiplica por 2 as duas componentes de qualquer vetor. Por quanto ela multiplica as áreas?
- 2
+ 4
- 0
> O determinante é 2 × 2 − 0 × 0. Dobrando a largura e a altura de uma figura, o que acontece com a área?
```

## A matriz inversa

A **inversa** de uma matriz A, escrita A⁻¹, é a transformação que desfaz A. Ela só existe quando o determinante é diferente de zero. Para uma matriz 2 por 2:

```
A =  a  b        A⁻¹ = (1 ÷ det) ×   d  −b
     c  d                           −c   a
```

Um sistema linear escreve-se A × x = b. Se A tem inversa, a solução é x = A⁻¹ × b.

No exemplo da feira (2 kg de arroz e 1 de feijão por R$ 19; 1 de arroz e 2 de feijão por R$ 23), a matriz tem linhas (2, 1) e (1, 2) e determinante 3:

```conta
arroz = (2 × 19 − 1 × 23) ÷ 3 = 15 ÷ 3 = 5
feijão = (−1 × 19 + 2 × 23) ÷ 3 = 27 ÷ 3 = 9
= os mesmos R$ 5 e R$ 9 obtidos por substituição
```

## Autovalores e autovetores

Uma transformação costuma mudar a direção dos vetores. Mas, para quase toda matriz, existem direções especiais que ela **não gira**: só estica ou encolhe. Um vetor nessas direções é um **autovetor**, e o fator de esticamento é o **autovalor** (λ):

A × v = λ × v

Para a matriz de linhas (2, 1) e (1, 2):

- o vetor (1, 1) vira (3, 3): é autovetor, com autovalor 3;
- o vetor (1, −1) vira (1, −1): é autovetor, com autovalor 1.

Autovetores revelam a "estrutura interna" de uma transformação, e por isso aparecem em toda parte:

- **vibrações:** os modos em que uma ponte ou uma corda de violão oscila;
- **buscadores:** o PageRank, algoritmo com que o Google passou a ordenar as páginas no fim dos anos 1990, calcula um autovetor de uma matriz enorme, que registra quais páginas apontam para quais;
- **estatística:** a análise de componentes principais usa autovetores para resumir dezenas de variáveis em poucas.

## Álgebra linear e planejamento

O economista Wassily Leontief descreveu a economia de um país com uma matriz: cada coluna diz quanto um setor consome dos produtos de todos os outros para produzir uma unidade. Dada a quantidade de bens que a sociedade quer ter à disposição, calcular quanto cada setor precisa produzir é resolver um sistema linear, isto é, inverter uma matriz.

O método foi usado tanto por governos capitalistas quanto no planejamento das economias socialistas. A matemática não decide **o que** produzir nem **para quem**. Mas mostra, com precisão, o que cada escolha exige de todos os setores. Com os computadores de hoje, que resolvem sistemas de milhões de equações, essa conta deixou de ser um obstáculo técnico.

## Para praticar

1. Com u = (3, 4) e v = (1, −2), calcule u + v, 2u e u · v.
2. Os vetores (4, 6) e (2, 3) são linearmente dependentes?
3. Aplique a rotação de 90 graus ao vetor (2, 1).
4. Calcule o determinante e a inversa da matriz de linhas (3, 1) e (2, 4).
5. Quais são os autovalores da matriz de linhas (4, 0) e (0, 2)? E os autovetores?

**Respostas:** 1) (4, 2); (6, 8); −5. 2) Sim: o primeiro é o dobro do segundo. 3) (−1, 2). 4) 10; a inversa é 1/10 vezes a matriz de linhas (4, −1) e (−2, 3). 5) 4 e 2; os autovetores estão nas direções (1, 0) e (0, 1).

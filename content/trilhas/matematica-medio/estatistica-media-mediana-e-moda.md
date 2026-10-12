---
titulo: "Estatística: média, mediana e moda"
resumo: "Resumir muitos números em poucos: as três medidas de centro, a média ponderada e o desvio padrão."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 2.5, Measures of the Center of the Data"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-5-measures-of-the-center-of-the-data"
  - titulo: "Introductory Statistics 2e, seção 2.7, Measures of the Spread of the Data"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-7-measures-of-the-spread-of-the-data"
quiz:
  - pergunta: "Qual é a mediana de 3, 5, 7 e 9?"
    opcoes: ["5", "6", "7"]
    resposta: 1
    explicacao: "Com quantidade par de valores, a mediana é a média dos dois do meio: (5 + 7) ÷ 2 = 6."
  - pergunta: "Em uma oficina, seis pessoas ganham entre R$ 1.500 e R$ 2.200 e o dono retira R$ 15.000. Que medida descreve melhor o ganho típico de quem trabalha ali?"
    opcoes: ["A média", "A mediana", "O maior valor"]
    resposta: 1
    explicacao: "A média é puxada para cima pelo valor extremo. A mediana não sente esse efeito."
  - pergunta: "Uma prova vale peso 2 e um trabalho vale peso 1. Com nota 6 na prova e 9 no trabalho, qual é a média?"
    opcoes: ["7,5", "7", "8"]
    resposta: 1
    explicacao: "(6 × 2 + 9 × 1) ÷ 3 = 21 ÷ 3 = 7."
---

## Um número no lugar de muitos

A estatística serve para resumir. Em vez de listar o salário de cada pessoa, a nota de cada estudante ou a temperatura de cada dia, procura-se um valor que represente o conjunto. Há três jeitos principais de fazer isso, e eles podem contar histórias bem diferentes.

Os dados desta aula são **inventados para o exercício**.

Sete pessoas tiram o seu sustento de uma oficina. Os ganhos mensais, em reais:

1.500, 1.500, 1.600, 1.800, 2.000, 2.200, 15.000

O último valor é a retirada do dono.

## Média

Some tudo e divida pelo número de valores.

```conta
1.500 + 1.500 + 1.600 + 1.800 + 2.000 + 2.200 + 15.000 = 25.600
25.600 ÷ 7
= cerca de R$ 3.657
```

"Na oficina, ganha-se em média R$ 3.657." A frase é verdadeira, e nenhuma das seis pessoas que trabalham ali chega perto desse valor. A média é sensível a **valores extremos**: um número muito alto ou muito baixo a arrasta.

## Mediana

Ponha os valores **em ordem** e pegue o do meio. Metade fica abaixo e metade acima.

1.500, 1.500, 1.600, **1.800**, 2.000, 2.200, 15.000

A mediana é R$ 1.800, um retrato muito mais fiel do ganho típico. Se o dono passasse a retirar R$ 150.000, a mediana continuaria em R$ 1.800.

Quando a quantidade de valores é par, não há um valor central: tira-se a média dos dois do meio. A mediana de 3, 5, 7 e 9 é (5 + 7) ÷ 2 = 6.

## Moda

É o valor que **mais se repete**. Na oficina, R$ 1.500, que aparece duas vezes. A moda é útil para dados que não são números (o partido mais votado, a profissão mais comum) e para saber o caso mais frequente. Um conjunto pode ter mais de uma moda, ou nenhuma.

## Qual usar?

| Medida | Vantagem | Cuidado |
| --- | --- | --- |
| Média | usa todos os valores; fácil de calcular | é distorcida por valores extremos |
| Mediana | não sente os extremos | ignora o tamanho dos valores das pontas |
| Moda | mostra o caso mais comum; serve para categorias | pode não existir ou não ser única |

Em dados muito desiguais, como renda, patrimônio e preço de imóveis, a média fica acima da mediana, porque poucos valores altíssimos a puxam. Quando alguém apresentar uma "renda média", pergunte pela mediana. A trilha [Estatística para ler o Brasil](/trilhas/estatistica-para-ler-o-brasil) volta a esse ponto com dados reais.

```verificar
As notas de uma estudante foram 5, 7, 8, 8 e 10. Quais são a média, a mediana e a moda?
- Média 8, mediana 8, moda 8
+ Média 7,6, mediana 8, moda 8
- Média 7,6, mediana 7, moda 10
> Some as cinco notas e divida por 5. Para a mediana, veja a nota do meio da lista em ordem.
```

## Média ponderada

Quando alguns valores contam mais que outros, cada um é multiplicado pelo seu **peso**, e divide-se pela soma dos pesos.

Uma prova com peso 2 e um trabalho com peso 1; nota 6 na prova e 9 no trabalho:

```conta
(6 × 2 + 9 × 1) ÷ (2 + 1)
= 21 ÷ 3
= 7
```

A média simples seria 7,5; a ponderada é 7, porque a nota mais baixa pesa mais. Os índices de inflação são médias ponderadas: o aluguel pesa mais que o sal, porque ocupa uma parte maior do orçamento das famílias.

## E o espalhamento?

Duas turmas têm média 6. Em uma, todos tiraram entre 5 e 7. Na outra, metade tirou 2 e metade tirou 10. A média esconde a diferença. É preciso medir também a **dispersão**.

A medida mais simples é a **amplitude**: o maior valor menos o menor.

A mais usada é o **desvio padrão**, que indica quanto, em geral, os valores se afastam da média. Para os valores 2, 4, 4, 4, 5, 5, 7 e 9:

1. a média é 40 ÷ 8 = 5;
2. as diferenças em relação à média são −3, −1, −1, −1, 0, 0, 2 e 4;
3. elevando cada uma ao quadrado: 9, 1, 1, 1, 0, 0, 4 e 16, que somam 32;
4. a média desses quadrados é 32 ÷ 8 = 4 (a **variância**);
5. o desvio padrão é a raiz quadrada da variância: √4 = 2.

Desvio padrão pequeno: valores concentrados perto da média. Desvio padrão grande: valores espalhados. (Quando os dados são uma amostra de um grupo maior, costuma-se dividir por n − 1 em vez de n; a ideia é a mesma.)

## Para praticar

1. Calcule média, mediana e moda de 4, 6, 6, 7, 9 e 10.
2. Cinco pessoas ganham R$ 1.400, R$ 1.500, R$ 1.500, R$ 1.700 e R$ 8.900. Calcule a média e a mediana. Qual representa melhor o grupo?
3. Um vestibular dá peso 3 à redação e peso 1 à prova objetiva. Com 700 na redação e 600 na objetiva, qual é a média?
4. Qual é a amplitude de 12, 15, 9 e 20?
5. Calcule o desvio padrão de 2, 4 e 6.

**Respostas:** 1) Média 7, mediana 6,5, moda 6. 2) Média R$ 3.000; mediana R$ 1.500, que representa melhor. 3) 675. 4) 11. 5) Média 4; variância 8/3; desvio padrão de cerca de 1,63.

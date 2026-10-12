---
titulo: "Média, mediana e moda"
resumo: "Por que a renda média não é a renda de quase ninguém, e que perguntas fazer quando alguém apresenta uma média."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 2.5, Measures of the Center of the Data"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-5-measures-of-the-center-of-the-data"
  - titulo: "Introductory Statistics 2e, seção 2.6, Skewness and the Mean, Median, and Mode"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-6-skewness-and-the-mean-median-and-mode"
  - titulo: "Como mentir com estatística"
    autor: "Darrell Huff"
    ano: "1954"
quiz:
  - pergunta: "Em uma distribuição de renda muito desigual, o que costuma acontecer?"
    opcoes: ["A média fica acima da mediana", "A média fica abaixo da mediana", "Média e mediana ficam iguais"]
    resposta: 0
    explicacao: "Poucos valores muito altos puxam a média para cima. A mediana não é afetada por eles."
  - pergunta: "Um bilionário entra em um bar com dez trabalhadores. O que acontece com a mediana do patrimônio das pessoas no bar?"
    opcoes: ["Dispara", "Quase não muda", "Cai"]
    resposta: 1
    explicacao: "A mediana é o valor do meio. Um único valor extremo desloca o meio em, no máximo, uma posição."
  - pergunta: "O PIB per capita de um país é:"
    opcoes: ["a renda da pessoa típica", "uma média: o total produzido dividido pelo número de habitantes", "a renda dos mais pobres"]
    resposta: 1
    explicacao: "É uma média, e como toda média não informa como o total está distribuído."
---

A conta de cada medida está na aula [Estatística: média, mediana e moda](/trilhas/matematica-medio/estatistica-media-mediana-e-moda). Aqui o assunto é como elas são usadas para descrever um país. Os números dos exemplos são inventados para o exercício.

## O bilionário no bar

Dez trabalhadores estão em um bar. Cada um tem cerca de R$ 20 mil de patrimônio, entre a moto, a geladeira e algum dinheiro guardado. Entra um bilionário, dono de R$ 1 bilhão.

- A **média** do patrimônio no bar passa de R$ 20 mil para mais de R$ 90 milhões. "Em média", todos ali são milionários.
- A **mediana** continua em R$ 20 mil.
- A **moda** também.

Ninguém ficou mais rico. A média mudou porque ela reparte o total igualmente no papel, coisa que a realidade não faz.

## Três perguntas diferentes

| Medida | Pergunta que ela responde |
| --- | --- |
| Média | Se o total fosse repartido igualmente, quanto caberia a cada um? |
| Mediana | Quanto tem a pessoa que está exatamente no meio da fila? |
| Moda | Qual é a situação mais comum? |

Quando os valores são parecidos entre si (a altura dos adultos, por exemplo), as três medidas ficam próximas, e tanto faz qual usar. Quando há **poucos valores muito altos**, como na renda, no patrimônio, no tamanho das propriedades de terra e no preço dos imóveis, elas se separam: a média fica acima da mediana, às vezes muito acima. Diz-se que a distribuição é **assimétrica**.

## A renda "média" do brasileiro

Sempre que você ler "a renda média é de tanto", lembre-se do bar. Em um país muito desigual, a maior parte da população ganha **menos** que a média, porque a média é puxada para cima pelos rendimentos do topo.

A pergunta a fazer é: **e a mediana?** Ela diz quanto ganha quem está no meio: metade da população ganha menos que isso. É um retrato muito mais próximo da vida da maioria.

O mesmo vale para o **PIB per capita**, que é o total produzido no país em um ano dividido pelo número de habitantes. É uma média. Dois países com o mesmo PIB per capita podem ter condições de vida completamente diferentes, conforme a produção esteja repartida. Crescimento do PIB per capita também não significa que a vida da maioria melhorou: a média sobe mesmo que todo o aumento fique com poucos.

```verificar
Um jornal informa que 'o salário médio na empresa subiu 10%'. O que se pode concluir?
- Que todos os funcionários ganharam 10% a mais
- Que a maioria dos funcionários ganhou aumento
+ Nada sobre a maioria: a média pode ter subido só por causa de aumentos na diretoria
> A média é o total dividido pelo número de pessoas. Pense no bilionário do bar.
```

## Além do meio: as fatias

Para descrever uma distribuição desigual, um número só não basta. Por isso os institutos de estatística dividem a população em fatias, depois de pôr todos em fila, do menor rendimento ao maior:

- **quintos:** cinco grupos com 20% da população cada;
- **décimos:** dez grupos com 10% cada;
- **percentis:** cem grupos com 1% cada.

Daí vêm as expressões "os 10% mais ricos", "o 1% do topo" e "os 40% mais pobres". Comparar a fatia da renda total que fica com cada grupo mostra o que a média esconde. A aula sobre o [índice de Gini](/trilhas/estatistica-para-ler-o-brasil/desigualdade-o-indice-de-gini) continua daqui.

## Médias que confundem

**"As mulheres do país têm, em média, 1,6 filho."** Nenhuma mulher tem 1,6 filho. A média pode ser um valor que não existe em nenhum caso real, e mesmo assim ser útil para comparar épocas e lugares.

**"A expectativa de vida era de 35 anos."** Isso não quer dizer que as pessoas morriam de velhice aos 35. A expectativa de vida ao nascer é uma média das idades de morte, e onde morrem muitas crianças pequenas a média despenca. Quem passava da infância vivia, muitas vezes, bem mais que isso.

**"O tempo médio de espera é de 20 minutos."** Se nove pessoas esperam 5 minutos e uma espera 2 horas e meia, a média é de quase 20 minutos, e ela não descreve a experiência de ninguém.

**Média de médias.** Uma escola com 10 alunos tem média 9; outra, com 90 alunos, tem média 5. A média das duas escolas juntas **não** é 7. É (10 × 9 + 90 × 5) ÷ 100 = 5,4. Para juntar médias de grupos de tamanhos diferentes, é preciso ponderar pelo tamanho de cada grupo.

## Quem escolhe a medida

Em uma negociação salarial, a empresa pode dizer que "o salário médio é de R$ 4.000", somando a folha inteira, diretoria incluída. O sindicato pode responder que "a maioria ganha R$ 1.800", olhando a mediana ou a moda. Nenhum dos dois mentiu.

Quem apresenta um número escolhe a medida que conta a história que lhe convém. Darrell Huff, em *Como mentir com estatística*, chamou isso de "a média bem escolhida". A defesa é perguntar sempre: **que média é essa? De quem? Como estão distribuídos os valores em volta dela?**

## Para praticar

1. Nove pessoas ganham R$ 2.000 e uma ganha R$ 82.000. Calcule a média e a mediana.
2. No exercício 1, quantas pessoas ganham menos que a média?
3. Uma cidade tem dois bairros. No bairro A moram 1.000 pessoas, com renda média de R$ 10.000. No bairro B moram 9.000, com renda média de R$ 1.500. Qual é a renda média da cidade?
4. Um governo afirma que "a renda média cresceu 8%". Que duas perguntas você faria antes de comemorar?

**Respostas:** 1) Média de R$ 10.000; mediana de R$ 2.000. 2) Nove das dez. 3) R$ 2.350. 4) Por exemplo: a mediana também cresceu? O crescimento foi descontado da inflação? Como ele se repartiu entre as faixas de renda?

---
titulo: "Desigualdade: o índice de Gini"
resumo: "Um número de 0 a 1 para medir a concentração da renda: como ele é construído, como ler e o que ele deixa de fora."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Gini index (indicador SI.POV.GINI)"
    autor: "Banco Mundial"
    url: "https://data.worldbank.org/indicator/SI.POV.GINI"
  - titulo: "World Inequality Database: Brazil"
    autor: "World Inequality Lab"
    url: "https://wid.world/country/brazil/"
  - titulo: "Variabilità e mutabilità"
    autor: "Corrado Gini"
    ano: "1912"
quiz:
  - pergunta: "O que significa um índice de Gini igual a 0?"
    opcoes: ["Que não há renda nenhuma", "Que todos têm exatamente a mesma renda", "Que uma pessoa tem tudo"]
    resposta: 1
    explicacao: "Zero é a igualdade perfeita. O outro extremo, 1, é uma pessoa com toda a renda."
  - pergunta: "Por que as pesquisas em domicílios tendem a mostrar menos desigualdade do que existe?"
    opcoes: ["Porque os pobres escondem a renda", "Porque captam mal os rendimentos do topo, como lucros e aplicações", "Porque são feitas em poucas cidades"]
    resposta: 1
    explicacao: "Os muito ricos são poucos, respondem menos e declaram mal rendimentos que não são salário. Por isso os estudos recorrem também aos dados do imposto de renda."
  - pergunta: "O índice de Gini da renda mede:"
    opcoes: ["a pobreza de um país", "como a renda está repartida entre as pessoas", "o tamanho da economia"]
    resposta: 1
    explicacao: "Ele mede concentração, e não nível. Um país pode ser pobre e igualitário, ou rico e muito desigual."
---

## Medir a desigualdade

Dizer que um país é desigual é fácil. Dizer **quanto**, de um jeito que permita comparar países e épocas, exige um método. O mais usado é o **índice de Gini**, criado pelo estatístico italiano Corrado Gini em 1912.

Ele vai de **0 a 1**:

- **0** é a igualdade perfeita: todos têm exatamente a mesma renda;
- **1** é a desigualdade máxima: uma só pessoa tem toda a renda, e as outras, nada.

Nenhuma sociedade está em um dos extremos. Quanto mais perto de 1, mais concentrada é a renda. Às vezes o índice aparece multiplicado por 100 (de 0 a 100): é a mesma coisa.

## A fila e a curva

Para entender de onde vem o número, ponha toda a população em fila, do mais pobre ao mais rico, e vá somando a renda.

Em uma sociedade perfeitamente igual, os 10% do começo da fila teriam 10% da renda; os 50%, metade da renda; os 90%, 90% da renda. Em uma sociedade real, a soma demora a crescer: os primeiros da fila têm muito pouco.

Um exemplo inventado, com a população dividida em cinco grupos de mesmo tamanho:

| Grupo | Parte da renda que recebe | Renda acumulada até aqui |
| --- | --- | --- |
| 20% mais pobres | 3% | 3% |
| 20% seguintes | 7% | 10% |
| 20% do meio | 12% | 22% |
| 20% seguintes | 20% | 42% |
| 20% mais ricos | 58% | 100% |

Lendo a última coluna: os 60% mais pobres, juntos, ficam com 22% da renda; os 20% mais ricos, sozinhos, com 58%.

Desenhando a renda acumulada em um gráfico, obtém-se a **curva de Lorenz**, proposta pelo economista americano Max Lorenz em 1905. Na igualdade perfeita, ela seria uma reta diagonal. Na vida real, é uma curva "barriguda", que fica abaixo da reta. O índice de Gini mede o tamanho dessa barriga: a área entre a reta e a curva, comparada com a área total debaixo da reta. Quanto maior a barriga, maior o Gini.

```verificar
No exemplo da tabela, que parte da renda fica com os 40% mais pobres?
- 7%
+ 10%
- 40%
> Some as partes dos dois primeiros grupos, ou leia a renda acumulada na segunda linha.
```

## O Brasil no mapa

O Banco Mundial reúne o índice de Gini de quase todos os países. Nessa comparação, o Brasil aparece há décadas no grupo dos mais desiguais do mundo, com índice em torno de 0,5, enquanto os países mais igualitários ficam perto de 0,25.

Dentro do país, o IBGE calcula o Gini do rendimento com os dados da PNAD Contínua, para o Brasil, as regiões e os estados. O valor exato muda a cada ano; vale consultar a divulgação mais recente.

## O que o Gini não mostra

**Nível de vida.** O Gini mede repartição, e não quantidade. Um país pode ser pobre e igualitário ou rico e muito desigual. Para saber como as pessoas vivem, é preciso olhar também a renda, a pobreza e o acesso a serviços.

**Onde está a desigualdade.** Distribuições diferentes podem dar o mesmo Gini. Por isso ele costuma vir acompanhado de comparações diretas, como a parte da renda que fica com os 10% mais ricos dividida pela parte que fica com os 40% mais pobres.

**O topo de verdade.** O Gini oficial vem de pesquisas em domicílios, e elas captam mal os muito ricos: são poucos, respondem menos e declaram mal os rendimentos que não são salário, como lucros, dividendos e aplicações. Pesquisadores passaram a combinar essas pesquisas com os dados do imposto de renda, e projetos como o World Inequality Database publicam séries feitas assim. Com esse método, a concentração no topo aparece maior do que a mostrada pelas pesquisas em domicílios.

**A riqueza.** Renda é o que entra todo mês; **riqueza** (ou patrimônio) é o que se tem acumulado: imóveis, terras, empresas, aplicações. Em toda parte, a riqueza é bem mais concentrada que a renda. Um Gini calculado só com a renda deixa de fora a desigualdade mais dura e mais hereditária.

**A terra.** O mesmo índice pode ser aplicado à distribuição das propriedades rurais. No Brasil, a concentração da terra, medida a partir dos censos agropecuários, é ainda maior que a da renda.

**Quem é quem.** O Gini trata as pessoas como números em uma fila. Não diz que, no Brasil, os primeiros lugares da fila são ocupados principalmente por pessoas negras e por moradores do Norte e do Nordeste, e que as mulheres negras têm os menores rendimentos médios. Para isso, é preciso abrir os dados por cor ou raça, sexo e região.

## Por que o número importa

A desigualdade não é um fenômeno da natureza. O índice sobe ou desce conforme o salário mínimo, o emprego, os impostos (quem paga mais, quem paga menos), os gastos sociais, a educação e a propriedade da terra. Acompanhar o Gini ao longo do tempo é um modo de avaliar para quem um governo ou um modelo econômico trabalhou.

Mas lembre-se dos limites: um número só não conta a história inteira. Use o Gini como porta de entrada, e peça os outros dados.

## Para praticar

1. Usando a tabela de exemplo, que parte da renda fica com os 80% mais pobres?
2. Na tabela, a renda dos 20% mais ricos é quantas vezes a dos 20% mais pobres?
3. O país A tem Gini de 0,30 e renda média baixa. O país B tem Gini de 0,55 e renda média alta. Em qual deles a renda é mais bem repartida? Dá para dizer em qual os mais pobres vivem melhor?
4. Por que um Gini calculado com dados do imposto de renda tende a ser maior que o calculado com pesquisas em domicílios?

**Respostas:** 1) 42%. 2) Cerca de 19 vezes (58 ÷ 3). 3) No país A. Não dá para dizer: depende também do nível de renda e dos serviços públicos de cada um. 4) Porque o imposto de renda registra melhor os rendimentos mais altos, que as pesquisas em domicílios captam mal.

---
titulo: "Probabilidade e distribuições"
resumo: "Variáveis aleatórias, valor esperado, a binomial, a curva normal e o teorema que explica por que ela aparece tanto."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 4.1, Probability Distribution Function (PDF) for a Discrete Random Variable"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/4-1-probability-distribution-function-pdf-for-a-discrete-random-variable"
  - titulo: "Introductory Statistics 2e, seção 4.3, Binomial Distribution"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/4-3-binomial-distribution"
  - titulo: "Introductory Statistics 2e, seção 6.1, The Standard Normal Distribution"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/6-1-the-standard-normal-distribution"
  - titulo: "Introductory Statistics 2e, seção 7.1, The Central Limit Theorem for Sample Means (Averages)"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/7-1-the-central-limit-theorem-for-sample-means-averages"
quiz:
  - pergunta: "Qual é o valor esperado do resultado de um dado comum?"
    opcoes: ["3", "3,5", "6"]
    resposta: 1
    explicacao: "(1 + 2 + 3 + 4 + 5 + 6) ÷ 6 = 3,5. O valor esperado não precisa ser um resultado possível."
  - pergunta: "Em uma distribuição normal, que parte dos valores fica a até dois desvios padrão da média?"
    opcoes: ["Cerca de 68%", "Cerca de 95%", "Cerca de 50%"]
    resposta: 1
    explicacao: "Cerca de 68% ficam a até um desvio, 95% a até dois e 99,7% a até três."
  - pergunta: "O que diz, em resumo, o teorema central do limite?"
    opcoes: ["Que toda variável é normal", "Que a média de muitas observações independentes tende a ter distribuição normal", "Que a média é sempre igual à mediana"]
    resposta: 1
    explicacao: "Mesmo que os valores individuais não sejam normais, as médias de amostras grandes se distribuem aproximadamente como a normal."
---

A aula [Probabilidade](/trilhas/matematica-medio/probabilidade) trata de eventos isolados. Aqui o objeto é a **distribuição** inteira: todos os resultados possíveis de um fenômeno e a chance de cada um.

## Variável aleatória

Uma **variável aleatória** é um número que depende do acaso: o resultado de um dado, o número de peças defeituosas em um lote, a altura de uma pessoa sorteada.

- É **discreta** quando assume valores separados, que se podem listar (0, 1, 2, 3...).
- É **contínua** quando pode assumir qualquer valor de um intervalo (altura, tempo, peso).

A **distribuição de probabilidade** diz como a probabilidade total, que é 1, se reparte entre os valores.

## Valor esperado e variância

O **valor esperado** (ou média) é a soma de cada valor multiplicado pela sua probabilidade. Para um dado:

```conta
1 × 1/6 + 2 × 1/6 + 3 × 1/6 + 4 × 1/6 + 5 × 1/6 + 6 × 1/6
= 21 ÷ 6
= 3,5
```

Nenhum lançamento dá 3,5. O valor esperado é a média para a qual tendem os resultados quando o experimento é repetido muitas vezes.

A **variância** mede o espalhamento: é o valor esperado do quadrado da distância até a média. Sua raiz quadrada é o **desvio padrão**. Para o dado, a variância é 35/12, cerca de 2,92, e o desvio padrão, cerca de 1,71.

## A distribuição binomial

Repete-se n vezes, de modo independente, um experimento com dois resultados ("sucesso", com probabilidade p, e "fracasso"). O número de sucessos tem **distribuição binomial**:

P(k sucessos) = C(n, k) × p^k × (1 − p)^(n − k)

O C(n, k) é o número de [combinações](/trilhas/matematica-medio/analise-combinatoria): de quantas maneiras os k sucessos se distribuem entre as n tentativas.

**Dez lançamentos de moeda.** A probabilidade de saírem exatamente 5 caras:

```conta
C(10, 5) × (1/2)^10
= 252 ÷ 1.024
= cerca de 24,6%
```

O resultado "mais provável" acontece menos de uma vez em quatro.

**Controle de qualidade.** Uma máquina produz 5% de peças com defeito. Em uma caixa de 20, a probabilidade de não haver nenhuma defeituosa é 0,95^20, cerca de 36%. A maioria das caixas terá pelo menos uma.

Na binomial, a média é **n × p** e a variância é **n × p × (1 − p)**. Em 100 lançamentos de moeda, esperam-se 50 caras, com desvio padrão de √25 = 5.

## A distribuição normal

Muitas medidas (a altura dos adultos de uma população, os erros de uma medição repetida) se distribuem em forma de **sino**: concentradas em torno da média, simétricas, rareando nos extremos. O modelo matemático desse sino é a **distribuição normal**, definida por dois números: a média (μ) e o desvio padrão (σ).

A regra prática:

| Distância da média | Parte dos valores |
| --- | --- |
| até 1 desvio padrão | cerca de 68% |
| até 2 desvios padrão | cerca de 95% |
| até 3 desvios padrão | cerca de 99,7% |

Se as alturas de um grupo têm média de 170 cm e desvio padrão de 10 cm, cerca de 68% das pessoas medem entre 160 e 180 cm, e cerca de 95%, entre 150 e 190 cm.

Para comparar valores de distribuições diferentes, **padroniza-se**: conta-se a quantos desvios padrão o valor está da média.

z = (x − μ) ÷ σ

Uma pessoa de 185 cm, nesse grupo, tem z = 1,5. As tabelas (e as calculadoras) dão a probabilidade associada a cada z.

```verificar
As notas de um exame têm distribuição aproximadamente normal, com média 500 e desvio padrão 100. Que parte dos candidatos, aproximadamente, tira mais de 700?
- 5%
+ 2,5%
- 16%
> 700 está a dois desvios padrão da média. Cerca de 95% ficam entre 300 e 700; o resto se divide igualmente entre as duas pontas.
```

## Por que a normal aparece tanto

A resposta é um dos resultados mais notáveis da matemática, o **teorema central do limite**:

> a **soma** (ou a média) de um grande número de variáveis aleatórias independentes tem distribuição aproximadamente normal, **qualquer que seja** a distribuição de cada uma.

Um dado não tem nada de normal: os seis resultados são igualmente prováveis. A soma de dois dados já forma um triângulo, com pico no 7. A soma de dez dados é praticamente um sino.

Por isso a normal descreve tão bem as grandezas que resultam de muitos pequenos efeitos somados, como a altura (muitos genes, alimentação, saúde) e os erros de medição. E é ele que sustenta as pesquisas por amostragem: a média de uma amostra grande se comporta como uma normal em torno da média verdadeira, e disso sai a [margem de erro](/trilhas/estatistica-para-ler-o-brasil/margem-de-erro).

Em 100 lançamentos de moeda, a média é 50 e o desvio padrão é 5. Pelo teorema, cerca de 95% das vezes o número de caras fica entre 40 e 60. Obter 70 caras estaria a quatro desvios padrão: uma moeda honesta praticamente nunca faz isso.

## Nem tudo é sino

A normal é um modelo, e muita coisa importante não cabe nele.

**Renda e riqueza.** A distribuição não é simétrica: tem uma **cauda longa** à direita. Poucos valores altíssimos concentram grande parte do total, e a média fica acima da mediana. No fim do século XIX, o economista italiano Vilfredo Pareto descreveu esse padrão ao estudar a distribuição da riqueza. Em distribuições assim, o "indivíduo médio" não representa ninguém.

**Eventos extremos.** Quedas de bolsas, enchentes e grandes apagões acontecem com muito mais frequência do que um modelo normal preveria. Tratar como normal o que tem cauda pesada leva a subestimar justamente os desastres.

**O "homem médio".** No século XIX, o astrônomo belga Adolphe Quetelet aplicou a curva dos erros de medição a características humanas e propôs a figura do "homem médio" como tipo ideal, do qual os indivíduos seriam desvios. A própria palavra "normal" passou a carregar um juízo: o que se afasta da média seria anormal. A estatística descreve como uma característica se distribui; ela não diz que a média é o certo. Essa passagem do "frequente" para o "correto" não é matemática, e teve usos muito graves, como se vê na aula de [inferência estatística](/trilhas/matematica-superior/inferencia-estatistica).

## Outras distribuições

- **Uniforme:** todos os valores igualmente prováveis (o dado, o sorteio).
- **Poisson:** número de ocorrências de um evento raro em um intervalo (chamadas em uma central por minuto, acidentes em um cruzamento por mês).
- **Exponencial:** tempo de espera até a próxima ocorrência.

A escolha da distribuição é uma hipótese sobre o fenômeno. Vale sempre conferi-la com os dados.

## Para praticar

1. Uma rifa de 200 números, a R$ 5 cada, sorteia um prêmio de R$ 600. Qual é o valor esperado do ganho de quem compra um número?
2. Qual é a probabilidade de saírem exatamente 2 caras em 4 lançamentos de moeda?
3. Em 400 lançamentos de moeda, quais são a média e o desvio padrão do número de caras?
4. Em um grupo com alturas de média 170 cm e desvio padrão 10 cm, calcule o z de uma pessoa de 155 cm.
5. Uma fábrica tem 2% de peças defeituosas. Qual é a probabilidade de não haver defeito em um lote de 10?
6. No exercício 3, obter 260 caras seria um resultado esperado de uma moeda honesta?

**Respostas:** 1) 600 ÷ 200 − 5 = −R$ 2. 2) 6/16 = 37,5%. 3) 200 e 10. 4) −1,5. 5) 0,98^10, cerca de 82%. 6) Não: está a 6 desvios padrão da média.

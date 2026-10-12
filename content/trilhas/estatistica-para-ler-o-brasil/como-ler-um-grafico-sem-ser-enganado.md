---
titulo: "Como ler um gráfico sem ser enganado"
resumo: "Eixo cortado, escala dupla, período escolhido a dedo, valores sem correção: os truques mais comuns e como se defender."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 2.2, Histograms, Frequency Polygons, and Time Series Graphs"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-2-histograms-frequency-polygons-and-time-series-graphs"
  - titulo: "Como mentir com estatística"
    autor: "Darrell Huff"
    ano: "1954"
quiz:
  - pergunta: "Um gráfico mostra o 'total acumulado' de casas entregues por um governo, mês a mês. A linha sobe sempre. O que isso prova?"
    opcoes: ["Que o ritmo de entregas está aumentando", "Nada sobre o ritmo: um total acumulado nunca desce", "Que o programa vai bem"]
    resposta: 1
    explicacao: "Qualquer soma acumulada cresce ou fica parada. Para ver o ritmo, é preciso olhar as entregas de cada mês."
  - pergunta: "Para comparar a violência entre uma cidade grande e uma pequena, o mais correto é usar:"
    opcoes: ["o número total de ocorrências", "a taxa por 100 mil habitantes", "o número de delegacias"]
    resposta: 1
    explicacao: "A cidade maior quase sempre tem mais ocorrências em número absoluto. A taxa desconta o tamanho da população."
  - pergunta: "Um mapa pinta cada município com a cor do candidato mais votado. Por que ele pode enganar?"
    opcoes: ["Porque mapas não servem para eleições", "Porque a área do município não tem relação com o número de eleitores", "Porque as cores confundem"]
    resposta: 1
    explicacao: "Municípios enormes e pouco povoados ocupam muito espaço no mapa. Quem vota são pessoas, não quilômetros quadrados."
---

A aula [Leitura de gráficos e tabelas](/trilhas/matematica-fundamental/leitura-de-graficos-e-tabelas) apresenta os tipos de gráfico. Esta vai aos truques. Quase nenhum deles exige mentir nos números: basta escolher **como mostrar**.

## 1. O eixo cortado

Em um gráfico de barras, o comprimento da barra é a informação. Se o eixo não começa no zero, as barras perdem a base e as diferenças são esticadas.

```
Eixo começando em 0            Eixo começando em 45
A ████████████████████ 48      A ███ 48
B █████████████████████ 52     B ███████ 52
```

**Defesa:** leia os números do eixo antes de olhar as barras.

Uma ressalva: em gráficos de **linha**, nem sempre é errado o eixo não começar no zero. A temperatura do corpo varia entre 36 e 40 graus; um gráfico de febre começando no zero esconderia tudo o que importa. A pergunta é se a escala escolhida **exagera** ou **esconde** uma variação que tem (ou não tem) importância real.

## 2. O período escolhido a dedo

Uma série que sobe e desce permite contar a história que se quiser, conforme o ponto de partida.

Imagine o preço de um alimento ao longo de cinco anos: 10, 14, 18, 16, 15. Quem começa o gráfico no primeiro ano mostra uma alta de 50%. Quem começa no terceiro mostra uma queda de 17%. Os dois gráficos são "verdadeiros".

**Defesa:** pergunte por que o gráfico começa onde começa, e procure a série mais longa disponível.

## 3. O acumulado que sempre sobe

"Total de casas entregues desde o início do programa": a linha sobe, mês após mês. Mas um total acumulado **nunca desce**. Mesmo que as entregas caiam à metade, a linha continua subindo, só que mais devagar.

**Defesa:** peça o dado **por período** (casas entregues em cada mês). É ele que mostra se o ritmo aumentou ou diminuiu.

## 4. Valores sem correção

Um gráfico do orçamento da saúde em reais, ao longo de vinte anos, vai subir quase sempre, porque os preços e a população aumentam. Isso não significa que há mais saúde por pessoa.

**Defesa:** em séries longas de dinheiro, exija valores **corrigidos pela inflação** (também chamados de valores reais ou constantes) e, quando fizer sentido, **por habitante**.

## 5. Total em vez de taxa

Uma cidade de 2 milhões de habitantes teve 400 homicídios; outra, de 50 mil, teve 30. Qual é mais violenta?

```conta
400 ÷ 2.000.000 × 100.000 = 20 por 100 mil habitantes
30 ÷ 50.000 × 100.000 = 60 por 100 mil habitantes
= a cidade pequena tem uma taxa três vezes maior
```

**Defesa:** para comparar lugares de tamanhos diferentes, use **taxas** (por mil, por 100 mil habitantes), e não totais.

```verificar
Um gráfico compara o número de pessoas com diploma universitário em dois estados. O estado A tem 3 milhões; o estado B, 600 mil. Pode-se concluir que A tem uma população mais escolarizada?
- Sim, tem cinco vezes mais diplomados
+ Não sem saber a população de cada estado
- Sim, porque o gráfico é oficial
> Se A tiver dez vezes mais habitantes que B, quem é mais escolarizado?
```

## 6. Dois eixos, uma ilusão

Alguns gráficos põem duas linhas com escalas diferentes, uma à esquerda e outra à direita. Como cada escala pode ser esticada à vontade, é possível fazer duas séries quaisquer "andarem juntas" ou se cruzarem em um ponto dramático. O cruzamento não significa nada: depende só das escalas escolhidas.

**Defesa:** desconfie de conclusões tiradas da forma das linhas em gráficos de dois eixos. Veja também a aula [Correlação não é causa](/trilhas/estatistica-para-ler-o-brasil/correlacao-nao-e-causa).

## 7. O mapa que pinta terra, não gente

Em um mapa eleitoral colorido por município, a cor ocupa a **área** do município. Um município enorme e pouco povoado aparece muito mais que um bairro de capital com dez vezes mais eleitores. O mapa pode ficar quase todo de uma cor e o resultado da eleição ser o contrário.

**Defesa:** em mapas, procure os números de população ou de votos. Território não vota.

## 8. A pizza impossível e o desenho inflado

- Um gráfico de setores só vale se as fatias somam 100% e são partes de um mesmo todo. Perguntas em que a pessoa pode marcar várias respostas não cabem em pizza.
- Gráficos em três dimensões deformam as fatias: a que fica na frente parece maior.
- Figuras que crescem em altura **e** em largura para representar o dobro de um valor ocupam quatro vezes mais espaço.

## A lista de bolso

1. Qual é o título, e ele corresponde ao que os eixos mostram?
2. Onde começa cada eixo? Há mais de um?
3. Que período foi escolhido? O que veio antes?
4. É total ou é taxa? É dado do período ou acumulado?
5. Valores em dinheiro foram corrigidos?
6. Qual é a fonte? Dá para achar o dado original?

Quando um gráfico vier sem fonte, sem data e sem números nos eixos, trate-o como o que ele é: um desenho.

## Para praticar

1. Uma cidade de 400 mil habitantes registrou 60 mortes no trânsito; outra, de 80 mil, registrou 20. Calcule as taxas por 100 mil habitantes. Qual tem o trânsito mais letal?
2. Um governo mostra que "o total de vacinas aplicadas desde janeiro não para de crescer". Que dado você pediria?
3. Procure em um jornal ou rede social um gráfico de barras e verifique onde começa o eixo. Refaça o desenho, à mão, começando no zero. A impressão muda?

**Respostas:** 1) 15 e 25 por 100 mil; a cidade menor. 2) As doses aplicadas por semana ou por mês, e a cobertura (parte da população vacinada).

---
titulo: "Histogramas e infográficos"
resumo: "Ler dados agrupados em faixas, calcular porcentagens e estimar a média por classes, e não se perder nos ícones e legendas de um infográfico."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 2.2, Histograms, Frequency Polygons, and Time Series Graphs"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-2-histograms-frequency-polygons-and-time-series-graphs"
  - titulo: "Introductory Statistics 2e, seção 2.1, Stem-and-Leaf Graphs, Line Graphs, and Bar Graphs"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-1-stem-and-leaf-graphs-stemplots-line-graphs-and-bar-graphs"
  - titulo: "Pirâmide etária"
    autor: "IBGE Educa"
    url: "https://educa.ibge.gov.br/jovens/conheca-o-brasil/populacao/18318-piramide-etaria.html"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Num histograma com classes de mesma largura, o que a altura de cada coluna mostra?"
    opcoes: ["O valor de cada pessoa da pesquisa", "A frequência da classe", "O ponto médio da classe", "A amplitude dos dados"]
    resposta: 1
    explicacao: "Cada coluna é uma faixa de valores. A altura diz quantos dados caíram naquela faixa: a frequência."
  - pergunta: "Um histograma tem as classes 0 ⊢ 10 (4 pessoas), 10 ⊢ 20 (6 pessoas) e 20 ⊢ 30 (10 pessoas). Que porcentagem fica abaixo de 20?"
    opcoes: ["30%", "20%", "60%", "50%"]
    resposta: 3
    explicacao: "Abaixo de 20 estão as duas primeiras classes: 4 + 6 = 10 pessoas. O total é 20. 10 ÷ 20 = 50%."
  - pergunta: "Qual é o ponto médio da classe 40 ⊢ 60?"
    opcoes: ["50", "40", "60", "20"]
    resposta: 0
    explicacao: "O ponto médio é o meio da faixa: (40 + 60) ÷ 2 = 50. O 20 é a largura da classe."
  - pergunta: "Num infográfico, cada ícone de casa vale 200 moradias. Uma cidade aparece com três ícones e meio. Quantas moradias ela tem?"
    opcoes: ["350", "600", "700", "3.500"]
    resposta: 2
    explicacao: "Três ícones valem 3 × 200 = 600. Meio ícone vale 100. Ao todo, 700 moradias."
---

```provocacao
Um gráfico mostra que, num bairro, 15 trabalhadores gastam entre 20 e 40 minutos para chegar ao trabalho. Dá para saber quantos gastam exatamente 30 minutos? Pense um pouco antes de ler: a resposta diz muito sobre o que um histograma mostra e o que ele esconde.
```

## O que você vai aprender

Ao fim desta aula você vai saber ler um histograma (o gráfico de colunas coladas para dados agrupados em faixas), calcular porcentagens a partir dele, estimar a média usando o ponto médio de cada faixa e ler um infográfico sem cair nas armadilhas de ícones, escalas e legendas.

## Quando os dados viram faixas

Imagine uma pesquisa com 50 trabalhadores de um bairro. Cada um diz quantos minutos gasta para chegar ao trabalho. Aparecem 12, 17, 23, 35, 41, 58, 64, 90 e muitos outros valores. Uma lista com 50 números é difícil de ler.

A saída é juntar os valores em **faixas**, que em estatística se chamam **classes**. Por exemplo: de 0 a 20 minutos, de 20 a 40, de 40 a 60, e assim por diante. Depois, conta-se quantas pessoas caem em cada faixa. Esse número é a **frequência** da classe.

Os números abaixo são um exemplo para a aula:

| Tempo de deslocamento (min) | Trabalhadores |
| --- | --- |
| 0 ⊢ 20 | 8 |
| 20 ⊢ 40 | 15 |
| 40 ⊢ 60 | 12 |
| 60 ⊢ 80 | 10 |
| 80 ⊢ 100 | 5 |
| Total | 50 |

O símbolo ⊢ tem uma regra. Em 20 ⊢ 40, o 20 **entra** na classe e o 40 **não entra**. Quem gasta exatamente 40 minutos fica na classe 40 ⊢ 60. Assim, cada valor cai numa classe só.

## O histograma

O **histograma** é o gráfico dessa tabela. No eixo deitado ficam as classes, uma ao lado da outra, sem espaço entre elas. Em cada classe sobe uma coluna. Quando todas as classes têm a mesma largura, a altura da coluna é a frequência.

No exemplo, o desenho teria cinco colunas coladas. A mais alta é a de 20 ⊢ 40 (15 pessoas). Depois vêm 40 ⊢ 60 (12), 60 ⊢ 80 (10), 0 ⊢ 20 (8) e, a mais baixa, 80 ⊢ 100 (5).

Por que as colunas ficam coladas? Porque o tempo é uma medida contínua: entre 39 e 40 minutos não há buraco. No gráfico de barras comum, as categorias são separadas (cidades, partidos, produtos), e as barras também.

Agora volte à provocação. O histograma diz que 15 pessoas estão entre 20 e 40 minutos. Ele **não** diz como elas se espalham dentro da faixa. Podem ser todas de 21 minutos ou todas de 39. Ao agrupar, ganha-se clareza e perde-se o valor de cada pessoa.

## O que dá para tirar de um histograma

**Porcentagens.** Quantos gastam menos de 40 minutos? As duas primeiras classes: 8 + 15 = 23 pessoas, de 50. Isso é 23 ÷ 50 = 46%.

**Frequência acumulada.** É ir somando as classes. No exemplo: 8, depois 23, depois 35, 45 e 50. Ela responde perguntas como "quantos gastam menos de 60 minutos?" (35).

**Classe modal.** É a classe de maior frequência: 20 ⊢ 40.

**Classe da mediana.** Com 50 dados, a mediana fica entre o 25º e o 26º valor, em ordem. A acumulada chega a 23 na segunda classe e a 35 na terceira. Então os dois valores do meio estão em 40 ⊢ 60.

**Média estimada.** Como os valores exatos se perderam, usa-se o **ponto médio** de cada classe, como se todo mundo da faixa estivesse no meio dela.

```formula
média estimada = soma de (ponto médio × frequência) ÷ total
cada classe é trocada pelo seu ponto médio, o meio da faixa, que pesa tanto quanto a sua frequência
é uma estimativa: a média verdadeira dos dados pode ser um pouco diferente
```

Os pontos médios são 10, 30, 50, 70 e 90. A conta fica: 10 × 8 + 30 × 15 + 50 × 12 + 70 × 10 + 90 × 5 = 80 + 450 + 600 + 700 + 450 = 2.280. Dividindo pelos 50 trabalhadores: 2.280 ÷ 50 = 45,6 minutos.

**Classes de largura diferente.** Se uma classe for duas vezes mais larga que as outras, a coluna dela engana. Nesse caso, quem mostra a frequência é a **área** da coluna, e não a altura. Quando a prova fizer isso, ela costuma avisar no texto. Leia a legenda.

## O infográfico

Um **infográfico** junta números, desenhos, mapas e pequenos gráficos numa mesma peça. É comum em jornais, campanhas de saúde e relatórios. A prova gosta dele porque obriga a juntar informações espalhadas.

Antes de fazer qualquer conta, procure quatro coisas:

1. **A unidade.** Mil pessoas? Porcentagem? Reais? Toneladas?
2. **A legenda.** O que cada cor e cada ícone querem dizer.
3. **O valor de cada ícone.** No pictograma, um desenho pode valer 200 casas, e meio desenho, 100.
4. **De onde e de quando são os dados.** Um número de 2010 não diz como está hoje.

Um cuidado com ícones: se um desenho é duas vezes mais alto e duas vezes mais largo que outro, ele parece quatro vezes maior, mas pode representar só o dobro. Confie no número escrito, não no tamanho do desenho.

```navidareal
A pirâmide etária, que o IBGE usa para mostrar a idade da população, é feita de dois histogramas deitados. As faixas de idade ficam empilhadas na vertical, dos mais novos embaixo aos mais velhos em cima. As barras dos homens saem para um lado e as das mulheres para o outro. A base larga mostra muitos jovens. Uma pirâmide que vai ficando estreita embaixo mostra que nascem menos crianças e que a população envelhece.
```

```verificar
Num histograma, a classe 150 ⊢ 160 cm inclui uma pessoa com exatamente 160 cm?
- Sim, porque 160 aparece na classe
+ Não: o 160 fica na classe seguinte, 160 ⊢ 170
- Depende de quem fez o gráfico, não há regra
> No símbolo ⊢, o número da esquerda entra na classe e o da direita não. Assim cada valor cai em uma classe só.
```

## Exemplo resolvido

**Use a tabela dos 50 trabalhadores. Calcule: (a) a porcentagem dos que gastam pelo menos 60 minutos; (b) a média estimada do tempo; (c) a classe em que está a mediana.**

1. **(a) Quem gasta pelo menos 60 minutos?** As classes 60 ⊢ 80 e 80 ⊢ 100, porque o 60 entra na classe 60 ⊢ 80. São 10 + 5 = 15 pessoas.
2. 15 ÷ 50 = 0,30 = 30%.
3. **(b) Pontos médios:** 10, 30, 50, 70 e 90. Multiplique cada um pela frequência e some: 80 + 450 + 600 + 700 + 450 = 2.280.
4. Divida pelo total: 2.280 ÷ 50 = 45,6 minutos.
5. **(c) Mediana:** o 25º e o 26º valores. Frequência acumulada: 8, 23, 35. O 23º valor fecha a segunda classe; do 24º ao 35º, os valores estão em 40 ⊢ 60. A mediana está nessa classe.

Confira: 46% gastam menos de 40 minutos, 30% gastam 60 ou mais, e os 24% que faltam (12 de 50) estão em 40 ⊢ 60. 46% + 24% + 30% = 100%.

## Como isso cai no ENEM

- **Formatos:** histogramas de idade, renda, altura, consumo de água ou de energia; infográficos de campanhas de saúde, de meio ambiente e de transporte, com ícones, mapas e porcentagens. A questão pede uma porcentagem por faixa, a classe com mais casos, uma média estimada ou uma conclusão que o gráfico sustenta.
- **Habilidades:** H24 (fazer inferências a partir de gráficos ou tabelas), H25 (resolver problemas com dados de tabelas ou gráficos) e H26 (analisar gráficos ou tabelas para construir argumentos).
- **O que mais caiu:** nas provas de 2022 e 2023, classificadas pelo instituto, de 81 questões de Matemática, nenhuma aparece na contagem com este tópico como principal. Mas a H24 teve 4 questões (4,9%) e a H25 também 4 (4,9%), e muitas delas trazem gráficos e infográficos. São só duas provas: é uma tendência, não uma promessa.
- **Armadilhas:**
  - Errar a fronteira da classe: em a ⊢ b, o b fica na classe seguinte.
  - Ler o valor de uma classe só quando a pergunta pede "pelo menos" ou "no máximo", que juntam várias.
  - Tratar a média estimada como exata.
  - Julgar pelo tamanho do ícone ou da coluna, e não pelo número.
  - Esquecer a unidade da legenda (mil, milhão, porcentagem).

## Questão comentada

**Texto-base.** Uma unidade básica de saúde registrou a massa de 40 bebês nascidos num mês. Os dados foram organizados no histograma descrito na tabela abaixo.

| Massa ao nascer (kg) | Bebês |
| --- | --- |
| 2,0 ⊢ 2,5 | 3 |
| 2,5 ⊢ 3,0 | 9 |
| 3,0 ⊢ 3,5 | 16 |
| 3,5 ⊢ 4,0 | 10 |
| 4,0 ⊢ 4,5 | 2 |

**Comando.** A porcentagem desses bebês que nasceram com pelo menos 3,0 kg é

A) 40%.
B) 7,5%.
C) 30%.
D) 70%.
E) 65%.

**Resolução.**

1. "Pelo menos 3,0 kg" inclui o 3,0. Pela regra do símbolo ⊢, o 3,0 está na classe 3,0 ⊢ 3,5.
2. Some essa classe e as seguintes: 16 + 10 + 2 = 28 bebês.
3. 28 ÷ 40 = 0,7 = 70%.

**Gabarito: D.**

**Por que as outras não:**

- A) 40% é 16 ÷ 40: só a classe 3,0 ⊢ 3,5. "Pelo menos" junta também as classes acima.
- B) 7,5% é 3 ÷ 40, a primeira classe. Ela fica abaixo de 3,0 kg.
- C) 30% é (3 + 9) ÷ 40: os que nasceram abaixo de 3,0 kg, o contrário do que se pede.
- E) 65% é (16 + 10) ÷ 40: faltou a última classe, 4,0 ⊢ 4,5, com 2 bebês.

```realidade
Pense numa medida da sua vida que dá para agrupar em faixas: o tempo até o trabalho ou a escola, o valor das contas de luz do ano, as horas de sono da semana. Que faixas você usaria? Qual seria a classe com mais casos?
```

## Resumo

- Histograma: colunas coladas, uma para cada faixa (classe) de uma medida contínua.
- Em a ⊢ b, o a entra e o b fica de fora.
- Com classes de mesma largura, a altura é a frequência. Com larguras diferentes, vale a área.
- Média estimada: ponto médio × frequência, somados, divididos pelo total.
- Infográfico: unidade, legenda, valor do ícone e data, antes de qualquer conta.

## Para aprofundar

- [Gráficos de barras, colunas, linhas e setores](/trilhas/enem-matematica-estatistica-e-probabilidade/graficos-de-barras-linhas-e-setores)
- [Leitura de tabelas](/trilhas/enem-matematica-estatistica-e-probabilidade/leitura-de-tabelas)
- [Média, mediana e moda](/trilhas/enem-matematica-estatistica-e-probabilidade/media-mediana-e-moda)
- [Como ler um gráfico sem ser enganado](/trilhas/estatistica-para-ler-o-brasil/como-ler-um-grafico-sem-ser-enganado)

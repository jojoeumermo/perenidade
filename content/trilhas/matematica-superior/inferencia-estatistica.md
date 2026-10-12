---
titulo: "Inferência estatística"
resumo: "Da amostra para a população: intervalos de confiança, testes de hipóteses, o valor-p e os seus abusos."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 8.1, A Single Population Mean using the Normal Distribution"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/8-1-a-single-population-mean-using-the-normal-distribution"
  - titulo: "Introductory Statistics 2e, seção 9.1, Null and Alternative Hypotheses"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/9-1-null-and-alternative-hypotheses"
  - titulo: "Introductory Statistics 2e, seção 9.2, Outcomes and the Type I and Type II Errors"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/9-2-outcomes-and-the-type-i-and-type-ii-errors"
  - titulo: "The ASA Statement on p-Values: Context, Process, and Purpose (The American Statistician)"
    autor: "Ronald L. Wasserstein e Nicole A. Lazar"
    ano: "2016"
quiz:
  - pergunta: "O que é o erro padrão da média?"
    opcoes: ["O desvio padrão dos dados", "O desvio padrão dividido pela raiz do tamanho da amostra", "O maior erro possível"]
    resposta: 1
    explicacao: "Ele mede quanto a média de uma amostra oscila de uma amostra para outra, e diminui com amostras maiores."
  - pergunta: "Um valor-p de 0,03 significa que:"
    opcoes: ["há 3% de chance de a hipótese nula ser verdadeira", "se a hipótese nula fosse verdadeira, um resultado tão extremo quanto o observado ocorreria em cerca de 3% das vezes", "o efeito é 97% importante"]
    resposta: 1
    explicacao: "O valor-p é calculado supondo a hipótese nula. Ele não é a probabilidade de ela ser verdadeira nem mede o tamanho do efeito."
  - pergunta: "Um pesquisador faz 20 testes independentes, com nível de 5%, em situações em que não há efeito nenhum. Quantos resultados 'significativos' ele deve esperar?"
    opcoes: ["Nenhum", "Cerca de 1", "Cerca de 5"]
    resposta: 1
    explicacao: "5% de 20 é 1. Testar muitas coisas e relatar só a que 'deu certo' fabrica descobertas falsas."
---

## O problema

Quase nunca se pode observar a população inteira. Observa-se uma [amostra](/trilhas/estatistica-para-ler-o-brasil/o-que-e-uma-pesquisa-por-amostragem) e, a partir dela, tira-se uma conclusão sobre o todo. A **inferência estatística** é o conjunto de métodos para fazer isso dizendo, ao mesmo tempo, **quão incerta** é a conclusão.

Tudo se apoia em uma ideia: se a amostra foi sorteada, a diferença entre ela e a população é obra do acaso, e o acaso tem leis, vistas na aula de [probabilidade e distribuições](/trilhas/matematica-superior/probabilidade-e-distribuicoes).

## O erro padrão

Sorteie uma amostra de 100 pessoas e calcule a altura média. Sorteie outra: a média será um pouco diferente. Quanto as médias oscilam de amostra para amostra?

**erro padrão = desvio padrão ÷ √n**

Se o desvio padrão das alturas é de 10 cm, as médias de amostras de 100 pessoas oscilam com erro padrão de 10 ÷ 10 = 1 cm. Com 400 pessoas, 0,5 cm. A precisão cresce com a **raiz** do tamanho da amostra: para dobrá-la, é preciso quadruplicar a amostra.

## Intervalo de confiança

Pelo teorema central do limite, a média amostral se distribui de modo aproximadamente normal em torno da média verdadeira. Como 95% de uma normal está a até 1,96 desvio padrão do centro:

**intervalo de 95% = média da amostra ± 1,96 × erro padrão**

Uma amostra de 100 pessoas tem média de 70 kg, com desvio padrão de 20 kg:

```conta
erro padrão = 20 ÷ √100 = 2
70 ± 1,96 × 2 = 70 ± 3,92
= intervalo de 95%: de 66,1 kg a 73,9 kg
```

Para uma **proporção** p, o erro padrão é √[p(1 − p) ÷ n]. Em uma pesquisa com 1.000 entrevistados em que 40% apoiam uma proposta:

```conta
√(0,4 × 0,6 ÷ 1.000) ≈ 0,0155
1,96 × 0,0155 ≈ 0,030
= 40%, com margem de 3 pontos: de 37% a 43%
```

É a margem de erro das pesquisas.

**Como interpretar.** "95% de confiança" não quer dizer que há 95% de probabilidade de a média verdadeira estar naquele intervalo específico. Quer dizer que o **método**, aplicado a muitas amostras, produz intervalos que contêm o valor verdadeiro em cerca de 95% das vezes. O seu intervalo pode ser um dos 5% que erram, e não há como saber.

## Teste de hipóteses

Outra pergunta frequente: o que eu observei pode ser só acaso?

O raciocínio lembra a demonstração por absurdo, com probabilidades no lugar de certezas.

1. Formula-se a **hipótese nula** (H0): "não há efeito", "não há diferença", "a moeda é honesta".
2. Calcula-se, **supondo H0 verdadeira**, a probabilidade de obter um resultado tão extremo quanto o observado, ou mais. É o **valor-p**.
3. Se o valor-p é muito pequeno, o resultado seria uma coincidência rara sob H0, e rejeita-se H0. O limite convencional é 5%, o **nível de significância**.

**Exemplo.** Uma moeda deu 60 caras em 100 lançamentos. É viciada?

Sob H0 (moeda honesta), o número de caras tem média 50 e desvio padrão 5. O resultado 60 está a 2 desvios padrão. A probabilidade de um afastamento desse tamanho ou maior, para qualquer dos lados, é de cerca de 4,6%.

O valor-p é 0,046: abaixo de 5%. Rejeita-se H0, por pouco. Diz-se que o resultado é "estatisticamente significativo".

Conta-se que o método nasceu de um chá. Nos anos 1920, uma colega do estatístico inglês Ronald Fisher afirmou que sabia dizer, pelo gosto, se o leite tinha sido posto na xícara antes ou depois do chá. Fisher desenhou um experimento com xícaras apresentadas em ordem sorteada e calculou a probabilidade de ela acertar todas por puro acaso. O caso é contado no seu livro *The Design of Experiments*, de 1935.

## Dois tipos de erro

| | H0 é verdadeira | H0 é falsa |
| --- | --- | --- |
| Rejeita-se H0 | **erro tipo I** (alarme falso) | acerto |
| Não se rejeita H0 | acerto | **erro tipo II** (efeito não detectado) |

O nível de significância é a probabilidade de erro tipo I que se aceita correr. Reduzi-lo aumenta o risco do erro tipo II, a menos que a amostra cresça.

Qual erro é pior depende do caso. Em um exame de triagem para uma doença grave, deixar passar um doente (tipo II) costuma ser pior que um alarme falso. Em um tribunal, condenar um inocente (tipo I) é considerado pior que absolver um culpado. A escolha dos limites é uma decisão sobre **consequências**, e não uma questão puramente técnica.

```verificar
Um estudo testa um remédio novo contra um placebo e obtém valor-p de 0,40. O que se pode concluir?
- Que o remédio não funciona
+ Que o estudo não encontrou evidência suficiente de efeito
- Que há 40% de chance de o remédio funcionar
> 'Não rejeitar' a hipótese nula não é o mesmo que prová-la. A amostra pode ter sido pequena demais.
```

## O que o valor-p não é

O valor-p é provavelmente o número mais mal compreendido da ciência. Em 2016, a Associação Americana de Estatística publicou uma declaração para corrigir os abusos. Entre os pontos:

- o valor-p **não** é a probabilidade de a hipótese nula ser verdadeira;
- ele **não** mede o tamanho nem a importância de um efeito;
- decisões científicas ou políticas **não** devem depender só de o valor-p ter cruzado uma linha.

**Significativo não é importante.** Com uma amostra enorme, uma diferença minúscula, sem relevância prática nenhuma, dá valor-p baixíssimo. "Estatisticamente significativo" quer dizer apenas "dificilmente é só acaso". É preciso olhar o **tamanho do efeito** e o intervalo de confiança.

**Muitos testes, um resultado.** Com nível de 5%, um em cada vinte testes de efeitos que não existem dará "significativo". Quem testa vinte coisas e publica só a que deu certo fabrica uma descoberta. Variações desse procedimento (experimentar recortes dos dados, trocar a variável medida, parar a coleta quando o resultado aparece) são uma das causas de tantos resultados publicados que depois ninguém consegue repetir.

**Correlação.** Um teste pode mostrar que uma associação não é fruto do acaso. Ele não mostra que há causa. Veja [Correlação não é causa](/trilhas/estatistica-para-ler-o-brasil/correlacao-nao-e-causa).

## A origem que não se costuma contar

Boa parte das ferramentas desta aula foi criada, entre o fim do século XIX e o começo do XX, por três ingleses: Francis Galton (correlação e regressão), Karl Pearson (o coeficiente de correlação e o teste qui-quadrado) e Ronald Fisher (análise de variância, testes de significância, desenho de experimentos).

Os três foram também defensores da **eugenia**, a doutrina que pretendia "melhorar" a população humana controlando quem deveria ter filhos. Galton criou a palavra, em 1883. Pearson ocupou a primeira cátedra de eugenia da Universidade de Londres, financiada pela herança de Galton; Fisher o sucedeu nela. Parte dos métodos nasceu do esforço de medir e hierarquizar seres humanos, e a eugenia serviu de justificativa a leis de esterilização forçada e ao racismo de Estado em vários países.

Os métodos são válidos: valem pelo que se demonstra, não por quem os criou, e hoje servem para testar vacinas e denunciar desigualdades. Mas a história ensina duas coisas. A primeira é que as perguntas que uma ciência faz não são neutras: dependem de quem pergunta e para quê. A segunda é que um número calculado corretamente pode estar a serviço de uma premissa falsa. Saber estatística é também saber perguntar o que se decidiu medir, e por quê.

## Para praticar

1. O desvio padrão de uma medida é 20 e a amostra tem 100 elementos. Qual é o erro padrão da média?
2. Com os dados do exercício 1 e média amostral de 70, calcule o intervalo de confiança de 95%.
3. Em uma amostra de 400 pessoas, 50% aprovam uma medida. Qual é a margem de erro, com 95% de confiança?
4. Uma moeda deu 55 caras em 100 lançamentos. A quantos desvios padrão da média esse resultado está? Há motivo para suspeitar da moeda?
5. Um estudo com 2 milhões de pessoas encontra uma diferença "altamente significativa" de 0,1 kg no peso médio entre dois grupos. O que você perguntaria?
6. Em um teste de gravidez, o que seriam o erro tipo I e o erro tipo II, tomando como hipótese nula "não está grávida"?

**Respostas:** 1) 2. 2) 70 ± 3,92: de 66,08 a 73,92. 3) 1,96 × √(0,25 ÷ 400) = 1,96 × 0,025 ≈ 4,9 pontos. 4) A 1 desvio padrão; não, é um resultado comum. 5) Se a diferença tem alguma importância prática: com amostras enormes, quase qualquer diferença é significativa. 6) Tipo I: o teste dá positivo sem haver gravidez; tipo II: dá negativo havendo gravidez.

---
titulo: "Média, mediana e moda"
resumo: "As três medidas que resumem uma lista de números: como calcular cada uma, inclusive em tabela de frequência, e quando cada uma conta a verdade."
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
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Qual é a mediana da lista 3, 8, 5, 10, 4?"
    opcoes: ["8", "5", "6", "4"]
    resposta: 1
    explicacao: "Primeiro ordene: 3, 4, 5, 8, 10. São cinco números; o do meio é o terceiro, 5. O 6 é a média (30 ÷ 5), não a mediana."
  - pergunta: "Qual é a moda da lista 2, 3, 3, 5, 7, 7, 7, 9?"
    opcoes: ["7", "3", "6", "5"]
    resposta: 0
    explicacao: "Moda é o valor que mais se repete. O 7 aparece três vezes; o 3, duas; os outros, uma."
  - pergunta: "Uma estudante tirou 6, 7, 5 e 8 em quatro provas. Qual é a média dela?"
    opcoes: ["6", "7", "6,25", "6,5"]
    resposta: 3
    explicacao: "Some as notas: 6 + 7 + 5 + 8 = 26. Divida pela quantidade de provas: 26 ÷ 4 = 6,5."
  - pergunta: "Um estudante tem média 6 em três provas. Quanto precisa tirar na quarta para a média das quatro ser 7?"
    opcoes: ["8", "7", "10", "9"]
    resposta: 2
    explicacao: "Para a média de quatro provas ser 7, a soma precisa ser 4 × 7 = 28. Ele já tem 3 × 6 = 18. Falta 28 − 18 = 10."
---

```provocacao
Numa padaria, cinco funcionários ganham R$ 1.600 por mês e o dono tira R$ 12.000. O dono diz que "o salário médio da padaria passa de R$ 3.300". Ele está mentindo? E esse número conta como vivem os funcionários?
```

## O que você vai aprender

Ao fim desta aula você vai saber calcular a média, a mediana e a moda de uma lista de números e de uma tabela de frequência. Também vai saber escolher a medida que melhor representa um grupo e achar o valor que falta para chegar a uma média.

## Um número no lugar de muitos

Quando há muitos números, a gente quer um só que resuma todos. Quanto ganha, em geral, quem trabalha nesta empresa? Quanto tempo, em geral, se gasta no ônibus? Esse número que resume é chamado de **medida de tendência central**: ele mostra em torno de onde os dados ficam.

O ENEM cobra três: a média, a mediana e a moda. Cada uma responde a uma pergunta diferente. Por isso, numa mesma lista, elas podem dar valores bem diferentes.

## Média: dividir igualmente

A média aritmética é o que cada um teria se o total fosse dividido em partes iguais.

```formula
média = soma dos valores ÷ quantidade de valores
some todos os números e divida pela quantidade de números que você somou
```

Volte à padaria. A soma dos salários é 5 × 1.600 + 12.000 = 8.000 + 12.000 = 20.000. São 6 pessoas. A média é 20.000 ÷ 6, perto de R$ 3.333. O dono não errou a conta.

Mas repare: nenhum funcionário ganha perto disso. Um valor muito alto puxa a média para cima. Um valor muito baixo puxa para baixo. Esse valor fora do padrão se chama **valor extremo**.

A média tem um truque útil na prova: **média vezes quantidade dá a soma**. Se a média de 5 dias foi 400, a soma dos 5 dias foi 2.000. Com isso se acha o valor que falta para chegar a uma meta, como no quiz desta aula.

## Mediana: o valor do meio

A mediana é o valor que fica no meio da lista **depois de ordenada**. Metade dos dados fica abaixo dela e metade acima.

- Quantidade ímpar de valores: a mediana é o do meio. Em 3, 4, 5, 8, 10, é o 5.
- Quantidade par: há dois valores no meio. A mediana é a média deles. Em 2, 4, 6, 9, é (4 + 6) ÷ 2 = 5.

Na padaria, a lista ordenada é 1.600, 1.600, 1.600, 1.600, 1.600, 12.000. Os dois do meio são 1.600 e 1.600. A mediana é R$ 1.600. Ela não liga para o tamanho do salário do dono: só para a posição dele na fila.

Com muitos valores, a posição do meio é (n + 1) ÷ 2, em que n é a quantidade. Com 7 valores, é a 4ª posição. Com 8, fica entre a 4ª e a 5ª.

## Moda: o que mais aparece

A moda é o valor que mais se repete. Na padaria, é R$ 1.600. Uma lista pode ter duas modas, ou nenhuma, quando todos aparecem o mesmo número de vezes.

A moda é a única das três que serve para dados que não são números. Qual tamanho de calçado mais sai? Qual cor de camiseta? Aí só a moda responde.

## Média em tabela de frequência

A prova raramente dá a lista solta. Ela dá uma tabela que diz quantas vezes cada valor aparece. Essa quantidade se chama **frequência**.

Para a média, multiplique cada valor pela frequência dele, some tudo e divida pelo total de frequências. Não divida pelo número de linhas da tabela: cada linha representa várias pessoas.

Para a mediana, ache a posição do meio e conte as frequências acumuladas, linha por linha, até chegar nela. O exemplo resolvido mostra o caminho.

```navidareal
Quando o noticiário fala em "renda média" de um grupo, o número inclui quem ganha muito. Num grupo desigual, a média fica acima do que a maior parte das pessoas recebe. Por isso estudos sérios de renda costumam mostrar também a mediana.

Na próxima vez que ouvir uma média, pergunte: há valores extremos nesse grupo? Qual seria a mediana?
```

```verificar
Num grupo de 9 trabalhadores, 8 ganham R$ 2.000 e 1 ganha R$ 11.000. Qual número representa melhor o salário típico do grupo?
- A média, R$ 3.000
+ A mediana, R$ 2.000
- O meio entre o menor e o maior, R$ 6.500
> A média é 27.000 ÷ 9 = 3.000, puxada pelo salário alto. Na lista ordenada, o 5º valor (o do meio) é 2.000: é o que quase todos ganham.
```

## Exemplo resolvido

**Numa rua, 20 famílias responderam quantos filhos têm. O resultado está na tabela. Calcule a média, a mediana e a moda.**

| Número de filhos | Famílias (frequência) |
| --- | --- |
| 0 | 4 |
| 1 | 7 |
| 2 | 5 |
| 3 | 3 |
| 4 | 1 |
| Total | 20 |

1. **Média.** Multiplique cada valor pela frequência: 0 × 4 = 0; 1 × 7 = 7; 2 × 5 = 10; 3 × 3 = 9; 4 × 1 = 4. Some: 0 + 7 + 10 + 9 + 4 = 30 filhos. Divida pelas 20 famílias: 30 ÷ 20 = 1,5.
2. **Mediana.** São 20 valores, uma quantidade par. Os dois do meio são o 10º e o 11º. Conte as frequências acumuladas: as famílias sem filhos ocupam as posições 1 a 4; as com 1 filho, as posições 5 a 11. O 10º e o 11º valem 1. A mediana é (1 + 1) ÷ 2 = 1.
3. **Moda.** A linha com maior frequência é a de 1 filho (7 famílias). A moda é 1.

Confira: a média, 1,5, ficou maior que a mediana, 1. Faz sentido, porque as poucas famílias com 3 e 4 filhos puxam a média para cima.

## Como isso cai no ENEM

- **Formatos:** uma tabela de frequência ou um gráfico com os dados de um grupo (notas, salários, tempos, vendas). A questão pede uma das medidas, compara duas delas, pergunta qual medida usar num critério ou pede o valor que falta para atingir uma média.
- **Habilidades:** H27 (calcular médias, moda, mediana ou dispersão de dados em tabelas de frequência ou gráficos), a principal; H28 (resolver problemas de estatística e probabilidade); H29 (usar estatística e probabilidade para construir argumentos).
- **O que mais caiu:** nas provas de 2022 e 2023, classificadas pelo instituto, 81 questões de Matemática entraram na contagem. Média, mediana e moda foi o tópico com mais questões: 6 (7,4%). A H27 teve 7 questões (8,6%). O objeto inteiro de estatística e probabilidade ficou com 18 (22,2%). São só duas provas: é uma tendência, não uma promessa.
- **Armadilhas:**
  - Achar a mediana sem ordenar a lista.
  - Com quantidade par, pegar só um dos dois valores do meio.
  - Na tabela de frequência, dividir pelo número de linhas em vez do total de frequências.
  - Confundir a moda (o valor) com a frequência dela (quantas vezes aparece).
  - Esquecer que média vezes quantidade dá a soma.

## Questão comentada

**Texto-base.** Uma cooperativa de catadores anotou a massa de material reciclável coletada, em quilogramas, em oito dias de trabalho: 120, 95, 130, 95, 110, 156, 95 e 115. Para planejar o caminhão da semana seguinte, a cooperativa vai usar a mediana desses valores.

**Comando.** A mediana da massa coletada, em quilogramas, é

A) 95.
B) 102,5.
C) 110.
D) 112,5.
E) 114,5.

**Resolução.**

1. Ordene os valores: 95, 95, 95, 110, 115, 120, 130, 156.
2. São 8 valores, uma quantidade par. Os do meio são o 4º e o 5º: 110 e 115.
3. A mediana é a média deles: (110 + 115) ÷ 2 = 225 ÷ 2 = 112,5.

**Gabarito: D.**

**Por que as outras não:**

- A) 95 é a moda, o valor que mais aparece (três vezes). A pergunta pede o valor do meio.
- B) 102,5 é a média do 4º e do 5º valor da lista **sem ordenar** (95 e 110). Ordene antes.
- C) 110 é só o 4º valor da lista ordenada. Com oito valores há dois no meio: tire a média do 4º e do 5º.
- E) 114,5 é a média: a soma é 916 e 916 ÷ 8 = 114,5. O dia de 156 kg puxou a média para cima; a mediana não sente esse puxão.

```realidade
Pense em cinco pessoas da sua família ou do seu trabalho e em quanto tempo cada uma gasta para chegar ao trabalho. Calcule a média e a mediana desses tempos. Elas ficaram parecidas ou distantes? Qual delas conta melhor a vida desse grupo?
```

## Resumo

- Média: some tudo e divida pela quantidade. Média vezes quantidade dá a soma.
- Mediana: ordene e pegue o do meio; com quantidade par, a média dos dois do meio.
- Moda: o valor que mais aparece. Pode haver mais de uma, ou nenhuma.
- Em tabela de frequência, multiplique cada valor pela frequência e divida pelo total de frequências.
- Valores extremos puxam a média, mas quase não mexem na mediana.

## Para aprofundar

- [Estatística: média, mediana e moda](/trilhas/matematica-medio/estatistica-media-mediana-e-moda)
- [Média, mediana e moda (para ler o Brasil)](/trilhas/estatistica-para-ler-o-brasil/media-mediana-e-moda)
- [Desigualdade: o índice de Gini](/trilhas/estatistica-para-ler-o-brasil/desigualdade-o-indice-de-gini)
- [Leitura de gráficos e tabelas](/trilhas/matematica-fundamental/leitura-de-graficos-e-tabelas)
- [Matemática: o que mais cai](/trilhas/enem-por-area/matematica-o-que-mais-cai)

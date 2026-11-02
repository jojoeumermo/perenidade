---
titulo: "Amplitude, variância e desvio padrão"
resumo: "Duas turmas com a mesma média podem ser muito diferentes: medir o quanto os dados se espalham e decidir quem é mais regular."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 2.7, Measures of the Spread of the Data"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-7-measures-of-the-spread-of-the-data"
  - titulo: "Introductory Statistics 2e, seção 2.5, Measures of the Center of the Data"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-5-measures-of-the-center-of-the-data"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Qual é a amplitude dos dados 3, 7, 12, 5 e 9?"
    opcoes: ["9", "12", "7,2", "3"]
    resposta: 0
    explicacao: "Amplitude é o maior menos o menor: 12 − 3 = 9. O 7,2 é a média (36 ÷ 5)."
  - pergunta: "Qual é a variância das notas 4, 6 e 8, dividindo pelo número de dados?"
    opcoes: ["4", "2", "8/3", "8"]
    resposta: 2
    explicacao: "Média 6. Desvios: −2, 0 e 2. Quadrados: 4, 0 e 4, que somam 8. Variância: 8 ÷ 3 = 8/3."
  - pergunta: "A variância de um conjunto de alturas é 25 cm². Qual é o desvio padrão?"
    opcoes: ["625 cm", "12,5 cm", "25 cm", "5 cm"]
    resposta: 3
    explicacao: "O desvio padrão é a raiz quadrada da variância: √25 = 5 cm. Ele volta à unidade dos dados."
  - pergunta: "Dois grupos têm a mesma média. O grupo A tem desvio padrão 2, e o grupo B, 9. Qual é o mais homogêneo, com valores mais parecidos entre si?"
    opcoes: ["B", "A", "Os dois, porque a média é igual", "Não dá para saber sem a amplitude"]
    resposta: 1
    explicacao: "Quanto menor o desvio padrão, mais perto da média ficam os valores. O grupo A é o mais homogêneo."
---

```provocacao
Duas turmas fizeram a mesma prova. Na turma A, as cinco notas foram 6, 6, 6, 6 e 6. Na turma B, foram 2, 4, 6, 8 e 10. As duas têm média 6. Dá para dizer que as turmas foram iguais?
```

## O que você vai aprender

Ao fim desta aula você vai saber medir o quanto os dados se espalham em torno da média, com a amplitude, a variância e o desvio padrão. E vai saber usar essas medidas para decidir o que é mais regular: um atleta, um produtor, uma linha de ônibus.

## A média não conta tudo

A média resume um conjunto de números num só. Mas ela esconde uma coisa: se os números estão todos perto dela ou muito espalhados.

Na provocação, a turma A é toda igual. Na turma B há quem tirou 2 e quem tirou 10. A média é a mesma, 6, mas a história é outra. Para contar essa outra parte, existem as **medidas de dispersão**. Dispersão quer dizer espalhamento.

## Amplitude: o jeito mais rápido

A **amplitude** é o maior valor menos o menor.

- Turma A: 6 − 6 = 0.
- Turma B: 10 − 2 = 8.

É fácil de calcular, mas olha só para os dois extremos. Um único valor muito diferente muda tudo. As notas 5, 6, 6, 6 e 10 têm amplitude 5, embora quase todas sejam 6.

## O desvio: a distância até a média

O **desvio** de um valor é a diferença entre ele e a média: valor − média.

Na turma B, com média 6, os desvios são:

- 2 − 6 = −4
- 4 − 6 = −2
- 6 − 6 = 0
- 8 − 6 = 2
- 10 − 6 = 4

Repare: eles somam zero. Isso sempre acontece, em qualquer conjunto de dados. Os desvios negativos compensam os positivos. Por isso, a média dos desvios não serve para medir nada: daria zero sempre.

A saída é elevar cada desvio ao quadrado. Assim, todos ficam positivos e nada se cancela.

## A variância

A **variância** é a média dos quadrados dos desvios.

```formula
variância = soma de (valor − média)² ÷ número de dados
calcule a média, tire a média de cada valor, eleve cada diferença ao quadrado, some tudo e divida pela quantidade de dados
quanto maior a variância, mais espalhados os valores estão em torno da média
```

Na turma B, os quadrados dos desvios são 16, 4, 0, 4 e 16. A soma é 40. Dividindo pelos 5 dados: a variância é 8. Na turma A, todos os desvios são zero, e a variância também.

Um aviso sobre a divisão. Alguns livros e calculadoras, quando os dados são uma amostra de um grupo maior, dividem por "número de dados menos 1". As questões do ENEM costumam dizer qual conta usar ou dar a fórmula no texto. Se a questão der a fórmula, siga a dela. Se não der, divida pelo número de dados.

## O desvio padrão

A variância tem um defeito: a unidade fica ao quadrado. Se os dados são em minutos, a variância sai em "minutos ao quadrado", que não quer dizer nada no dia a dia. Para voltar à unidade dos dados, tira-se a raiz quadrada.

```formula
desvio padrão = √variância
é a raiz quadrada da variância e tem a mesma unidade dos dados
lê-se como uma distância típica dos valores até a média
```

Na turma B, o desvio padrão é √8, perto de 2,8 pontos. Na turma A, é 0.

**Como usar na prova.** Quanto **menor** o desvio padrão, mais perto da média os valores ficam. O grupo é mais **homogêneo** (parecido), e o desempenho é mais **regular**. Quanto maior, mais **heterogêneo** (desigual).

Muitas questões não pedem a conta inteira. Elas dão uma tabela com a média e o desvio padrão de cada candidato e pedem uma escolha: "o mais regular", "o de menor variação", ou um critério com duas etapas, como "média de pelo menos tanto e, entre esses, o menor desvio padrão". Nesse caso, aplique as etapas na ordem em que o texto manda.

```navidareal
Uma fábrica de remédios não pode olhar só para a média da dose dos comprimidos. Se a média estiver certa, mas uns comprimidos tiverem dose demais e outros de menos, o remédio falha ou faz mal. Por isso, o controle de qualidade mede também o espalhamento. O mesmo vale para o tempo de espera de um ônibus: uma linha com a mesma média, mas com grande desvio padrão, é a que faz você perder a hora.
```

```verificar
Os desvios em relação à média dos números 2, 4, 6, 8 e 10 somam:
- 40
+ 0
- 6
> Os desvios positivos e negativos sempre se compensam. Por isso a variância usa os quadrados dos desvios.
```

## Exemplo resolvido

**Um morador anotou, em cinco dias, quantos minutos esperou por duas linhas de ônibus. Linha 1: 10, 12, 14, 12 e 12. Linha 2: 4, 20, 6, 18 e 12. Qual linha é mais regular?**

1. **Médias.** Linha 1: (10 + 12 + 14 + 12 + 12) ÷ 5 = 60 ÷ 5 = 12. Linha 2: (4 + 20 + 6 + 18 + 12) ÷ 5 = 60 ÷ 5 = 12. As médias são iguais.
2. **Amplitudes.** Linha 1: 14 − 10 = 4. Linha 2: 20 − 4 = 16.
3. **Desvios da linha 1:** −2, 0, 2, 0, 0. Quadrados: 4, 0, 4, 0, 0. Soma 8. Variância: 8 ÷ 5 = 1,6.
4. **Desvios da linha 2:** −8, 8, −6, 6, 0. Quadrados: 64, 64, 36, 36, 0. Soma 200. Variância: 200 ÷ 5 = 40.
5. **Desvios padrão.** Linha 1: √1,6, perto de 1,3 minuto. Linha 2: √40, perto de 6,3 minutos.
6. **Conclusão.** A linha 1 é muito mais regular: a espera fica perto de 12 minutos quase todo dia.

Confira: os desvios de cada linha somam zero (−2 + 0 + 2 + 0 + 0 = 0 e −8 + 8 − 6 + 6 + 0 = 0). Se não somassem, a média estaria errada.

## Como isso cai no ENEM

- **Formatos:** escolher o atleta, o fornecedor, a máquina ou o funcionário mais regular a partir de uma tabela com médias e desvios padrão; comparar duas turmas ou duas cidades; calcular a variância ou o desvio padrão de poucos números, às vezes com a fórmula no próprio texto.
- **Habilidades:** H27 (calcular médias, moda, mediana ou dispersão de dados em tabelas de frequência ou gráficos), a principal; H28 (resolver problemas de estatística e probabilidade); H29 (usar estatística e probabilidade para construir argumentos).
- **O que mais caiu:** nas provas de 2022 e 2023, classificadas pelo instituto, de 81 questões de Matemática, nenhuma aparece na contagem com este tópico como principal. A H27, que inclui dispersão, teve 7 questões (8,6%), a maior parte de média, mediana e moda. São só duas provas: é uma tendência, não uma promessa.
- **Armadilhas:**
  - Achar que média igual quer dizer conjuntos iguais.
  - Somar os desvios sem elevar ao quadrado (dá zero).
  - Esquecer de tirar a raiz: variância e desvio padrão são coisas diferentes.
  - Escolher o maior desvio padrão como "mais regular". É o contrário.
  - Num critério em duas etapas, aplicar só uma delas.

## Questão comentada

**Texto-base.** Uma cooperativa vai comprar polpa de fruta de um único produtor. Ela levantou a produção semanal de cinco produtores ao longo de vários meses. Os resultados estão na tabela.

| Produtor | Média semanal (kg) | Desvio padrão (kg) |
| --- | --- | --- |
| I | 120 | 15 |
| II | 95 | 4 |
| III | 110 | 6 |
| IV | 130 | 20 |
| V | 100 | 8 |

A cooperativa decidiu escolher, entre os produtores com média semanal de pelo menos 100 kg, aquele com a produção mais regular.

**Comando.** O produtor escolhido será o

A) I.
B) II.
C) III.
D) IV.
E) V.

**Resolução.**

1. Primeira etapa: média de pelo menos 100 kg. Ficam I (120), III (110), IV (130) e V (100). O II, com 95, sai.
2. Segunda etapa: produção mais regular é o menor desvio padrão. Entre os que ficaram: I tem 15, III tem 6, IV tem 20 e V tem 8.
3. O menor é 6, do produtor III.

**Gabarito: C.**

**Por que as outras não:**

- A) O produtor I cumpre a média, mas o desvio padrão dele (15) é bem maior que o do III.
- B) O produtor II tem o menor desvio padrão da tabela, mas a média dele (95 kg) fica abaixo de 100. Ele sai na primeira etapa.
- D) O produtor IV tem a maior média, mas também o maior desvio padrão: é o menos regular.
- E) O produtor V cumpre a média (100 kg entra em "pelo menos 100"), mas o desvio padrão dele (8) é maior que o do III (6).

```realidade
Pense em algo da sua semana que varia de um dia para o outro: o tempo de espera do ônibus, as horas de sono, o gasto com comida. Anote os valores de cinco dias. Calcule a média e a amplitude. A sua rotina é mais parecida com a turma A ou com a turma B da provocação?
```

## Resumo

- A média não mostra o espalhamento. Para isso existem as medidas de dispersão.
- Amplitude: maior menos menor. Rápida, mas olha só os extremos.
- Desvio: valor menos média. Os desvios sempre somam zero.
- Variância: média dos quadrados dos desvios.
- Desvio padrão: raiz da variância, na mesma unidade dos dados.
- Menor desvio padrão: mais regular, mais homogêneo.

## Para aprofundar

- [Média, mediana e moda](/trilhas/enem-matematica-estatistica-e-probabilidade/media-mediana-e-moda)
- [Média ponderada](/trilhas/enem-matematica-estatistica-e-probabilidade/media-ponderada)
- [Estatística: média, mediana e moda](/trilhas/matematica-medio/estatistica-media-mediana-e-moda)
- [Desigualdade: o índice de Gini](/trilhas/estatistica-para-ler-o-brasil/desigualdade-o-indice-de-gini)

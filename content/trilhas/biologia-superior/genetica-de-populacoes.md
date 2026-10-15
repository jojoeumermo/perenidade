---
titulo: "Genética de populações"
resumo: "Objetivo: calcular frequências de alelos e de genótipos, aplicar o equilíbrio de Hardy-Weinberg e entender como mutação, seleção, deriva genética e fluxo gênico mudam as populações."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Biology 2e, seção 19.1, Population Evolution"
    autor: "Mary Ann Clark, Matthew Douglas e Jung Choi (OpenStax)"
    ano: "2018"
    url: "https://openstax.org/books/biology-2e/pages/19-1-population-evolution"
  - titulo: "Biology 2e, seção 19.2, Population Genetics"
    autor: "Mary Ann Clark, Matthew Douglas e Jung Choi (OpenStax)"
    ano: "2018"
    url: "https://openstax.org/books/biology-2e/pages/19-2-population-genetics"
  - titulo: "Biology 2e, seção 19.3, Adaptive Evolution"
    autor: "Mary Ann Clark, Matthew Douglas e Jung Choi (OpenStax)"
    ano: "2018"
    url: "https://openstax.org/books/biology-2e/pages/19-3-adaptive-evolution"
quiz:
  - pergunta: "No equilíbrio de Hardy-Weinberg, qual é a frequência esperada de heterozigotos?"
    opcoes: ["p²", "2pq", "q²"]
    resposta: 1
    explicacao: "p² + 2pq + q² = 1: homozigotos dominantes, heterozigotos e homozigotos recessivos."
  - pergunta: "Se 1 em cada 10 000 pessoas manifesta uma condição recessiva, qual é a frequência do alelo recessivo, supondo equilíbrio?"
    opcoes: ["0,0001", "0,01", "0,1"]
    resposta: 1
    explicacao: "q² = 1/10 000, logo q = 1/100 = 0,01."
  - pergunta: "O que é deriva genética?"
    opcoes: ["Mudança nas frequências de alelos por acaso, mais forte em populações pequenas", "Mudança causada só pela seleção natural", "Migração de indivíduos"]
    resposta: 0
    explicacao: "O efeito gargalo e o efeito fundador são formas de deriva."
  - pergunta: "Por que o alelo da anemia falciforme é relativamente frequente em regiões onde a malária era comum?"
    opcoes: ["Por acaso", "Porque os heterozigotos têm maior resistência à malária, e essa vantagem mantém o alelo na população", "Porque a malária causa a mutação"]
    resposta: 1
    explicacao: "É um caso clássico de vantagem do heterozigoto."
---

## A evolução medida em números

Darwin descreveu a seleção natural sem saber como funciona a herança. A **genética de populações** junta Darwin e Mendel e mede a evolução com números: ela acompanha como as **frequências dos alelos** mudam de uma geração para outra.

Esta aula supõe [Genética: as leis de Mendel](/trilhas/biologia-medio/genetica-as-leis-de-mendel) e [Evolução: Darwin e a seleção natural](/trilhas/biologia-medio/evolucao-darwin-e-a-selecao-natural).

## Frequências

O **conjunto gênico** de uma população é a soma de todos os alelos de todos os indivíduos. Para um gene com dois alelos, A e a:

- **p** = frequência do alelo A;
- **q** = frequência do alelo a;
- **p + q = 1**.

```conta
População de 100 indivíduos: 49 AA, 42 Aa, 9 aa (200 alelos no total)
alelos A: 2 × 49 + 42 = 140      p = 140 ÷ 200 = 0,7
alelos a: 2 × 9 + 42 = 60        q = 60 ÷ 200 = 0,3
```

## O equilíbrio de Hardy-Weinberg

Em 1908, o matemático inglês **G. H. Hardy** e o médico alemão **Wilhelm Weinberg** mostraram, independentemente, que, em certas condições, as frequências de alelos e de genótipos **não mudam** de geração para geração, e os genótipos se distribuem assim:

**p² + 2pq + q² = 1**

| Genótipo | Frequência |
| --- | --- |
| AA | p² |
| Aa | 2pq |
| aa | q² |

Na população do exemplo, p² = 0,49, 2pq = 0,42 e q² = 0,09: exatamente o observado. Ela está em equilíbrio.

### As condições

O equilíbrio só se mantém se:

1. não houver **mutação**;
2. não houver **seleção natural**;
3. a população for muito **grande** (sem deriva);
4. não houver **migração** (fluxo gênico);
5. os cruzamentos forem **ao acaso**.

Na natureza, essas condições quase nunca são todas cumpridas. Justamente por isso o modelo é útil: é a **hipótese nula**. Quando as frequências observadas se afastam do previsto, sabe-se que alguma força evolutiva está agindo.

### Uso prático: estimar portadores

```conta
Uma condição recessiva atinge 1 em cada 10 000 nascidos.
q² = 0,0001  →  q = 0,01  →  p = 0,99
portadores (heterozigotos): 2pq = 2 × 0,99 × 0,01 ≈ 0,0198, cerca de 2%
```

Uma condição rara pode ter um número de **portadores** cem vezes maior que o de afetados. Isso orienta programas de triagem e aconselhamento genético.

```verificar
Em uma população em equilíbrio, a frequência do alelo recessivo é 0,2. Qual é a frequência de heterozigotos?
- 0,04
+ 0,32
- 0,64
> 2pq, com p = 0,8 e q = 0,2.
```

## As forças que mudam as populações

| Força | Como age | Exemplo |
| --- | --- | --- |
| **Mutação** | cria alelos novos; é a fonte última de variação | qualquer alelo novo |
| **Seleção natural** | alelos que aumentam a sobrevivência e a reprodução ficam mais frequentes | resistência de bactérias a antibióticos |
| **Deriva genética** | mudança por **acaso**; mais forte em populações pequenas | perda de alelos em populações isoladas |
| **Fluxo gênico** | migração leva alelos de uma população a outra e as torna mais parecidas | cruzamento entre populações vizinhas |
| **Cruzamentos não aleatórios** | mudam as frequências dos genótipos | casamentos entre parentes aumentam os homozigotos |

### Deriva: gargalos e fundadores

- **Efeito gargalo**: um desastre reduz drasticamente a população. Os sobreviventes carregam só parte da variação original, por acaso. A população pode voltar a crescer, mas com pouca diversidade genética.
- **Efeito fundador**: um pequeno grupo funda uma nova população. Alelos raros na população de origem podem ficar comuns na nova, e vice-versa.

Pouca diversidade genética deixa a população vulnerável a doenças e a mudanças do ambiente. É uma das preocupações da [conservação](/trilhas/biologia-superior/ecologia-e-conservacao) de espécies ameaçadas.

### Tipos de seleção

- **Direcional**: favorece um extremo (insetos cada vez mais resistentes a um inseticida).
- **Estabilizadora**: favorece o intermediário (bebês com peso ao nascer próximo da média tinham, historicamente, mais chance de sobreviver).
- **Disruptiva**: favorece os dois extremos.

### Vantagem do heterozigoto

O alelo que causa a anemia falciforme é prejudicial em dose dupla. Mas os **heterozigotos** têm maior resistência à **malária**. Em regiões onde a malária era muito frequente, essa vantagem manteve o alelo em frequência relativamente alta. A trajetória desse alelo acompanha a história das populações: ele chegou ao Brasil com os africanos escravizados, e por isso a anemia falciforme é mais frequente na população negra brasileira.

## Variação humana

A genética de populações mostrou que a espécie humana tem **pouca** diversidade genética comparada a muitas outras espécies, e que a maior parte dela está **dentro** de cada população, e não entre populações. A maior diversidade está nas populações africanas, de onde a espécie se originou. Isso desmonta a ideia de raças biológicas humanas, como se viu na aula de [Mendel](/trilhas/biologia-medio/genetica-as-leis-de-mendel).

## Para praticar

1. Em uma população de 500 pessoas, 320 são AA, 160 são Aa e 20 são aa. Calcule p e q. A população está em equilíbrio de Hardy-Weinberg?
2. Uma condição recessiva atinge 1 em cada 2 500 pessoas. Estime a frequência de portadores.
3. Por que a deriva genética é mais forte em populações pequenas?
4. Explique a vantagem do heterozigoto na anemia falciforme com as suas palavras.

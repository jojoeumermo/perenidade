---
titulo: "Dimensionar um circuito"
resumo: "Passo a passo para escolher a bitola do fio, o disjuntor, o DR e o eletroduto de um circuito, com a tabela simplificada do manual baseado na NBR 5410 e o exemplo do chuveiro."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Instalações elétricas residenciais, parte 1 (manual baseado na NBR 5410)"
    autor: "ELEKTRO e Pirelli, com revisão técnica de Hilton Moreno"
    ano: "2003"
    url: "https://www.coe.ufrj.br/~kleber/INST_ELET_RES_PARTE_01.pdf"
  - titulo: "Instalações elétricas residenciais, parte 2 (manual baseado na NBR 5410)"
    autor: "ELEKTRO e Pirelli, com revisão técnica de Hilton Moreno"
    ano: "2003"
    url: "https://www.coe.ufrj.br/~kleber/INST_ELET_RES_PARTE_02.pdf"
  - titulo: "ABNT NBR 5410: Instalações elétricas de baixa tensão (edição de 2004, versão corrigida de 2008)"
    autor: "Associação Brasileira de Normas Técnicas"
    ano: "2004"
glossario:
  - termo: "dimensionar"
    definicao: "Escolher o tamanho certo de cada peça do circuito: a bitola do fio, o disjuntor, o DR e o eletroduto."
  - termo: "circuitos agrupados"
    definicao: "Os circuitos que passam juntos dentro do mesmo eletroduto. Quanto mais circuitos juntos, mais difícil o calor sair, e menos corrente cada fio pode levar."
  - termo: "corrente nominal"
    definicao: "A corrente para a qual o disjuntor ou o DR foi feito. É o número escrito nele, como 10 A ou 40 A."
quiz:
  - pergunta: "Um chuveiro de 5.500 W ligado em 220 V puxa quanta corrente?"
    opcoes: ["2,5 A", "25 A", "250 A"]
    resposta: 1
    explicacao: "I = P ÷ U = 5.500 ÷ 220 = 25 A."
  - pergunta: "Pela tabela simplificada do manual, qual é o disjuntor para fio de 2,5 mm² com 3 circuitos no mesmo eletroduto?"
    opcoes: ["10 A", "15 A", "20 A"]
    resposta: 1
    explicacao: "Na linha do 2,5 mm², a coluna de 3 circuitos por eletroduto dá 15 A. Sozinho no eletroduto, seriam 20 A."
  - pergunta: "Um aparelho de 1.500 W em 127 V precisa de circuito só para ele?"
    opcoes: ["Sim, porque puxa mais de 10 A", "Não, nenhum aparelho precisa", "Só se for na cozinha"]
    resposta: 0
    explicacao: "1.500 ÷ 127 ≈ 11,8 A. A NBR 5410 pede circuito exclusivo para aparelho com corrente acima de 10 A."
  - pergunta: "Qual é a parte máxima da área interna do eletroduto que os fios podem ocupar?"
    opcoes: ["40%", "75%", "100%"]
    resposta: 0
    explicacao: "Os condutores não podem ocupar mais de 40% da área útil, para que possam ser enfiados e retirados com facilidade."
---

```provocacao
Instalaram um chuveiro mais potente no lugar do antigo, sem mexer na fiação. Desde então o disjuntor desarma no meio do banho. O que está errado?
```

## O que você vai aprender

Ao fim desta aula você vai saber dividir uma instalação em circuitos, calcular a corrente, escolher a bitola do fio e o disjuntor numa tabela, conferir a seção mínima, escolher o DR e o tamanho do eletroduto.

## Passo 1: dividir em circuitos

A NBR 5410 pede:

- circuitos de **iluminação separados** dos circuitos de tomadas;
- um **circuito só para cada aparelho** com corrente acima de **10 A**. Em 127 V, isso vale para aparelhos de mais de 1.270 VA (127 × 10).

O manual baseado na norma recomenda ainda limitar cada circuito de iluminação e de tomadas de uso geral a **10 A**: até **1.270 VA em 127 V** ou **2.200 VA em 220 V**. Circuito muito carregado exige fio grosso demais para as caixas e os interruptores.

Dividir também ajuda na manutenção: um defeito desliga só uma parte da casa.

## Passo 2: calcular a corrente

```formula
I = P ÷ U
A corrente (em ampères) é a potência (em watts ou VA) dividida pela tensão (em volts).
```

## Passo 3: contar os circuitos agrupados

Siga, na planta, o caminho do circuito e veja em que trecho ele passa junto com **mais circuitos** no mesmo eletroduto. Esse é o número que se usa na tabela: quanto mais circuitos juntos, mais difícil o calor escapar.

## Passo 4: bitola e disjuntor na tabela

A tabela simplificada do manual dá, para cada seção de fio e número de circuitos no eletroduto, a **corrente nominal do disjuntor**:

| Seção (mm²) | 1 circuito | 2 circuitos | 3 circuitos | 4 circuitos |
| --- | --- | --- | --- | --- |
| 1,5 | 15 A | 10 A | 10 A | 10 A |
| 2,5 | 20 A | 15 A | 15 A | 15 A |
| 4 | 30 A | 25 A | 20 A | 20 A |
| 6 | 40 A | 30 A | 25 A | 25 A |
| 10 | 50 A | 40 A | 40 A | 35 A |
| 16 | 70 A | 60 A | 50 A | 40 A |

Como usar: na coluna do número de circuitos agrupados, desça até o **primeiro valor maior ou igual à corrente** do circuito. A linha dá a **seção do fio** e o valor dá o **disjuntor**.

## Passo 5: conferir a seção mínima

Compare a seção da tabela com a **mínima da norma**: 1,5 mm² para iluminação e 2,5 mm² para força. Fica a **maior** das duas.

## Passo 6: escolher o DR

Nos circuitos em que a norma exige DR, a corrente nominal do **interruptor DR** precisa ser pelo menos a do disjuntor que vem antes dele:

| Disjuntor | Interruptor DR mínimo |
| --- | --- |
| 10, 15, 20 ou 25 A | 25 A |
| 30 ou 40 A | 40 A |
| 50 ou 60 A | 63 A |
| 70 A | 80 A |

Se a escolha for um **disjuntor DR**, ele segue a mesma tabela do passo 4. Um disjuntor DR de 25 A, por exemplo, não serve para fio de 1,5 ou 2,5 mm²: aí a solução é disjuntor comum mais interruptor DR.

## Passo 7: o eletroduto

Os fios não podem ocupar mais de **40%** da área interna do eletroduto, para que possam ser enfiados e retirados. Na prática, o manual recomenda não passar mais de **6 ou 7 condutores** no mesmo eletroduto. O tamanho certo sai de uma tabela que cruza o número de condutores com a maior seção entre eles.

Esta tabela e estes passos são a versão simplificada do manual para casas. O método completo da NBR 5410 leva em conta outros fatores, como a maneira de instalar os fios, a temperatura do ambiente e a queda de tensão em circuitos compridos.

```navidareal
**O chuveiro novo no fio velho.** Trocar um chuveiro por outro mais potente muda a corrente do circuito. Se o fio e o disjuntor foram escolhidos para o chuveiro antigo, ou o disjuntor desarma, ou, pior, alguém troca o disjuntor por um maior e o fio passa a esquentar dentro da parede. Antes de comprar o chuveiro, faça a conta deste passo a passo.
```

```verificar
Um circuito tem corrente de 18 A e passa sozinho no eletroduto. Pela tabela, qual fio e qual disjuntor?
- 1,5 mm² e 15 A
+ 2,5 mm² e 20 A
- 4 mm² e 30 A
> Na coluna de 1 circuito, o primeiro valor maior ou igual a 18 A é 20 A.
```

## Exemplo resolvido

**Dimensione o circuito de um chuveiro de 7.500 W em 220 V, que passa sozinho no eletroduto.**

```conta
Corrente: I = 7.500 ÷ 220 ≈ 34,1 A
Tabela, coluna de 1 circuito: 4 mm² dá 30 A (menor que 34,1)
                              6 mm² dá 40 A (maior que 34,1)
Seção pela tabela: 6 mm²; disjuntor: 40 A
Seção mínima de força: 2,5 mm² → fica 6 mm²
DR (local com chuveiro): disjuntor de 40 A → interruptor DR de 40 A
```

Resultado: fios de **6 mm²**, disjuntor **bipolar de 40 A** (o chuveiro está ligado entre duas fases, em 220 V) e **interruptor DR de 40 A**, com o fio terra também de 6 mm².

**E as tomadas de uma cozinha com 1.900 VA em 127 V?** A corrente seria 1.900 ÷ 127 ≈ 15 A, acima dos 10 A recomendados. Divide-se em dois circuitos: um com duas tomadas de 600 VA (1.200 VA, cerca de 9,4 A) e outro com uma de 600 VA e uma de 100 VA (700 VA, cerca de 5,5 A). Com três circuitos no eletroduto, a tabela dá 1,5 mm² e 10 A; a seção mínima de força sobe o fio para **2,5 mm²**. Cada circuito fica com disjuntor de **10 A** e, por ser cozinha, interruptor DR de **25 A**.

## Resumo

- Iluminação separada das tomadas; aparelho acima de 10 A em circuito próprio; circuitos de uso geral até 10 A.
- **I = P ÷ U**.
- Na tabela, com o número de circuitos agrupados, encontre a seção e o disjuntor.
- Fica a maior entre a seção da tabela e a mínima da norma (1,5 ou 2,5 mm²).
- O interruptor DR tem corrente nominal pelo menos igual à do disjuntor.
- Os fios ocupam no máximo 40% do eletroduto.

```leve
- Procure a potência do chuveiro da sua casa (na etiqueta ou no manual) e calcule a corrente dele.
- Abra o quadro (só a porta) e veja o valor do disjuntor do chuveiro. Ele combina com a conta?
```

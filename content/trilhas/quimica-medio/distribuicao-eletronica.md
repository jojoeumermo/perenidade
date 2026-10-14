---
titulo: "Distribuição eletrônica"
resumo: "Objetivo: distribuir os elétrons de um átomo em níveis e subníveis, identificar a camada de valência e relacioná-la à posição do elemento na tabela periódica."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Chemistry 2e, seção 6.4, Electronic Structure of Atoms (Electron Configurations)"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/6-4-electronic-structure-of-atoms-electron-configurations"
  - titulo: "Chemistry 2e, seção 6.5, Periodic Variations in Element Properties"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/6-5-periodic-variations-in-element-properties"
quiz:
  - pergunta: "Quantos elétrons cabem, no máximo, em um subnível p?"
    opcoes: ["2", "6", "10"]
    resposta: 1
    explicacao: "Os subníveis s, p, d e f comportam, no máximo, 2, 6, 10 e 14 elétrons."
  - pergunta: "Qual é a distribuição eletrônica do sódio (Z = 11)?"
    opcoes: ["1s² 2s² 2p⁶ 3s¹", "1s² 2s² 2p⁷", "1s² 2s² 3s² 3p⁵"]
    resposta: 0
    explicacao: "Preenche-se na ordem de energia: 2 + 2 + 6 + 1 = 11 elétrons."
  - pergunta: "O cloro tem distribuição 1s² 2s² 2p⁶ 3s² 3p⁵. Quantos elétrons há na camada de valência?"
    opcoes: ["5", "7", "17"]
    resposta: 1
    explicacao: "A camada mais externa é a terceira, com 2 + 5 = 7 elétrons."
  - pergunta: "O que os elementos de um mesmo grupo (coluna) da tabela periódica têm em comum?"
    opcoes: ["O mesmo número de camadas", "O mesmo número de elétrons na camada de valência, e por isso propriedades químicas parecidas", "A mesma massa"]
    resposta: 1
    explicacao: "Sódio e potássio têm, cada um, 1 elétron de valência, e reagem de modo parecido."
---

## Por que isso importa

O comportamento químico de um elemento (com quem ele se liga, se forma sal, se conduz eletricidade) depende quase só de uma coisa: **como os seus elétrons estão arrumados**, sobretudo os mais externos. A **distribuição eletrônica** é o endereço dos elétrons.

Esta aula parte dos [Modelos atômicos](/trilhas/quimica-medio/modelos-atomicos).

## Níveis de energia

Os elétrons se distribuem em **níveis de energia**, ou **camadas**, numerados a partir do núcleo.

| Nível | Camada | Máximo de elétrons |
| --- | --- | --- |
| 1 | K | 2 |
| 2 | L | 8 |
| 3 | M | 18 |
| 4 | N | 32 |
| 5 | O | 32 |
| 6 | P | 18 |
| 7 | Q | 8 |

Quanto mais longe do núcleo, maior a energia do elétron.

## Subníveis

Cada nível se divide em **subníveis**, indicados pelas letras **s**, **p**, **d** e **f**.

| Subnível | Máximo de elétrons |
| --- | --- |
| s | 2 |
| p | 6 |
| d | 10 |
| f | 14 |

O nível 1 tem só o subnível s. O nível 2 tem s e p. O nível 3 tem s, p e d. O nível 4 tem s, p, d e f.

A notação junta tudo: em **3p⁵**, o 3 é o nível, p é o subnível e 5 é o número de elétrons ali.

## A ordem de preenchimento

Os elétrons ocupam primeiro os subníveis de **menor energia**. A ordem não segue exatamente a numeração dos níveis: o subnível 4s, por exemplo, tem energia menor que o 3d e é preenchido antes.

A ordem é dada pelo **diagrama de Linus Pauling**, que se lê pelas diagonais:

```conta
1s
2s 2p
3s 3p 3d
4s 4p 4d 4f
5s 5p 5d 5f
6s 6p 6d
7s 7p
```

Lendo em diagonal, de cima para baixo, obtém-se:

**1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p**

## Como fazer

Basta ir preenchendo os subníveis, na ordem, até acabarem os elétrons do átomo.

```conta
Sódio (Z = 11):   1s² 2s² 2p⁶ 3s¹
Cloro (Z = 17):   1s² 2s² 2p⁶ 3s² 3p⁵
Cálcio (Z = 20):  1s² 2s² 2p⁶ 3s² 3p⁶ 4s²
Ferro (Z = 26):   1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶
```

Confira sempre a soma dos expoentes: ela tem de dar o número atômico. No ferro: 2 + 2 + 6 + 2 + 6 + 2 + 6 = 26.

## A camada de valência

A **camada de valência** é a mais externa que contém elétrons. É ela que participa das ligações químicas.

| Elemento | Distribuição | Camada de valência | Elétrons de valência |
| --- | --- | --- | --- |
| Sódio | 1s² 2s² 2p⁶ **3s¹** | 3ª | 1 |
| Cloro | 1s² 2s² 2p⁶ **3s² 3p⁵** | 3ª | 7 |
| Cálcio | 1s² 2s² 2p⁶ 3s² 3p⁶ **4s²** | 4ª | 2 |

Atenção ao ferro: a camada mais externa é a 4ª (4s²), com 2 elétrons, embora o último subnível preenchido tenha sido o 3d.

```verificar
O oxigênio tem Z = 8. Quantos elétrons ele tem na camada de valência?
- 2
+ 6
- 8
> Faça a distribuição: 1s² 2s² 2p⁴. Qual é a camada mais externa, e quantos elétrons ela tem?
```

## A distribuição e a tabela periódica

A tabela periódica é, no fundo, um mapa das distribuições eletrônicas.

- O **período** (a linha) indica o número de **camadas** ocupadas. O sódio, com três camadas, está no 3º período.
- O **grupo** (a coluna) reúne elementos com a **mesma configuração na camada de valência**. Por isso têm propriedades químicas parecidas.

| Grupo | Nome | Elétrons de valência | Tendência |
| --- | --- | --- | --- |
| 1 | metais alcalinos (Li, Na, K) | 1 | perder 1 elétron: formam cátions 1+ |
| 2 | metais alcalinoterrosos (Mg, Ca) | 2 | perder 2 elétrons: cátions 2+ |
| 16 | calcogênios (O, S) | 6 | ganhar 2 elétrons: ânions 2− |
| 17 | halogênios (F, Cl) | 7 | ganhar 1 elétron: ânions 1− |
| 18 | gases nobres (He, Ne, Ar) | 8 (o hélio tem 2) | muito estáveis; quase não reagem |

O sódio e o potássio reagem violentamente com a água pelo mesmo motivo: os dois têm um único elétron de valência, fácil de perder.

## Distribuição dos íons

Para um **cátion**, retiram-se elétrons da **camada mais externa**. Para um **ânion**, acrescentam-se.

```conta
Na  (11 elétrons): 1s² 2s² 2p⁶ 3s¹
Na⁺ (10 elétrons): 1s² 2s² 2p⁶

Cl  (17 elétrons): 1s² 2s² 2p⁶ 3s² 3p⁵
Cl⁻ (18 elétrons): 1s² 2s² 2p⁶ 3s² 3p⁶
```

O Na⁺ ficou com a mesma distribuição do gás nobre neônio; o Cl⁻, com a do argônio. Os dois terminaram com **oito elétrons** na última camada. Essa tendência é a chave das [Ligações químicas](/trilhas/quimica-medio/ligacoes-quimicas).

No ferro, os elétrons saem primeiro do 4s, que é a camada mais externa: o Fe²⁺ é 1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶.

## Para praticar

1. Faça a distribuição eletrônica de: carbono (Z = 6), magnésio (Z = 12), enxofre (Z = 16) e potássio (Z = 19).
2. Para cada um, indique a camada de valência e o número de elétrons nela.
3. Sem olhar a tabela periódica, diga em que período está cada um desses elementos.
4. Faça a distribuição dos íons Mg²⁺ e S²⁻. A que gás nobre cada um se iguala?

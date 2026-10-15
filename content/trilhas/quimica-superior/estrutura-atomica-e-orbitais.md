---
titulo: "Estrutura atômica e orbitais"
resumo: "Objetivo: descrever os elétrons pelos números quânticos e orbitais, aplicar as regras de preenchimento, explicar as propriedades periódicas e usar a hibridização e a repulsão dos pares de elétrons para prever a forma das moléculas."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Chemistry 2e, seção 6.3, Development of Quantum Theory"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/6-3-development-of-quantum-theory"
  - titulo: "Chemistry 2e, seção 6.5, Periodic Variations in Element Properties"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/6-5-periodic-variations-in-element-properties"
  - titulo: "Chemistry 2e, seção 7.6, Molecular Structure and Polarity"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/7-6-molecular-structure-and-polarity"
  - titulo: "Chemistry 2e, seção 8.2, Hybrid Atomic Orbitals"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/8-2-hybrid-atomic-orbitals"
quiz:
  - pergunta: "Quais valores pode ter o número quântico secundário l quando n = 3?"
    opcoes: ["0, 1 e 2", "1, 2 e 3", "Só 3"]
    resposta: 0
    explicacao: "l vai de 0 até n − 1. Com n = 3, há os subníveis 3s (l = 0), 3p (l = 1) e 3d (l = 2)."
  - pergunta: "O que diz a regra de Hund?"
    opcoes: ["Os elétrons ocupam primeiro, um a um e com spins iguais, os orbitais de mesma energia, antes de formar pares", "Dois elétrons não podem ter os quatro números quânticos iguais", "Os subníveis se preenchem em ordem crescente de energia"]
    resposta: 0
    explicacao: "As outras duas alternativas são o princípio de Pauli e o princípio de construção."
  - pergunta: "Qual é a hibridização do carbono no metano (CH₄) e o ângulo entre as ligações?"
    opcoes: ["sp, 180°", "sp², 120°", "sp³, cerca de 109,5°"]
    resposta: 2
    explicacao: "Quatro orbitais híbridos sp³ apontam para os vértices de um tetraedro."
  - pergunta: "Como varia a energia de ionização ao longo de um período, da esquerda para a direita?"
    opcoes: ["Tende a aumentar", "Tende a diminuir", "Não varia"]
    resposta: 0
    explicacao: "A carga nuclear efetiva aumenta, e os elétrons ficam mais presos."
---

## Do modelo de camadas aos orbitais

No ensino médio, distribuímos os elétrons em camadas e subníveis com o [diagrama de Pauling](/trilhas/quimica-medio/distribuicao-eletronica). A [mecânica quântica](/trilhas/fisica-superior/mecanica-quantica-os-fundamentos) explica de onde vem esse arranjo: os elétrons ocupam **orbitais**, regiões em que a probabilidade de encontrá-los é alta, descritas por soluções da equação de Schrödinger.

## Os números quânticos

Cada elétron de um átomo é descrito por quatro números quânticos.

| Número | Símbolo | Valores | O que indica |
| --- | --- | --- | --- |
| Principal | n | 1, 2, 3... | o nível de energia e o tamanho do orbital |
| Secundário (ou azimutal) | l | 0 até n − 1 | o subnível e a forma do orbital: l = 0 (s), 1 (p), 2 (d), 3 (f) |
| Magnético | mₗ | −l até +l | a orientação do orbital no espaço |
| De spin | mₛ | +½ ou −½ | o spin do elétron |

Daí vêm os números que decoramos: o subnível p tem 3 orientações (mₗ = −1, 0, +1), logo 3 orbitais e até 6 elétrons; o d tem 5 orbitais e até 10 elétrons; o f, 7 orbitais e até 14.

### As formas

- Orbitais **s**: esféricos.
- Orbitais **p**: em forma de halteres, ao longo dos eixos x, y e z.
- Orbitais **d**: formas mais complexas, com quatro lóbulos na maioria.

## As regras de preenchimento

1. **Princípio de construção**: os elétrons ocupam primeiro os orbitais de menor energia.
2. **Princípio de exclusão de Pauli**: dois elétrons de um mesmo átomo não podem ter os quatro números quânticos iguais. Cada orbital comporta no máximo dois elétrons, com spins opostos.
3. **Regra de Hund**: em orbitais de mesma energia, os elétrons se espalham um por orbital, com spins paralelos, antes de formar pares.

```conta
Nitrogênio (Z = 7): 1s² 2s² 2p³
2p:  [↑] [↑] [↑]     (três elétrons desemparelhados, regra de Hund)

Oxigênio (Z = 8): 1s² 2s² 2p⁴
2p:  [↑↓] [↑] [↑]    (dois elétrons desemparelhados)
```

Há exceções conhecidas: o cromo é [Ar] 4s¹ 3d⁵ e o cobre é [Ar] 4s¹ 3d¹⁰, porque subníveis d semicheios ou cheios são especialmente estáveis.

## Propriedades periódicas

A **carga nuclear efetiva** é a atração líquida que um elétron de valência sente do núcleo, descontada a "blindagem" dos elétrons internos. Ela explica as tendências da tabela.

| Propriedade | Ao longo do período (→) | Ao descer no grupo (↓) |
| --- | --- | --- |
| **Raio atômico** | diminui | aumenta |
| **Energia de ionização** (energia para arrancar um elétron) | aumenta | diminui |
| **Eletronegatividade** (atração por elétrons em uma ligação) | aumenta | diminui |

O flúor é o elemento mais eletronegativo; o césio e o frâncio, os menos. Por isso os metais alcalinos perdem elétrons tão facilmente e os halogênios os capturam com avidez.

```verificar
Qual destes átomos tem o maior raio: sódio, cloro ou potássio?
- Sódio
- Cloro
+ Potássio
> O raio diminui ao longo do período e aumenta ao descer no grupo. O potássio está abaixo do sódio.
```

## A forma das moléculas

### Repulsão dos pares de elétrons (VSEPR)

Os pares de elétrons em volta de um átomo central se repelem e se afastam o máximo possível. O arranjo dos pares determina a geometria.

| Pares em volta do átomo central | Pares livres | Geometria | Exemplo | Ângulo |
| --- | --- | --- | --- | --- |
| 2 | 0 | linear | CO₂ | 180° |
| 3 | 0 | trigonal plana | BF₃ | 120° |
| 4 | 0 | tetraédrica | CH₄ | 109,5° |
| 4 | 1 | piramidal | NH₃ | cerca de 107° |
| 4 | 2 | angular | H₂O | cerca de 104,5° |

Os **pares livres** ocupam mais espaço e "empurram" as ligações, fechando o ângulo. A forma angular da água é a razão de ela ser **polar**, com todas as consequências vistas em [Ligações químicas](/trilhas/quimica-medio/ligacoes-quimicas).

### Hibridização

O carbono tem configuração 2s² 2p², com só dois elétrons desemparelhados, mas faz **quatro** ligações iguais no metano. A explicação é a **hibridização**: orbitais atômicos se combinam formando orbitais híbridos equivalentes.

| Hibridização | Orbitais misturados | Geometria | Exemplo |
| --- | --- | --- | --- |
| sp³ | um s e três p | tetraédrica (109,5°) | metano, etano, diamante |
| sp² | um s e dois p | trigonal plana (120°) | eteno, benzeno, grafite |
| sp | um s e um p | linear (180°) | etino (acetileno), CO₂ |

Na ligação dupla do eteno, uma das ligações é **sigma** (σ), formada pela sobreposição frontal de orbitais híbridos; a outra é **pi** (π), formada pela sobreposição lateral de orbitais p não hibridizados. A ligação π impede a rotação em torno do eixo C=C, e é isso que dá origem à isomeria geométrica (*cis* e *trans*).

A diferença entre o diamante (sp³, rede tridimensional, duríssimo e isolante) e o grafite (sp², camadas, macio e condutor) está toda aqui.

## Para praticar

1. Escreva os quatro números quânticos do elétron mais externo do sódio.
2. Faça o diagrama de orbitais do carbono e do flúor. Quantos elétrons desemparelhados há em cada um?
3. Preveja a geometria e o ângulo aproximado de: H₂S, CCl₄ e SO₂.
4. Qual é a hibridização de cada carbono no propeno, CH₂=CH–CH₃?

---
titulo: "Física nuclear e de partículas"
resumo: "Objetivo: entender a estrutura do núcleo, a energia de ligação, o decaimento radioativo e a meia-vida, e conhecer o Modelo Padrão das partículas elementares e das forças."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "University Physics, volume 3, seção 10.2, Nuclear Binding Energy"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/10-2-nuclear-binding-energy"
  - titulo: "University Physics, volume 3, seção 10.3, Radioactive Decay"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/10-3-radioactive-decay"
  - titulo: "University Physics, volume 3, seção 11.3, Quarks"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/11-3-quarks"
  - titulo: "University Physics, volume 3, seção 11.5, The Standard Model"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/11-5-the-standard-model"
quiz:
  - pergunta: "O que mantém prótons e nêutrons unidos no núcleo, apesar da repulsão elétrica entre os prótons?"
    opcoes: ["A gravidade", "A força nuclear forte", "A força magnética"]
    resposta: 1
    explicacao: "É muito intensa, mas age só a distâncias da ordem do tamanho do núcleo."
  - pergunta: "Uma amostra de iodo-131 (meia-vida de cerca de 8 dias) tem 80 g. Quanto resta depois de 24 dias?"
    opcoes: ["40 g", "20 g", "10 g"]
    resposta: 2
    explicacao: "24 dias são três meias-vidas: 80 → 40 → 20 → 10 g."
  - pergunta: "De que quarks é formado o próton?"
    opcoes: ["Dois quarks up e um down", "Um up e dois down", "Três quarks up"]
    resposta: 0
    explicacao: "Cargas: +2/3 + 2/3 − 1/3 = +1. O nêutron é um up e dois down: carga zero."
  - pergunta: "Por que tanto a fissão de núcleos pesados quanto a fusão de núcleos leves liberam energia?"
    opcoes: ["Porque nos dois casos os produtos ficam mais perto do máximo da curva de energia de ligação por núcleon", "Porque a massa aumenta", "Porque a carga elétrica desaparece"]
    resposta: 0
    explicacao: "Os núcleos mais firmemente ligados estão na região do ferro e do níquel."
---

## O núcleo

O núcleo atômico tem cerca de 10⁻¹⁵ m de diâmetro, dezenas de milhares de vezes menor que o átomo, e concentra quase toda a sua massa. É formado por **prótons** e **nêutrons**, chamados juntos de **núcleons**.

Um núcleo se representa por ᴬ_Z X: Z é o número de prótons, A é o número de núcleons. Veja os conceitos de base em [Modelos atômicos](/trilhas/quimica-medio/modelos-atomicos).

### A força forte

Os prótons, todos positivos, se repelem com força enorme a distâncias tão curtas. O que segura o núcleo é a **força nuclear forte**, que atrai núcleons entre si. Ela é muito mais intensa que a elétrica, mas tem **alcance muito curto**, da ordem do tamanho do núcleo.

## Energia de ligação

A massa de um núcleo é **menor** que a soma das massas dos seus prótons e nêutrons separados. A diferença, o **defeito de massa** Δm, corresponde à energia que mantém o núcleo unido, pela equação de Einstein vista em [Relatividade restrita](/trilhas/fisica-superior/relatividade-restrita):

**energia de ligação = Δm · c²**

Dividida pelo número de núcleons, ela dá a **energia de ligação por núcleon**. Em um gráfico contra o número de massa, essa curva sobe depressa nos núcleos leves, atinge o máximo (cerca de 8,8 MeV por núcleon) na região do **ferro** e do **níquel** e cai lentamente nos núcleos pesados.

Daí vêm as duas formas de extrair energia do núcleo:

- **fissão**: partir um núcleo muito pesado (como o urânio-235) em dois médios, mais firmemente ligados;
- **fusão**: juntar núcleos muito leves (como os do hidrogênio) em um mais pesado, também mais ligado.

Em ambos os casos, a massa final é menor que a inicial, e a diferença sai como energia.

## Radioatividade

Núcleos instáveis se transformam espontaneamente, emitindo radiação. A radioatividade foi descoberta em **1896** pelo francês **Henri Becquerel**, e estudada a fundo por **Marie Curie** e **Pierre Curie**, que descobriram o polônio e o rádio.

| Decaimento | O que sai do núcleo | Efeito no núcleo | Poder de penetração |
| --- | --- | --- | --- |
| **Alfa (α)** | núcleo de hélio (2 prótons e 2 nêutrons) | Z diminui 2, A diminui 4 | baixo: uma folha de papel barra |
| **Beta menos (β⁻)** | elétron (e um antineutrino) | um nêutron vira próton: Z aumenta 1 | médio: alguns milímetros de alumínio |
| **Beta mais (β⁺)** | pósitron (e um neutrino) | um próton vira nêutron: Z diminui 1 | médio |
| **Gama (γ)** | fóton de alta energia | só perde energia | alto: exige chumbo ou concreto espesso |

### Meia-vida

Não se sabe **quando** um núcleo em particular vai decair. Mas, em uma amostra grande, a fração que decai por unidade de tempo é constante. O tempo para que metade dos núcleos decaia é a **meia-vida**, T½.

**N(t) = N₀ · (1/2)^(t / T½)**

| Isótopo | Meia-vida aproximada | Uso ou importância |
| --- | --- | --- |
| Iodo-131 | 8 dias | diagnóstico e tratamento da tireoide |
| Césio-137 | 30 anos | o isótopo do acidente de Goiânia (1987) |
| Carbono-14 | 5 730 anos | datação de restos orgânicos |
| Urânio-238 | 4,5 bilhões de anos | datação de rochas |

```conta
Datação: um pedaço de madeira tem 1/4 do carbono-14 de uma madeira viva.
1/4 = (1/2)²  →  passaram 2 meias-vidas
idade ≈ 2 × 5 730 = 11 460 anos
```

A atividade de uma amostra (número de decaimentos por segundo) é medida em **becquerel** (Bq).

```verificar
Uma amostra radioativa tem atividade de 1 600 Bq. Depois de 4 meias-vidas, qual será a atividade?
- 400 Bq
+ 100 Bq
- 0 Bq
> 1 600 → 800 → 400 → 200 → ?
```

## As partículas elementares

No século XX, descobriu-se que prótons e nêutrons não são elementares: são formados por **quarks**. O brasileiro **César Lattes** participou, em 1947, da descoberta do **méson pi**, uma das primeiras partículas desse novo mundo.

O conhecimento atual se resume no **Modelo Padrão**.

### As partículas de matéria

| Família | Partículas |
| --- | --- |
| **Quarks** | up, down, charm, strange, top, bottom |
| **Léptons** | elétron, múon, tau e os seus três neutrinos |

Os quarks nunca aparecem isolados: combinam-se em trios (como o próton, **uud**, e o nêutron, **udd**) ou em pares quark-antiquark (os mésons). Cada partícula tem a sua **antipartícula**, de mesma massa e carga oposta.

### As forças e os seus mensageiros

| Força | Partícula mediadora | Age sobre |
| --- | --- | --- |
| Eletromagnética | fóton | partículas com carga |
| Forte | glúons | quarks |
| Fraca | bósons W e Z | todas as partículas de matéria; responsável pelo decaimento beta |
| Gravitacional | (não incluída no Modelo Padrão) | tudo que tem massa ou energia |

Completa o quadro o **bóson de Higgs**, ligado ao mecanismo que dá massa às partículas. Previsto na década de 1960, foi detectado em **2012** no grande acelerador do CERN, laboratório europeu de pesquisa com participação de cientistas do mundo inteiro, inclusive do Brasil.

## O que ainda não se sabe

O Modelo Padrão é uma das teorias mais bem testadas da ciência, mas é incompleto: não inclui a gravidade, não explica a **matéria escura** nem a **energia escura**, que a astronomia indica dominarem o universo, nem por que há tanta mais matéria que antimatéria.

## Para praticar

1. O urânio-238 (Z = 92) emite uma partícula alfa. Qual é o número atômico e o de massa do núcleo resultante?
2. Uma amostra de 120 g de um isótopo com meia-vida de 10 anos: quanto resta depois de 30 anos?
3. Um osso tem 1/8 do carbono-14 de um osso atual. Qual é a sua idade aproximada?
4. Calcule a carga do méson formado por um quark up e um antiquark down.

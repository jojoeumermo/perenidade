---
titulo: "Eletroquímica: pilhas e eletrólise"
resumo: "Objetivo: entender oxidação e redução, explicar como uma pilha produz corrente elétrica, como a eletrólise usa corrente para forçar reações e como se combate a corrosão."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Chemistry 2e, seção 17.1, Review of Redox Chemistry"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/17-1-review-of-redox-chemistry"
  - titulo: "Chemistry 2e, seção 17.2, Galvanic Cells"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/17-2-galvanic-cells"
  - titulo: "Chemistry 2e, seção 17.6, Corrosion"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/17-6-corrosion"
  - titulo: "Chemistry 2e, seção 17.7, Electrolysis"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/17-7-electrolysis"
  - titulo: "Lei nº 12.305, de 2 de agosto de 2010 (Política Nacional de Resíduos Sólidos)"
    autor: "Brasil"
    ano: "2010"
    url: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12305.htm"
quiz:
  - pergunta: "O que é oxidação?"
    opcoes: ["Ganho de elétrons", "Perda de elétrons", "Ganho de prótons"]
    resposta: 1
    explicacao: "Quem perde elétrons se oxida; quem ganha se reduz. As duas coisas acontecem sempre juntas."
  - pergunta: "Em uma pilha, o que acontece no ânodo?"
    opcoes: ["Redução; é o polo positivo", "Oxidação; é o polo negativo, de onde saem os elétrons", "Nada"]
    resposta: 1
    explicacao: "Os elétrons liberados na oxidação percorrem o fio externo até o cátodo."
  - pergunta: "Qual é a diferença entre pilha e eletrólise?"
    opcoes: ["A pilha produz corrente a partir de uma reação espontânea; a eletrólise usa corrente para forçar uma reação que não ocorreria sozinha", "Não há diferença", "A eletrólise só funciona com metais"]
    resposta: 0
    explicacao: "Uma transforma energia química em elétrica; a outra, elétrica em química."
  - pergunta: "Por que o aço galvanizado (coberto de zinco) resiste à ferrugem?"
    opcoes: ["Porque o zinco se oxida no lugar do ferro", "Porque o zinco é um isolante elétrico", "Porque o zinco é mais duro que o ferro"]
    resposta: 0
    explicacao: "O zinco perde elétrons com mais facilidade que o ferro e se sacrifica por ele."
---

## Química e eletricidade

Algumas reações químicas **transferem elétrons** de uma substância para outra. Se esses elétrons forem obrigados a passar por um fio, tem-se **corrente elétrica**. É a ideia da pilha. O caminho inverso também existe: usar corrente elétrica para **forçar** uma reação. É a eletrólise.

A **eletroquímica** estuda as duas coisas. Ela junta o que foi visto em [Reações químicas](/trilhas/quimica-medio/reacoes-quimicas-e-balanceamento) e em [Circuitos elétricos](/trilhas/fisica-medio/circuitos-eletricos).

## Oxidação e redução

- **Oxidação**: **perda** de elétrons.
- **Redução**: **ganho** de elétrons.

Uma nunca acontece sem a outra: os elétrons que um perde, outro ganha. Por isso se fala em reações de **oxirredução** (ou redox).

```conta
Um prego de ferro mergulhado em solução de sulfato de cobre (azul) fica coberto de cobre:
Fe + Cu²⁺  →  Fe²⁺ + Cu

o ferro perdeu 2 elétrons: oxidou-se
o íon cobre ganhou 2 elétrons: reduziu-se
```

Quem se oxida é o **agente redutor** (faz o outro se reduzir). Quem se reduz é o **agente oxidante**.

São reações de oxirredução a combustão, a ferrugem, a respiração, a fotossíntese e a ação da água sanitária como alvejante.

### A fila dos metais

Alguns metais perdem elétrons com mais facilidade que outros. Em ordem decrescente de tendência a se oxidar:

**magnésio > alumínio > zinco > ferro > chumbo > cobre > prata > ouro**

Um metal desloca da solução os íons dos metais que vêm **depois** dele na fila. O ferro desloca o cobre, mas o cobre não desloca o ferro. Ouro e prata, no fim da fila, quase não se oxidam: por isso são encontrados puros na natureza e não enferrujam.

## Pilhas

Em **1800**, o italiano **Alessandro Volta** empilhou discos de zinco e de cobre separados por panos embebidos em solução salgada e obteve corrente elétrica contínua. O nome "pilha" vem daí.

### A pilha de Daniell

O exemplo clássico, de 1836, usa a reação entre zinco e íons de cobre, mas com os dois **separados**, para que os elétrons tenham de passar por um fio.

| | Eletrodo de zinco | Eletrodo de cobre |
| --- | --- | --- |
| Mergulhado em | solução de sulfato de zinco | solução de sulfato de cobre |
| O que acontece | Zn → Zn²⁺ + 2 elétrons (**oxidação**) | Cu²⁺ + 2 elétrons → Cu (**redução**) |
| Nome | **ânodo** | **cátodo** |
| Polo | negativo | positivo |
| Com o tempo | a placa se desgasta | a placa engrossa |

Os elétrons saem do zinco, percorrem o fio (acendendo uma lâmpada no caminho) e chegam ao cobre. Uma **ponte salina** liga as duas soluções e fecha o circuito, permitindo a passagem de íons. A tensão é de cerca de **1,1 V**.

Na pilha, **energia química vira energia elétrica**, em uma reação **espontânea**.

### Pilhas e baterias do dia a dia

| Tipo | Onde se usa | Recarregável? |
| --- | --- | --- |
| Alcalina | controles, brinquedos, lanternas | não |
| Chumbo-ácido | carros e motos | sim |
| Íon-lítio | celulares, computadores, carros elétricos | sim |

"Bateria" é o nome de um conjunto de pilhas ligadas entre si. Nas recarregáveis, a passagem de corrente no sentido contrário desfaz a reação e devolve os reagentes.

### Descarte

Pilhas e baterias contêm metais que contaminam o solo e a água. **Não vão para o lixo comum.** A Política Nacional de Resíduos Sólidos (Lei nº 12.305, de 2010) obriga fabricantes, importadores, distribuidores e comerciantes a manter sistemas de **logística reversa**: recolher o produto usado. Na prática, deve-se entregá-las em pontos de coleta de lojas e assistências técnicas.

## Corrosão

A **ferrugem** é uma pilha indesejada. Em presença de **água** e **oxigênio**, o ferro se oxida e forma óxido de ferro, que esfarela e expõe mais metal. Perto do mar, o sal acelera o processo.

A corrosão destrói pontes, tubulações, navios, carros e as armaduras de aço dentro do concreto. Combatê-la custa caro; não combatê-la custa vidas.

| Proteção | Como funciona |
| --- | --- |
| Pintura, graxa, esmalte | isola o metal da água e do ar |
| **Galvanização** | cobre o aço com zinco, que se oxida no lugar do ferro |
| **Metal de sacrifício** | blocos de zinco ou magnésio presos a cascos de navio e tubulações enterradas se corroem no lugar do aço |
| Aço inoxidável | liga com cromo, que forma uma película protetora |

O **alumínio** se oxida mais facilmente que o ferro, mas a camada de óxido que se forma é fina, firme e impermeável, e protege o metal por baixo.

```verificar
Um casco de navio, de aço, tem blocos de zinco aparafusados. Com o tempo, o que se observa?
- O aço se corrói e o zinco fica intacto
+ O zinco se corrói e o aço fica protegido
- Os dois se corroem na mesma velocidade
> Veja a fila dos metais: qual dos dois perde elétrons com mais facilidade?
```

## Eletrólise

Na **eletrólise**, uma fonte externa de corrente **força** uma reação que não ocorreria sozinha. **Energia elétrica vira energia química.**

### A eletrólise da água

```conta
2 H₂O  →  2 H₂ + O₂
```

Passando corrente pela água (com um pouco de sal ou ácido para conduzir), forma-se gás hidrogênio em um eletrodo e gás oxigênio no outro, no dobro do volume para o hidrogênio. Se a eletricidade vier de fonte renovável, o hidrogênio produzido é chamado de **hidrogênio verde**.

### O alumínio

O alumínio é o metal mais abundante da crosta terrestre, mas nunca aparece puro: está preso no óxido da **bauxita**. Só a eletrólise, com o óxido fundido, consegue separá-lo. O processo consome uma quantidade enorme de **energia elétrica**, e é por isso que:

- as fábricas de alumínio se instalam perto de grandes hidrelétricas;
- **reciclar** latas de alumínio poupa a maior parte dessa energia.

O Brasil tem grandes reservas de bauxita, sobretudo na Amazônia. A mineração, o refino e as hidrelétricas que os alimentam têm custo ambiental e social alto para as populações da região.

### Outros usos

- **Cloro e soda cáustica**: obtidos pela eletrólise da salmoura (água com sal). São a base de boa parte da indústria química, incluindo o tratamento da água e o PVC.
- **Galvanoplastia**: cobrir um objeto com uma camada fina de metal (cromo, níquel, prata, ouro). É a cromação e a niquelação de peças.
- **Refino do cobre**: produz o cobre de alta pureza usado nos fios elétricos.

## Para praticar

1. Na reação Zn + 2 HCl → ZnCl₂ + H₂, quem se oxidou e quem se reduziu?
2. Use a fila dos metais: uma colher de alumínio pode ser guardada em uma solução de sulfato de cobre? E uma de prata?
3. Explique por que o portão de ferro enferruja mais depressa em uma cidade de praia.
4. Descubra onde há um ponto de coleta de pilhas e baterias no seu bairro.

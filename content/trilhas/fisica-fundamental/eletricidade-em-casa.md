---
titulo: "Eletricidade em casa"
resumo: "Objetivo: entender tensão, corrente, resistência e potência, e usar esse conhecimento para evitar choques, incêndios e desperdício."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 19.1, Ohm's Law"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-1-ohms-law"
  - titulo: "Physics, seção 19.4, Electric Power"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-4-electric-power"
quiz:
  - pergunta: "O que é a corrente elétrica?"
    opcoes: ["O movimento ordenado de cargas elétricas por um condutor", "A cor do fio", "A força do ímã"]
    resposta: 0
    explicacao: "Nos fios de metal, quem se move são os elétrons. A corrente mede-se em amperes."
  - pergunta: "Um chuveiro de 5.500 W ligado em 220 V puxa que corrente?"
    opcoes: ["2,5 A", "25 A", "250 A"]
    resposta: 1
    explicacao: "Corrente = potência ÷ tensão = 5.500 ÷ 220 = 25 amperes."
  - pergunta: "Para que serve o disjuntor?"
    opcoes: ["Para aumentar a energia", "Para desligar o circuito quando a corrente passa do limite que o fio aguenta", "Para economizar na conta"]
    resposta: 1
    explicacao: "Ele protege a fiação contra o aquecimento e evita incêndios."
  - pergunta: "Por que não se deve ligar muitos aparelhos em um mesmo benjamim?"
    opcoes: ["Porque a tomada fica feia", "Porque as correntes se somam e o fio pode esquentar até pegar fogo", "Porque os aparelhos brigam"]
    resposta: 1
    explicacao: "Cada aparelho puxa a sua corrente; o fio da tomada tem de suportar a soma de todas."
---

## O que corre no fio

A matéria é feita de átomos, e os átomos têm partículas com **carga elétrica**. Nos metais, uma parte dos elétrons fica livre para se mover. Quando eles se deslocam todos no mesmo sentido, há uma **corrente elétrica**.

- **Condutores** deixam a corrente passar com facilidade: cobre, alumínio, ferro, a água com sais e **o corpo humano**.
- **Isolantes** dificultam: borracha, plástico, vidro, madeira seca, porcelana.

É por isso que os fios são de cobre por dentro e de plástico por fora.

## Três grandezas

Uma comparação ajuda: pense na água em um encanamento.

| Grandeza | O que é | Na comparação | Unidade |
| --- | --- | --- | --- |
| **Tensão** (ou voltagem) | o que "empurra" as cargas | a pressão da água | volt (V) |
| **Corrente** | a quantidade de carga que passa por segundo | a vazão | ampere (A) |
| **Resistência** | a dificuldade que o material opõe à passagem | o cano estreito | ohm (Ω) |

A relação entre elas é a **lei de Ohm**:

**tensão = resistência × corrente**

Para a mesma tensão, quanto **menor a resistência, maior a corrente**. Guarde isso: é a chave para entender o choque e o curto-circuito.

No Brasil, as tomadas fornecem **127 V** ou **220 V**, conforme a cidade e o circuito. Antes de ligar um aparelho, confira a tensão. Ligar em 220 V o que é de 127 V queima o aparelho.

## Potência

A **potência** diz quanta energia o aparelho usa por segundo. Mede-se em **watts** (W).

**potência = tensão × corrente**

Com isso se calcula a corrente que cada aparelho puxa:

```conta
Chuveiro de 5.500 W em 220 V
corrente = 5.500 ÷ 220
= 25 A
```

```conta
Lâmpada de LED de 9 W em 127 V
corrente = 9 ÷ 127
= cerca de 0,07 A
```

O chuveiro puxa centenas de vezes mais corrente que a lâmpada. Por isso precisa de **fio mais grosso** e de um **circuito só para ele**. O cálculo da conta de luz, em kWh, está na aula [Energia e suas transformações](/trilhas/fisica-fundamental/energia-e-suas-transformacoes).

## Por que o fio esquenta

Toda corrente que passa por um fio o aquece. Às vezes é isso que se quer: no chuveiro, no ferro e na torradeira, um fio especial, a resistência, é feito para esquentar.

Na fiação da casa, o aquecimento é o perigo. Cada espessura de fio suporta uma corrente máxima. Acima dela, o fio esquenta, o plástico derrete, e pode haver **incêndio**.

**O benjamim.** Quando vários aparelhos são ligados na mesma tomada, as correntes **se somam**. Um aquecedor, um ferro e um micro-ondas juntos passam facilmente do que o fio aguenta.

**O curto-circuito.** Se os dois fios se encostam sem passar por um aparelho, a resistência fica quase nula e a corrente dispara. O calor é imediato.

## Disjuntor, fio terra e DR

| Dispositivo | O que faz | Protege |
| --- | --- | --- |
| **Disjuntor** | desliga o circuito quando a corrente passa do limite | a fiação, contra o aquecimento e o incêndio |
| **Fio terra** | dá um caminho fácil para a corrente que "vaza" de um aparelho com defeito | a pessoa, contra o choque na carcaça do aparelho |
| **DR** (dispositivo diferencial residual) | desliga quando percebe corrente escapando do circuito | a pessoa, contra o choque |

Se um disjuntor desarma com frequência, ele está avisando que há sobrecarga ou defeito. Trocar por um disjuntor "mais forte", sem trocar o fio, é desligar o alarme e deixar o incêndio.

```verificar
O disjuntor do chuveiro vive desarmando. Qual é a atitude correta?
- Trocar por um disjuntor de corrente maior, mantendo o mesmo fio
+ Chamar um eletricista para verificar o fio, as conexões e a potência do chuveiro
- Prender o disjuntor com fita para ele não cair
> O disjuntor é dimensionado para o fio. Se ele desarma, o problema está no circuito.
```

## O choque

O **choque** acontece quando uma corrente atravessa o corpo. O que fere e mata é a **corrente**, e ela depende da tensão e da resistência do corpo.

- A pele **seca** resiste bastante. A pele **molhada** resiste muito menos. Por isso o banheiro e a área de serviço são os lugares mais perigosos, e por isso não se mexe em nada elétrico com as mãos ou os pés molhados.
- Correntes bem pequenas, de frações de ampere, já podem parar o coração.
- O caminho importa: de uma mão à outra, a corrente passa pelo peito.

**Se alguém está levando um choque:** não toque na pessoa. Desligue a chave geral ou o disjuntor. Se não for possível, afaste-a do fio com um material isolante e seco, como um cabo de vassoura de madeira. Depois, chame o socorro (192). Veja a trilha de [primeiros socorros](/estantes/primeiros-socorros).

## Regras que salvam

1. Desligue o disjuntor antes de trocar lâmpada, chuveiro ou tomada.
2. Não use benjamins para aparelhos que esquentam.
3. Não deixe fios desencapados nem emendas malfeitas.
4. Não mexa no chuveiro com ele ligado nem com o corpo molhado.
5. Longe da rede elétrica com pipas, antenas, varas e escadas de metal.
6. Instalação elétrica é serviço para eletricista, com material de qualidade.

## Gambiarra tem causa

Fio fino, emenda com fita, ligação improvisada: grande parte dos incêndios em moradias populares começa na instalação elétrica. Isso não vem de descuido de quem mora. Vem de casas construídas sem projeto, de material barato, de redes sobrecarregadas e de bairros onde a ligação regular não chega. Segurança elétrica é também uma questão de moradia digna.

## Para praticar

1. Que corrente puxa um ferro de 1.100 W ligado em 127 V?
2. Um micro-ondas de 1.200 W e uma cafeteira de 800 W estão no mesmo benjamim, em 127 V. Qual é a corrente total?
3. Localize o quadro de disjuntores da sua casa. Quantos circuitos há? O chuveiro tem um só para ele?
4. Sua casa tem fio terra e DR?

**Respostas:** 1) Cerca de 8,7 A. 2) 2.000 ÷ 127, cerca de 15,7 A.

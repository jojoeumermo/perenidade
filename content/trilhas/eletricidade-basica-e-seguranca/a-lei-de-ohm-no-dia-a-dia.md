---
titulo: "A lei de Ohm no dia a dia"
resumo: "Tensão é igual a resistência vezes corrente: a conta que diz quanta corrente um aparelho puxa, por que o fio esquenta e como resistências se somam em série e se repartem em paralelo."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "College Physics 2e, seção 20.2, Ohm's Law: Resistance and Simple Circuits"
    autor: "Paul Peter Urone e Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/20-2-ohms-law-resistance-and-simple-circuits"
  - titulo: "College Physics 2e, seção 20.3, Resistance and Resistivity"
    autor: "Paul Peter Urone e Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/20-3-resistance-and-resistivity"
  - titulo: "College Physics 2e, seção 21.1, Resistors in Series and Parallel"
    autor: "Paul Peter Urone e Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/21-1-resistors-in-series-and-parallel"
  - titulo: "Lei de Ohm"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Lei_de_Ohm"
quiz:
  - pergunta: "Uma resistência de 22 Ω está ligada em 220 V. Qual é a corrente?"
    opcoes: ["2 A", "10 A", "4.840 A"]
    resposta: 1
    explicacao: "I = V ÷ R = 220 ÷ 22 = 10 A."
  - pergunta: "Na casa, as tomadas e as lâmpadas são ligadas em:"
    opcoes: ["Série, uma depois da outra", "Paralelo, cada uma recebendo a tensão da rede", "Tanto faz"]
    resposta: 1
    explicacao: "Em paralelo, cada aparelho recebe a tensão inteira e funciona sozinho. Em série, se um apaga, todos apagam."
  - pergunta: "Duas resistências de 10 Ω em série dão, juntas:"
    opcoes: ["5 Ω", "10 Ω", "20 Ω"]
    resposta: 2
    explicacao: "Em série, as resistências se somam: 10 + 10 = 20 Ω."
  - pergunta: "Um fio mais fino e mais comprido, do mesmo metal, tem:"
    opcoes: ["Mais resistência", "Menos resistência", "A mesma resistência"]
    resposta: 0
    explicacao: "A resistência cresce com o comprimento e diminui com a grossura do fio. Por isso fio fino demais esquenta."
---

```provocacao
Por que a extensão fininha esquenta quando você liga a airfryer nela, e a tomada da parede não?
```

## O que você vai aprender

Ao fim desta aula você vai usar a lei de Ohm para calcular corrente, tensão ou resistência, entender por que fio fino e comprido esquenta e saber a diferença entre ligar coisas em série e em paralelo.

## A conta que liga as três grandezas

Na aula anterior, vimos que com a mesma tensão, mais resistência dá menos corrente. Em 1827, o alemão Georg Simon Ohm mostrou que, para muitos materiais, essa relação é uma proporção exata:

```formula
V = R × I
tensão (volts) = resistência (ohms) × corrente (ampères)
```

Quem sabe duas grandezas descobre a terceira:

- **I = V ÷ R** quando se quer a corrente;
- **R = V ÷ I** quando se quer a resistência;
- **V = R × I** quando se quer a tensão.

Um jeito de lembrar é o triângulo: V em cima, R e I embaixo. Cubra com o dedo o que você quer achar e veja o que sobra.

## Exemplo resolvido

**A resistência de um ferro de passar tem 48,4 Ω. Ligado em 220 V, quanta corrente ele puxa?**

```conta
I = V ÷ R
= 220 ÷ 48,4
= 4,5 A (arredondando)
```

1. O que se quer: a corrente.
2. O que se sabe: tensão (220 V) e resistência (48,4 Ω).
3. Divide a tensão pela resistência: cerca de 4,5 ampères.

Confira o sentido: uma resistência baixa num empurrão forte dá uma corrente considerável. É por isso que o ferro precisa de uma tomada em bom estado.

## O fio também tem resistência

Fio não é perfeito: ele também tem resistência, pequena, que depende de três coisas:

- do **material** (o cobre conduz melhor que o alumínio, que conduz melhor que o ferro);
- do **comprimento** (quanto mais comprido, mais resistência);
- da **grossura** (quanto mais grosso, menos resistência).

Quando a corrente passa por uma resistência, parte da energia vira calor. No fio da parede, grosso e curto, esse calor é pequeno. Numa extensão fina e comprida, ligada a um aparelho que puxa muita corrente, o calor aumenta, a capa de plástico amolece e o risco de incêndio cresce.

```navidareal
**A extensão quente.** Aparelhos que esquentam (airfryer, chaleira, aquecedor, ferro) puxam muita corrente. Ligados numa extensão fina, com vários outros aparelhos no mesmo "benjamim", o fio aquece. Sinal de alerta: plugue ou fio morno ao toque, cheiro de plástico, tomada escurecida. Aparelho de aquecer vai direto na tomada da parede.
```

## Série e paralelo

Há dois jeitos de ligar várias resistências.

**Em série**, uma depois da outra, num caminho só. A corrente é a mesma em todas, e as resistências **se somam**: R total = R1 + R2 + … Se uma queimar, o caminho se abre e tudo apaga. É o pisca-pisca antigo de Natal, em que uma lâmpada queimada apagava o fio inteiro.

**Em paralelo**, cada uma num caminho próprio, todas ligadas aos mesmos dois pontos. Cada uma recebe a **tensão inteira** da rede e funciona sozinha. É assim que a casa é ligada: você apaga a luz da sala e a geladeira continua funcionando. Quanto mais aparelhos ligados em paralelo, **mais corrente total** passa pelo fio que alimenta todos eles.

```verificar
Num circuito de tomadas estão ligados, em paralelo, um aparelho que puxa 6 A e outro que puxa 4 A. Quanta corrente passa pelo fio que alimenta os dois?
- 4 A
- 6 A
+ 10 A
> Em paralelo, as correntes de cada ramo se somam no fio que alimenta todos.
```

## Resumo

- **V = R × I**: tensão é resistência vezes corrente. Com duas grandezas, acha-se a terceira.
- Fio comprido e fino tem mais resistência e esquenta mais.
- Em **série**, resistências se somam e um defeito apaga tudo.
- Em **paralelo**, cada aparelho recebe a tensão inteira, e as correntes se somam no fio principal.
- Aparelho que esquenta vai direto na tomada da parede, não em extensão fina.

```leve
- Procure em casa uma extensão ou um "benjamim" com aparelhos de aquecer ligados e explique o risco a quem mora com você.
- Faça a conta do ferro de passar para a tensão da sua casa.
```

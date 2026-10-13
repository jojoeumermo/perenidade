---
titulo: "Eletromagnetismo"
resumo: "Objetivo: entender a relação entre eletricidade e magnetismo, explicar o funcionamento do motor, do gerador e do transformador e por que a energia é transmitida em alta tensão."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 20.1, Magnetic Fields, Field Lines, and Force"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/20-1-magnetic-fields-field-lines-and-force"
  - titulo: "Physics, seção 20.2, Motors, Generators, and Transformers"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/20-2-motors-generators-and-transformers"
  - titulo: "Physics, seção 20.3, Electromagnetic Induction"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/20-3-electromagnetic-induction"
quiz:
  - pergunta: "O que Oersted descobriu em 1820?"
    opcoes: ["Que a corrente elétrica cria um campo magnético", "Que os ímãs têm dois polos", "Que a luz é uma onda"]
    resposta: 0
    explicacao: "Ele viu a agulha de uma bússola desviar quando passava corrente em um fio próximo."
  - pergunta: "O que é necessário para induzir corrente em uma bobina usando um ímã?"
    opcoes: ["Deixar o ímã parado dentro da bobina", "Fazer o campo magnético através da bobina variar, por exemplo movendo o ímã", "Aquecer a bobina"]
    resposta: 1
    explicacao: "É a lei de Faraday: só há corrente induzida enquanto o campo magnético através da bobina está variando."
  - pergunta: "Um transformador tem 1 000 espiras no primário e 50 no secundário. Ligado a 220 V, fornece:"
    opcoes: ["11 V", "4 400 V", "220 V"]
    resposta: 0
    explicacao: "A tensão é proporcional ao número de espiras: 220 × 50 ÷ 1 000 = 11 V."
  - pergunta: "Por que a energia elétrica é transmitida em alta tensão?"
    opcoes: ["Para que chegue mais rápido", "Porque, com tensão alta, a corrente é menor e a perda por aquecimento nos fios diminui muito", "Porque é mais segura para quem encosta nos fios"]
    resposta: 1
    explicacao: "A perda nos fios é R·i²: reduzir a corrente a um décimo reduz a perda a um centésimo."
---

## Duas forças que são uma

Até o começo do século XIX, eletricidade e magnetismo eram estudados como coisas separadas. Em poucas décadas, descobriu-se que são dois lados do mesmo fenômeno. Dessa descoberta saíram o motor, o gerador, o transformador e toda a rede elétrica.

Esta aula continua [Ímãs e magnetismo](/trilhas/fisica-fundamental/imas-e-magnetismo) e [Circuitos elétricos](/trilhas/fisica-medio/circuitos-eletricos).

## Corrente cria magnetismo

Em **1820**, o dinamarquês **Hans Christian Oersted** percebeu que a agulha de uma bússola se desviava quando passava corrente em um fio próximo. Conclusão: **toda corrente elétrica cria um campo magnético** em volta de si.

### O eletroímã

Enrolando o fio em muitas voltas (uma **bobina**) em torno de um núcleo de ferro, o efeito se multiplica: é o **eletroímã**, um ímã que se liga e desliga com a corrente. Quanto mais espiras e mais corrente, mais forte.

Está no guindaste do ferro-velho, na campainha, na fechadura elétrica, no alto-falante e nos aparelhos de ressonância magnética.

## Magnetismo empurra corrente

Um fio com corrente, colocado dentro de um campo magnético, sofre uma **força**. A força é perpendicular ao fio e ao campo.

### O motor elétrico

Uma bobina com corrente, entre os polos de um ímã, recebe forças que a fazem **girar**. Um mecanismo inverte a corrente a cada meia volta, para que o giro continue sempre no mesmo sentido.

O motor transforma **energia elétrica em energia mecânica**. Está no ventilador, no liquidificador, na geladeira, na máquina de lavar, na furadeira, no elevador, no metrô e no carro elétrico.

## Magnetismo cria corrente: a indução

Se a corrente cria magnetismo, o contrário também vale? Em **1831**, o inglês **Michael Faraday** mostrou que sim, com uma condição.

Um ímã **parado** perto de uma bobina não produz nada. Mas, quando o ímã **se move**, entrando ou saindo da bobina, aparece corrente no fio.

> **Lei de Faraday**: uma variação do campo magnético através de um circuito induz nele uma tensão. Quanto mais rápida a variação, maior a tensão induzida.

É a **indução eletromagnética**. Faraday, filho de ferreiro, não teve estudo formal: começou como aprendiz de encadernador e aprendeu ciência lendo os livros que encadernava.

```verificar
Um ímã é deixado parado dentro de uma bobina ligada a um medidor de corrente. O que o medidor indica?
- Uma corrente constante
+ Nenhuma corrente
- Uma corrente que aumenta com o tempo
> A indução depende da variação do campo magnético, não da simples presença do ímã.
```

### O gerador

O gerador é um **motor ao contrário**: alguma coisa faz girar uma bobina dentro de um campo magnético (ou um ímã dentro de uma bobina), e a variação do campo induz corrente.

Transforma **energia mecânica em energia elétrica**. O que muda de uma usina para outra é o que faz o eixo girar:

| Usina | O que move a turbina |
| --- | --- |
| Hidrelétrica | a água que desce da represa |
| Termelétrica | o vapor produzido pela queima de carvão, gás, óleo ou biomassa |
| Nuclear | o vapor produzido pelo calor da fissão nuclear |
| Eólica | o vento |

A exceção é a energia **solar fotovoltaica**, que não usa gerador: transforma a luz diretamente em eletricidade.

Como a bobina gira, a corrente induzida muda de sentido a cada meia volta. É a **corrente alternada**. No Brasil, ela completa **60 ciclos por segundo** (60 Hz).

## O transformador

O transformador **aumenta ou diminui a tensão**. São duas bobinas enroladas no mesmo núcleo de ferro:

- a corrente alternada na primeira bobina (o **primário**) cria um campo magnético que varia o tempo todo;
- esse campo variável induz tensão na segunda bobina (o **secundário**).

A relação entre as tensões é a mesma que entre os números de espiras:

**U₁ ÷ U₂ = N₁ ÷ N₂**

```conta
Primário com 1 000 espiras, ligado a 220 V. Secundário com 50 espiras.
U₂ = 220 × 50 ÷ 1 000 = 11 V
```

O transformador **só funciona com corrente alternada**: com corrente contínua, o campo não varia e nada é induzido. E ele não cria energia: se a tensão sobe, a corrente desce na mesma proporção.

## Por que alta tensão nas linhas

As usinas ficam a centenas de quilômetros das cidades. Os fios têm resistência e esquentam (efeito Joule), desperdiçando energia. A perda é **P = R · i²**.

A potência transmitida é P = U · i. Para transmitir a mesma potência, pode-se usar tensão baixa com corrente alta ou **tensão alta com corrente baixa**.

```conta
Transmitir a mesma potência com tensão 10 vezes maior:
a corrente fica 10 vezes menor
a perda nos fios (R·i²) fica 10 × 10 = 100 vezes menor
```

Por isso a tensão é elevada na saída da usina a centenas de milhares de volts, viaja pelas torres e é reduzida aos poucos nas subestações e nos transformadores dos postes, até chegar a 127 V ou 220 V nas casas.

## Ondas eletromagnéticas

Na década de 1860, o escocês **James Clerk Maxwell** reuniu toda a eletricidade e todo o magnetismo em um conjunto de equações. Delas saiu uma previsão espantosa: campos elétricos e magnéticos variáveis podem se sustentar um ao outro e viajar pelo espaço como **ondas**, à velocidade da luz. A conclusão de Maxwell: **a luz é uma onda eletromagnética**.

No fim da década de 1880, o alemão **Heinrich Hertz** produziu e detectou essas ondas em laboratório. Poucos anos depois vieram o telégrafo sem fio e o rádio. Veja o espectro completo na aula de [Ondas](/trilhas/fisica-medio/ondas).

## Para praticar

1. Construa um eletroímã com um prego grande, um metro de fio esmaltado e uma pilha. Quantos clipes ele levanta? E com o dobro de voltas?
2. Um carregador de celular reduz 127 V para 5 V. Qual deve ser a razão entre as espiras do primário e do secundário? (Considere apenas o transformador.)
3. Por que um transformador não funciona ligado a uma bateria de carro?
4. Explique o caminho da energia desde a água na represa até a lâmpada da sua casa, indicando cada transformação.

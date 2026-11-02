---
titulo: "Corrente, tensão, resistência e Lei de Ohm"
resumo: "O que são corrente, tensão e resistência, a Lei de Ohm (U = R · i), por que o fio fino e comprido esquenta mais, e o que acontece com um aparelho de 127 V ligado em 220 V."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 19.1, Ohm's law"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-1-ohms-law"
  - titulo: "College Physics 2e, seção 20.2, Ohm's Law: Resistance and Simple Circuits"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/20-2-ohms-law-resistance-and-simple-circuits"
  - titulo: "College Physics 2e, seção 20.3, Resistance and Resistivity"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/20-3-resistance-and-resistivity"
  - titulo: "Physics, seção 19.4, Electric Power"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/19-4-electric-power"
  - titulo: "Provas e gabaritos do Enem (as provas de 2022 e 2023, base da contagem do instituto)"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Um resistor de 10 Ω é atravessado por uma corrente de 2 A. Qual é a tensão entre os seus terminais?"
    opcoes: ["5 V", "12 V", "0,2 V", "20 V"]
    resposta: 3
    explicacao: "Pela Lei de Ohm, U = R · i = 10 × 2 = 20 V."
  - pergunta: "Um aparelho ligado em 220 V é atravessado por 11 A. A resistência dele é de"
    opcoes: ["20 Ω", "2.420 Ω", "0,05 Ω", "231 Ω"]
    resposta: 0
    explicacao: "De U = R · i, a resistência é R = U ÷ i = 220 ÷ 11 = 20 Ω."
  - pergunta: "Dois fios de cobre têm o mesmo comprimento. Um é mais grosso que o outro. O fio mais grosso tem resistência"
    opcoes: ["maior", "menor", "igual, porque o material é o mesmo", "zero"]
    resposta: 1
    explicacao: "Pela segunda Lei de Ohm, R = ρ · L ÷ A. Área A maior, no denominador, dá resistência menor. Um fio grosso é como uma rua larga: passa mais corrente com menos dificuldade."
  - pergunta: "Um ampère (1 A) de corrente quer dizer que passa pelo fio"
    opcoes: ["1 volt por segundo", "1 watt por segundo", "1 coulomb de carga por segundo", "1 ohm por segundo"]
    resposta: 2
    explicacao: "Corrente é a quantidade de carga que passa por segundo: i = Q ÷ Δt. A carga se mede em coulombs (C); 1 A = 1 C/s."
---

```provocacao
Na embalagem de um secador de cabelo está escrito "127 V". Alguém o liga numa tomada de 220 V e, segundos depois, ele solta fumaça. A tomada deu "mais energia" do que ele aguentava? O que mudou dentro do aparelho?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que são corrente, tensão e resistência, usar a Lei de Ohm (U = R · i) para achar qualquer uma das três, explicar como o comprimento e a grossura de um fio mudam a sua resistência e entender por que um resistor esquenta.

## Corrente: carga que passa por segundo

Um fio de cobre está cheio de elétrons que podem andar. Quando o fio é ligado a uma pilha ou à tomada, esses elétrons passam a se mover num sentido. Esse movimento ordenado de cargas é a **corrente elétrica**.

A corrente mede quanta carga atravessa o fio a cada segundo.

```formula
i = Q ÷ Δt
corrente (em ampères) = carga que passou (em coulombs) ÷ tempo (em segundos)
30 C passando em 10 s dão 30 ÷ 10 = 3 A
```

A carga se mede em **coulombs** (C). Um ampère (1 A) é um coulomb por segundo. Por convenção, desenha-se a corrente saindo do polo positivo e entrando no negativo, mesmo que os elétrons, que são negativos, andem ao contrário. Na prova, use o sentido convencional.

## Tensão: o empurrão nas cargas

Para a corrente existir, algo precisa empurrar as cargas. Esse empurrão é a **tensão elétrica**, também chamada de diferença de potencial (ddp). Ela se mede em **volts** (V).

Pense numa caixa-d'água. A água desce pelo cano porque a caixa está no alto. A diferença de altura é como a tensão; a água que passa por segundo é como a corrente.

A tensão é dada pela fonte. Uma pilha comum dá 1,5 V. As tomadas no Brasil são de 127 V ou de 220 V, conforme a região e a instalação. A tensão diz quanta energia cada coulomb de carga recebe: 1 V é 1 joule por coulomb.

## Resistência e a Lei de Ohm

Nem tudo deixa a corrente passar com a mesma facilidade. A **resistência elétrica** (R) mede a dificuldade que um material ou um aparelho oferece à corrente. Ela se mede em **ohms** (Ω, a letra grega ômega).

Para muitos materiais, como os metais em temperatura constante, a corrente é proporcional à tensão: dobre a tensão, e a corrente dobra. A resistência fica constante. Esses materiais se chamam **ôhmicos**, e para eles vale a **Lei de Ohm**:

```formula
U = R · i
tensão (em volts) = resistência (em ohms) × corrente (em ampères)
um resistor de 10 Ω com 2 A tem 10 × 2 = 20 V entre os terminais
```

Com a mesma fórmula se acha qualquer uma das três: R = U ÷ i e i = U ÷ R. Com a tensão fixa, mais resistência quer dizer menos corrente.

Num gráfico de tensão por corrente, um resistor ôhmico dá uma reta que passa pela origem. A inclinação da reta é a resistência.

## O fio: comprimento, grossura e material

A resistência de um fio depende de três coisas. A **segunda Lei de Ohm** junta todas:

```formula
R = ρ · L ÷ A
resistência = resistividade do material × comprimento ÷ área da seção do fio
fio duas vezes mais comprido: resistência dobra; fio com o dobro da área: resistência cai pela metade
```

- **Material** (ρ, a letra grega rô, a resistividade): o cobre conduz muito bem, por isso é usado nas instalações.
- **Comprimento** (L): fio mais comprido, mais resistência.
- **Área da seção** (A): fio mais grosso, menos resistência. Cuidado: se o **diâmetro** dobra, a área fica **4 vezes** maior (a área do círculo vai com o quadrado do diâmetro), e a resistência cai para um quarto.

## O resistor esquenta: efeito Joule

Quando a corrente atravessa um resistor, as cargas trombam com os átomos do material e passam energia para eles. O resistor esquenta. Isso é o **efeito Joule**: energia elétrica que vira energia térmica.

É o que se quer no chuveiro, no ferro de passar e na torradeira. É o que não se quer num fio fino de extensão que alimenta um aparelho forte: ele esquenta, derrete o plástico e pode causar incêndio. A potência dissipada num resistor sai da Lei de Ohm junto com P = U · i:

```formula
P = R · i² = U² ÷ R
potência no resistor = resistência × corrente ao quadrado = tensão ao quadrado ÷ resistência
um resistor de 22 Ω em 220 V: 220 × 220 ÷ 22 = 2.200 W
```

```navidareal
# O secador de 127 V na tomada de 220 V
A resistência do secador é a mesma em qualquer tomada. Em 220 V, a tensão é cerca de 1,7 vez a de 127 V. Pela Lei de Ohm, a corrente também fica cerca de 1,7 vez maior.

A potência, que vai com a tensão ao quadrado, fica cerca de 3 vezes maior (1,7 × 1,7 ≈ 3). O resistor recebe três vezes mais energia por segundo do que foi feito para aguentar, esquenta demais e queima. A tomada não "empurrou energia a mais" à toa: a tensão maior empurrou mais corrente pela mesma resistência.
```

```verificar
Uma lâmpada ligada em 127 V é atravessada por 0,5 A. Qual é a resistência dela nesse funcionamento?
- 63,5 Ω
+ 254 Ω
- 127,5 Ω
> R = U ÷ i = 127 ÷ 0,5 = 254 Ω. Dividir por 0,5 é o mesmo que multiplicar por 2.
```

## Exemplo resolvido

**Um aquecedor tem resistência de 22 Ω e funciona ligado em 220 V. Qual é a corrente nele e a sua potência? Se a tensão caísse pela metade, para 110 V, quais seriam a nova corrente e a nova potência?**

1. Corrente em 220 V: i = U ÷ R = 220 ÷ 22 = 10 A.
2. Potência: P = U · i = 220 × 10 = 2.200 W.
3. Corrente em 110 V, com a mesma resistência: i = 110 ÷ 22 = 5 A. Caiu pela metade.
4. Potência em 110 V: P = 110 × 5 = 550 W.

Confira: com a tensão pela metade, a corrente cai pela metade e a potência cai para um quarto (2.200 ÷ 4 = 550). É a tensão ao quadrado: (1/2)² = 1/4.

## Como isso cai no ENEM

- **Formatos:** etiqueta de aparelho com tensão e potência, chuveiro e ferro de passar, escolha da espessura do fio, gráfico de tensão por corrente, aparelho ligado na tensão errada, extensão que esquenta. A questão pede a corrente, a resistência ou a tensão pela Lei de Ohm, compara fios pela segunda Lei de Ohm ou explica o aquecimento pelo efeito Joule.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, os fenômenos elétricos e magnéticos tiveram 7 das 89 questões classificadas de Ciências da Natureza (7,9%). Este tópico, corrente, tensão, resistência e Lei de Ohm, teve 2 delas (2,2%). São só duas edições: é tendência, não promessa.
- **Habilidades:** H5 (dimensionar circuitos e aparelhos elétricos do dia a dia), que teve 4 questões nessa mesma base, H21 (usar leis da física para interpretar processos eletromagnéticos), com 5, e H6 (entender manuais de instalação ou de uso de aparelhos).
- **Armadilhas:**
  - Achar que resistência maior dá mais corrente. Com a mesma tensão, é o contrário.
  - Dobrar o diâmetro do fio e dividir a resistência só por 2. A área fica 4 vezes maior.
  - Confundir tensão (volts, dada pela tomada) com corrente (ampères, que depende do aparelho).
  - Esquecer que a resistência do aparelho não muda com a tomada: o que muda é a corrente.

## Questão comentada

**Texto-base.** Um eletricista compara dois fios feitos do mesmo cobre. O fio B tem o dobro do comprimento do fio A e também o dobro do diâmetro. A resistência de um fio é diretamente proporcional ao seu comprimento e inversamente proporcional à área da sua seção, que é circular.

**Comando.** Em relação à resistência do fio A, a resistência do fio B é

A) 4 vezes maior.
B) 2 vezes maior.
C) igual.
D) um quarto.
E) a metade.

**Resolução.**

1. Comprimento dobrado: a resistência fica multiplicada por 2.
2. Diâmetro dobrado: a área do círculo vai com o quadrado do diâmetro, então fica 2 × 2 = 4 vezes maior. A resistência fica dividida por 4.
3. Juntando: 2 ÷ 4 = 1/2. O fio B tem a metade da resistência do fio A.

**Gabarito: E.**

**Por que as outras não:**

- A) 4 vezes maior: você multiplicou pelos dois fatores, como se a área também aumentasse a resistência. Área maior diminui a resistência.
- B) 2 vezes maior: você contou só o comprimento e esqueceu a grossura.
- C) igual: você achou que o diâmetro dobrado compensa o comprimento dobrado. Mas a área cresce 4 vezes, não 2.
- D) um quarto: você contou só a área e esqueceu que o comprimento dobrou.

```realidade
Procure na sua casa a etiqueta de um aparelho que esquenta (chuveiro, ferro, secador, sanduicheira). Anote a tensão e a potência. Com P = U · i, calcule a corrente que ele puxa e, com U = R · i, a resistência dele.
```

## Resumo

- Corrente é carga por segundo: i = Q ÷ Δt, em ampères (1 A = 1 C/s).
- Tensão é o empurrão nas cargas, em volts, dada pela fonte.
- Resistência é a dificuldade à corrente, em ohms. Lei de Ohm: U = R · i.
- Segunda Lei de Ohm: R = ρ · L ÷ A. Fio longo, mais resistência; fio grosso, menos. Diâmetro dobrado, área 4 vezes maior.
- Efeito Joule: o resistor esquenta. P = R · i² = U² ÷ R.
- A resistência de um aparelho não muda com a tomada; tensão maior empurra mais corrente.
- As fórmulas também estão no [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica).

## Para aprofundar

- [Eletricidade em casa](/trilhas/fisica-fundamental/eletricidade-em-casa)
- [Circuitos elétricos](/trilhas/fisica-medio/circuitos-eletricos)
- [Circuitos em série e em paralelo](/trilhas/enem-fisica/circuitos)
- [Potência elétrica, consumo em kWh e conta de luz](/trilhas/enem-fisica/consumo)
- [Formulário de física](/trilhas/enem-reta-final/formulario-de-fisica)

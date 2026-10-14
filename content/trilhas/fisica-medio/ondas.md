---
titulo: "Ondas"
resumo: "Objetivo: reconhecer os tipos de onda, medir comprimento de onda, frequência e velocidade, e explicar reflexão, refração, difração, interferência e ressonância."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 13.1, Types of Waves"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/13-1-types-of-waves"
  - titulo: "Physics, seção 13.2, Wave Properties: Speed, Amplitude, Frequency, and Period"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/13-2-wave-properties-speed-amplitude-frequency-and-period"
  - titulo: "Physics, seção 13.3, Wave Interaction: Superposition and Interference"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/13-3-wave-interaction-superposition-and-interference"
quiz:
  - pergunta: "O que uma onda transporta?"
    opcoes: ["Matéria", "Energia, sem transportar matéria", "Matéria e energia, sempre juntas"]
    resposta: 1
    explicacao: "Uma rolha na água sobe e desce quando a onda passa, mas não acompanha a onda."
  - pergunta: "Qual destas ondas pode se propagar no vácuo?"
    opcoes: ["O som", "A luz", "A onda em uma corda"]
    resposta: 1
    explicacao: "A luz é onda eletromagnética; o som é onda mecânica e precisa de um meio material."
  - pergunta: "Uma emissora de rádio transmite em 100 MHz. Qual é o comprimento de onda? (velocidade: 300 000 000 m/s)"
    opcoes: ["3 m", "30 m", "0,3 m"]
    resposta: 0
    explicacao: "λ = v ÷ f = 300 000 000 ÷ 100 000 000 = 3 m."
  - pergunta: "O que acontece quando a crista de uma onda encontra o vale de outra, de mesma amplitude?"
    opcoes: ["Elas se reforçam", "Elas se anulam naquele ponto", "Uma delas volta"]
    resposta: 1
    explicacao: "É a interferência destrutiva, usada nos fones com cancelamento de ruído."
---

## O que é uma onda

Jogue uma pedra em um lago. Círculos se espalham pela superfície. Uma folha que boia ali perto **sobe e desce**, mas não vai embora com a onda.

Uma **onda** é uma perturbação que se propaga, transportando **energia sem transportar matéria**.

## Tipos de onda

**Quanto à natureza:**

| Tipo | Precisa de meio material? | Exemplos |
| --- | --- | --- |
| **Mecânica** | sim | som, ondas na água, ondas em cordas, terremotos |
| **Eletromagnética** | não: propaga-se até no vácuo | luz, ondas de rádio, micro-ondas, raios X |

No espaço, onde não há ar, não há som. Mas a luz do Sol chega até nós.

**Quanto à direção da vibração:**

- **Transversal**: a vibração é perpendicular à direção em que a onda avança. Exemplo: sacudir uma corda para cima e para baixo. A luz também é transversal.
- **Longitudinal**: a vibração tem a mesma direção em que a onda avança. Exemplo: o [som](/trilhas/fisica-fundamental/som) no ar, feito de compressões e rarefações.

## As medidas de uma onda

| Grandeza | Símbolo | O que é | Unidade |
| --- | --- | --- | --- |
| Amplitude | A | a altura da crista em relação à posição de repouso | metro |
| Comprimento de onda | λ (lambda) | a distância entre duas cristas vizinhas | metro |
| Frequência | f | o número de oscilações por segundo | hertz (Hz) |
| Período | T | o tempo de uma oscilação completa | segundo |

Frequência e período são inversos: **T = 1 ÷ f**. Uma onda de 50 Hz tem período de 0,02 s.

A **amplitude** está ligada à **energia** da onda: som mais forte, luz mais intensa, onda do mar mais alta.

## A equação fundamental

**v = λ · f**

A velocidade da onda é o comprimento de onda multiplicado pela frequência.

A **velocidade** depende do **meio**. O som anda a cerca de 340 m/s no ar e a cerca de 1 500 m/s na água. A luz anda a cerca de 300 000 000 m/s no vácuo.

A **frequência** é dada pela **fonte** e não muda quando a onda troca de meio. Portanto, em um mesmo meio, frequência maior significa comprimento de onda menor.

```conta
A nota lá (440 Hz), no ar:
λ = 340 ÷ 440 ≈ 0,77 m

Rádio FM em 100 MHz (100 000 000 Hz):
λ = 300 000 000 ÷ 100 000 000 = 3 m

Wi-Fi em 2,4 GHz (2 400 000 000 Hz):
λ = 300 000 000 ÷ 2 400 000 000 = 0,125 m = 12,5 cm
```

```verificar
Uma onda passa do ar para a água e a sua velocidade aumenta. O que acontece com o comprimento de onda?
- Diminui
+ Aumenta
- Fica igual
> A frequência não muda. Em v = λ·f, se v aumenta e f fica igual, o que acontece com λ?
```

## O que as ondas fazem

### Reflexão

A onda bate em um obstáculo e **volta**. É o **eco** do som, a imagem no espelho, o radar e o sonar. Morcegos e golfinhos se orientam emitindo sons e ouvindo o retorno.

### Refração

A onda **muda de meio** e muda de velocidade, o que costuma desviar a sua direção. É o que faz o canudo parecer "quebrado" no copo d'água. Veja em [Óptica geométrica](/trilhas/fisica-medio/optica-geometrica).

### Difração

A onda **contorna** obstáculos e se espalha depois de passar por uma abertura. É por isso que ouvimos alguém falando do outro lado de um muro, mesmo sem vê-lo. A difração é mais forte quando o comprimento de onda é parecido com o tamanho do obstáculo: o som (com comprimento de onda de centímetros a metros) contorna portas e muros; a luz (com comprimento de onda minúsculo), quase não.

Pela mesma razão, as ondas de rádio AM, com centenas de metros, contornam morros melhor do que as de FM.

### Interferência

Duas ondas que se encontram **se somam**.

- **Construtiva**: crista com crista. A onda resultante é maior.
- **Destrutiva**: crista com vale. As ondas se cancelam.

Os fones com **cancelamento de ruído** captam o som de fora e emitem uma onda igual, mas invertida: as duas se anulam.

### Ressonância

Todo objeto tem frequências em que vibra com mais facilidade. Se recebe empurrões justamente nessa frequência, a amplitude cresce muito: é a **ressonância**.

Quem empurra uma criança no balanço sabe: é preciso empurrar **no ritmo certo**. Empurrões pequenos, na frequência do balanço, levam a criança bem alto.

A ressonância está na caixa dos instrumentos musicais e na sintonia do rádio. E precisa ser evitada em pontes e edifícios, que não podem ter frequências de vibração próximas das do vento, dos passos ou dos terremotos da região.

## O espectro eletromagnético

As ondas eletromagnéticas são todas da mesma natureza. Mudam a frequência e o comprimento de onda.

| Tipo | Uso |
| --- | --- |
| Ondas de rádio | rádio, televisão, celular |
| Micro-ondas | forno, Wi-Fi, radar |
| Infravermelho | controle remoto, câmeras térmicas |
| Luz visível | visão |
| Ultravioleta | esterilização; causa queimadura de sol |
| Raios X | radiografia |
| Raios gama | radioterapia |

Da primeira à última linha, a frequência **aumenta** e o comprimento de onda **diminui**. As de frequência mais alta (do ultravioleta em diante) carregam energia suficiente para danificar as células: por isso o protetor solar e o avental de chumbo na radiografia.

## Para praticar

1. Uma onda na água tem cristas a cada 2 m e passa por um barco parado com frequência de 0,5 Hz. Qual é a sua velocidade?
2. Calcule o comprimento de onda de um som de 100 Hz e de um de 10 000 Hz, no ar.
3. Por que ouvimos o trovão depois de ver o relâmpago?
4. Explique por que soldados costumam atravessar pontes sem marchar em passo cadenciado.

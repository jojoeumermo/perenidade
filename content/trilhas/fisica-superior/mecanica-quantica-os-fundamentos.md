---
titulo: "Mecânica quântica: os fundamentos"
resumo: "Objetivo: entender as ideias centrais da mecânica quântica: quantização, ondas de matéria, função de onda e probabilidade, princípio da incerteza, equação de Schrödinger e as suas consequências para os átomos e a tecnologia."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "University Physics, volume 3, seção 6.4, Bohr's Model of the Hydrogen Atom"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/6-4-bohrs-model-of-the-hydrogen-atom"
  - titulo: "University Physics, volume 3, seção 6.5, De Broglie's Matter Waves"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/6-5-de-broglies-matter-waves"
  - titulo: "University Physics, volume 3, seção 7.1, Wave Functions"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/7-1-wave-functions"
  - titulo: "University Physics, volume 3, seção 7.2, The Heisenberg Uncertainty Principle"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/7-2-the-heisenberg-uncertainty-principle"
  - titulo: "University Physics, volume 3, seção 7.4, The Quantum Particle in a Box"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/7-4-the-quantum-particle-in-a-box"
quiz:
  - pergunta: "Segundo de Broglie, qual é o comprimento de onda associado a uma partícula?"
    opcoes: ["λ = h/p", "λ = p/h", "λ = m·c²"]
    resposta: 0
    explicacao: "Quanto maior o momento, menor o comprimento de onda. Para objetos do cotidiano, ele é minúsculo demais para ser notado."
  - pergunta: "Na interpretação de Born, o que representa |ψ|²?"
    opcoes: ["A energia da partícula", "A densidade de probabilidade de encontrar a partícula em cada lugar", "A carga da partícula"]
    resposta: 1
    explicacao: "A função de onda não diz onde a partícula está, mas a probabilidade de encontrá-la ali."
  - pergunta: "O que afirma o princípio da incerteza de Heisenberg?"
    opcoes: ["Que os instrumentos sempre erram", "Que não é possível conhecer ao mesmo tempo, com precisão arbitrária, a posição e o momento de uma partícula", "Que a energia não se conserva"]
    resposta: 1
    explicacao: "Δx·Δp ≥ ħ/2. É uma propriedade da natureza, não uma falha dos aparelhos."
  - pergunta: "Em uma 'partícula na caixa', o que acontece com as energias permitidas?"
    opcoes: ["Podem ter qualquer valor", "São quantizadas: só certos valores são possíveis, proporcionais a n²", "São todas zero"]
    resposta: 1
    explicacao: "Confinar uma onda obriga a energia a assumir valores discretos."
---

## Por que outra mecânica

No começo do século XX, três problemas não cabiam na física clássica: a luz emitida por corpos quentes (resolvida por Planck, em 1900, com a energia em pacotes), o efeito fotoelétrico (explicado por Einstein, em 1905, com os fótons) e a estabilidade dos átomos. A introdução está em [Física moderna](/trilhas/fisica-medio/fisica-moderna-relatividade-e-quantica). Agora vamos às ideias de fundo.

## O átomo de Bohr

Em 1913, Niels Bohr supôs que o elétron do hidrogênio só pode ocupar órbitas com energias definidas:

**Eₙ = −13,6 eV / n²**, com n = 1, 2, 3...

(1 eV, ou elétron-volt, é a energia que um elétron ganha ao atravessar uma diferença de potencial de 1 volt: 1,6 × 10⁻¹⁹ J.)

Ao passar de um nível mais alto para um mais baixo, o elétron emite um **fóton** com a diferença de energia, E = h·f.

```conta
Transição de n = 3 para n = 2 no hidrogênio:
ΔE = 13,6 × (1/2² − 1/3²) = 13,6 × (1/4 − 1/9) = 13,6 × 0,139 ≈ 1,89 eV
λ = h·c ÷ ΔE ≈ 1 240 eV·nm ÷ 1,89 eV ≈ 656 nm   (luz vermelha)
```

Essa linha vermelha aparece de fato no espectro do hidrogênio. O modelo acertava os números, mas não explicava **por que** só certas órbitas eram permitidas.

## Ondas de matéria

Em 1924, o francês **Louis de Broglie** propôs que, assim como a luz se comporta às vezes como partícula, as partículas se comportam às vezes como **onda**, com comprimento de onda:

**λ = h / p**

```conta
Elétron acelerado por 100 V:
p = √(2·m·E) = √(2 × 9,11 × 10⁻³¹ × 1,6 × 10⁻¹⁷) ≈ 5,4 × 10⁻²⁴ kg·m/s
λ = 6,63 × 10⁻³⁴ ÷ 5,4 × 10⁻²⁴ ≈ 1,2 × 10⁻¹⁰ m   (tamanho de um átomo)

Bola de 0,15 kg a 40 m/s:
λ = 6,63 × 10⁻³⁴ ÷ 6 ≈ 1,1 × 10⁻³⁴ m   (impossível de perceber)
```

A ideia foi confirmada em 1927: feixes de elétrons sofrem **difração** em cristais, como os raios X. Elétrons enviados um a um por uma fenda dupla formam, com o tempo, um padrão de interferência, como ondas. O microscópio eletrônico aproveita o comprimento de onda minúsculo dos elétrons.

Com isso, as órbitas de Bohr ganharam sentido: são aquelas em que a onda do elétron "fecha" sobre si mesma, como uma onda estacionária, vista em [Oscilações e ondas](/trilhas/fisica-superior/oscilacoes-e-ondas).

## A função de onda

Na mecânica quântica, o estado de uma partícula é descrito por uma **função de onda**, ψ (psi). Em 1926, **Max Born** deu a interpretação aceita até hoje:

> |ψ|² é a **densidade de probabilidade** de encontrar a partícula em cada ponto.

A teoria não diz onde o elétron **está**; diz a **probabilidade** de encontrá-lo em cada lugar quando se faz a medida. É uma mudança profunda em relação à física clássica, em que, conhecido o estado, tudo se prevê com certeza.

## A equação de Schrödinger

Em 1926, o austríaco **Erwin Schrödinger** escreveu a equação que governa a evolução da função de onda. Ela tem, na mecânica quântica, o papel que F = m·a tem na mecânica clássica. Resolvê-la para cada situação (um elétron preso em uma região, um átomo, uma molécula) dá os estados e as energias possíveis.

### A partícula na caixa

O caso mais simples: uma partícula de massa m presa em uma "caixa" de largura L, de onde não pode sair. Só cabem ondas com um número inteiro de meias ondas, e as energias permitidas são:

**Eₙ = n² · h² / (8·m·L²)**, com n = 1, 2, 3...

Três lições:

- a energia é **quantizada**: só certos valores;
- a energia mínima **não é zero**: uma partícula confinada nunca fica totalmente parada;
- quanto **menor** a caixa, **maiores** e mais espaçados os níveis. Isso explica por que os efeitos quânticos dominam na escala atômica e somem na escala do cotidiano.

```verificar
Se a largura da caixa é reduzida à metade, o que acontece com a energia do nível fundamental?
- Cai para a metade
+ Fica quatro vezes maior
- Não muda
> Eₙ é proporcional a 1/L².
```

## O princípio da incerteza

Em 1927, **Werner Heisenberg** mostrou que posição e momento não podem ser conhecidos ao mesmo tempo com precisão arbitrária:

**Δx · Δp ≥ ħ / 2**, com ħ = h/(2π)

Não é defeito dos instrumentos. Uma onda bem localizada no espaço precisa ser formada pela soma de muitos comprimentos de onda, ou seja, de muitos momentos diferentes. Quanto mais definido um, mais indefinido o outro.

## O efeito túnel

Na física clássica, uma bola sem energia suficiente para subir um morro nunca chega do outro lado. Na quântica, a função de onda "vaza" através de barreiras finas, e há uma probabilidade de a partícula atravessá-las. É o **efeito túnel**.

Ele explica um tipo de decaimento radioativo (o alfa), permite a fusão nuclear no interior do Sol e é usado no microscópio de tunelamento, que mostra átomos individuais, e nas memórias do tipo *flash* dos pen drives e celulares.

## Spin e o princípio de exclusão

Além da posição e da energia, o elétron tem uma propriedade quântica sem análogo clássico exato, o **spin**, com dois valores possíveis.

O **princípio de exclusão de Pauli** diz que dois elétrons de um mesmo átomo não podem ocupar exatamente o mesmo estado quântico. Por isso os elétrons não se amontoam no nível mais baixo e vão preenchendo camadas e subníveis, como se viu em [Distribuição eletrônica](/trilhas/quimica-medio/distribuicao-eletronica). A tabela periódica inteira é uma consequência da mecânica quântica.

## O debate sobre o sentido

Os criadores da teoria discordaram profundamente sobre o que ela significa. Einstein não aceitava que a natureza fosse fundamentalmente probabilística; Bohr defendia que a teoria era completa. O debate entre os dois, nas décadas de 1920 e 1930, é um dos mais famosos da história da ciência, e as questões sobre a interpretação continuam abertas. Mas as **previsões** da teoria foram confirmadas com precisão extraordinária.

## Para praticar

1. Calcule a energia do fóton emitido na transição de n = 2 para n = 1 no hidrogênio. Ele é visível?
2. Calcule o comprimento de onda de um elétron com velocidade de 10⁶ m/s.
3. Explique por que não percebemos o comportamento ondulatório de uma pessoa andando.
4. Um elétron está confinado em uma região de 0,1 nm. Estime a incerteza mínima do seu momento.

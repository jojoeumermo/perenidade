---
titulo: "Oscilações e ondas"
resumo: "Objetivo: descrever o movimento harmônico simples, o pêndulo, as oscilações amortecidas e forçadas e as ondas em cordas, incluindo ondas estacionárias, ressonância e efeito Doppler."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "University Physics, volume 1, seção 15.1, Simple Harmonic Motion"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-1/pages/15-1-simple-harmonic-motion"
  - titulo: "University Physics, volume 1, seção 15.6, Forced Oscillations"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-1/pages/15-6-forced-oscillations"
  - titulo: "University Physics, volume 1, seção 16.6, Standing Waves and Resonance"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-1/pages/16-6-standing-waves-and-resonance"
  - titulo: "University Physics, volume 1, seção 17.7, The Doppler Effect"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-1/pages/17-7-the-doppler-effect"
quiz:
  - pergunta: "No movimento harmônico simples, de que depende o período de um sistema massa-mola?"
    opcoes: ["Da amplitude", "Da massa e da constante da mola", "Só da gravidade"]
    resposta: 1
    explicacao: "T = 2π√(m/k). A amplitude não influi."
  - pergunta: "O período de um pêndulo simples, para pequenas oscilações, depende:"
    opcoes: ["Da massa da bolinha", "Do comprimento do fio e da gravidade", "Da amplitude"]
    resposta: 1
    explicacao: "T = 2π√(L/g). Foi isso que tornou o pêndulo útil para medir o tempo."
  - pergunta: "Em uma corda presa nas duas pontas, quais comprimentos de onda podem formar ondas estacionárias?"
    opcoes: ["Qualquer um", "Apenas aqueles em que cabe um número inteiro de meias ondas no comprimento da corda", "Apenas o dobro do comprimento"]
    resposta: 1
    explicacao: "λₙ = 2L/n. Daí vêm as notas fundamentais e os harmônicos dos instrumentos de corda."
  - pergunta: "Uma ambulância se aproxima com a sirene ligada. O que o pedestre ouve?"
    opcoes: ["Um som mais grave do que o emitido", "Um som mais agudo do que o emitido", "O mesmo som"]
    resposta: 1
    explicacao: "É o efeito Doppler: com a fonte se aproximando, as frentes de onda chegam mais juntas."
---

## O movimento que se repete

O coração bate, a corda do violão vibra, o prédio balança com o vento, o elétron oscila na antena. Quase todo sistema que é afastado de uma posição de equilíbrio estável e solto **oscila**. E oscilações que se propagam são **ondas**.

Esta aula aprofunda [Ondas](/trilhas/fisica-medio/ondas), do ensino médio, com as ferramentas da [Mecânica clássica](/trilhas/fisica-superior/mecanica-classica).

## O movimento harmônico simples

Uma massa m presa a uma mola de constante k, sem atrito. A força da mola obedece à **lei de Hooke**:

**F = −k·x**

O sinal negativo indica que a força sempre aponta para o equilíbrio. Pela segunda lei de Newton:

**m · d²x/dt² = −k·x**

É uma equação diferencial cuja solução é uma função senoidal:

**x(t) = A · cos(ω·t + φ)**, com **ω = √(k/m)**

- A é a **amplitude**;
- ω é a **frequência angular**;
- o **período** é T = 2π/ω = **2π√(m/k)**.

O período **não depende da amplitude**: uma oscilação grande e uma pequena levam o mesmo tempo. É a característica que define o movimento harmônico simples.

```conta
Massa de 0,5 kg em uma mola de k = 50 N/m:
ω = √(50 ÷ 0,5) = √100 = 10 rad/s
T = 2π ÷ 10 ≈ 0,63 s
```

### Energia

A energia se alterna entre cinética e potencial elástica, e o total é constante: **E = k·A²/2**. Na posição extrema, tudo é potencial; no centro, tudo é cinética.

## O pêndulo

Para pequenas oscilações, o pêndulo simples também faz movimento harmônico, com período:

**T = 2π√(L/g)**

O período não depende da massa nem (para ângulos pequenos) da amplitude. Galileu observou essa regularidade, e ela permitiu, no século XVII, os primeiros relógios de pêndulo precisos. Medindo L e T, pode-se medir g.

## Oscilações amortecidas e forçadas

Na prática, há atrito. A amplitude cai com o tempo: a oscilação é **amortecida**. Os amortecedores dos carros existem para isso: sem eles, o carro ficaria pulando depois de cada buraco.

Quando uma força externa periódica age sobre o sistema, a oscilação é **forçada**. Se a frequência da força se aproxima da **frequência natural** do sistema, a amplitude cresce muito: é a **ressonância**. Ela é útil (sintonizar um rádio) e perigosa (estruturas que vibram com o vento, máquinas ou passos). Engenheiros projetam pontes e prédios para que as suas frequências naturais fiquem longe das frequências que vão encontrar.

```verificar
Por que um amortecedor gasto deixa o carro "quicando" depois de um buraco?
- Porque aumenta a massa do carro
+ Porque o amortecimento ficou fraco, e a oscilação da mola demora a se apagar
- Porque muda a frequência do motor
> O amortecedor tira energia da oscilação. Sem ele, o que sobra?
```

## Ondas em uma corda

Uma perturbação em uma corda tensa se propaga. A velocidade depende só da corda:

**v = √(T/μ)**

em que T é a tensão e μ é a massa por unidade de comprimento. Corda mais esticada, onda mais rápida; corda mais grossa, onda mais lenta.

Uma onda senoidal que viaja no sentido positivo de x é descrita por:

**y(x, t) = A · sen(k·x − ω·t)**

com **k = 2π/λ** (número de onda) e **ω = 2π·f**. A velocidade é v = ω/k = λ·f.

### Superposição e ondas estacionárias

Duas ondas no mesmo lugar **se somam** (princípio da superposição). Em uma corda presa nas duas pontas, a onda vai e volta, e a soma das duas forma uma **onda estacionária**: há pontos que nunca se movem (**nós**) e pontos que vibram ao máximo (**ventres**).

Só alguns comprimentos de onda cabem na corda:

**λₙ = 2L/n** e **fₙ = n · v/(2L)**, com n = 1, 2, 3...

- n = 1 é a **frequência fundamental**, a nota que se ouve;
- n = 2, 3... são os **harmônicos**, que dão o **timbre** de cada instrumento.

Apertar a corda do violão contra o traste encurta L e sobe a nota. Apertar a tarraxa aumenta a tensão e também sobe a nota. Veja a ferramenta [afinador](/ferramentas/afinador).

## Som e efeito Doppler

O som é uma onda longitudinal de pressão. Quando a **fonte** ou o **ouvinte** se movem, a frequência percebida muda:

- aproximação: frequência **maior** (mais agudo);
- afastamento: frequência **menor** (mais grave).

É o **efeito Doppler**. Ele é usado nos radares de velocidade, no ultrassom Doppler, que mede o fluxo de sangue nos vasos, e na astronomia: a luz de galáxias que se afastam chega "esticada" para o vermelho, uma das evidências de que o universo se expande.

## Para praticar

1. Calcule o período de uma massa de 2 kg presa a uma mola de 200 N/m.
2. Qual deve ser o comprimento de um pêndulo com período de 2 s? (Use g = 9,8 m/s².)
3. Uma corda de 0,65 m vibra com frequência fundamental de 110 Hz. Qual é a velocidade da onda na corda?
4. Por que soldados quebram o passo ao atravessar uma ponte? Use a palavra ressonância.

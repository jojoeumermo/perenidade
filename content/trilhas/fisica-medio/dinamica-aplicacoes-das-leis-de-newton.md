---
titulo: "Dinâmica: aplicações das leis de Newton"
resumo: "Objetivo: aplicar as leis de Newton a situações com peso, força normal, atrito e tração, incluindo o elevador e o plano inclinado."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 4.1, Force"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/4-1-force"
  - titulo: "Physics, seção 4.3, Newton's Second Law of Motion"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/4-3-newtons-second-law-of-motion"
  - titulo: "Physics, seção 5.4, Inclined Planes"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/5-4-inclined-planes"
quiz:
  - pergunta: "Uma força resultante de 40 N age sobre uma caixa de 20 kg. Qual é a aceleração?"
    opcoes: ["2 m/s²", "800 m/s²", "0,5 m/s²"]
    resposta: 0
    explicacao: "Pela segunda lei, a = F ÷ m = 40 ÷ 20 = 2 m/s²."
  - pergunta: "Um livro está parado sobre a mesa. Que força equilibra o peso do livro?"
    opcoes: ["O atrito", "A força normal, exercida pela mesa", "A tração"]
    resposta: 1
    explicacao: "A mesa empurra o livro para cima com uma força perpendicular à superfície."
  - pergunta: "De que depende a força de atrito entre uma caixa e o chão?"
    opcoes: ["Do tipo das superfícies e da força normal", "Só da área de contato", "Só da cor da caixa"]
    resposta: 0
    explicacao: "A força de atrito é o coeficiente de atrito multiplicado pela força normal."
  - pergunta: "Um elevador sobe acelerando. O que a pessoa dentro dele sente?"
    opcoes: ["Que está mais leve", "Que está mais pesada", "Nenhuma diferença"]
    resposta: 1
    explicacao: "O piso precisa empurrá-la com força maior que o peso para acelerá-la para cima."
---

## A ferramenta central

A **dinâmica** estuda as causas do movimento. A sua ferramenta principal é a segunda lei de Newton, vista em [Força e as leis de Newton](/trilhas/fisica-fundamental/forca-e-as-leis-de-newton):

**F resultante = m · a**

A força que entra na conta é a **resultante**: a soma [vetorial](/trilhas/fisica-medio/vetores) de todas as forças que agem sobre o corpo. Se a resultante é zero, o corpo está parado ou em movimento retilíneo uniforme.

O método é sempre o mesmo:

1. isolar o corpo e **desenhar todas as forças** que agem sobre ele;
2. escolher os eixos (em geral, um na direção do movimento);
3. aplicar F resultante = m · a em cada eixo.

## As forças mais comuns

| Força | O que é | Como calcular |
| --- | --- | --- |
| **Peso** (P) | atração da Terra sobre o corpo; aponta para baixo | P = m · g |
| **Normal** (N) | força com que a superfície empurra o corpo; perpendicular à superfície | depende da situação |
| **Atrito** (Fat) | resiste ao deslizamento; paralela à superfície | Fat = μ · N |
| **Tração** (T) | força transmitida por corda, cabo ou corrente | depende da situação |

Usaremos g = 10 m/s². Um corpo de 20 kg pesa, então, 200 N.

## Atrito

O **atrito** aparece quando uma superfície desliza, ou tenta deslizar, sobre outra.

- **Atrito estático**: age enquanto o corpo ainda não se moveu. Cresce conforme você empurra, até um valor máximo.
- **Atrito cinético**: age quando o corpo já está deslizando. Costuma ser um pouco menor que o estático máximo. Por isso é mais difícil **começar** a empurrar um móvel do que mantê-lo andando.

A intensidade é **Fat = μ · N**, em que μ (letra grega "mi") é o **coeficiente de atrito**, um número que depende do par de superfícies. Borracha sobre asfalto seco tem coeficiente alto; sobre asfalto molhado, bem menor.

O atrito não é só um estorvo. Sem ele, ninguém andaria, nenhum carro frearia e nenhum prego ficaria na parede.

```conta
Uma caixa de 20 kg é empurrada sobre o piso com força horizontal de 100 N.
O coeficiente de atrito cinético é 0,3.
peso: P = 20 × 10 = 200 N
normal: N = 200 N (equilibra o peso)
atrito: Fat = 0,3 × 200 = 60 N
resultante: 100 − 60 = 40 N
aceleração: a = 40 ÷ 20 = 2 m/s²
```

## No elevador

Sobre uma pessoa em pé no elevador agem duas forças: o **peso**, para baixo, e a **normal** do piso, para cima. A sensação de peso que temos é, na verdade, a normal.

| Situação | Normal | Sensação |
| --- | --- | --- |
| parado ou em velocidade constante | N = m·g | normal |
| acelerando para cima | N = m·(g + a) | mais pesado |
| acelerando para baixo | N = m·(g − a) | mais leve |
| em queda livre (a = g) | N = 0 | ausência de peso |

```conta
Uma pessoa de 70 kg em um elevador que sobe acelerando a 2 m/s².
N = 70 × (10 + 2) = 840 N
(parada, a normal seria 700 N)
```

O último caso da tabela explica os astronautas "flutuando": eles **não** estão fora do alcance da gravidade. Estão em queda livre permanente ao redor da Terra, junto com a nave. Veja em [Gravitação universal](/trilhas/fisica-medio/gravitacao-universal).

```verificar
Um elevador desce com velocidade constante. A força que o piso faz sobre uma pessoa de 60 kg é:
- Menor que 600 N
+ Igual a 600 N
- Maior que 600 N
> Velocidade constante quer dizer aceleração zero. Qual é, então, a resultante?
```

## No plano inclinado

Em uma rampa, o peso continua apontando para baixo, mas convém **decompô-lo** em duas partes:

- uma **paralela à rampa**, que puxa o corpo para baixo: **P · sen θ**;
- uma **perpendicular à rampa**, que o aperta contra ela: **P · cos θ**.

Sem atrito, a aceleração de descida é **a = g · sen θ**, e não depende da massa.

```conta
Rampa de 30°, sem atrito (sen 30° = 0,5).
a = 10 × 0,5 = 5 m/s²
```

Quanto menor a inclinação, menor a força necessária para subir uma carga, e maior a distância a percorrer. É a troca que faz da rampa uma [máquina simples](/trilhas/fisica-fundamental/maquinas-simples), e a razão de as rampas de acessibilidade serem longas e suaves.

## Tração e polias

Uma corda ideal transmite a força de uma ponta à outra. Uma **polia fixa** só muda a direção da força: para erguer um balde de 200 N com velocidade constante, é preciso puxar com 200 N. Uma **polia móvel** divide o peso entre dois trechos de corda: bastam 100 N, mas é preciso puxar o dobro de corda.

## Para praticar

1. Um carro de 1 000 kg acelera a 3 m/s². Qual é a força resultante?
2. Um armário de 50 kg precisa ser arrastado em um piso com coeficiente de atrito 0,4. Que força mínima é necessária para mantê-lo em movimento?
3. Uma pessoa de 80 kg está em um elevador que desce acelerando a 1 m/s². Qual é a força normal?
4. Desenhe as forças sobre uma caixa parada em uma rampa com atrito. O que impede a caixa de descer?

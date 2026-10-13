---
titulo: "Trabalho, energia e potência"
resumo: "Objetivo: calcular trabalho, energia cinética, energia potencial e potência, e usar a conservação da energia mecânica para resolver problemas."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 9.1, Work, Power, and the Work–Energy Theorem"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/9-1-work-power-and-the-work-energy-theorem"
  - titulo: "Physics, seção 9.2, Mechanical Energy and Conservation of Energy"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/9-2-mechanical-energy-and-conservation-of-energy"
quiz:
  - pergunta: "Em física, quando uma força realiza trabalho?"
    opcoes: ["Sempre que alguém se cansa", "Quando a força age sobre um corpo que se desloca na direção dela", "Só quando há atrito"]
    resposta: 1
    explicacao: "Sem deslocamento, o trabalho é zero, mesmo que haja esforço."
  - pergunta: "Se a velocidade de um carro dobra, o que acontece com a sua energia cinética?"
    opcoes: ["Dobra", "Fica quatro vezes maior", "Fica igual"]
    resposta: 1
    explicacao: "A energia cinética depende do quadrado da velocidade: Ec = m·v² ÷ 2."
  - pergunta: "Qual é a unidade de potência no Sistema Internacional?"
    opcoes: ["Joule", "Watt", "Newton"]
    resposta: 1
    explicacao: "Um watt é um joule por segundo."
  - pergunta: "Dois pedreiros erguem baldes iguais à mesma altura. Um leva 10 s e o outro, 20 s. O que se pode afirmar?"
    opcoes: ["Realizaram o mesmo trabalho, mas o primeiro com o dobro da potência", "O primeiro realizou mais trabalho", "Tiveram a mesma potência"]
    resposta: 0
    explicacao: "O trabalho é o mesmo (mesma força, mesma altura); a potência mede a rapidez."
---

## Trabalho, no sentido da física

No dia a dia, "trabalho" é qualquer esforço. Em física, a palavra é mais restrita: uma força realiza **trabalho** quando age sobre um corpo que **se desloca**.

**W = F · d · cos θ**

em que F é a força, d é o deslocamento e θ é o ângulo entre os dois. Quando a força tem a mesma direção e o mesmo sentido do deslocamento, a conta se reduz a **W = F · d**.

A unidade é o **joule** (J): 1 J = 1 N × 1 m.

Três consequências:

- quem segura um saco de cimento parado **não realiza trabalho** no sentido da física, embora se canse (os músculos gastam energia para se manter contraídos);
- força **perpendicular** ao deslocamento não realiza trabalho: carregar o saco na horizontal, com velocidade constante, não exige trabalho da força que o sustenta;
- força **contrária** ao deslocamento realiza trabalho negativo: é o caso do atrito, que tira energia do corpo.

```conta
Um pedreiro ergue um balde de 20 kg a 3 m de altura.
força necessária: P = 20 × 10 = 200 N
trabalho: W = 200 × 3 = 600 J
```

## Energia: a capacidade de realizar trabalho

Esta aula aprofunda [Energia e suas transformações](/trilhas/fisica-fundamental/energia-e-suas-transformacoes).

### Energia cinética

É a energia do **movimento**:

**Ec = m · v² ÷ 2**

```conta
Carro de 1 000 kg.
a 20 m/s (72 km/h): Ec = 1 000 × 400 ÷ 2 = 200 000 J
a 40 m/s (144 km/h): Ec = 1 000 × 1 600 ÷ 2 = 800 000 J
```

O dobro da velocidade, **quatro vezes** a energia. Em uma batida, é essa energia que amassa a lataria e fere as pessoas. Por isso um pequeno excesso de velocidade aumenta muito a gravidade de um acidente.

O **teorema trabalho-energia** liga as duas ideias: o trabalho da força resultante é igual à **variação da energia cinética** do corpo.

### Energia potencial gravitacional

É a energia guardada por um corpo por causa da **altura**:

**Ep = m · g · h**

O balde erguido a 3 m guardou os 600 J que o pedreiro lhe deu. Se cair, devolve.

## Conservação da energia mecânica

A soma da energia cinética com a potencial é a **energia mecânica**. Quando não há atrito nem resistência do ar, ela **se conserva**: o que se perde de uma forma aparece na outra.

**Ec + Ep = constante**

```conta
Uma manga se solta do galho a 5 m de altura. Com que velocidade chega ao chão?
no alto: Ep = m × 10 × 5 = 50·m     Ec = 0
no chão: Ep = 0                      Ec = m·v² ÷ 2
50·m = m·v² ÷ 2
v² = 100
v = 10 m/s (36 km/h)
```

A massa se cancela: o resultado vale para qualquer manga.

Em uma usina hidrelétrica, a ideia é a mesma em escala enorme: a água represada no alto tem energia potencial; ao descer, ganha energia cinética, gira as turbinas e o gerador a transforma em energia elétrica.

### E quando há atrito?

A energia mecânica diminui, mas **a energia total não some**: a parte que falta virou **calor**. Esfregue as mãos e sinta. Nenhuma máquina devolve em trabalho útil toda a energia que recebe.

```verificar
Um carrinho de montanha-russa parte do repouso do ponto mais alto. Desprezando o atrito, em que ponto ele tem a maior velocidade?
- No ponto mais alto
+ No ponto mais baixo
- A velocidade é a mesma em todo o percurso
> Onde a energia potencial é menor, a cinética é maior.
```

## Potência

Dois guindastes erguem a mesma carga à mesma altura: o trabalho é igual. Se um leva a metade do tempo, ele é mais **potente**.

**P = W ÷ Δt**

A unidade é o **watt** (W): 1 W = 1 J/s.

```conta
O pedreiro do exemplo ergue o balde (600 J) em 10 s.
P = 600 ÷ 10 = 60 W
```

Outras unidades:

- **quilowatt** (kW) = 1 000 W;
- **cavalo-vapor** (cv) ≈ 735,5 W. Um motor de 100 cv tem cerca de 73,5 kW.

O **quilowatt-hora** (kWh) da conta de luz, apesar do nome, é unidade de **energia**: a energia consumida por um aparelho de 1 kW ligado durante 1 hora, o que dá 3 600 000 J.

## Rendimento

Nenhuma máquina aproveita toda a energia que recebe. O **rendimento** é a fração aproveitada:

**rendimento = energia útil ÷ energia total recebida**

Um motor que recebe 1 000 J do combustível e entrega 300 J de trabalho tem rendimento de 30%. Os outros 700 J saem como calor. Um motor elétrico tem rendimento bem maior que um motor a combustão. O porquê está na aula de [Termodinâmica](/trilhas/fisica-medio/termodinamica).

## Para praticar

1. Que trabalho se realiza ao empurrar um carrinho com força de 150 N por 20 m?
2. Calcule a energia cinética de uma moto de 200 kg (com o piloto) a 20 m/s e a 30 m/s.
3. Uma bomba eleva 600 kg de água a 10 m de altura em 1 minuto. Qual é a potência útil?
4. De que altura um objeto precisa cair para chegar ao chão a 20 m/s?

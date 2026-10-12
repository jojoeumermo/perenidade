---
titulo: "Limites"
resumo: "A ideia de chegar tão perto quanto se queira: o conceito que sustenta todo o cálculo."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Calculus Volume 1, seção 2.2, The Limit of a Function"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-1/pages/2-2-the-limit-of-a-function"
  - titulo: "Calculus Volume 1, seção 2.3, The Limit Laws"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-1/pages/2-3-the-limit-laws"
  - titulo: "Calculus Volume 1, seção 2.4, Continuity"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-1/pages/2-4-continuity"
quiz:
  - pergunta: "Quanto vale o limite de (x² − 9) ÷ (x − 3) quando x tende a 3?"
    opcoes: ["Não existe, porque há divisão por zero", "6", "0"]
    resposta: 1
    explicacao: "Para x diferente de 3, a expressão é igual a x + 3. Quando x se aproxima de 3, ela se aproxima de 6."
  - pergunta: "O limite de uma função em um ponto depende do valor da função nesse ponto?"
    opcoes: ["Sim, sempre", "Não: depende só dos valores perto do ponto", "Só se a função for crescente"]
    resposta: 1
    explicacao: "O limite descreve a tendência nas vizinhanças. A função pode nem estar definida no ponto."
  - pergunta: "Quanto vale o limite de 1/x quando x cresce sem parar?"
    opcoes: ["Infinito", "1", "0"]
    resposta: 2
    explicacao: "Dividir 1 por números cada vez maiores dá resultados cada vez mais próximos de zero."
---

Nesta trilha, o sinal ^ quer dizer "elevado a", e "x → a" lê-se "x tende a a".

## Chegar perto

Considere a função

f(x) = (x² − 1) ÷ (x − 1)

Em x = 1, ela não está definida: daria 0 ÷ 0. Mas o que acontece **perto** de 1?

| x | 0,9 | 0,99 | 0,999 | 1 | 1,001 | 1,01 | 1,1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| f(x) | 1,9 | 1,99 | 1,999 | ? | 2,001 | 2,01 | 2,1 |

Dos dois lados, os valores se aproximam de 2. Diz-se que **o limite de f(x), quando x tende a 1, é 2**:

lim (x → 1) f(x) = 2

A álgebra confirma: como x² − 1 = (x − 1)(x + 1), para todo x diferente de 1 a função é igual a x + 1. Perto de 1, x + 1 fica perto de 2.

O ponto central: **o limite não depende do que acontece no ponto**, e sim do que acontece em volta dele. A função pode não existir ali, ou valer outra coisa. O limite descreve uma tendência.

## Por que isso importa

O limite é a resposta a problemas que pareciam sem saída:

- **Velocidade em um instante.** Velocidade é distância dividida por tempo. Em um instante, o tempo decorrido é zero. Como dividir por zero? Tomando intervalos cada vez menores e vendo para onde a razão tende. É a [derivada](/trilhas/matematica-superior/derivadas).
- **Área de uma figura curva.** Somando retângulos cada vez mais finos e vendo para onde a soma tende. É a [integral](/trilhas/matematica-superior/integrais).
- **Somas com infinitas parcelas.** 1/2 + 1/4 + 1/8 + ... nunca "termina", mas as somas parciais tendem a 1.

Esse último caso resolve um paradoxo de 2.400 anos. O grego Zenão argumentava que o veloz Aquiles nunca alcançaria uma tartaruga que saísse na frente: quando ele chegasse aonde ela estava, ela já teria andado um pouco; quando chegasse lá, mais um pouco; e assim sem fim. A falha do argumento está em supor que infinitas etapas somam um tempo infinito. Elas somam um tempo finito, e depois dele Aquiles passa.

## Limites laterais

Às vezes a função tende a valores diferentes conforme o lado pelo qual se chega.

Um estacionamento cobra R$ 8 até uma hora e R$ 11 a partir daí. Chegando a 1 hora por baixo (59 minutos, 59 minutos e meio...), o preço tende a 8. Chegando por cima, tende a 11. Os **limites laterais** existem e são diferentes; por isso, **o limite em x = 1 não existe**. A função dá um salto.

O limite só existe quando os dois lados concordam.

## Infinito

O infinito não é um número, mas serve para descrever duas situações.

**A função cresce sem parar perto de um ponto.** Em f(x) = 1/x², quanto mais x se aproxima de 0, maior o resultado: 100, 10.000, 1.000.000... Escreve-se lim (x → 0) 1/x² = +∞.

**O x cresce sem parar.** Em f(x) = 1/x, quando x aumenta, o resultado se aproxima de 0: lim (x → ∞) 1/x = 0.

Para frações com polinômios, um truque: divida tudo pela maior potência de x.

```conta
lim (x → ∞) (2x + 1) ÷ (x + 3)
= lim (2 + 1/x) ÷ (1 + 3/x)
= 2 ÷ 1 = 2
```

Os termos 1/x e 3/x tendem a zero; sobra o que manda no longo prazo.

```verificar
Quanto vale o limite de (5x − 2) ÷ (x + 1) quando x tende ao infinito?
- Infinito
+ 5
- −2
> Divida o numerador e o denominador por x e veja o que sobra.
```

## Regras de cálculo

Quando os limites de f e de g em um ponto existem:

- o limite da soma é a soma dos limites;
- o limite do produto é o produto dos limites;
- o limite do quociente é o quociente dos limites, desde que o limite de baixo não seja zero.

Para polinômios, isso significa que basta **substituir**: lim (x → 2) (3x + 1) = 7. A dificuldade só aparece quando a substituição dá 0 ÷ 0 ou ∞ ÷ ∞, as chamadas **formas indeterminadas**. Nesses casos é preciso simplificar antes, como no exemplo do começo.

## Continuidade

Uma função é **contínua** em um ponto quando três coisas acontecem: ela está definida ali, o limite existe ali, e os dois coincidem.

lim (x → a) f(x) = f(a)

A imagem informal é a do gráfico traçado sem tirar o lápis do papel. Polinômios, exponenciais, seno e cosseno são contínuos em toda parte. A tarifa do estacionamento, não.

## Um limite famoso

Um banco paga 100% de juros ao ano. Se os juros forem creditados uma vez, R$ 1 vira R$ 2. Se forem creditados em duas metades de 50%, vira 1,5² = 2,25. Em doze parcelas mensais, (1 + 1/12)^12 ≈ 2,61. E se forem creditados a cada instante?

| n (parcelas) | 1 | 10 | 100 | 1.000 |
| --- | --- | --- | --- | --- |
| (1 + 1/n)^n | 2 | 2,5937 | 2,7048 | 2,7169 |

O valor não cresce sem parar. Ele tende a um número: **e ≈ 2,71828**, a base dos logaritmos naturais. O suíço Jacob Bernoulli chegou a ele em 1683, estudando justamente juros compostos. O número e reaparece em todo fenômeno em que a taxa de crescimento é proporcional ao tamanho, das populações à radioatividade.

## A definição rigorosa

Newton e Leibniz criaram o cálculo no século XVII usando quantidades "infinitamente pequenas", sem definir bem o que eram. O bispo e filósofo George Berkeley zombou delas, em 1734, chamando-as de "fantasmas de quantidades desaparecidas". O cálculo funcionava, mas a crítica era justa.

A resposta veio no século XIX, com Augustin-Louis Cauchy e Karl Weierstrass. Na definição que usamos hoje, não há infinitamente pequenos, só desigualdades:

> O limite de f(x) quando x tende a a é L se, **para qualquer margem de tolerância** em torno de L, por menor que seja, existe uma vizinhança de a dentro da qual todos os valores de f(x) (com x diferente de a) ficam dentro da tolerância.

É um desafio e uma resposta: você escolhe quão perto de L quer ficar (a tolerância, tradicionalmente chamada de épsilon), e eu tenho de mostrar quão perto de a é preciso estar (o delta). Se eu sempre conseguir responder, o limite é L.

## Para praticar

1. Calcule lim (x → 2) (3x + 1).
2. Calcule lim (x → 3) (x² − 9) ÷ (x − 3).
3. Calcule lim (x → ∞) (4x² + 1) ÷ (2x² − x).
4. A função f(x) = |x| ÷ x tem limite quando x tende a 0? Calcule os limites laterais.
5. A função que dá o preço do estacionamento do exemplo é contínua em x = 1? E em x = 0,5?

**Respostas:** 1) 7. 2) 6. 3) 2. 4) Não: pela esquerda o limite é −1; pela direita, 1. 5) Não é contínua em 1 (há um salto); é contínua em 0,5.

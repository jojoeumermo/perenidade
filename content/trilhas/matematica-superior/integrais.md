---
titulo: "Integrais"
resumo: "Somar infinitas fatias: áreas, distâncias, o Teorema Fundamental do Cálculo e a ligação com a derivada."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Calculus Volume 1, seção 5.1, Approximating Areas"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-1/pages/5-1-approximating-areas"
  - titulo: "Calculus Volume 1, seção 5.2, The Definite Integral"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-1/pages/5-2-the-definite-integral"
  - titulo: "Calculus Volume 1, seção 5.3, The Fundamental Theorem of Calculus"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-1/pages/5-3-the-fundamental-theorem-of-calculus"
quiz:
  - pergunta: "Quanto vale a integral de x² entre 0 e 1?"
    opcoes: ["1", "1/2", "1/3"]
    resposta: 2
    explicacao: "Uma primitiva de x² é x³/3. Entre 0 e 1: 1/3 − 0 = 1/3."
  - pergunta: "O que afirma o Teorema Fundamental do Cálculo?"
    opcoes: ["Que toda função tem máximo", "Que derivar e integrar são operações inversas", "Que toda curva é uma parábola"]
    resposta: 1
    explicacao: "A integral de uma função entre a e b é a diferença dos valores de uma primitiva dela: F(b) − F(a)."
  - pergunta: "Se v(t) é a velocidade de um carro, o que representa a integral de v(t) entre dois instantes?"
    opcoes: ["A aceleração", "A distância percorrida nesse intervalo", "A velocidade média"]
    resposta: 1
    explicacao: "Velocidade vezes tempo dá distância. A integral soma essas pequenas distâncias ao longo do intervalo."
---

## O problema da área

A área de um retângulo é base vezes altura. E a área debaixo de uma curva?

Tome f(x) = x², entre x = 0 e x = 1. A ideia é antiga: **cobrir a região com retângulos estreitos** e somar.

Com quatro retângulos de largura 0,25, usando a altura da curva no lado direito de cada um:

```conta
(0,25² + 0,5² + 0,75² + 1²) × 0,25
= (0,0625 + 0,25 + 0,5625 + 1) × 0,25
= 0,46875
```

Esses retângulos passam um pouco da curva. Usando a altura do lado esquerdo, eles ficam por baixo, e a soma dá 0,21875. A área verdadeira está entre os dois valores.

Com mais retângulos, mais finos, as duas somas se apertam. No [limite](/trilhas/matematica-superior/limites), quando o número de retângulos tende ao infinito, as duas tendem ao mesmo valor: **1/3**.

Esse limite é a **integral definida**:

∫ (de 0 a 1) x² dx = 1/3

O sinal ∫ é um S esticado, de "soma". O "dx" lembra a largura de cada fatia.

Arquimedes, no século III a.C., calculou áreas limitadas por parábolas com um raciocínio desse tipo, quase dois mil anos antes de o cálculo existir.

## O atalho

Somar infinitos retângulos toda vez seria impraticável. O que tornou o cálculo uma ferramenta universal foi a descoberta de que **integrar é o inverso de derivar**.

Uma **primitiva** de f é uma função F cuja derivada é f. Uma primitiva de x² é x³/3, porque a derivada de x³/3 é x².

O **Teorema Fundamental do Cálculo** diz:

∫ (de a a b) f(x) dx = F(b) − F(a)

Para o nosso exemplo:

```conta
F(x) = x³/3
F(1) − F(0) = 1/3 − 0
= 1/3
```

Uma conta de duas linhas, no lugar de um limite de somas. A área, que é um problema de geometria, e a taxa de variação, que é um problema de movimento, são duas faces da mesma coisa.

## Tabela de primitivas

Lendo ao contrário a tabela de [derivadas](/trilhas/matematica-superior/derivadas):

| Função | Primitiva |
| --- | --- |
| x^n (n diferente de −1) | x^(n + 1) ÷ (n + 1) + C |
| 1/x | ln \|x\| + C |
| e^x | e^x + C |
| cos x | sen x + C |
| sen x | −cos x + C |

O **C** é uma constante qualquer. Ele aparece porque a derivada de uma constante é zero: x², x² + 5 e x² − 100 têm todas a mesma derivada, 2x. A primitiva sem limites de integração chama-se **integral indefinida**. Na integral definida, o C se cancela na subtração.

Valem também: a integral da soma é a soma das integrais, e uma constante multiplicando sai para fora.

**Exemplo:** ∫ (4x³ − 6x + 2) dx = x⁴ − 3x² + 2x + C.

```verificar
Quanto vale a integral de 2x entre 1 e 3?
- 4
+ 8
- 9
> Uma primitiva de 2x é x². Calcule 3² − 1².
```

## Integral é acúmulo

A área é só a imagem mais fácil. A integral serve para somar qualquer coisa que se acumula a uma taxa variável.

**Distância.** Se a velocidade é v(t) = 10t, a distância percorrida entre 0 e 3 segundos é

```conta
∫ (de 0 a 3) 10t dt = [5t²] entre 0 e 3
= 45 − 0 = 45 metros
```

É o caminho de volta do exemplo da aula de derivadas: lá, derivamos a posição 5t² para achar a velocidade 10t; aqui, integramos a velocidade para recuperar a distância.

**Energia.** A conta de luz cobra energia, em quilowatts-hora. A potência que a casa puxa da rede varia a cada instante: sobe quando o chuveiro liga, cai de madrugada. A energia do mês é a integral da potência ao longo do tempo. O medidor é uma máquina de integrar.

**Água.** A vazão de um rio varia ao longo do dia. O volume que passou é a integral da vazão.

Em todos os casos: **taxa × tempo = quantidade**, somada fatia por fatia.

## Uma integral que mede a desigualdade

Na aula sobre o [índice de Gini](/trilhas/estatistica-para-ler-o-brasil/desigualdade-o-indice-de-gini), a população é posta em fila, do mais pobre ao mais rico, e a curva de Lorenz, L(x), dá a parte da renda total que fica com a fração x mais pobre da população. Na igualdade perfeita, L(x) = x.

O índice de Gini compara a área debaixo da curva de Lorenz com a área debaixo da reta da igualdade, e pode ser escrito assim:

G = 1 − 2 × ∫ (de 0 a 1) L(x) dx

Se a curva de Lorenz de um país fosse L(x) = x², teríamos:

```conta
∫ (de 0 a 1) x² dx = 1/3
G = 1 − 2 × 1/3
= 1/3, ou cerca de 0,33
```

E se fosse L(x) = x³, uma curva mais "barriguda"? A integral vale 1/4 e o índice sobe para 0,5. O número que aparece no noticiário é, no fundo, uma área.

## Quando não há fórmula

Muitas funções não têm primitiva que se escreva com as funções usuais. A curva do sino, da distribuição normal, é o exemplo mais conhecido. Nesses casos, volta-se à ideia original: somam-se muitos retângulos (ou trapézios), agora com o computador. É a **integração numérica**, usada todos os dias na engenharia, na meteorologia e na estatística.

## Para praticar

1. Calcule ∫ (de 0 a 2) 3x² dx.
2. Ache a primitiva de f(x) = 4x³ − 6x + 2.
3. Calcule a área debaixo de f(x) = x entre 0 e 4, pela integral e pela fórmula do triângulo.
4. A velocidade de um objeto é v(t) = 3t² (em m/s). Que distância ele percorre entre t = 0 e t = 2?
5. Uma torneira despeja água a uma vazão de 2 + t litros por minuto, em que t é o tempo em minutos. Quantos litros saem nos primeiros 4 minutos?

**Respostas:** 1) 8. 2) x⁴ − 3x² + 2x + C. 3) 8, nos dois casos. 4) 8 m. 5) [2t + t²/2] entre 0 e 4 = 8 + 8 = 16 litros.
